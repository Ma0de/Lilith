package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"

	"lilith-app/server"
	"lilith-app/storage"

	"github.com/joho/godotenv"
)

//go:embed web/out/*
var frontendFS embed.FS

var globalStore *storage.MemoryStore

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Println("未找到 .env 文件，使用系统环境变量")
	}

	err = initStorage()
	if err != nil {
		log.Fatalf("初始化存储失败: %v", err)
	}
	defer closeStorage()

	llmBaseURL := os.Getenv("LLM_BASE_URL")
	llmAPIKey := os.Getenv("LLM_API_KEY")
	llmModelName := os.Getenv("LLM_MODEL_NAME")

	if llmBaseURL == "" {
		log.Fatal("LLM_BASE_URL 未设置")
	}
	if llmAPIKey == "" {
		log.Fatal("LLM_API_KEY 未设置")
	}
	if llmModelName == "" {
		log.Fatal("LLM_MODEL_NAME 未设置")
	}

	server.InitAgent(llmBaseURL, llmAPIKey, llmModelName, storageGetMemory, storageSetMemory)

	server.InitRoutes()

	staticFS, err := fs.Sub(frontendFS, "web/out")
	if err != nil {
		log.Fatal(err)
	}

	http.Handle("/", http.FileServer(http.FS(staticFS)))

	log.Println("Lilith 启动成功: http://localhost:8080")
	log.Println("WebSocket 端点: ws://localhost:8080/ws")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func initStorage() error {
	var err error
	globalStore, err = storage.NewMemoryStore("./lilith_memory.json")
	return err
}

func closeStorage() {
	if globalStore != nil {
		globalStore.Close()
	}
}

func storageGetMemory(listName string) (*server.MemoryList, error) {
	if globalStore == nil {
		return nil, nil
	}
	storageList, err := globalStore.Get(listName)
	if err != nil {
		return nil, err
	}
	if storageList == nil {
		return nil, nil
	}

	agentItems := make([]server.MemoryItem, len(storageList.Items))
	for i, item := range storageList.Items {
		agentItems[i] = server.MemoryItem{
			Value:   item.Value,
			IsFuzzy: item.IsFuzzy,
		}
	}

	return &server.MemoryList{
		Version:    storageList.Version,
		Items:      agentItems,
		UpdateTime: storageList.UpdateAt,
	}, nil
}

func storageSetMemory(listName string, list *server.MemoryList) error {
	if globalStore == nil {
		return nil
	}

	storageItems := make([]storage.MemoryItem, len(list.Items))
	for i, item := range list.Items {
		storageItems[i] = storage.MemoryItem{
			Value:   item.Value,
			IsFuzzy: item.IsFuzzy,
		}
	}

	return globalStore.Set(listName, &storage.MemoryList{
		Version:  list.Version,
		Items:    storageItems,
		UpdateAt: list.UpdateTime,
	})
}

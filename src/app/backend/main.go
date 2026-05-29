package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
)

//go:embed web/out/*
var frontendFS embed.FS

func main() {
	// 获取 web/out 目录下的文件系统
	staticFS, err := fs.Sub(frontendFS, "web/out")
	if err != nil {
		log.Fatal(err)
	}

	// 托管前端静态文件
	http.Handle("/", http.FileServer(http.FS(staticFS)))

	log.Println("Lilith 启动成功: http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

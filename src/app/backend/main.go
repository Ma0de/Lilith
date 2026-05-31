package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"

	"lilith-app/server"
)

//go:embed web/out/*
var frontendFS embed.FS

func main() {
	// 初始化路由（必须在托管静态文件之前）
	server.InitRoutes()

	// 获取 web/out 目录下的文件系统
	staticFS, err := fs.Sub(frontendFS, "web/out")
	if err != nil {
		log.Fatal(err)
	}

	// 托管前端静态文件
	http.Handle("/", http.FileServer(http.FS(staticFS)))

	log.Println("Lilith 启动成功: http://localhost:8080")
	log.Println("WebSocket 端点: ws://localhost:8080/ws")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

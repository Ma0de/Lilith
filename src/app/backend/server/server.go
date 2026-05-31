package server

import "net/http"

func InitRoutes() {
	http.HandleFunc("/ws", HandleWebSocket)
}

package server

import (
	"lilith-app/agent"
	"net/http"
)

func SetAgent(ag *agent.Agent) {
	globalAgent = ag
}

func InitRoutes() {
	http.HandleFunc("/ws", HandleWebSocket)
}

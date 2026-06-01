package llm

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

type OpenAIClient struct {
	baseURL    string
	apiKey     string
	modelName  string
	httpClient *http.Client
}

func NewOpenAIClient(baseURL, apiKey, modelName string) *OpenAIClient {
	return &OpenAIClient{
		baseURL:   baseURL,
		apiKey:    apiKey,
		modelName: modelName,
		httpClient: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

func (c *OpenAIClient) Chat(messages []Message) (string, error) {
	reqBody := ChatRequest{
		Model:    c.modelName,
		Messages: messages,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	// 智能拼接 URL
	baseURL := c.baseURL
	if baseURL == "" {
		baseURL = "https://api.openai.com"
	}
	// 移除末尾的 /v1 如果存在
	if len(baseURL) > 3 && baseURL[len(baseURL)-3:] == "/v1" {
		baseURL = baseURL[:len(baseURL)-3]
	}
	// 确保末尾有 /
	if baseURL[len(baseURL)-1] != '/' {
		baseURL += "/"
	}
	url := baseURL + "v1/chat/completions"

	log.Printf("[LLM] 请求 URL: %s", url)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		log.Printf("[LLM] 请求失败: %v", err)
		return "", err
	}
	defer resp.Body.Close()

	log.Printf("[LLM] 响应状态码: %d", resp.StatusCode)

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("[LLM] 读取响应体失败: %v", err)
		return "", err
	}

	log.Printf("[LLM] 响应体: %s", string(body))

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("API error: status=%d, body=%s", resp.StatusCode, string(body))
	}

	var chatResp ChatResponse
	if err := json.Unmarshal(body, &chatResp); err != nil {
		return "", fmt.Errorf("解析响应失败: %v, body=%s", err, string(body))
	}

	if len(chatResp.Choices) == 0 {
		return "", fmt.Errorf("no choices in response")
	}

	log.Printf("[LLM] 解析后的回复: %s", chatResp.Choices[0].Message.Content)

	return chatResp.Choices[0].Message.Content, nil
}

package tts

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type TTSClient struct {
	baseURL string
	client  *http.Client
}

type TTSRequest struct {
	Text    string `json:"text"`
	Emotion string `json:"emotion"`
}

type TTSResponse struct {
	Success     bool   `json:"success"`
	Audio       string `json:"audio"`
	SampleRate  int    `json:"sample_rate"`
	EmotionUsed string `json:"emotion_used"`
	Error       string `json:"error,omitempty"`
}

func NewTTSClient(baseURL string) *TTSClient {
	return &TTSClient{
		baseURL: baseURL,
		client: &http.Client{
			Timeout: 90 * time.Second,
		},
	}
}

func (c *TTSClient) Synthesize(text string, emotion string) ([]byte, error) {
	reqBody := TTSRequest{
		Text:    text,
		Emotion: emotion,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	resp, err := c.client.Post(
		c.baseURL+"/tts",
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return nil, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status %d: %s", resp.StatusCode, string(body))
	}

	var ttsResp TTSResponse
	if err := json.Unmarshal(body, &ttsResp); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	if !ttsResp.Success {
		return nil, fmt.Errorf("tts error: %s", ttsResp.Error)
	}

	audioData, err := base64.StdEncoding.DecodeString(ttsResp.Audio)
	if err != nil {
		return nil, fmt.Errorf("decode audio: %w", err)
	}

	return audioData, nil
}

func (c *TTSClient) SynthesizeStream(text string, emotion string) ([]byte, error) {
	reqBody := TTSRequest{
		Text:    text,
		Emotion: emotion,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	resp, err := c.client.Post(
		c.baseURL+"/tts/stream",
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return nil, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("status %d: %s", resp.StatusCode, string(body))
	}

	return io.ReadAll(resp.Body)
}

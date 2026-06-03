package config

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

type Config struct {
	LLM     LLMConfig
	TTS     TTSConfig
	Server  ServerConfig
	Storage StorageConfig
	Game    GameConfig
}

type LLMConfig struct {
	BaseURL   string
	APIKey    string
	ModelName string
	Protocol  string
}

type TTSConfig struct {
	BaseURL   string
	APIKey    string
	Timeout   time.Duration
	LocalPort string
	UseLocal  bool
}

type ServerConfig struct {
	Port         string
	ExposePublic bool
}

type StorageConfig struct {
	MemoryFilePath string
	MemoryEnabled  bool
}

type GameConfig struct {
	DisplayMode  string
	TextSpeed    int
	VoiceVolume  int
	GameVoice    string
	GameLanguage string
	SessionID    string
}

var (
	globalConfig *Config
	configMu     sync.RWMutex
	configFile   = "lilith.cfg.env"
)

const (
	DefaultDisplayMode  = "窗口"
	DefaultTextSpeed    = 70
	DefaultVoiceVolume  = 80
	DefaultGameVoice    = "汉语"
	DefaultGameLanguage = "简体中文"
	DefaultSessionID    = "default-session"
	DefaultLLMProtocol  = "OpenAI"
	DefaultTTSPort      = "5200"
	DefaultServerPort   = "8080"
	DefaultMemoryPath   = "./lilith_memory.json"
)

// Load 加载配置，优先级: 环境变量 > .env > lilith.cfg.env > 默认值
func Load() *Config {
	configMu.Lock()
	defer configMu.Unlock()

	if globalConfig != nil {
		return globalConfig
	}

	cfg := defaultConfig()
	loadFromFile(cfg, configFile)
	loadFromFile(cfg, ".env")
	loadFromEnv(cfg)

	globalConfig = cfg
	return cfg
}

func defaultConfig() *Config {
	return &Config{
		LLM: LLMConfig{
			Protocol: DefaultLLMProtocol,
		},
		TTS: TTSConfig{
			Timeout:   90 * time.Second,
			LocalPort: DefaultTTSPort,
			UseLocal:  true,
		},
		Server: ServerConfig{
			Port: DefaultServerPort,
		},
		Storage: StorageConfig{
			MemoryFilePath: DefaultMemoryPath,
			MemoryEnabled:  true,
		},
		Game: GameConfig{
			DisplayMode:  DefaultDisplayMode,
			TextSpeed:    DefaultTextSpeed,
			VoiceVolume:  DefaultVoiceVolume,
			GameVoice:    DefaultGameVoice,
			GameLanguage: DefaultGameLanguage,
			SessionID:    DefaultSessionID,
		},
	}
}

func loadFromFile(cfg *Config, filename string) {
	file, err := os.Open(filename)
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])

		switch key {
		case "LLM_BASE_URL":
			cfg.LLM.BaseURL = value
		case "LLM_API_KEY":
			cfg.LLM.APIKey = value
		case "LLM_MODEL_NAME":
			cfg.LLM.ModelName = value
		case "LLM_PROTOCOL":
			cfg.LLM.Protocol = value
		case "TTS_BASE_URL":
			cfg.TTS.BaseURL = value
		case "TTS_API_KEY":
			cfg.TTS.APIKey = value
		case "TTS_USE_LOCAL":
			cfg.TTS.UseLocal = strings.ToLower(value) == "true"
		case "TTS_LOCAL_PORT":
			cfg.TTS.LocalPort = value
		case "SERVER_PORT":
			cfg.Server.Port = value
		case "SERVER_EXPOSE_PUBLIC":
			cfg.Server.ExposePublic = strings.ToLower(value) == "true"
		case "MEMORY_FILE_PATH":
			cfg.Storage.MemoryFilePath = value
		case "MEMORY_ENABLED":
			cfg.Storage.MemoryEnabled = strings.ToLower(value) == "true"
		case "DISPLAY_MODE":
			cfg.Game.DisplayMode = value
		case "TEXT_SPEED":
			if v, err := strconv.Atoi(value); err == nil && v >= 0 && v <= 100 {
				cfg.Game.TextSpeed = v
			}
		case "VOICE_VOLUME":
			if v, err := strconv.Atoi(value); err == nil && v >= 0 && v <= 100 {
				cfg.Game.VoiceVolume = v
			}
		case "GAME_VOICE":
			cfg.Game.GameVoice = value
		case "GAME_LANGUAGE":
			cfg.Game.GameLanguage = value
		case "SESSION_ID":
			cfg.Game.SessionID = value
		}
	}
}

func loadFromEnv(cfg *Config) {
	if v := os.Getenv("LLM_BASE_URL"); v != "" {
		cfg.LLM.BaseURL = v
	}
	if v := os.Getenv("LLM_API_KEY"); v != "" {
		cfg.LLM.APIKey = v
	}
	if v := os.Getenv("LLM_MODEL_NAME"); v != "" {
		cfg.LLM.ModelName = v
	}
	if v := os.Getenv("LLM_PROTOCOL"); v != "" {
		cfg.LLM.Protocol = v
	}
	if v := os.Getenv("TTS_BASE_URL"); v != "" {
		cfg.TTS.BaseURL = v
	}
	if v := os.Getenv("TTS_API_KEY"); v != "" {
		cfg.TTS.APIKey = v
	}
	if v := os.Getenv("SERVER_PORT"); v != "" {
		cfg.Server.Port = v
	}
}

// Save 保存配置到 lilith.cfg.env
func Save(cfg *Config) error {
	configMu.Lock()
	defer configMu.Unlock()

	// 确保目录存在
	dir := filepath.Dir(configFile)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("创建配置目录失败: %w", err)
	}

	file, err := os.Create(configFile)
	if err != nil {
		return fmt.Errorf("创建配置文件失败: %w", err)
	}
	defer file.Close()

	writer := bufio.NewWriter(file)
	defer writer.Flush()

	// 写入头部注释
	writer.WriteString("# Lilith 配置文件\n")
	writer.WriteString("# 注意：.env 文件优先级高于本文件\n")
	writer.WriteString(fmt.Sprintf("# 最后修改: %s\n\n", time.Now().Format("2006-01-02 15:04:05")))

	// LLM 配置
	writer.WriteString("# ========== LLM 配置 ==========\n")
	writer.WriteString(fmt.Sprintf("LLM_BASE_URL=%s\n", cfg.LLM.BaseURL))
	writer.WriteString(fmt.Sprintf("LLM_API_KEY=%s\n", cfg.LLM.APIKey))
	writer.WriteString(fmt.Sprintf("LLM_MODEL_NAME=%s\n", cfg.LLM.ModelName))
	writer.WriteString(fmt.Sprintf("LLM_PROTOCOL=%s\n", cfg.LLM.Protocol))

	// TTS 配置
	writer.WriteString("\n# ========== TTS 配置 ==========\n")
	writer.WriteString(fmt.Sprintf("TTS_BASE_URL=%s\n", cfg.TTS.BaseURL))
	writer.WriteString(fmt.Sprintf("TTS_API_KEY=%s\n", cfg.TTS.APIKey))
	writer.WriteString(fmt.Sprintf("TTS_USE_LOCAL=%t\n", cfg.TTS.UseLocal))
	writer.WriteString(fmt.Sprintf("TTS_LOCAL_PORT=%s\n", cfg.TTS.LocalPort))

	// 服务器配置
	writer.WriteString("\n# ========== 服务器配置 ==========\n")
	writer.WriteString(fmt.Sprintf("SERVER_PORT=%s\n", cfg.Server.Port))
	writer.WriteString(fmt.Sprintf("SERVER_EXPOSE_PUBLIC=%t\n", cfg.Server.ExposePublic))

	// 存储配置
	writer.WriteString("\n# ========== 存储配置 ==========\n")
	writer.WriteString(fmt.Sprintf("MEMORY_FILE_PATH=%s\n", cfg.Storage.MemoryFilePath))
	writer.WriteString(fmt.Sprintf("MEMORY_ENABLED=%t\n", cfg.Storage.MemoryEnabled))

	// 游戏设置
	writer.WriteString("\n# ========== 游戏设置 ==========\n")
	writer.WriteString(fmt.Sprintf("DISPLAY_MODE=%s\n", cfg.Game.DisplayMode))
	writer.WriteString(fmt.Sprintf("TEXT_SPEED=%d\n", cfg.Game.TextSpeed))
	writer.WriteString(fmt.Sprintf("VOICE_VOLUME=%d\n", cfg.Game.VoiceVolume))
	writer.WriteString(fmt.Sprintf("GAME_VOICE=%s\n", cfg.Game.GameVoice))
	writer.WriteString(fmt.Sprintf("GAME_LANGUAGE=%s\n", cfg.Game.GameLanguage))
	writer.WriteString(fmt.Sprintf("SESSION_ID=%s\n", cfg.Game.SessionID))

	globalConfig = cfg
	return nil
}

// Reload 重新加载配置
func Reload() *Config {
	configMu.Lock()
	defer configMu.Unlock()

	cfg := defaultConfig()
	loadFromFile(cfg, configFile)
	loadFromFile(cfg, ".env")
	loadFromEnv(cfg)

	globalConfig = cfg
	return cfg
}

// MaskAPIKey 隐藏 API 密钥
func MaskAPIKey(key string) string {
	if len(key) <= 8 {
		return "****"
	}
	return key[:4] + "****" + key[len(key)-4:]
}

package server

import (
	"log"
	"sync"

	"lilith-app/config"
)

type BasicSettings struct {
	DisplayMode  string `json:"displayMode"`
	TextSpeed    int    `json:"textSpeed"`
	VoiceVolume  int    `json:"voiceVolume"`
	GameVoice    string `json:"gameVoice"`
	GameLanguage string `json:"gameLanguage"`
}

type AdvancedSettings struct {
	LLM     LLMSettings     `json:"llm"`
	TTS     TTSSettings     `json:"tts"`
	Server  ServerSettings  `json:"server"`
	Storage StorageSettings `json:"memory"`
	Session SessionSettings `json:"session"`
}

type LLMSettings struct {
	BaseURL   string `json:"baseUrl"`
	APIKey    string `json:"apiKey"`
	ModelName string `json:"modelId"`
	Protocol  string `json:"protocol"`
}

type TTSSettings struct {
	BaseURL   string `json:"apiUrl"`
	APIKey    string `json:"apiKey"`
	UseLocal  bool   `json:"useLocalTTS"`
	LocalPort string `json:"localTTSPort"`
}

type ServerSettings struct {
	Port         string `json:"webUIPort"`
	ExposePublic bool   `json:"exposePublic"`
}

type StorageSettings struct {
	FilePath string `json:"dbPath"`
	Enabled  bool   `json:"enabled"`
}

type SessionSettings struct {
	SessionID string `json:"sessionId"`
}

type SettingsManager struct {
	mu sync.RWMutex
}

var (
	settingsManager *SettingsManager
	settingsOnce    sync.Once
)

func InitSettingsManager() *SettingsManager {
	return GetSettingsManager()
}

func GetSettingsManager() *SettingsManager {
	settingsOnce.Do(func() {
		settingsManager = &SettingsManager{}
		log.Println("[Settings] 设置管理器初始化完成")
		log.Println("[Settings] 配置优先级: 环境变量 > .env > lilith.cfg.env")
	})
	return settingsManager
}

// GetBasicSettings 获取基础设置
func (sm *SettingsManager) GetBasicSettings() *BasicSettings {
	cfg := config.Load()
	return &BasicSettings{
		DisplayMode:  cfg.Game.DisplayMode,
		TextSpeed:    cfg.Game.TextSpeed,
		VoiceVolume:  cfg.Game.VoiceVolume,
		GameVoice:    cfg.Game.GameVoice,
		GameLanguage: cfg.Game.GameLanguage,
	}
}

// UpdateBasicSettings 更新基础设置并保存
func (sm *SettingsManager) UpdateBasicSettings(settings *BasicSettings) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	cfg := config.Load()

	if settings.DisplayMode != "" {
		cfg.Game.DisplayMode = settings.DisplayMode
	}
	if settings.TextSpeed > 0 && settings.TextSpeed <= 100 {
		cfg.Game.TextSpeed = settings.TextSpeed
	}
	if settings.VoiceVolume >= 0 && settings.VoiceVolume <= 100 {
		cfg.Game.VoiceVolume = settings.VoiceVolume
	}
	if settings.GameVoice != "" {
		cfg.Game.GameVoice = settings.GameVoice
	}
	if settings.GameLanguage != "" {
		cfg.Game.GameLanguage = settings.GameLanguage
	}

	if err := config.Save(cfg); err != nil {
		log.Printf("[Settings] 保存基础设置失败: %v", err)
		return err
	}

	log.Printf("[Settings] 基础设置已保存: displayMode=%s, textSpeed=%d, voiceVolume=%d",
		cfg.Game.DisplayMode, cfg.Game.TextSpeed, cfg.Game.VoiceVolume)
	return nil
}

// GetAdvancedSettings 获取高级设置
func (sm *SettingsManager) GetAdvancedSettings() *AdvancedSettings {
	cfg := config.Load()
	return &AdvancedSettings{
		LLM: LLMSettings{
			BaseURL:   cfg.LLM.BaseURL,
			APIKey:    config.MaskAPIKey(cfg.LLM.APIKey),
			ModelName: cfg.LLM.ModelName,
			Protocol:  cfg.LLM.Protocol,
		},
		TTS: TTSSettings{
			BaseURL:   cfg.TTS.BaseURL,
			APIKey:    config.MaskAPIKey(cfg.TTS.APIKey),
			UseLocal:  cfg.TTS.UseLocal,
			LocalPort: cfg.TTS.LocalPort,
		},
		Server: ServerSettings{
			Port:         cfg.Server.Port,
			ExposePublic: cfg.Server.ExposePublic,
		},
		Storage: StorageSettings{
			FilePath: cfg.Storage.MemoryFilePath,
			Enabled:  cfg.Storage.MemoryEnabled,
		},
		Session: SessionSettings{
			SessionID: cfg.Game.SessionID,
		},
	}
}

// UpdateAdvancedSettings 更新高级设置并保存
func (sm *SettingsManager) UpdateAdvancedSettings(settings *AdvancedSettings) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	cfg := config.Load()

	// LLM
	if settings.LLM.BaseURL != "" {
		cfg.LLM.BaseURL = settings.LLM.BaseURL
	}
	if settings.LLM.APIKey != "" && !isMasked(settings.LLM.APIKey) {
		cfg.LLM.APIKey = settings.LLM.APIKey
	}
	if settings.LLM.ModelName != "" {
		cfg.LLM.ModelName = settings.LLM.ModelName
	}
	if settings.LLM.Protocol != "" {
		cfg.LLM.Protocol = settings.LLM.Protocol
	}

	// TTS
	if settings.TTS.BaseURL != "" {
		cfg.TTS.BaseURL = settings.TTS.BaseURL
	}
	if settings.TTS.APIKey != "" && !isMasked(settings.TTS.APIKey) {
		cfg.TTS.APIKey = settings.TTS.APIKey
	}
	cfg.TTS.UseLocal = settings.TTS.UseLocal
	if settings.TTS.LocalPort != "" {
		cfg.TTS.LocalPort = settings.TTS.LocalPort
	}

	// Server
	if settings.Server.Port != "" {
		cfg.Server.Port = settings.Server.Port
	}
	cfg.Server.ExposePublic = settings.Server.ExposePublic

	// Storage
	if settings.Storage.FilePath != "" {
		cfg.Storage.MemoryFilePath = settings.Storage.FilePath
	}
	cfg.Storage.MemoryEnabled = settings.Storage.Enabled

	// Session
	if settings.Session.SessionID != "" {
		cfg.Game.SessionID = settings.Session.SessionID
	}

	if err := config.Save(cfg); err != nil {
		log.Printf("[Settings] 保存高级设置失败: %v", err)
		return err
	}

	log.Printf("[Settings] 高级设置已保存到 lilith.cfg.env")
	return nil
}

// ResetToDefault 重置所有设置为默认值
func (sm *SettingsManager) ResetToDefault() error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	cfg := &config.Config{
		LLM: config.LLMConfig{
			Protocol: config.DefaultLLMProtocol,
		},
		TTS: config.TTSConfig{
			LocalPort: config.DefaultTTSPort,
			UseLocal:  true,
			Timeout:   90,
		},
		Server: config.ServerConfig{
			Port: config.DefaultServerPort,
		},
		Storage: config.StorageConfig{
			MemoryFilePath: config.DefaultMemoryPath,
			MemoryEnabled:  true,
		},
		Game: config.GameConfig{
			DisplayMode:  config.DefaultDisplayMode,
			TextSpeed:    config.DefaultTextSpeed,
			VoiceVolume:  config.DefaultVoiceVolume,
			GameVoice:    config.DefaultGameVoice,
			GameLanguage: config.DefaultGameLanguage,
			SessionID:    config.DefaultSessionID,
		},
	}

	if err := config.Save(cfg); err != nil {
		return err
	}

	// 重新加载配置
	config.Reload()
	log.Println("[Settings] 所有设置已恢复默认值")
	return nil
}

// GetSessionID 获取当前会话ID
func (sm *SettingsManager) GetSessionID() string {
	cfg := config.Load()
	return cfg.Game.SessionID
}

// DeleteSession 删除会话
func (sm *SettingsManager) DeleteSession(sessionID string) error {
	cfg := config.Load()
	if cfg.Game.SessionID != sessionID {
		return nil
	}

	cfg.Game.SessionID = config.DefaultSessionID
	if err := config.Save(cfg); err != nil {
		return err
	}

	if globalAgent != nil {
		globalAgent.ClearConversation()
	}

	log.Printf("[Settings] 会话已删除: %s", sessionID)
	return nil
}

// CompressSession 压缩会话（清除对话历史）
func (sm *SettingsManager) CompressSession(sessionID string) error {
	cfg := config.Load()
	if cfg.Game.SessionID != sessionID {
		return nil
	}

	if globalAgent != nil {
		globalAgent.ClearConversation()
	}

	log.Printf("[Settings] 会话已压缩: %s", sessionID)
	return nil
}

// GetTTSStatus 获取TTS状态
func (sm *SettingsManager) GetTTSStatus() string {
	if ttsClient != nil {
		return "online"
	}
	return "offline"
}

// LaunchLocalTTS 启动本地TTS
func (sm *SettingsManager) LaunchLocalTTS() error {
	cfg := config.Load()
	log.Printf("[Settings] 尝试启动本地TTS服务，端口: %s", cfg.TTS.LocalPort)
	// TODO: 实际启动逻辑
	return nil
}

func isMasked(key string) bool {
	return len(key) > 0 && (key[:4] == "****" || key == "****")
}

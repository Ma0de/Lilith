package common

const (
	FuzzyThreshold = 16
	ConfuseWindow  = 60
	ConfuseCount   = 5
	ResetKeepCount = 3

	MsgTypeChat         = "chat"
	MsgTypeStatusQuery  = "status_query"
	MsgTypeStatusResp   = "status_response"
	MsgTypeRetry        = "retry"
	MsgTypeMemoryUpdate = "memory_update"

	// 设置相关消息类型
	MsgTypeGetSettings              = "get_settings"
	MsgTypeUpdateSettings           = "update_settings"
	MsgTypeSettingsResponse         = "settings_response"
	MsgTypeSettingsUpdateResponse   = "settings_update_response"
	MsgTypeGetAdvancedSettings      = "get_advanced_settings"
	MsgTypeUpdateAdvancedSettings   = "update_advanced_settings"
	MsgTypeAdvancedSettingsResponse = "advanced_settings_response"
	MsgTypeAdvancedUpdateResponse   = "advanced_settings_update_response"
	MsgTypeLaunchTTS                = "launch_tts"
	MsgTypeTTSLaunchResponse        = "tts_launch_response"
	MsgTypeDeleteSession            = "delete_session"
	MsgTypeDeleteSessionResponse    = "delete_session_response"
	MsgTypeCompressSession          = "compress_session"
	MsgTypeCompressSessionResponse  = "compress_session_response"
	MsgTypeErrorResponse            = "error_response"

	// 默认设置值
	DefaultDisplayMode   = "窗口"
	DefaultTextSpeed     = 70
	DefaultVoiceVolume   = 80
	DefaultGameVoice     = "汉语"
	DefaultGameLanguage  = "简体中文"
	DefaultWebUIPort     = "8080"
	DefaultExposePublic  = false
	DefaultLLMProtocol   = "OpenAI"
	DefaultMemoryEnabled = true
	DefaultMemoryDBPath  = "./lilith_memory.json"
	DefaultSessionID     = "default-session"
	DefaultLocalTTSPort  = "5200"
)

package tts

// 表情到情绪的映射（用于选择音频风格）
var EmotionToVoiceStyle = map[string]string{
	"joyful_laugh":         "happy",
	"cheerful_laughing":    "happy",
	"confident_laugh":      "happy",
	"confident_playful":    "playful",
	"smug_playful":         "playful",
	"calm_gentle":          "calm",
	"gentle_smile_closed":  "calm",
	"serene":               "calm",
	"questioning":          "question",
	"skeptical_inquiring":  "question",
	"surprised_slight":     "surprised",
	"pout_playful":         "playful",
	"neutral_slight_upset": "sad",
	"upset_whimper":        "sad",
	"blush":                "shy",
	"sweat":                "awkward",
}

func GetVoiceStyle(emotion string) string {
	if style, ok := EmotionToVoiceStyle[emotion]; ok {
		return style
	}
	return "calm"
}

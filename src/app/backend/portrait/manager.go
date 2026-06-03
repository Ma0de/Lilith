package portrait  
  
type PortraitManager struct {  
    currentEmotion string  
}  
  
func NewPortraitManager() *PortraitManager {  
    return &PortraitManager{currentEmotion: "calm_gentle"}  
}  
  
func (p *PortraitManager) GetExpression(emotion string) string {  
    if expr, ok := emotionMap[emotion]; ok {  
        return expr  
    }  
    return "neutral"  
}  
  
var emotionMap = map[string]string{  
    "joyful_laugh": "happy",  
    "cheerful_laughing": "happy",  
    "confident_laugh": "happy",  
    "calm_gentle": "neutral",  
    "gentle_smile_closed": "neutral",  
    "serene": "neutral",  
    "questioning": "confused",  
    "skeptical_inquiring": "confused",  
    "pout_playful": "playful",  
    "smug_playful": "playful",  
    "neutral_slight_upset": "sad",  
    "upset_whimper": "sad",  
    "blush": "shy",  
    "sweat": "awkward",  
} 

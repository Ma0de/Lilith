# 表情情绪 -> 音频文件映射
EMOTION_SOUND_MAP = {
    # 开心/愉快类
    "joyful_laugh": "06e574a",
    "cheerful_laughing": "06e574a",
    "confident_laugh": "06e574a",
    "confident_playful": "06e574a",
    "smug_playful": "091e1a8",
    
    # 温柔/平静类
    "calm_gentle": "033c234",
    "gentle_smile_closed": "033c234",
    "serene": "033c234",
    "resigned_gentle": "033c234",
    "helpless_smile": "033c234",
    "gentle_inquiry": "033c234",
    
    # 肯定/欣慰类
    "confident_smile": "06e574a",
    "knowing_smile": "06e574a",
    
    # 疑惑/试探类
    "questioning": "0c80e65",
    "skeptical_inquiring": "0c80e65",
    "uncertain_thinking": "0c80e65",
    "surprised_slight": "0c80e65",
    
    # 调皮/试探类
    "pout_playful": "091e1a8",
    "playful_doubt": "091e1a8",
    
    # 无奈/轻叹类
    "neutral_slight_upset": "0bbb1c7",
    "resigned_acceptance": "0bbb1c7",
    "tired_resigned": "0bbb1c7",
    "bitter_smile": "0bbb1c7",
    "defeated_sigh": "0bbb1c7",
    
    # 严肃/认真类
    "serious_deadpan": "033c234",
    "determined": "033c234",
    "serious_displeased": "033c234",
    
    # 委屈/难过类
    "upset_whimper": "0bbb1c7",
    "worried_upset": "0bbb1c7",
    "misunderstood_sigh": "0bbb1c7",
    
    # 害羞类
    "blush": "033c234",
    
    # 尴尬类
    "sweat": "091e1a8",
    "sweat_2": "091e1a8",
    
    # 惊讶类
    "surprised_slight": "0c80e65",
    "shocked_offended": "0c80e65",
    
    # 发呆/空白类
    "blank_dazed": "0bbb1c7",
    
    # 生气/不悦类
    "displeasure": "033c234",
    "annoyed_glare": "033c234",
    "disgust_talking": "033c234",
    
    "default": "033c234"
}

# 音频文件路径映射
SOUND_FILE_MAP = {
    "033c234": "Sounds/033c234.ogg",
    "06e574a": "Sounds/06e574a.ogg",
    "091e1a8": "Sounds/091e1a8.ogg",
    "0bbb1c7": "Sounds/0bbb1c7.ogg",
    "0c80e65": "Sounds/0c80e65.ogg",
    "0cc0b90": "Sounds/0cc0b90.ogg",
}

# 音频对应的参考文本
SOUND_REF_TEXT_MAP = {
    "033c234": "不好吗？我好歹是个魔剑士，总比你一个人要好得多吧？",
    "06e574a": "你也会说点可靠的话了嘛",
    "091e1a8": "你在撒谎，对吧？",
    "0bbb1c7": "你做得很好...真的",
    "0c80e65": "欸？你在说什么？",
    "0cc0b90": "你看起来也是一名冒险者？",
}

def get_sound_hash_by_emotion(emotion: str) -> str:
    return EMOTION_SOUND_MAP.get(emotion, EMOTION_SOUND_MAP["default"])

def get_sound_path_by_emotion(emotion: str) -> str:
    sound_hash = get_sound_hash_by_emotion(emotion)
    return SOUND_FILE_MAP.get(sound_hash, SOUND_FILE_MAP["033c234"])

def get_ref_text_by_emotion(emotion: str) -> str:
    """根据表情获取对应的参考文本"""
    sound_hash = get_sound_hash_by_emotion(emotion)
    return SOUND_REF_TEXT_MAP.get(sound_hash, "")
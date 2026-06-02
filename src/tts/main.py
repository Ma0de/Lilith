import sys
import torch
import soundfile as sf
import io
import base64
from flask import Flask, request, jsonify
from flask_cors import CORS
import logging

sys.path.insert(0, "./Qwen3-TTS")

from qwen_tts.inference.qwen3_tts_model import Qwen3TTSModel
from emotion_sound_map import get_sound_path_by_emotion, get_ref_text_by_emotion, EMOTION_SOUND_MAP

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # 允许跨域

# 全局模型实例
model = None

def load_model():
    """加载 TTS 模型"""
    global model
    logger.info("正在加载 Qwen3-TTS 模型...")
    model = Qwen3TTSModel.from_pretrained(
        "./Qwen3-TTS-1.7B-Base",
        device_map="cpu",  # 可改为 "cuda" 如果有 GPU
        dtype=torch.bfloat16,
    )
    logger.info("模型加载完成")

def text_to_speech_with_emotion(text: str, emotion: str) -> bytes:
    """根据表情情绪进行语音克隆合成
    
    Args:
        text: 要合成的文本
        emotion: 表情名称（如 "joyful_laugh", "calm_gentle" 等）
    
    Returns:
        bytes: WAV 音频数据
    """
    # 根据表情获取参考音频路径
    ref_audio_path = get_sound_path_by_emotion(emotion)
    logger.info(f"表情: {emotion}, 使用参考音频: {ref_audio_path}")
    
    # 可选：加载参考文本（当前为空，使用自动识别）
    ref_text = ""
    
    # 生成语音
    wavs, sr = model.generate_voice_clone(
        text=text,
        language="Chinese",
        ref_audio=ref_audio_path,
        ref_text=ref_text,
    )
    
    # 转换为 bytes
    buffer = io.BytesIO()
    sf.write(buffer, wavs[0], sr, format="wav")
    buffer.seek(0)
    
    return buffer.getvalue()

@app.route("/health", methods=["GET"])
def health_check():
    """健康检查接口"""
    return jsonify({"status": "ok", "model_loaded": model is not None})

@app.route("/emotions", methods=["GET"])
def list_emotions():
    """获取支持的表情列表"""
    emotions = list(set(EMOTION_SOUND_MAP.keys()))
    # 移除 'default'
    if "default" in emotions:
        emotions.remove("default")
    return jsonify({"emotions": sorted(emotions)})

@app.route("/tts", methods=["POST"])
def tts_generate():
    """TTS 生成接口
    
    请求体:
    {
        "text": "要合成的文本",
        "emotion": "joyful_laugh"  // 可选，默认 calm_gentle
    }
    
    响应:
    {
        "success": true,
        "audio": "base64编码的WAV音频",
        "sample_rate": 24000
    }
    """
    if model is None:
        return jsonify({"success": False, "error": "模型未加载"}), 503
    
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "error": "请求体为空"}), 400
    
    text = data.get("text", "")
    if not text:
        return jsonify({"success": False, "error": "text 参数不能为空"}), 400
    
    emotion = data.get("emotion", "calm_gentle")
    
    try:
        # 生成语音
        audio_bytes = text_to_speech_with_emotion(text, emotion)
        
        # 转换为 base64
        audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
        
        return jsonify({
            "success": True,
            "audio": audio_base64,
            "sample_rate": 24000,
            "emotion_used": emotion
        })
    except Exception as e:
        logger.error(f"TTS 生成失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/tts/stream", methods=["POST"])
def tts_generate_stream():
    """流式 TTS 生成接口（直接返回音频文件）
    
    请求体:
    {
        "text": "要合成的文本",
        "emotion": "joyful_laugh"
    }
    """
    if model is None:
        return jsonify({"error": "模型未加载"}), 503
    
    data = request.get_json()
    if not data:
        return jsonify({"error": "请求体为空"}), 400
    
    text = data.get("text", "")
    if not text:
        return jsonify({"error": "text 参数不能为空"}), 400
    
    emotion = data.get("emotion", "calm_gentle")
    
    try:
        audio_bytes = text_to_speech_with_emotion(text, emotion)
        
        # 直接返回音频文件
        return audio_bytes, 200, {
            "Content-Type": "audio/wav",
            "Content-Disposition": "attachment; filename=speech.wav"
        }
    except Exception as e:
        logger.error(f"TTS 生成失败: {e}")
        return jsonify({"error": str(e)}), 500

def text_to_speech_with_emotion(text: str, emotion: str) -> bytes:
    """根据表情情绪进行语音克隆合成
    
    Args:
        text: 要合成的文本
        emotion: 表情名称（如 "joyful_laugh", "calm_gentle" 等）
    
    Returns:
        bytes: WAV 音频数据
    """
    # 根据表情获取参考音频路径和参考文本
    ref_audio_path = get_sound_path_by_emotion(emotion)
    ref_text = get_ref_text_by_emotion(emotion)
    
    logger.info(f"表情: {emotion}, 使用参考音频: {ref_audio_path}")
    logger.info(f"参考文本: {ref_text}")
    
    # 生成语音
    wavs, sr = model.generate_voice_clone(
        text=text,
        language="Chinese",
        ref_audio=ref_audio_path,
        ref_text=ref_text,
    )
    
    # 转换为 bytes
    buffer = io.BytesIO()
    sf.write(buffer, wavs[0], sr, format="wav")
    buffer.seek(0)
    
    return buffer.getvalue()

if __name__ == "__main__":
    # 加载模型
    load_model()
    
    # 启动服务
    logger.info("启动 TTS 微服务，端口: 5200")
    app.run(host="0.0.0.0", port=5200, debug=False, threaded=True)
import sys
import torch
import soundfile as sf
import io
import base64
import os
import glob
import configparser
import socket
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import logging

sys.path.insert(0, "./Qwen3-TTS")

from qwen_tts.inference.qwen3_tts_model import Qwen3TTSModel
from emotion_sound_map import get_sound_path_by_emotion, get_ref_text_by_emotion, EMOTION_SOUND_MAP

# 配置日志格式
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y/%m/%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # 允许跨域

# 全局变量
model = None
config = {}
CONFIG_FILE = "tts.cfg"

def log_with_time(level, message):
    """带时间戳的日志输出"""
    timestamp = datetime.now().strftime("%Y/%m/%d %H:%M:%S")
    if level == "info":
        logger.info(message)
    elif level == "error":
        logger.error(message)
    elif level == "warning":
        logger.warning(message)
    else:
        print(f"{timestamp} [{level.upper()}] {message}")

def load_config():
    """加载配置文件 tts.cfg"""
    global config
    
    if not os.path.exists(CONFIG_FILE):
        log_with_time("warning", f"[配置] 未找到 {CONFIG_FILE} 文件，将使用默认配置")
        config = {
            "QW_TTS_MODEL_FOLDER": "",
            "TTS_SERVICE_PORT": "5200"
        }
        return False
    
    # 检查文件是否可读
    if not os.access(CONFIG_FILE, os.R_OK):
        log_with_time("error", f"[配置] 已找到 {CONFIG_FILE} 文件，但无法访问文件（权限不足）")
        return False
    
    try:
        cfg = configparser.ConfigParser()
        cfg.read(CONFIG_FILE, encoding='utf-8')
        
        # 读取配置
        if 'DEFAULT' in cfg:
            config['QW_TTS_MODEL_FOLDER'] = cfg['DEFAULT'].get('QW_TTS_MODEL_FOLDER', '')
            config['TTS_SERVICE_PORT'] = cfg['DEFAULT'].get('TTS_SERVICE_PORT', '5200')
        elif 'tts' in cfg:
            config['QW_TTS_MODEL_FOLDER'] = cfg['tts'].get('QW_TTS_MODEL_FOLDER', '')
            config['TTS_SERVICE_PORT'] = cfg['tts'].get('TTS_SERVICE_PORT', '5200')
        else:
            # 尝试直接读取（如果没有section）
            cfg.read(CONFIG_FILE, encoding='utf-8')
            config['QW_TTS_MODEL_FOLDER'] = cfg.get('DEFAULT', 'QW_TTS_MODEL_FOLDER', fallback='')
            config['TTS_SERVICE_PORT'] = cfg.get('DEFAULT', 'TTS_SERVICE_PORT', fallback='5200')
        
        log_with_time("info", f"[配置] 已找到 {CONFIG_FILE} 文件并成功解析")
        log_with_time("info", f"[配置] 模型文件夹: {config['QW_TTS_MODEL_FOLDER'] or '未指定'}")
        log_with_time("info", f"[配置] 服务端口: {config['TTS_SERVICE_PORT']}")
        return True
        
    except configparser.Error as e:
        log_with_time("error", f"[配置] 已找到 {CONFIG_FILE} 文件，但无法正确解析文件: {e}")
        config = {
            "QW_TTS_MODEL_FOLDER": "",
            "TTS_SERVICE_PORT": "5200"
        }
        return False
    except Exception as e:
        log_with_time("error", f"[配置] 读取 {CONFIG_FILE} 文件时发生未知错误: {e}")
        config = {
            "QW_TTS_MODEL_FOLDER": "",
            "TTS_SERVICE_PORT": "5200"
        }
        return False

def find_model_folder():
    """查找 Qwen3-TTS 模型文件夹"""
    # 先从配置文件获取路径
    if config.get('QW_TTS_MODEL_FOLDER') and config['QW_TTS_MODEL_FOLDER'].strip():
        model_path = config['QW_TTS_MODEL_FOLDER'].strip()
        if os.path.exists(model_path) and os.path.isdir(model_path):
            log_with_time("info", f"[模型] 使用配置文件指定的模型路径: {model_path}")
            return model_path
        else:
            log_with_time("warning", f"[模型] 配置文件指定的路径不存在: {model_path}，将尝试自动查找")
    
    # 匹配 Qwen3-TTS-*-* 格式的文件夹
    patterns = ["Qwen3-TTS-*-*", "./Qwen3-TTS-*-*", "../Qwen3-TTS-*-*", "*/Qwen3-TTS-*-*"]
    matching_folders = []
    
    for pattern in patterns:
        matching_folders.extend(glob.glob(pattern))
    
    # 去重并过滤掉非目录
    matching_folders = [f for f in set(matching_folders) if os.path.isdir(f)]
    
    if matching_folders:
        log_with_time("info", f"[模型] 自动找到模型文件夹: {matching_folders[0]}")
        return matching_folders[0]
    
    return None

def check_port_available(port):
    """检查端口是否可用"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(('0.0.0.0', port))
            return True
    except OSError:
        return False

def load_model():
    """加载 TTS 模型"""
    global model
    
    model_path = find_model_folder()
    
    # 如果没找到，提示用户
    if model_path is None:
        error_msg = (
            "未寻找到有 Qwen3-TTS-*-* 的模型文件夹，请尝试以下方法：\n"
            "方法1: 在 tts.cfg 配置文件中设置 QW_TTS_MODEL_FOLDER=/path/to/your/model\n"
            "方法2: 确保模型文件夹在当前目录下，格式如 'Qwen3-TTS-1.7B-Base'\n"
            "方法3: 手动指定路径（见下方提示）"
        )
        log_with_time("error", error_msg)
        
        # 交互式输入
        try:
            user_path = input("\n请输入模型文件夹路径（直接回车退出）: ").strip()
            if user_path:
                if os.path.exists(user_path) and os.path.isdir(user_path):
                    model_path = user_path
                    log_with_time("info", f"[模型] 使用用户指定的路径: {model_path}")
                else:
                    log_with_time("error", f"[模型] 路径不存在: {user_path}")
                    raise FileNotFoundError("模型文件夹不存在")
            else:
                raise FileNotFoundError("用户取消模型加载")
        except EOFError:
            log_with_time("error", "[模型] 无法进行交互式输入，请通过配置文件指定模型路径")
            raise FileNotFoundError("无法找到模型文件夹")
    
    # 检查模型文件夹是否存在
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"模型文件夹不存在: {model_path}")
    
    # 检查是否是有效的模型目录（检查关键文件）
    required_files = ['model.safetensors', 'config.json', 'tokenizer.json']
    missing_files = [f for f in required_files if not os.path.exists(os.path.join(model_path, f))]
    if missing_files:
        log_with_time("warning", f"[模型] 模型目录可能不完整，缺少: {', '.join(missing_files)}")
    
    try:
        log_with_time("info", f"[模型] 正在加载 Qwen3-TTS 模型，路径: {model_path}")
        log_with_time("info", "[模型] 这可能需要一些时间，请稍候...")
        
        model = Qwen3TTSModel.from_pretrained(
            model_path,
            device_map="cpu",  # 可改为 "cuda" 如果有 GPU
            dtype=torch.bfloat16,
        )
        log_with_time("info", "[模型] 模型加载完成！")
        return True
    except Exception as e:
        log_with_time("error", f"[模型] 模型加载失败: {e}")
        raise

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
        log_with_time("error", f"TTS 生成失败: {e}")
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
        log_with_time("error", f"TTS 生成失败: {e}")
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
    
    log_with_time("info", f"[TTS] 表情: {emotion}, 参考音频: {ref_audio_path}")
    log_with_time("info", f"[TTS] 参考文本: {ref_text}")
    log_with_time("info", f"[TTS] 合成文本: {text[:50]}{'...' if len(text) > 50 else ''}")
    
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
    
    log_with_time("info", f"[TTS] 语音生成完成，采样率: {sr}Hz")
    return buffer.getvalue()

def start_server():
    """启动 Flask 服务器"""
    # 获取端口配置
    try:
        port = int(config.get('TTS_SERVICE_PORT', '5200'))
        if port < 1 or port > 65535:
            raise ValueError(f"端口号超出范围: {port}")
    except ValueError as e:
        log_with_time("error", f"[服务] 端口配置无效: {e}，将使用默认端口 5200")
        port = 5200
    
    # 检查端口是否可用
    if not check_port_available(port):
        log_with_time("error", f"[服务] 端口 {port} 已被占用，请检查并释放端口或修改配置文件")
        log_with_time("info", "[服务] 您可以尝试：")
        log_with_time("info", f"  1. 查找占用端口的进程: lsof -i :{port} (Linux/Mac) 或 netstat -ano | findstr :{port} (Windows)")
        log_with_time("info", "  2. 在 tts.cfg 中修改 TTS_SERVICE_PORT 为其他端口")
        sys.exit(1)
    
    log_with_time("info", f"[服务] 正在启动 TTS 微服务...")
    log_with_time("info", f"[服务] 监听地址: 0.0.0.0:{port}")
    log_with_time("info", f"[服务] API 端点:")
    log_with_time("info", f"  - GET  /health     健康检查")
    log_with_time("info", f"  - GET  /emotions   获取支持的表情列表")
    log_with_time("info", f"  - POST /tts        TTS 生成 (返回 Base64)")
    log_with_time("info", f"  - POST /tts/stream TTS 生成 (直接返回音频文件)")
    log_with_time("info", "[服务] 服务已就绪，等待请求...")
    
    try:
        app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
    except OSError as e:
        if "Address already in use" in str(e):
            log_with_time("error", f"[服务] 端口 {port} 已被占用，无法启动服务")
        else:
            log_with_time("error", f"[服务] 启动失败: {e}")
        sys.exit(1)
    except Exception as e:
        log_with_time("error", f"[服务] 发生未知错误: {e}")
        sys.exit(1)

if __name__ == "__main__":
    log_with_time("info", "=" * 60)
    log_with_time("info", "TTS 微服务启动中...")
    log_with_time("info", "=" * 60)
    
    # 1. 加载配置文件
    load_config()
    
    # 2. 加载模型
    try:
        load_model()
    except FileNotFoundError as e:
        log_with_time("error", f"[启动] 模型加载失败: {e}")
        log_with_time("error", "[启动] 服务无法启动，请检查模型配置后重试")
        sys.exit(1)
    except Exception as e:
        log_with_time("error", f"[启动] 发生未预期的错误: {e}")
        log_with_time("error", "[启动] 服务终止")
        sys.exit(1)
    
    # 3. 启动服务
    start_server()
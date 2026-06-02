import requests
import base64
import soundfile as sf
import io
import json

# TTS 服务地址
TTS_URL = "http://127.0.0.1:5200"

def test_health():
    """测试健康检查"""
    print("\n" + "="*50)
    print("测试健康检查")
    print("="*50)
    
    resp = requests.get(f"{TTS_URL}/health")
    print(f"状态码: {resp.status_code}")
    print(f"响应: {resp.json()}")

def test_list_emotions():
    """测试获取表情列表"""
    print("\n" + "="*50)
    print("测试获取表情列表")
    print("="*50)
    
    resp = requests.get(f"{TTS_URL}/emotions")
    print(f"状态码: {resp.status_code}")
    data = resp.json()
    print(f"支持的表情数量: {len(data.get('emotions', []))}")
    print(f"前10个表情: {data.get('emotions', [])[:10]}")

def test_tts_generate(text: str, emotion: str, output_file: str = None):
    """测试 TTS 生成（返回 base64）"""
    print("\n" + "="*50)
    print(f"测试 TTS 生成")
    print(f"文本: {text}")
    print(f"表情: {emotion}")
    print("="*50)
    
    payload = {
        "text": text,
        "emotion": emotion
    }
    
    resp = requests.post(f"{TTS_URL}/tts", json=payload)
    print(f"状态码: {resp.status_code}")
    
    if resp.status_code == 200:
        data = resp.json()
        if data.get("success"):
            print(f"使用的表情: {data.get('emotion_used')}")
            print(f"采样率: {data.get('sample_rate')}")
            
            # 解码音频
            audio_bytes = base64.b64decode(data["audio"])
            print(f"音频大小: {len(audio_bytes)} bytes")
            
            # 保存音频文件
            if output_file is None:
                output_file = f"test_{emotion}.wav"
            
            audio_buffer = io.BytesIO(audio_bytes)
            audio_data, sr = sf.read(audio_buffer)
            sf.write(output_file, audio_data, sr)
            print(f"音频已保存: {output_file}")
            
            return True
        else:
            print(f"错误: {data.get('error')}")
            return False
    else:
        print(f"请求失败: {resp.text}")
        return False

def test_tts_stream(text: str, emotion: str, output_file: str = None):
    """测试 TTS 流式生成（直接返回音频）"""
    print("\n" + "="*50)
    print(f"测试 TTS 流式生成")
    print(f"文本: {text}")
    print(f"表情: {emotion}")
    print("="*50)
    
    payload = {
        "text": text,
        "emotion": emotion
    }
    
    resp = requests.post(f"{TTS_URL}/tts/stream", json=payload)
    print(f"状态码: {resp.status_code}")
    print(f"Content-Type: {resp.headers.get('Content-Type')}")
    
    if resp.status_code == 200:
        if output_file is None:
            output_file = f"test_stream_{emotion}.wav"
        
        # 直接保存音频
        with open(output_file, "wb") as f:
            f.write(resp.content)
        
        print(f"音频已保存: {output_file}")
        print(f"音频大小: {len(resp.content)} bytes")
        return True
    else:
        print(f"请求失败: {resp.text}")
        return False

def test_all_emotions(text: str = "你好，很高兴认识你"):
    """测试所有表情的 TTS 生成"""
    print("\n" + "="*50)
    print("测试所有表情")
    print("="*50)
    
    # 获取表情列表
    resp = requests.get(f"{TTS_URL}/emotions")
    if resp.status_code != 200:
        print("获取表情列表失败")
        return
    
    emotions = resp.json().get("emotions", [])
    print(f"将测试 {len(emotions)} 个表情...")
    
    success_count = 0
    for emotion in emotions[:5]:  # 只测试前5个，避免时间过长
        print(f"\n测试表情: {emotion}")
        if test_tts_generate(text, emotion, f"test_{emotion}.wav"):
            success_count += 1
    
    print(f"\n测试完成: {success_count}/{min(len(emotions),5)} 成功")

if __name__ == "__main__":
    print("开始测试 TTS 微服务")
    print(f"服务地址: {TTS_URL}")
    
    # 1. 健康检查
    test_health()
    
    # 2. 获取表情列表
    test_list_emotions()
    
    # 3. 测试单个 TTS 生成
    test_tts_generate("今天天气真好，我们一起出去玩吧！", "joyful_laugh", "test_joyful.wav")
    
    
    # 6. 测试默认表情（不传 emotion）
    print("\n" + "="*50)
    print("测试默认表情（不传 emotion）")
    print("="*50)
    payload = {"text": "默认表情测试"}
    resp = requests.post(f"{TTS_URL}/tts", json=payload)
    if resp.status_code == 200:
        data = resp.json()
        print(f"自动使用的表情: {data.get('emotion_used')}")
    
    # 7. 可选：测试所有表情（注释掉，因为耗时较长）
    # test_all_emotions()
    
    print("\n所有测试完成！")
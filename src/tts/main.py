import sys
import torch
import soundfile as sf

# 添加 qwen_tts 包的路径到 Python 路径
sys.path.insert(0, "./Qwen3-TTS")

# 现在可以从 qwen_tts 导入
from qwen_tts.inference.qwen3_tts_model import Qwen3TTSModel

model = Qwen3TTSModel.from_pretrained(
    "./Qwen3-TTS-1.7B-Base",
    device_map="cpu",
    dtype=torch.bfloat16,
)

ref_audio = ""
ref_text = ""

wavs, sr = model.generate_voice_clone(
    text="你好",
    language="Chinese",
    ref_audio=ref_audio,
    ref_text=ref_text,
)
sf.write("output_clone.wav", wavs[0], sr)
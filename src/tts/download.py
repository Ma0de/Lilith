import os
os.environ['HF_ENDPOINT'] = 'https://hf-mirror.com'

from huggingface_hub import snapshot_download

print("开始下载模型")
snapshot_download(
    repo_id="Qwen/Qwen3-TTS-12Hz-1.7B-Base",
    local_dir="./Qwen3-TTS-1.7B-Base",
    resume_download=True,
    local_dir_use_symlinks=False
)
print("下载完成！")
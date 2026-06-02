from faster_whisper import download_model
from pathlib import Path

MODELS_DIR = Path(__file__).resolve().parents[1] / "models"
MODEL_DIR = MODELS_DIR / "models--Systran--faster-whisper-medium.en"

path = download_model("medium.en", output_dir=str(MODEL_DIR))
print(f"Downloaded Faster-Whisper medium.en to: {path}")

from TTS.api import TTS

MODEL_PATH = "V:/Document/Vella-Modes/models/tts"

# Example: Tacotron2 DDC (small, CPU-friendly)
tts = TTS(
    model_name="tts_models/en/ljspeech/fast_pitch",
    gpu=False,
    progress_bar=True
)

tts.tts_to_file(
    text="Vella is alive and talking.",
    file_path="out.wav"
)
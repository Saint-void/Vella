# from transformers import AutoTokenizer, AutoModelForCausalLM

# MODEL_PATH = "V:/Document/Vella-Modes/models"

# print("Downloading tokenizer...")
# AutoTokenizer.from_pretrained(
#     "distilgpt2",
#     cache_dir=MODEL_PATH
# )

# print("Downloading model...")
# AutoModelForCausalLM.from_pretrained(
#     "distilgpt2",
#     cache_dir=MODEL_PATH
# )

# print("Download complete.")


from sentence_transformers import SentenceTransformer
model = SentenceTransformer("all-MiniLM-L6-v2")
model.save("V:/Document/Vella-Modes/models/embeddings/all-MiniLM-L6-v2")

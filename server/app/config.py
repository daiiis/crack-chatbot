import os
from dotenv import load_dotenv

load_dotenv()

client_id = os.getenv("CLIENT_ID", None)
client_secret = os.getenv("CLIENT_SECRET", None)
database_url = os.getenv("DATABASE_URL", None)
secret_key = os.getenv("SECRET_KEY", "said")

# Ollama Configuration
# If running Ollama on Windows and this backend on WSL, you might need 'http://172.17.0.1:11434' or your host IP.
# If 'localhost' worked for curl, keep it as localhost.
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "mistral:latest")

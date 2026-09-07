import os
import json
from pydantic_settings import BaseSettings

def get_contract_address():
    addr = os.getenv("CONTRACT_ADDRESS", "")
    if addr:
        return addr
    try:
        path = os.path.join(os.path.dirname(__file__), "contract_address.json")
        with open(path, "r") as f:
            data = json.load(f)
            return data.get("address", "")
    except Exception:
        return ""

class Settings(BaseSettings):
    SERPAPI_KEY: str = os.getenv("SERPAPI_KEY", "")
    WEB3_PROVIDER_URI: str = os.getenv("WEB3_PROVIDER_URI", "http://127.0.0.1:8545")
    CONTRACT_ADDRESS: str = get_contract_address()
    
    SEARCH_PROVIDER: str = os.getenv("SEARCH_PROVIDER", "hybrid")
    MAX_SEARCH_RESULTS: int = int(os.getenv("MAX_SEARCH_RESULTS", "15"))

    FACE_DISTANCE_THRESHOLD: float = float(os.getenv("FACE_DISTANCE_THRESHOLD", "0.35"))

    class Config:
        env_file = "../.env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()

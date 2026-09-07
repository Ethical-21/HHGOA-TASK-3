import hashlib
import json
from typing import Dict, Any

class HashingService:
    @staticmethod
    def canonicalize_post_data(post_data: Dict[str, Any]) -> str:
        """
        Creates a deterministic JSON string from post data to be hashed.
        """
        # Ensure we only hash specific immutable fields, sort keys for determinism
        canonical_dict = {
            "source": post_data.get("source", ""),
            "post_url": post_data.get("post_url", ""),
            "title": post_data.get("title", ""),
            "image_url": post_data.get("image_url", "")
        }
        return json.dumps(canonical_dict, sort_keys=True, separators=(',', ':'))

    @staticmethod
    def generate_hash(post_data: Dict[str, Any]) -> str:
        """
        Generates SHA-256 hash of canonicalized post data.
        """
        canonical_str = HashingService.canonicalize_post_data(post_data)
        return hashlib.sha256(canonical_str.encode('utf-8')).hexdigest()

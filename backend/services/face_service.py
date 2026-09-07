import os
import cv2
import numpy as np
from deepface import DeepFace
from typing import Dict, Any
from config import settings

class FaceService:
    @staticmethod
    def process_image(image_path: str) -> Dict[str, Any]:
        """
        Detects a face in the image and generates an encoding.
        """
        try:
            representations = DeepFace.represent(
                img_path=image_path,
                model_name="ArcFace",
                detector_backend="retinaface",
                enforce_detection=True
            )
            
            if len(representations) == 0:
                return {"success": False, "error": "No faces detected."}
                
            face_data = representations[0]
            
            return {
                "success": True,
                "face_detected": True,
                "face_count": len(representations),
                "encoding_generated": True,
                "facial_area": face_data.get("facial_area", {})
            }
        except ValueError as ve:
            return {"success": False, "error": "No faces detected in the image. " + str(ve)}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @staticmethod
    def compare_faces(img1_path: str, img2_path: str) -> Dict[str, Any]:
        """
        Compares two images using DeepFace.verify with Facenet512 and retinaface.
        """
        # Validate image files exist
        if not os.path.exists(img1_path) or not os.path.exists(img2_path):
            return {"success": False, "error": "One or both image files not found"}

        try:
            # Enforce the validated model config
            result = DeepFace.verify(
                img1_path=img1_path,
                img2_path=img2_path,
                model_name="Facenet512",
                detector_backend="retinaface",
                distance_metric="cosine",
                enforce_detection=False
            )
            
            # Extract facial areas and verify non-degenerate detection
            facial_areas = result.get("facial_areas", {})
            img2_area = facial_areas.get("img2", {})
            
            if not img2_area:
                 return {
                    "success": False,
                    "error": "No face detected in candidate image (missing area object)."
                }
                
            w = img2_area.get("w", 0)
            h = img2_area.get("h", 0)
            
            if w == 0 or h == 0:
                return {
                    "success": False,
                    "error": "No face detected in candidate image (degenerate area)."
                }
            
            confidence = img2_area.get("confidence", 0)
            distance = result.get("distance", float('inf'))
            
            # Use our configurable strict threshold instead of DeepFace's default (0.68)
            threshold = settings.FACE_DISTANCE_THRESHOLD
            verified = distance <= threshold
            
            # Compute a similarity score for ranking
            similarity = max(0.0, 1.0 - distance)
            
            return {
                "success": True,
                "verified": verified,
                "distance": distance,
                "similarity": similarity,
                "confidence": confidence,
                "threshold": threshold,
                "faces_detected": 1
            }
            
        except ValueError as ve:
            return {"success": False, "error": f"Face verification error: {str(ve)}"}
        except Exception as e:
            return {"success": False, "error": f"Face comparison error: {str(e)}"}

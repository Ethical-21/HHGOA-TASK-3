import os
import requests
import time
from typing import Dict, Any, List
import io
from PIL import Image
from serpapi import GoogleSearch
from config import settings

class SearchProvider:
    def search(self, image_url: str) -> List[Dict[str, Any]]:
        raise NotImplementedError

class SerpApiReverseImageSearch(SearchProvider):
    def search(self, image_url: str) -> List[Dict[str, Any]]:
        if not settings.SERPAPI_KEY:
            raise ValueError("SERPAPI_KEY is not configured.")
        formatted_matches = []
        
        # 1. Google Lens
        try:
            google_params = {
                "engine": "google_lens",
                "url": image_url,
                "api_key": settings.SERPAPI_KEY
            }
            google_search = GoogleSearch(google_params)
            google_results = google_search.get_dict()
            google_matches = google_results.get("visual_matches", [])
            for match in google_matches:
                formatted_matches.append({
                    "source": match.get("source", "Google Lens"),
                    "post_url": match.get("link", ""),
                    "title": match.get("title", ""),
                    "image_url": match.get("thumbnail", ""),
                    "timestamp": str(time.time()),
                    "search_engine": "google_lens"
                })
        except Exception as e:
            print(f"Google Lens search failed: {e}")
            
        # 2. Bing Reverse Image
        try:
            bing_params = {
                "engine": "bing_reverse_image",
                "image_url": image_url,
                "api_key": settings.SERPAPI_KEY
            }
            bing_search = GoogleSearch(bing_params)
            bing_results = bing_search.get_dict()
            bing_matches = bing_results.get("pages_with_this_image", [])
            for match in bing_matches:
                formatted_matches.append({
                    "source": match.get("domain", "Bing Reverse Image"),
                    "post_url": match.get("source", ""),  # In Bing, 'source' contains the page URL
                    "title": match.get("title", ""),
                    "image_url": match.get("original", "") or match.get("thumbnail", ""),
                    "timestamp": str(time.time()),
                    "search_engine": "bing_reverse_image"
                })
        except Exception as e:
            print(f"Bing Reverse Image search failed: {e}")
            
        # Filter out invalid entries
        formatted_matches = [m for m in formatted_matches if m.get("post_url") and m.get("image_url")]
            
        return formatted_matches

class SearchService:
    def __init__(self):
        self.serpapi_provider = SerpApiReverseImageSearch()
        
        try:
            from services.scripted_search_service import ScriptedReverseImageSearchProvider
            self.scripted_provider = ScriptedReverseImageSearchProvider()
        except ImportError:
            self.scripted_provider = None
        
        
    def upload_temp_image(self, file_path: str) -> str:
        """
        Uploads image to a public temporary host so Google Lens can access it.
        We use catbox.moe for temporary public hosting.
        """
        with open(file_path, 'rb') as f:
            files = {'fileToUpload': f}
            data = {'reqtype': 'fileupload'}
            response = requests.post("https://catbox.moe/user/api.php", files=files, data=data)
            
        if response.status_code == 200:
            return response.text.strip()
        raise Exception("Failed to upload temporary image for search.")

    def find_matching_post(self, file_path: str, progress_callback=None) -> Dict[str, Any]:
        """
        Uploads local image, performs reverse image search, evaluates matches.
        """
        # Import FaceService here to avoid circular imports if any
        from services.face_service import FaceService
        import tempfile
        import uuid

        try:
            # 0. Check local enrollment index first
            import json
            import numpy as np
            from deepface import DeepFace
            
            if os.path.exists("enrollment_index.json"):
                with open("enrollment_index.json", "r") as f:
                    index_data = json.load(f)
                
                # Get representation of the uploaded face using the exact same config
                reps = DeepFace.represent(img_path=file_path, model_name="Facenet512", detector_backend="retinaface", enforce_detection=False)
                if len(reps) > 0:
                    uploaded_embedding = np.array(reps[0]["embedding"])
                    
                    best_dist = float('inf')
                    best_match = None
                    
                    for person in index_data:
                        person_embedding = np.array(person["facenet512_embedding"])
                        # Compute cosine distance
                        dist = 1.0 - np.dot(uploaded_embedding, person_embedding) / (np.linalg.norm(uploaded_embedding) * np.linalg.norm(person_embedding))
                        if dist < best_dist:
                            best_dist = dist
                            best_match = person
                            
                    # Use the same exact global threshold
                    threshold = settings.FACE_DISTANCE_THRESHOLD
                    if best_dist <= threshold:
                        return {
                            "success": True,
                            "match_found": True,
                            "candidates_count": 1,
                            "best_match": {
                                "title": f"Enrollment Match: {best_match.get('name', 'Unknown')}",
                                "source": "Local Index",
                                "post_url": best_match.get("real_profile_url", ""),
                                "image_url": "",
                                "face_similarity": max(0.0, 1.0 - best_dist),
                                "discovery_method": "enrollment_index"
                            },
                            "rejections": [],
                            "diagnostics": {"matches_above_threshold": 1, "faces_compared": 1, "provider": "enrollment_index", "best_dist": float(best_dist)}
                        }

            # 1. Get a public URL for the image
            if progress_callback:
                progress_callback({"detail": "Uploading temporary image to web for Google Lens..."})
            image_url = self.upload_temp_image(file_path)
            
            # 2. Search Strategy (Discovery Layer)
            if progress_callback:
                progress_callback({"detail": "Fetching visual matches from search provider..."})
            
            candidates = []
            discovery_method = "Unknown"
            
            provider_mode = settings.SEARCH_PROVIDER.lower()
            
            # Execute SerpAPI
            serpapi_candidates = []
            if provider_mode in ["serpapi", "hybrid"]:
                try:
                    serpapi_candidates = self.serpapi_provider.search(image_url)
                except Exception as e:
                    print(f"SerpAPI Error: {e}")
            
            # Execute Scripted
            scripted_candidates = []
            if provider_mode in ["scripted", "hybrid"] and self.scripted_provider:
                try:
                    scripted_candidates = self.scripted_provider.search(image_url)
                except Exception as e:
                    print(f"Scripted Search Error: {e}")
                    
            if provider_mode == "hybrid":
                discovery_method = "Hybrid (SerpAPI + Scripted)"
                # Deduplicate by post_url
                seen = set()
                for c in serpapi_candidates + scripted_candidates:
                    if c["post_url"] not in seen:
                        seen.add(c["post_url"])
                        candidates.append(c)
            elif provider_mode == "scripted":
                discovery_method = "Scripted Search"
                candidates = scripted_candidates
            else:
                discovery_method = "SerpAPI"
                candidates = serpapi_candidates
                
            # Truncate to max configured limits
            max_results = getattr(settings, 'MAX_SEARCH_RESULTS', 15)
            candidates = candidates[:max_results]
            
            if progress_callback:
                progress_callback({"candidates_total": len(candidates), "detail": f"Found {len(candidates)} potential candidates online. Checking them now..."})
            
            if not candidates:
                return {
                    "success": False, 
                    "error": f"No candidates found from web search using {discovery_method}.",
                    "diagnostics": {
                        "raw_search_results": 0
                    }
                }
            
            # 3. Candidate Evaluation (Identity Layer)
            best_match = None
            best_final_score = -1.0
            rejection_reasons = []
            running_best_distance = float('inf')
            
            # Initialize diagnostics
            diagnostics = {
                "raw_search_results": len(candidates),
                "social_results": 0,
                "news_results": 0,
                "public_web_results": 0,
                "commercial_results": 0,
                "commercial_rejected": 0,
                "candidates_retained": 0,
                "images_fetched": 0,
                "images_failed": 0,
                "faces_detected": 0,
                "faces_compared": 0,
                "matches_above_threshold": 0,
                "provider": discovery_method
            }
            
            # Domain and keyword classifiers
            commercial_domains = ["shein.", "amazon.", "flipkart.", "aliexpress.", "temu.", "myntra.", "ebay.", "walmart.", "etsy."]
            commercial_keywords = ["buy", "price", "sale", "shop", "men's", "women's", "clothing", "apparel", "catalog"]
            social_domains = ["linkedin.", "instagram.", "facebook.", "twitter.", "x.com", "tiktok.", "pinterest.", "reddit.", "youtube."]
            news_domains = ["news", "times", "post", "journal", "article", "bbc.", "cnn.", "theguardian.", "reuters.", "bloomberg."]
            
            for index, candidate in enumerate(candidates):
                if progress_callback:
                    progress_callback({
                        "candidates_checked": index + 1,
                        "current_candidate_url": candidate.get("image_url", ""),
                        "detail": f"Evaluating candidate {index + 1} of {len(candidates)}..."
                    })
                    
                post_url_lower = candidate.get("post_url", "").lower()
                title_lower = candidate.get("title", "").lower()
                
                # Source Classification
                is_commercial = any(domain in post_url_lower for domain in commercial_domains) or any(kw in title_lower for kw in commercial_keywords)
                is_social = any(domain in post_url_lower for domain in social_domains)
                is_news = any(domain in post_url_lower for domain in news_domains)
                
                if is_commercial:
                    diagnostics["commercial_results"] += 1
                elif is_social:
                    diagnostics["social_results"] += 1
                elif is_news:
                    diagnostics["news_results"] += 1
                else:
                    diagnostics["public_web_results"] += 1
                
                # 1. COMMERCIAL FILTER
                # Aggressively filter commercial/product results to save face compute
                if is_commercial and "author" not in title_lower and "profile" not in title_lower:
                    rejection_reasons.append(f"Candidate {index} ({candidate.get('source', 'Unknown')}): Rejected — COMMERCIAL/PRODUCT filter.")
                    diagnostics["commercial_rejected"] += 1
                    continue
                
                # 2. VALIDATION
                if not candidate.get("post_url"):
                    rejection_reasons.append(f"Candidate {index}: Missing URL")
                    continue
                
                candidate_img_url = candidate.get("image_url")
                if not candidate_img_url:
                    rejection_reasons.append(f"Candidate {index} ({candidate.get('source', 'Unknown')}): IMAGE_INACCESSIBLE (Missing image URL)")
                    diagnostics["images_failed"] += 1
                    continue
                
                diagnostics["candidates_retained"] += 1
                
                # 3. IMAGE RETRIEVAL
                try:
                    response = requests.get(candidate_img_url, timeout=10)
                    if response.status_code != 200:
                        rejection_reasons.append(f"Candidate {index} ({candidate.get('source', 'Unknown')}): IMAGE_UNFETCHABLE / BLOCKED SOURCE (HTTP {response.status_code})")
                        diagnostics["images_failed"] += 1
                        continue
                        
                    # Validate image with PIL
                    try:
                        img = Image.open(io.BytesIO(response.content))
                        img.verify()
                        img = Image.open(io.BytesIO(response.content)) # reopen to check size
                        width, height = img.size
                        if width < 80 or height < 80:
                            raise ValueError(f"Image too small: {width}x{height}")
                    except Exception as img_e:
                        rejection_reasons.append(f"Candidate {index} ({candidate.get('source', 'Unknown')}): IMAGE_UNFETCHABLE / BLOCKED SOURCE ({str(img_e)})")
                        diagnostics["images_failed"] += 1
                        continue
                        
                    import hashlib
                    os.makedirs("saved_candidates", exist_ok=True)
                    url_hash = hashlib.md5(candidate_img_url.encode()).hexdigest()[:8]
                    temp_candidate_path = os.path.join("saved_candidates", f"candidate_idx{index}_{url_hash}.jpg")
                    with open(temp_candidate_path, "wb") as f:
                        f.write(response.content)
                    
                    diagnostics["images_fetched"] += 1
                except Exception as e:
                    rejection_reasons.append(f"Candidate {index} ({candidate.get('source', 'Unknown')}): IMAGE_UNFETCHABLE / BLOCKED SOURCE ({str(e)})")
                    diagnostics["images_failed"] += 1
                    continue

                # 4. FACE DETECTION & COMPARISON
                face_result = FaceService.compare_faces(file_path, temp_candidate_path)
                
                # Image is preserved in saved_candidates directory for evidence
                
                if not face_result.get("success"):
                    rejection_reasons.append(f"Candidate {index} ({candidate.get('source', 'Unknown')}): Rejected — {face_result.get('error', 'no detectable face')}")
                    continue
                
                diagnostics["faces_detected"] += face_result.get("faces_detected", 1)
                diagnostics["faces_compared"] += face_result.get("faces_detected", 1)
                
                similarity = face_result.get("similarity", 0.0)
                candidate["face_similarity"] = similarity
                candidate["decision"] = "Evaluated"
                
                threshold = face_result.get("threshold", 0.68)
                is_verified = face_result.get("verified", False)
                distance = face_result.get("distance", float('inf'))
                confidence = face_result.get("confidence", 0.0)
                
                if distance < running_best_distance:
                    running_best_distance = distance
                    if progress_callback:
                        progress_callback({
                            "best_distance": running_best_distance,
                            "best_candidate_url": candidate_img_url
                        })
                
                if not is_verified:
                    rejection_reasons.append(f"Candidate {index} ({candidate.get('source', 'Unknown')}): Rejected — verified: False, distance: {distance:.3f} (thresh: {threshold:.2f}), conf: {confidence:.2f}")
                    continue
                
                diagnostics["matches_above_threshold"] += 1
                
                # 5. RANKING SCORE
                # Score is purely face similarity (higher is better)
                final_score = similarity
                
                rejection_reasons.append(f"Candidate {index} ({candidate.get('source', 'Unknown')}): ACCEPTED — verified: True, distance: {distance:.3f}, conf: {confidence:.2f}")
                
                if final_score > best_final_score:
                    best_final_score = final_score
                    best_match = candidate
                    best_match["discovery_method"] = discovery_method
                    
            if best_match:
                # Add Identity Dossier enrichment
                if progress_callback:
                    progress_callback({"detail": "Extracting Identity Dossier...", "status": "processing"})
                
                # Collect all candidate titles to find consensus on identity
                all_titles = [c.get("title", "") for c in candidates if c.get("title")]
                best_match["identity_profile"] = self._enrich_identity(best_match.get("title", ""), all_titles)
                
            if not best_match:
                return {
                    "success": True, 
                    "match_found": False,
                    "candidates_count": len(candidates),
                    "error": "No reliable face match found.",
                    "rejections": rejection_reasons,
                    "diagnostics": diagnostics
                }
                
            return {
                "success": True,
                "match_found": True,
                "candidates_count": len(candidates),
                "best_match": best_match,
                "rejections": rejection_reasons,
                "diagnostics": diagnostics
            }
        except Exception as e:
            return {"success": False, "error": str(e), "diagnostics": {"raw_search_results": 0}}

    def _extract_likely_name(self, titles: list) -> str:
        import re
        from collections import Counter
        
        # Stop words that typically indicate a non-person entity
        stop_words = {
            'University', 'College', 'Institute', 'Academy', 'School', 'Team', 'Group', 'Organization', 
            'Corp', 'Inc', 'Ltd', 'LLC', 'Foundation', 'Association', 'Wikipedia', 'Wiki', 'Facebook', 
            'Twitter', 'LinkedIn', 'Instagram', 'Pinterest', 'Kendra', 'Bharatha', 'Corruption', 'Against', 
            'News', 'Daily', 'Post', 'Times', 'Journal', 'Media', 'TV', 'Radio', 'Network', 'Samvada', 
            'Vishwa', 'President', 'Director', 'Chairman', 'CEO', 'Founder', 'Profile'
        }
        stop_words_lower = {w.lower() for w in stop_words}
        
        phrases = []
        for t in titles:
            if not t: continue
            # Split by common title separators
            parts = re.split(r'\||-|:|—|–', t)
            for part in parts:
                part = part.strip()
                # Find consecutive capitalized words (2 to 4 words)
                matches = re.findall(r'\b(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b', part)
                for match in matches:
                    words = match.split()
                    # Skip if any word is a known non-person stop word
                    if any(w.lower() in stop_words_lower for w in words):
                        continue
                    phrases.append(match)
                    
        if phrases:
            counter = Counter(phrases)
            most_common = counter.most_common()
            
            # If the most frequent phrase appears more than once, use it
            if most_common[0][1] > 1:
                return most_common[0][0]
                
            # Otherwise, prefer pure names (2-3 words) instead of long descriptions
            valid_names = [p for p in phrases if 2 <= len(p.split()) <= 3]
            if valid_names:
                return min(valid_names, key=len)
                
            return most_common[0][0]
            
        return ""

    def _enrich_identity(self, matched_title: str, all_titles: list = None) -> dict:
        """
        Extracts a clean Name and Bio using candidate titles and Google Knowledge Graph.
        """
        if not settings.SERPAPI_KEY:
            return {"name": "Unknown Identity", "bio": "No context available."}
            
        try:
            # 1. Try to extract a consensus name from all visual matches
            likely_name = ""
            if all_titles:
                likely_name = self._extract_likely_name(all_titles)
            
            # The search query is the extracted name if found, else the raw title
            search_query = likely_name if likely_name else matched_title
            if not search_query:
                return {"name": "Unknown", "bio": "Could not extract identity details."}

            from serpapi import GoogleSearch
            params = {
                "engine": "google",
                "q": search_query,
                "api_key": settings.SERPAPI_KEY,
                "hl": "en"
            }
            search = GoogleSearch(params)
            results = search.get_dict()
            
            # 2. Try Knowledge Graph first
            if "knowledge_graph" in results:
                kg = results["knowledge_graph"]
                title = kg.get("title", "")
                if title:
                    return {
                        "name": title,
                        "bio": kg.get("description", kg.get("type", ""))
                    }
                    
            # 3. Fallback to first organic result
            if "organic_results" in results and len(results["organic_results"]) > 0:
                first_res = results["organic_results"][0]
                # If we had a likely name, use it. Otherwise clean the title.
                if likely_name:
                    name = likely_name
                else:
                    raw_title = first_res.get("title", "")
                    name = raw_title.split(" - ")[0].split(" | ")[0].strip()
                    
                if name:
                    return {
                        "name": name,
                        "bio": first_res.get("snippet", "No detailed biography found.")
                    }
                    
            return {"name": likely_name or "Unknown", "bio": "Could not extract identity details."}
        except Exception as e:
            print(f"Identity enrichment failed: {e}")
            return {"name": "Unknown", "bio": "Failed to fetch identity."}

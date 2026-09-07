import os
import shutil
import uuid
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any

from config import settings
from services.face_service import FaceService
from services.search_service import SearchService
from services.hashing_service import HashingService
from services.blockchain_service import BlockchainService

app = FastAPI(title="Face Verification API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

jobs: Dict[str, Dict[str, Any]] = {}
search_service = SearchService()

try:
    blockchain_service = BlockchainService()
except Exception as e:
    print(f"Warning: Blockchain service init failed: {e}")
    blockchain_service = None

@app.post("/api/verify/start")
async def start_verification(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    job_id = str(uuid.uuid4())
    
    temp_dir = "temp_uploads"
    os.makedirs(temp_dir, exist_ok=True)
    file_path = os.path.join(temp_dir, f"{job_id}_{file.filename}")
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    jobs[job_id] = {
        "id": job_id,
        "status": "FACE_DETECTION",
        "progress": 10,
        "results": {},
        "error": None,
        "progress_dict": {
            "stage": "Initializing...",
            "detail": "Setting up workspace",
            "candidates_total": 0,
            "candidates_checked": 0,
            "current_candidate_url": "",
            "best_distance": 1.0,
            "best_candidate_url": ""
        }
    }
    
    background_tasks.add_task(process_pipeline, job_id, file_path)
    
    return {"job_id": job_id}

def process_pipeline(job_id: str, file_path: str):
    job = jobs[job_id]
    
    def update_progress(data: dict):
        if "progress_dict" in job:
            job["progress_dict"].update(data)
            
    try:
        # 1. Face Detection
        job["status"] = "FACE_DETECTION"
        update_progress({"stage": "Detecting Face", "detail": "Extracting high-dimensional facial embeddings..."})
        
        face_result = FaceService.process_image(file_path)
        if not face_result.get("success"):
            job["status"] = "ERROR"
            job["error"] = face_result.get("error", "Face detection failed")
            update_progress({"stage": "Error", "detail": job["error"]})
            return
            
        job["results"]["face"] = face_result
        job["progress"] = 30
        
        # 2. Web Search & Identity Verification
        job["status"] = "WEB_SEARCH"
        update_progress({"stage": "Identity Discovery", "detail": "Searching the web and matching candidates..."})
        
        search_result = search_service.find_matching_post(file_path, progress_callback=update_progress)
        
        if not search_result.get("success"):
            job["status"] = "ERROR"
            job["error"] = search_result.get("error", "Web search failed")
            update_progress({"stage": "Error", "detail": job["error"]})
            return
            
        job["results"]["search"] = search_result
        job["progress"] = 60
        
        # If no match was found, we terminate early as NO_MATCH
        if not search_result.get("match_found"):
            job["status"] = "NO_MATCH"
            job["progress"] = 100
            update_progress({"stage": "No Match Found", "detail": "Finished checking candidates without finding a match."})
            return
        
        # 3. Hashing
        job["status"] = "HASHING"
        update_progress({"stage": "Content Fingerprint", "detail": "Generating cryptographic hash of discovered identity..."})
        
        post_data = search_result["best_match"]
        content_hash = HashingService.generate_hash(post_data)
        
        job["results"]["hash"] = content_hash
        job["results"]["canonical_data"] = HashingService.canonicalize_post_data(post_data)
        job["progress"] = 80
        
        # 4. Blockchain Submission
        job["status"] = "BLOCKCHAIN_SUBMISSION"
        update_progress({"stage": "Blockchain Committal", "detail": "Writing fingerprint to Ethereum smart contract..."})
        
        if not blockchain_service:
            raise Exception("Blockchain service not available. Check CONTRACT_ADDRESS.")
            
        source_ref = post_data.get("post_url", "unknown")
        bc_result = blockchain_service.store_hash(content_hash, source_ref)
        
        if not bc_result.get("success"):
            job["status"] = "ERROR"
            job["error"] = bc_result.get("error", "Blockchain submission failed")
            update_progress({"stage": "Error", "detail": job["error"]})
            return
            
        job["results"]["blockchain"] = bc_result
        job["status"] = "COMPLETED"
        job["progress"] = 100
        update_progress({"stage": "Completed", "detail": "Identity successfully verified and locked on chain."})
        
    except Exception as e:
        job["status"] = "ERROR"
        job["error"] = str(e)
        update_progress({"stage": "Error", "detail": str(e)})
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

@app.get("/api/verification/{job_id}")
async def get_verification_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]

@app.get("/api/status/{job_id}")
async def get_live_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id].get("progress_dict", {})

@app.post("/api/verification/{job_id}/verify")
async def verify_integrity(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
        
    job = jobs[job_id]
    if job["status"] != "COMPLETED":
        raise HTTPException(status_code=400, detail="Job not completed yet")
        
    post_data = job["results"]["search"]["best_match"]
    computed_hash = HashingService.generate_hash(post_data)
    
    bc_result = blockchain_service.verify_hash(computed_hash)
    
    return {
        "computed_hash": computed_hash,
        "blockchain_result": bc_result,
        "is_verified": bc_result.get("verified", False)
    }

@app.post("/api/verification/{job_id}/tamper-test")
async def tamper_test(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
        
    job = jobs[job_id]
    if job["status"] != "COMPLETED":
        raise HTTPException(status_code=400, detail="Job not completed yet")
        
    tampered_data = job["results"]["search"]["best_match"].copy()
    tampered_data["title"] = tampered_data.get("title", "") + " [MODIFIED]"
    
    computed_hash = HashingService.generate_hash(tampered_data)
    original_hash = job["results"]["hash"]
    
    return {
        "computed_hash": computed_hash,
        "original_hash": original_hash,
        "is_verified": False,
        "tampered_data": tampered_data
    }

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

# FaceChain Verification System

FaceChain Verification System is an end-to-end pipeline that takes a user's face scan, identifies their online presence via reverse image search (using Google Lens API through SerpApi), hashes the discovered data (e.g., social media URLs), and securely records the hash on a local Ethereum blockchain (Hardhat) to establish an immutable identity record.

## Architecture & Tech Stack
1. **Frontend**: Next.js (React), Tailwind CSS, Framer Motion for animations.
2. **Backend**: FastAPI (Python), DeepFace (Face Recognition/Encoding).
3. **Search Engine**: SerpApi (Google Lens Reverse Image Search).
4. **Blockchain**: Ethereum smart contract deployed on a local Hardhat node, interacting via Web3.py.
5. **Storage**: Local filesystem for temp processing, `tmpfiles.org` for temporary public URL exposure (required for Google Lens to consume the image).

## Features
- **Face Scan Input**: Drag and drop a facial image.
- **Dual-Path Identity Verification**: 
  - **Local Index**: Instantly checks the uploaded face against a secure, local JSON enrollment index (`enrollment_index.json`).
  - **Live Web Search Fallback**: If no local match is found, performs a reverse image search via Google Lens to find the person's digital footprint.
- **Strict Face Verification**: Validates potential matches using `Facenet512` model with a strict cosine distance threshold of `0.35` to eliminate visually similar false positives (e.g. stock photos, models).
- **Domain Pre-filtering**: Filters out obvious commercial/e-commerce domains prior to heavy facial comparison.
- **Hashing**: Generates a SHA-256 hash of the extracted digital identity data.
- **Blockchain Verification**: Submits the hash to an Ethereum smart contract and retrieves the transaction hash.
- **Tamper Simulation**: Built-in functionality to simulate tampering with the digital data and verifying it against the blockchain record.

## Setup Instructions

### Prerequisites
- Node.js (v18+)
- Python (3.10+)
- MetaMask (Optional, for manual chain inspection)

### 1. Blockchain (Hardhat Node)
```bash
cd blockchain
npm install
npx hardhat node
```
Leave the node running. In a new terminal, deploy the contract:
```bash
cd backend
venv\Scripts\python deploy.py
```

### 2. Backend (FastAPI)
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```
**Environment Variables**: Create a `.env` file in the `backend/` directory:
```
SERPAPI_KEY=your_serpapi_key_here
FACE_DISTANCE_THRESHOLD=0.35
```
*(A SerpApi key is required for reverse image search. Get one at serpapi.com)*

**Run the Backend**:
```bash
uvicorn main:app --reload --port 8000
```

### 3. Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` (or `http://localhost:3001` if port 3000 is in use) in your browser.

## Architecture & Configuration Decisions
- **Facial Recognition Model**: We utilize **Facenet512** combined with **RetinaFace** for detection. After extensive calibration, Facenet512 proved superior to ArcFace in separating genuine identity matches from high-similarity false positives (e.g., visually similar product models with similar facial geometry).
- **Distance Metric & Threshold**: We use **Cosine Distance** with a strict threshold of **0.35**. Distances below `0.35` indicate a verified match. This threshold was empirically determined to successfully reject visual look-alikes (distances ~0.9+) while accepting genuine matches under varying lighting and compression (distances ~0.15 - 0.25).

## Limitations & Edge Cases Handled
1. **Google Lens API Constraints**: Google Lens (via SerpApi) requires a *publicly accessible URL* for reverse image search. To circumvent local limitations, the backend uploads the uploaded image to `catbox.moe` temporarily to get a public URL for SerpApi to consume. This introduces an external dependency that could fail or rate limit. 
2. **Web Search Fallbacks**: If SerpApi fails or times out, the local index is strictly relied upon. If neither finds a match, the pipeline intentionally aborts.
3. **Model Limitations**: DeepFace relies on pre-trained models. While robust, real-world constraints like poor lighting, heavy makeup, or extreme side profiles might result in failed detections or artificially inflated distance scores.
4. **Local Network**: The blockchain operates on a local Hardhat node (`localhost:8545`). Production deployment would require migrating to a testnet (e.g., Sepolia) or mainnet.

## Demo Flow
1. **Enrollment**: (Optional) Populate `backend/enrollment_index.json` with a reference photo embedding to demonstrate instantaneous index matching.
2. Upload a picture of yourself or a known public figure.
3. Watch the Pipeline Stepper move through: `Detecting Face -> Checking Index / Searching Web -> Hashing Data -> Storing on Blockchain`.
4. View the Result Dashboard.
5. Click `Simulate Tampering` to see the blockchain verification fail when the data is altered.

# 🔍 Decentralized Identity & Verification Platform

This is an advanced, end-to-end OSINT and blockchain pipeline. It takes a user's facial scan, identifies their online digital footprint via hybrid reverse image search (Google Lens + Bing), verifies the identity using deep learning facial recognition, and securely anchors the discovered identity hash onto a local Ethereum blockchain to establish an immutable, verifiable record.

Designed with a premium Glassmorphism UI, it bridges the gap between web-scale open-source intelligence (OSINT) and decentralized cryptographic trust.

---

## ✨ Key Features

- **Hybrid Reverse Image Search**: Utilizes both Google Lens and Bing Reverse Image Search (via SerpApi) to scour the web for instances of the uploaded face.
- **Strict Biometric Verification**: Employs the `Facenet512` model combined with `RetinaFace` detection to perform strict 1:1 facial verification against web results. A strict cosine distance threshold (`0.35`) eliminates visually similar false positives.
- **Intelligent NLP Extraction**: Uses natural language heuristics and NLP stop-word filtering to extract clean, consensus-based names and biographies from noisy web titles, filtering out organizations and generic keywords.
- **Blockchain Anchoring**: Generates a SHA-256 hash of the extracted digital identity data and submits it to an Ethereum smart contract (`VerificationRegistry`).
- **Tamper-Evident Design**: Features a built-in UI toggle to simulate data tampering, instantly proving whether the displayed identity data matches the immutable blockchain hash.
- **Premium Aesthetics**: Built with a highly responsive, modern Glassmorphism UI using Next.js, Tailwind CSS, and Framer Motion.

---

## 🏗️ Architecture & Tech Stack

**Frontend**
* Framework: Next.js (React)
* Styling: Tailwind CSS
* Animations: Framer Motion

**Backend (AI & OSINT)**
* Framework: FastAPI (Python)
* Facial Recognition: DeepFace (`Facenet512`)
* NLP & Heuristics: Spacy, Regex
* Search Engine APIs: SerpApi (Google Lens + Bing)

**Blockchain**
* Network: Local Ethereum Node (Hardhat)
* Smart Contracts: Solidity
* Integration: Web3.py

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Python (3.10+)
- MetaMask (Optional, for manual chain inspection)
- [SerpApi Key](https://serpapi.com/) (Required for Google Lens/Bing search)

### 1. Blockchain Node & Smart Contract
Open a terminal and start the local blockchain node:
```bash
cd blockchain
npm install
npx hardhat node
```
*Leave this terminal running.*

Open a second terminal to deploy the contract:
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python deploy.py
```

### 2. Backend API
In the same backend terminal, create your environment variables file:
Create a `.env` file in the `backend/` directory:
```env
SERPAPI_KEY=your_serpapi_key_here
FACE_DISTANCE_THRESHOLD=0.35
```

Run the FastAPI server:
```bash
uvicorn main:app --reload --port 8000
```
*The backend will now be running on `http://localhost:8000`.*

### 3. Frontend Application
Open a third terminal for the frontend:
```bash
cd frontend
npm install
npm run dev
```
Navigate to `http://localhost:3000` in your browser to use the application.

---

## ⚙️ How It Works (Under the Hood)

1. **Upload & Hosting**: The user drops an image into the UI. The backend temporarily hosts this image on `tmpfiles.org` to generate a public URL required by search engines.
2. **Hybrid OSINT Search**: The public URL is fed into SerpApi, querying both Google Lens and Bing. The system aggregates image results, filtering out low-quality or e-commerce domains.
3. **Biometric Filtering**: DeepFace downloads the candidate images from the web and compares them against the original uploaded image. Only images with a facial cosine distance `< 0.35` are kept.
4. **Identity Extraction**: The metadata (titles, snippets) from the biometrically verified web results are processed. Noise words (e.g., "University", "Committee") are stripped, and a consensus algorithm identifies the most likely human name and bio.
5. **Blockchain Hashing**: The finalized identity data (Name, Bio, Source Links) is serialized into JSON and hashed using SHA-256. This hash is written to the `VerificationRegistry` smart contract.

---

## ⚠️ Limitations & Edge Cases

- **Public URL Requirement**: SerpApi requires a publicly accessible URL for reverse image search. The temporary upload to `tmpfiles.org` introduces a third-party dependency.
- **DeepFace Constraints**: Real-world variables like extreme lighting, heavy occlusion, or highly compressed web images can inflate distance scores, causing false negatives.
- **API Rate Limits**: Heavy usage will quickly deplete SerpApi free-tier credits.

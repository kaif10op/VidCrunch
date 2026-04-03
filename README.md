# 🧠 VidCrunch: The Elite YouTube Analysis Platform

**VidCrunch** is a high-fidelity, professional-grade platform designed to transform noisy YouTube content into structured, logically-grouped narrative knowledge. It leverages an unstoppable extraction architecture and semantic AI synthesis to provide a "Premium Reader" experience for every video.

---

## 🚀 Core Value Propositions

### 💎 Premium Reader Engine
- **Narrative Grouping**: Raw Word-Bursts are logically clustered into 30-45 second semantic paragraphs.
- **Heuristic Sentencizer**: Automatic punctuation and capitalization of auto-generated transcripts, transforming word-streams into professional narrative.
- **Speaker De-Marker**: Automatic removal of noisy markers (e.g., `>>`) for a clean, logical flow.

### 🧬 Total Spectrum Identity Recovery
- **5-Layer Metadata Lane**: 100% video identification (Title, Duration, Thumbnail) via:
    1. **Internal JSON**: `ytInitialPlayerResponse` parsing.
    2. **OpenGraph**: Social meta-tag extraction.
    3. **Schema.org**: Structured search-engine markers.
    4. **Twitter Cards**: Alternative identity standards.
    5. **Native HTML**: Deep-scrape fallbacks.
- **Zero "Untitled" Guarantee**: Identity is restored even under heavy YouTube restriction.

### 🗺️ AI Roadmap Synthesis (Chapters)
- **High-Fidelity Chapters**: If a video lacks native YouTube chapters, VidCrunch synthesizes **5-12 logical chapters** covering the entire duration.
- **Topic-Based Navigation**: Every dashboard provides an instant, semantic roadmap for deep learning.

### 🛡️ Unstoppable "Triple-Lane" Extraction
1. **Lane 1 (Standard API)**: High-speed transcript and metadata extraction.
2. **Lane 2 (yt-dlp Engine)**: Deep identity bypass for non-API compatible videos.
3. **Lane 3 (Deep-Scrape)**: Authenticated mweb identity masking (Redbeat/Celery resilient).
- **Identity Jitter**: Randomized user-agents and mweb session masks to bypass "Sign-in" blocks.
- **Cookie Support**: Integrated `cookies.txt` management for authenticated extraction.

---

## 🛠️ Technical Architecture

### **Backend (FastAPI & Python)**
- **Core Engine**: `transcript.py` (Metadata Resilience & Sentencizer).
- **AI Pipeline**: `ai_pipeline.py` (Groq/Gemini/OpenRouter synthesis).
- **Vast Scalability**: Celery + Redis + Redbeat for background processing of 10+ hour videos.

### **Frontend (React & TypeScript)**
- **Modern UI**: Stunning, dark-mode first design with glassmorphism and premium aesthetics.
- **Dynamic Content**: Real-time progress tracking and modular analysis components (Full Summary, Quiz, Mind Map, Flashcards).

---

## 🏗️ Installation & Setup

### **Quick Start (Docker)**
1.  Clone the repository and place your `cookies.txt` in the `/backend/` directory.
2.  Configure environment variables in `.env` (API Keys for Groq, Groq Models, etc.).
3.  Run the system:
    ```bash
    docker compose up --build -d
    ```

### **Manual Backend Setup**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

---

## 📊 Developer Operations
- **System Verification**: Run the regression test suite:
    ```bash
    docker compose exec worker python3 /app/verify_engine.py [VIDEO_ID]
    ```
- **Resilience Monitoring**: Checks for "Lane 3" fallsback and identity recovery in logs.

---

**VidCrunch is built for those who demand professional structural clarity and elite readability from every video. 🚀**

🌌 Vella Chat Interface
Offline-First AI Chat for Android & PC.
v4.0.0 | Local Backend | PostgreSQL History | Native Android Frontend | Real-Time Streaming

Vella Chat is a private, local-first AI messaging interface. It runs on your Android device but connects securely to your local PC's powerful AI backend. It provides a ChatGPT-like experience with zero subscriptions, zero data harvesting, and full persistence.

New in v4.0.0: Vella now features Persistent Chat History (via PostgreSQL), a new History Dashboard, and optimized connectivity for Ngrok tunneling.

🛠️ Core Technology Stack
The Brain (Backend)
API Framework: FastAPI (Python 3.10+) — Supports StreamingResponse.

Database: PostgreSQL — Stores User Accounts, Sessions, and Message Logs.

LLM Engine: Custom chat_agent.py using TextIteratorStreamer for instant token generation.

Voice Engine:

STT: Faster-Whisper for transcribing voice notes.

TTS: Piper TTS for reading messages aloud.

Memory: Weaviate — Vector database for long-term conversation semantic search.

Connectivity: ngrok — Secure tunnel for mobile access.

The Interface (Frontend)
Framework: React + Vite (TypeScript)

Native Wrapper: Capacitor JS (Android)

Data Layer: vellaService.ts — Handles streaming, history fetching, and Ngrok bypass headers.

UI Components: HistoryDashboard, Tailwind CSS, Lucide React, Custom Waveforms.

🚀 Quick Start Guide
1. Database Setup (PostgreSQL)
Ensure you have a PostgreSQL database running locally. Update your .env or db.py with the connection string:

Bash
DATABASE_URL="postgresql://postgres:password@localhost:5432/vella"
2. Start the Backend (PC)
Ensure FFmpeg is installed on your system.

Bash
cd backend

# Install dependencies
pip install fastapi uvicorn psycopg2-binary python-dotenv transformers torch faster-whisper

# Start the Vella Server on Port 8001 (Auto-initializes Tables)
uvicorn main:app --reload --host 0.0.0.0 --port 8001
3. Open the Tunnel
Allow your Android device to reach your local PC:
\
Bash
ngrok http 8001
Copy the https://... URL provided by ngrok.

4. Build the Android App
Bash
cd frontend

# Install & Build
npm install
npm run build

# Sync to Android Studio & Run
npx cap sync
npx cap open android
📱 Configuration
1. Update API URL & Headers
In frontend/src/services/vellaService.ts, update BACKEND and ensure the Ngrok bypass header is present:

TypeScript
const BACKEND = "https://your-ngrok-id.ngrok-free.app";

// In fetch requests:
headers: {
  "Content-Type": "application/json",
  "ngrok-skip-browser-warning": "true" // Required for fetching history over free Ngrok
}
2. Android Permissions
Ensure android/app/src/main/AndroidManifest.xml includes:

XML
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
📂 Project Structure
Plaintext
VELLA-CHAT/
├── backend/
│   ├── main.py             # FastAPI App (Port 8001)
│   ├── db.py               # PostgreSQL Connection & Schema Init
│   ├── auth.py             # User Registration & Login Logic
│   ├── chat_agent.py       # LLM Streaming Logic
│   └── vector_store.py     # Weaviate Memory Management
├── frontend/
│   ├── src/
│   │   ├── components/     # HistoryDashboard, MessageBubble, Waveform
│   │   ├── services/
│   │   │   ├── ttsService.ts      # Zero-Latency Audio Queue
│   │   │   └── vellaService.ts    # API Wrapper (Chat & History)
│   │   ├── utils/
│   │   │   └── streamProcessor.ts # Sentence Buffer
│   │   └── App.tsx         # Main Interface Logic
│   └── android/            # Native Project Files
└── README.md
🎙️ Key Features (v4.0.0)
🗄️ Persistent History: Chats are automatically saved to PostgreSQL. Reloading the app restores your sessions.

📊 History Dashboard: A sleek sidebar interface to browse, search, and manage past conversations.

⚡ Instant Text Streaming: Responses type out character-by-character in real-time.

🗣️ Smart Read-Aloud: Pipeline architecture plays sentence audio while downloading the next one.

🌊 Visual Voice Notes: Send audio messages with a real-time waveform visualization.

🛣️ Roadmap
[x] Chat History: Full PostgreSQL integration for saving/loading sessions.

[ ] Long-Term Memory: Connect Weaviate to recall user details across sessions.

[ ] Secure Auth: Upgrade to JWT tokens for persistent login sessions.

[ ] Image Gen: Add stable-diffusion support for generating images in chat.

[ ] File Analysis: Upload PDFs or text files for Vella to read.
# Gemini Chatbot (Next.js + NestJS)

```
chatbot/
├── backend/   NestJS API   → POST /api/chat   (port 4000)
└── frontend/  Next.js UI                      (port 3000)
```

The browser never sees your API key. The frontend calls the NestJS backend,
and the backend calls Gemini.

## Setup

Requires Node.js 18.18+.

### 1. Backend
```bash
cd backend
cp .env.example .env        # then paste your key into GEMINI_API_KEY
npm install
npm run start:dev
```

### 2. Frontend (new terminal)
```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Open http://localhost:3000

## API

`POST /api/chat`
```json
{ "messages": [{ "role": "user", "content": "Hello" }] }
```
Returns `{ "reply": "..." }`. Send the full history each time; the backend is stateless.

## Config (backend/.env)
| Variable | Default | Notes |
|---|---|---|
| GEMINI_API_KEY | – | required |
| GEMINI_MODEL | gemini-2.5-flash | any Gemini model id |
| FRONTEND_URL | http://localhost:3000 | CORS origin |
| PORT | 4000 | |

---

## Laws search with Python + ChromaDB (no LM Studio embeddings)

LM Studio only runs the chat model (Gemma). A small Python service holds the
embedding model and the vector database.

```bash
cd retrieval
python -m venv .venv                 # use Python 3.11 or 3.12 (see note)
.venv\Scripts\activate               # Windows   (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
python ingest.py ../backend/data/laws.jsonl      # once; rerun when data changes
python -m uvicorn server:app --port 8000         # keep running
```

Then in `backend/.env` uncomment `RETRIEVAL_URL=http://localhost:8000`,
set `LMSTUDIO_CHAT_MODEL`, and start the backend + frontend as usual.

Embedding model: set `EMBED_MODEL` (default `BAAI/bge-small-en-v1.5`). For Bangla
use `BAAI/bge-m3`. After changing it, rerun `ingest.py`.

Note: very new Python versions (3.13/3.14) may lack prebuilt wheels for
torch/chromadb. If `pip install` fails, install Python 3.12 and recreate the venv.

---

## Google login + chat history (Firebase)

How it works: the browser signs in with Google (Firebase Auth) and sends the
login token to the NestJS backend. The backend verifies it and is the **only**
thing that reads/writes Firestore, so users can only ever see their own chats.

### One-time Firebase setup
1. https://console.firebase.google.com -> **Add project** (the free Spark plan is enough).
2. **Build -> Authentication -> Get started -> Sign-in method -> Google -> Enable** (pick a support email, save).
   `localhost` is already an authorized domain. Add your real domain here when you deploy.
3. **Build -> Firestore Database -> Create database** -> choose a location -> **Production mode**.
   (The default "deny all" rules are what we want; see `firestore.rules`.)
4. **Project settings (gear) -> General -> Your apps -> Web (</>)** -> register an app.
   Copy `apiKey`, `authDomain`, `projectId`, `appId` into `frontend/.env.local`.
5. **Project settings -> Service accounts -> Generate new private key.**
   Save the file as `backend/firebase-service-account.json`
   (already in .gitignore - never commit or share it).

### Config files
- `frontend/.env.local`: the four NEXT_PUBLIC_FIREBASE_* values.
- `backend/.env`: `FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json`

Restart both dev servers after editing env files.

### API (all require `Authorization: Bearer <Firebase ID token>`)
| Method | Path | Purpose |
|---|---|---|
| POST | /api/chat | `{ chatId?, message }` -> `{ chatId, title, reply, sources }` |
| GET | /api/chats | list your chats |
| GET | /api/chats/:id | one chat with its messages |
| DELETE | /api/chats/:id | delete a chat |

### Firestore data
```
users/{uid}                              profile
users/{uid}/chats/{chatId}               { title, createdAt, updatedAt }
users/{uid}/chats/{chatId}/messages/{id} { role, content, sources, order }
```

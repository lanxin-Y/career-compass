# Career Compass 🧭

AI-powered career gap analysis and growth planning tool.

Upload your resume + paste a job description → get a detailed gap analysis → pick a skill to improve → get a step-by-step learning plan with trackable tasks.

## Features

- **Gap Analysis**: AI compares your resume against any job description
- **Deep Dive Plans**: Select a skill gap and get a concrete action plan
- **Task Tracking**: Check off tasks as you complete them
- **Manual Projects**: Create your own checklist projects (no AI required)
- **Gamification**: Earn XP and level up as you complete learning tasks
- **Dedup Cache**: Same resume + JD combo won't burn extra API calls
- **Multi-provider AI**: Switch between Claude and DeepSeek
- **Access code gate**: Simple frontend password for private demos

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Python FastAPI + SQLite (async)
- **AI**: Claude API (Anthropic) and DeepSeek — two-round analysis
- **Deployment**: Vercel (frontend) + Render (backend)

## Local Development

### Backend

```bash
cd backend
python3 -m venv ../venv   # first time only
source ../venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # or use repo-root .env — add your API keys
python run.py
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env      # set access code and API URL
npm run dev
```

Open `http://localhost:5173` in your browser. Enter the access code from `frontend/.env` (`VITE_ACCESS_CODE`).

## Architecture

```
User → React Frontend → FastAPI Backend → Claude / DeepSeek API
                              ↓
                          SQLite DB
                     (analyses, plans, tasks)
```

## Environment Variables

### Frontend (`frontend/.env`)

| Variable | Purpose |
|----------|---------|
| `VITE_ACCESS_CODE` | Password gate code |
| `VITE_API_URL` | Backend API base, e.g. `http://localhost:8000/api` |

### Backend (repo-root `.env` or `backend/.env`)

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude API key |
| `DEEPSEEK_API_KEY` | DeepSeek API key (optional) |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |
| `DEEPSEEK_MODEL` | e.g. `deepseek-v4-pro` / `deepseek-v4-flash` |

## Screenshots

*(Add screenshots here after deployment)*

## Status

Phases 1–4 complete: AI core, FastAPI + SQLite, React UI, password gate + deploy prep.

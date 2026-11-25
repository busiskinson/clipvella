# ClipForge worker

Runs the long jobs the web app queues in Supabase (`public.jobs`): transcription (Groq Whisper),
highlight detection (Gemini), speech detection (Silero VAD), scene detection (PySceneDetect) and all
rendering (FFmpeg). It polls the queue, so it works behind a home router with no open ports.

## One-time setup (Windows)

```powershell
winget install Gyan.FFmpeg
winget install astral-sh.uv
cd worker
uv python install 3.12
uv sync
copy .env.example .env   # then fill in the keys below
```

`worker/.env` (never commit it):

| Variable | Where to get it |
|---|---|
| `SUPABASE_URL` | already filled in |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API keys → `service_role` / secret key |
| `GROQ_API_KEY` | https://console.groq.com/keys (free) |
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey (free) |
| `WHISPER_MODEL`, `GEMINI_MODEL` | optional overrides |

## Run

```powershell
cd worker
uv run python -m clipforge_worker --check   # tools + which keys are set
uv run python -m clipforge_worker           # process jobs until you press Ctrl+C
```

The app shows "Waiting for the worker" on queued jobs while it isn't running; jobs start as soon as it is.
Jobs whose worker stops mid-way are retried (up to 3 attempts) after 10 minutes.

## Tests

```powershell
uv run pytest -q
```

## Swapping providers

`clipforge_worker/ai/base.py` defines `Transcriber` and `HighlightModel`. Add an implementation next to
`groq_whisper.py` / `gemini.py` and pass it in `__main__.py`.

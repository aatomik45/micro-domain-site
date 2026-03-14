# Deploy notes

This package is now standalone and no longer includes the previous Atoms/OIDC auth flow.

## What changed
- Removed frontend Atoms SDK usage
- Removed backend OIDC/auth routes
- Removed auth-protected runtime settings routes
- Removed admin bootstrap tied to legacy auth
- Simplified config to `VITE_API_BASE_URL` and `CORS_ALLOWED_ORIGINS`

## Local run

### Backend
```bash
cd app/backend
pip install -r requirements.txt
export DATABASE_URL=sqlite:///./app.db
export CORS_ALLOWED_ORIGINS=http://localhost:3000
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd app/frontend
npm install
export VITE_API_BASE_URL=http://localhost:8000
npm run dev
```

## Deploy recommendation
- Frontend: Vercel or Netlify
- Backend: Render or Railway
- Database: Postgres on Render/Railway

## Required environment variables
### Backend
- `DATABASE_URL`
- `CORS_ALLOWED_ORIGINS`
- `LOG_LEVEL` (optional)

### Frontend
- `VITE_API_BASE_URL`

## Important
The old `/api/v1/auth/*`, `/api/v1/users/*`, and runtime settings admin routes were intentionally removed. If you want login later, add a fresh auth system explicitly instead of restoring the old platform-specific one.

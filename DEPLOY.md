# CryptoNews Backend — Render.com Deployment Guide

## ⚡ Quick Setup (5 minutes)

### 1. **Render.com Account Oluştur**
- [Render.com](https://render.com) ziyaret et → Sign Up (GitHub ile kolaylı)
- Email verify et

### 2. **GitHub'a Repository Push Et**
```powershell
# Already done locally. Now:
# 1. Create new repo on GitHub: https://github.com/new
#    - Repo name: cryptonews-backend
#    - Public ✓ (Render'ın erişmesi için)
#    - Don't initialize README (we have it)

# 2. Add remote and push:
cd c:\Users\bora\cryptonews
git remote add origin https://github.com/YOUR_USERNAME/cryptonews-backend.git
git branch -M main
git push -u origin main

# Note: GitHub HTTPS authentication:
#   - Use Personal Access Token (not password)
#   - Settings > Developer settings > Personal access tokens > Generate
#   - Select: repo, admin:repo_hook
#   - Copy token → paste when `git push` asks for password
```

### 3. **Render.com'da Deploy Service Oluştur**
- Render dashboard → **+ New** → **Web Service**
- **Connect repository:**
  - "GitHub" seç
  - `cryptonews-backend` repo'yu select et
  - Deploy (main branch)
- **Settings:**
  - Name: `cryptonews-api`
  - Runtime: Node
  - Build Command: `npm install` (auto-detected)
  - Start Command: `node src/index.js` (auto-detected)
  - Plan: **Free** (yeterli testing için)

### 4. **Environment Variables Ayarla**
Render dashboard → Service → Environment:

```
ADMIN_API_KEY = cryptonews_admin_key_change_me_2026
TELEGRAM_BOT_TOKEN = (from your .env)
TELEGRAM_WEBHOOK_SECRET = cryptonews_webhook_secret_change_me_2026
NODE_ENV = production
CORS_ORIGIN = *
RATE_LIMIT_MAX = 1000
```

### 5. **Deploy**
- Click **"Deploy"** button
- Wait ~3 minutes for build + startup
- Get the URL: `https://cryptonews-api.onrender.com` (example)

### 6. **Test**
```powershell
# Replace with your Render URL
Invoke-RestMethod https://cryptonews-api.onrender.com/health
# Should return: { "ok": true, ... }
```

### 7. **Update Mobile App**
Edit `mobile/app.json`:
```json
"extra": {
  "apiBaseUrl": "https://cryptonews-api.onrender.com"
}
```

Build and submit new TestFlight build:
```powershell
cd mobile
$env:EXPO_APPLE_ID='burksnli@gmail.com'
npx eas build --platform ios --profile productionSecondApp
npx eas submit --platform ios --profile productionSecondApp --latest
```

---

## 📌 Notes
- **Free tier:** Auto-sleeps after 15 min inactivity (first request wakes it)
- **Persistent disk:** SQLite database saved to `/opt/render/project/src/data`
- **Logs:** View in Render dashboard → Logs tab
- **Redeploy:** Push new commit to GitHub → auto-redeploy

## 🔗 Useful Links
- [Render Docs](https://render.com/docs)
- [Render Pricing](https://render.com/pricing)

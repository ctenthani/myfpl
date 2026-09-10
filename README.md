# BT42.195 km Race 2026 — Event Website + Control Room

Mobile-first public website **and** interactive OC Control Room for the **BT42.195 km Race**.

**Race day:** Sunday, 27 September 2026 · Blantyre, Malawi  
Organised under the Malawi National Council of Sports.

---

## What is included

### Public site
- Home with live countdown
- Race information (42.195 km / 10 km / 5 km)
- Online registration (Netlify Forms)
- Course, Sponsors, Info sections
- Mobile bottom tab bar + PWA support

### Control Room (OC only)
Interactive version of the full project planner:
- **Dashboard** — days to race, checklist progress %, sponsors contacted, registration counter placeholder
- **Checklist** — 40+ tasks; tap to cycle status (To do → In progress → Done → Blocked); saved on device
- **Meetings** — all 8 OC meetings with full agendas
- **Sponsors** — pipeline with editable status dropdowns
- **Budget** — expenditure & income targets
- **Race Day** — full run sheet
- **Roles** — OC organogram
- **Notes** — local scratch pad

**Access:** Click **⚙️ OC** (bottom-right) or go to `#control`.  

---

## Deploy to Netlify via GitHub

### 1. Create empty GitHub repo
[github.com/new](https://github.com/new) → name e.g. `bt42-race-2026` → create **without** README.

### 2. Push

```bash
cd github-ready   # this folder
git remote add origin https://github.com/YOUR_USERNAME/bt42-race-2026.git
git push -u origin main
```

(If you received the zip: unzip, then `git init && git add . && git commit -m "Launch" && git branch -M main` before adding the remote.)

### 3. Netlify
1. [app.netlify.com](https://app.netlify.com) → Add new site → Import from GitHub
2. Select the repo
3. Build command: *(empty)* · Publish directory: `.`
4. Deploy

### 4. Enable Forms
After first deploy → **Forms** in Netlify dashboard → you will see `bt42-registration`.  
Optionally add email notifications.

### 5. Custom domain (optional)
Site settings → Domain management.

---

## Local test

```bash
python3 -m http.server 8080
# Open http://localhost:8080
```

---

## Project structure

```
├── index.html
├── css/styles.css
├── js/
│   ├── app.js           # Public site navigation + form
│   ├── control-data.js  # Full planner data
│   └── control.js       # Interactive Control Room logic
├── manifest.json
├── netlify.toml
├── _redirects
└── robots.txt
```

---

## Security note

The Control Room PIN is a simple client-side gate intended for convenience among the OC.  
It is **not** strong security. Do not put highly sensitive personal data or financial credentials only behind this PIN. For stronger protection later, add Netlify Identity or a proper auth layer.

---

**Chair:** Chifundo Tenthani  
**Event:** BT42.195 km Race · 27 September 2026

## Netlify environment variables

See [docs/NETLIFY_ENV.md](docs/NETLIFY_ENV.md) for EMAIL_API_KEY, EMAIL_FROM, and MPAMBA_WEBHOOK_SECRET.

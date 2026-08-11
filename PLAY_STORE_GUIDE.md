# FPL Assistant — Google Play Store guide

**Live site:** https://myfpl.netlify.app  
**Privacy policy URL (use in Play Console):** https://myfpl.netlify.app/privacy.html  
**Suggested package name:** `app.myfpl.assistant`  
**App name:** FPL Assistant  

---

## A. Store listing copy (paste into Play Console)

### App name (max 30 characters)
FPL Assistant

### Short description (max 80 characters)
Rate your FPL team, AI transfers & chips — pitch view for 2026/27.

### Full description
FPL Assistant helps Fantasy Premier League managers plan squads, transfers, and chips with a clear pitch view and practical tools for the 2026/27 season.

WHAT YOU GET
• Pitch view of your squad with predicted points  
• Optimise lineup (one GK in the XI, legal formations)  
• AI Transfers — single moves and multi-transfer bundles  
• Unlimited transfer mode for GW1, Wildcard, and Free Hit  
• AI Teams for Wildcard and Free Hit drafts (under £100m)  
• Chip planner and Matchday tools (polls, fixtures, rival radar)  
• Team ID login, optional 14-day Pro/Ultra trial  

HOW IT WORKS
Enter your FPL Team ID to load or build a squad. Edit and save on your device, explore AI suggestions, then mirror decisions on the official FPL site.

PLANS
• Starter — free pitch, optimise, and core tools  
• Pro / Ultra — AI Transfers, AI Teams, and advanced Matchday features (trial available)

IMPORTANT
FPL Assistant is an independent helper. It is NOT affiliated with the Premier League, the FA, or Fantasy Premier League. Official transfers and chips must be made on the official FPL website or app. Predictions are estimates only.

Privacy: https://myfpl.netlify.app/privacy.html  

### Category
Sports  

### Tags (examples)
fantasy football, FPL, premier league, transfers  

---

## B. Graphics checklist

| Asset | Size | Notes |
|-------|------|--------|
| App icon | 512×512 PNG | Use icons/icon-512.png or a cleaner store icon |
| Feature graphic | 1024×500 | Title “FPL Assistant” + pitch screenshot |
| Phone screenshots | min 2 | Pick tab, AI Transfers, AI Teams |
| 7" tablet (optional) | — | Can reuse phone shots if scaled |

---

## C. PWA Builder (easiest packaging)

1. Go to https://www.pwabuilder.com/
2. Enter: `https://myfpl.netlify.app`
3. Start → Package for stores → **Android**
4. Settings:
   - Package ID: `app.myfpl.assistant`
   - App name: FPL Assistant
   - Host: `myfpl.netlify.app`
   - Display mode: standalone
   - Signing: generate new key **or** use Play App Signing (recommended)
5. Download the **Android package** (AAB preferred).
6. In Play Console → Your app → Production (or Testing) → Create release → upload the `.aab`.

---

## D. Bubblewrap (optional CLI)

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://myfpl.netlify.app/manifest.json
# packageId: app.myfpl.assistant
# name: FPL Assistant
bubblewrap build
```

Upload the generated AAB to Play Console.

---

## E. Digital Asset Links (required for TWA)

1. After the first upload, open Play Console → **Setup → App integrity → App signing**.
2. Copy the **SHA-256 certificate fingerprint** of the **App signing key** (not only the upload key).
3. Edit the file on your site:

`https://myfpl.netlify.app/.well-known/assetlinks.json`

Replace `REPLACE_WITH_PLAY_APP_SIGNING_SHA256` with the fingerprint (colons optional; Google accepts both formats).

Example shape (already in this project):

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "app.myfpl.assistant",
    "sha256_cert_fingerprints": ["AA:BB:CC:..."]
  }
}]
```

4. Deploy the site, then test:

https://developers.google.com/digital-asset-links/tools/generator  

Host: `myfpl.netlify.app` · Package: `app.myfpl.assistant` · Fingerprint: (paste SHA-256)

---

## F. Play Console setup checklist

- [ ] Create app → App name **FPL Assistant**
- [ ] Default language English
- [ ] App or game: **App** · Free
- [ ] Declarations: no ads (or declare if you add ads later)
- [ ] Privacy policy URL: `https://myfpl.netlify.app/privacy.html`
- [ ] Store listing: short + full description (section A)
- [ ] Graphics: icon, feature graphic, screenshots
- [ ] Categorization: Sports
- [ ] Target audience & content ratings questionnaire
- [ ] News apps / Data safety form (see section G)
- [ ] Upload AAB to **Internal testing** first (recommended)
- [ ] Add your Gmail as tester → install from Play and verify
- [ ] Promote to Production when happy

---

## G. Data safety form (summary answers)

| Question | Suggested answer |
|----------|------------------|
| Collects user data? | Yes |
| Data types | App activity / user IDs as applicable; email if used for login/digests |
| Encrypted in transit? | Yes (HTTPS) |
| Users can request deletion? | Yes (contact operator; clear app data) |
| Data sold? | No |
| Required for app? | Team ID optional for basic browse; needed for personalised squad |

---

## H. After approval

- Content updates: deploy to Netlify as usual (TWA loads the live site).
- Only upload a new AAB when you change package name, signing, or Android shell settings.
- Keep `assetlinks.json` in sync if Google rotates the app signing cert (rare).

---

## Support contact for Play listing

Use the same email as your Play Console account, or a public support email/WhatsApp you monitor.

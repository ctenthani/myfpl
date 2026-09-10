# Netlify environment variables — BT42.195 km Race 2026

Configure these in the Netlify UI after the site is linked to GitHub.

## Where to set them

1. Open [https://app.netlify.com](https://app.netlify.com)
2. Select your **BT42** site
3. **Site configuration** → **Environment variables** → **Add a variable**
4. Add each variable below (scope: **All scopes** / production + deploy previews as you prefer)
5. **Trigger a new deploy** (Deploys → Trigger deploy) so functions pick up the values

> Environment variables are **not** stored in Git. Never commit real API keys.

## Required for certificate & bib emails

| Variable | Example | Purpose |
|----------|---------|---------|
| `EMAIL_API_KEY` | `re_xxxxxxxx` | API key from [Resend](https://resend.com) (or set `RESEND_API_KEY` instead) |
| `EMAIL_FROM` | `certificates@yourdomain.mw` | From address — must be verified in Resend |

### Resend setup (recommended)

1. Create account at [resend.com](https://resend.com)
2. Add and verify your domain (or use Resend’s onboarding domain for tests)
3. Create an API key → paste into `EMAIL_API_KEY`
4. Set `EMAIL_FROM` to an address on that verified domain

Without these, the site still works: certificates open in the browser, but **no email is sent**.

## Required for Mpamba auto-verification (when TNM is connected)

| Variable | Example | Purpose |
|----------|---------|---------|
| `MPAMBA_WEBHOOK_SECRET` | long random string | Shared secret TNM/aggregator sends in header `x-webhook-secret` |

Generate a secret, e.g.:

```bash
openssl rand -hex 32
```

Give the same value to TNM and put it in Netlify. Webhook URL:

```text
https://YOUR-SITE.netlify.app/.netlify/functions/mpamba-webhook
```

## Optional

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Alias accepted if `EMAIL_API_KEY` is unset |

## Checklist after saving variables

- [ ] Redeploy the site  
- [ ] Register a test athlete **with email**  
- [ ] In Control Room: Verify payment → open Entry cert (email may send if type hooks call the function)  
- [ ] Mark Finish → completion cert + `send-certificate` POST  
- [ ] Assign bib → optional bib email  
- [ ] (Later) TNM points callbacks at `mpamba-webhook` with the secret  

## Local development

Create a file `.env` **only on your machine** (already gitignored pattern — do not commit):

```env
EMAIL_API_KEY=re_xxx
EMAIL_FROM=certificates@yourdomain.mw
MPAMBA_WEBHOOK_SECRET=your-secret
```

Netlify CLI:

```bash
npm i -g netlify-cli
netlify login
netlify link
netlify env:set EMAIL_API_KEY "re_xxx"
netlify env:set EMAIL_FROM "certificates@yourdomain.mw"
netlify env:set MPAMBA_WEBHOOK_SECRET "your-secret"
netlify deploy --prod
```

## What each function uses

| Function | Env vars |
|----------|----------|
| `send-certificate` | `EMAIL_API_KEY` or `RESEND_API_KEY`, `EMAIL_FROM` |
| `mpamba-webhook` | `MPAMBA_WEBHOOK_SECRET` |

## Shared OC backend sync

| Variable | Purpose |
|----------|---------|
| `OC_SYNC_TOKEN` | Shared secret for committee/chair devices to read/write sync API |

Generate:

```bash
openssl rand -hex 24
```

Set the same value in Netlify env and enter it once per device in Control Room → **Sync** (or it can be embedded after first chair setup — prefer env-only and prompt in UI).

API:

- `GET /.netlify/functions/oc-sync` — load shared registrations, payments, bibs, finishes
- `POST /.netlify/functions/oc-sync` — merge updates (`x-oc-role: chair` required to change payments)

Payment verification remains **Chair only** on the server.

### Fix: “Blob store unavailable”

1. Confirm `package.json` includes `@netlify/blobs` and build command is `npm install`.
2. Redeploy the site after pushing.
3. Confirm `OC_SYNC_TOKEN` is set, then trigger deploy again.
4. Optional **JSONBin fallback** (if Blobs still fails on your plan):
   - Create a free bin at https://jsonbin.io
   - Set `JSONBIN_BIN_ID` and `JSONBIN_API_KEY` in Netlify env
   - Redeploy — sync will use JSONBin automatically


### Recommended: JSONBin (works when Blobs is not configured)

1. Create account at https://jsonbin.io  
2. Create a bin with content `{}`  
3. Copy Bin ID and API Master Key  
4. Netlify → Environment variables:
   - `JSONBIN_BIN_ID` = your bin id  
   - `JSONBIN_API_KEY` = your master key  
5. Also keep `OC_SYNC_TOKEN` set  
6. **Trigger deploy**  
7. On site: Control → Save token → **Push** / **Pull**

### Alternative: Netlify Blobs with manual credentials

If you prefer Blobs only:

1. Site settings → general → copy **Site ID** → `NETLIFY_SITE_ID`  
2. User settings → Applications → Personal access tokens → create token → `NETLIFY_AUTH_TOKEN`  
3. Redeploy  

The function passes `siteID` + `token` into `getStore()` automatically when those env vars exist.

## Email (Resend) — production domain `btrace.nsanja.app`

1. Resend → Domains → Add Domain → `btrace.nsanja.app`
2. Copy DNS records into Porkbun DNS for `nsanja.app`
3. Verify domain in Resend
4. Netlify env:
   - `EMAIL_API_KEY` = Resend API key (`re_...`)
   - `EMAIL_FROM` = `BT42.195km Race <entries@btrace.nsanja.app>`
5. Trigger deploy

Automated emails:
- Registration confirmation (if email on form)
- Payment verified (Chair verifies)
- Bib assigned
- Certificates (when issued)

Until the domain is Verified, Resend will return 403 for non-test recipients.

# TNM Mpamba payment webhook — integration design

**Business payment code:** `500204`  
**Bank fallback:** National Bank of Malawi account `1802283`

This site is static on Netlify. Live auto-verification needs a small serverless function and a commercial Mpamba / aggregator API (or operator CSV push). Below is the target design.

## Recommended flow

1. Runner registers on the website → Netlify Forms + local Control Room row.
2. Runner pays via TNM Mpamba USSD:
   - Dial **\*444#**
   - Select **4**
   - Enter business code **500204**
   - Amount for the chosen race distance is shown — confirm and pay.
3. TNM (or payment aggregator) sends a **webhook POST** to:
   `https://YOUR-SITE.netlify.app/.netlify/functions/mpamba-webhook`
4. Function validates shared secret, matches `msisdn` / reference to a registration, marks payment **verified**.
5. Optional: email “payment confirmed” via `send-certificate` / transactional email provider.

Until the live webhook is connected, OC uses **Control → Participants → Verify** after checking Mpamba / NBM statements.

## Expected webhook payload (illustrative)

TNM’s exact schema depends on the product you are given. Design assumes JSON like:

```json
{
  "event": "payment.completed",
  "transactionId": "MPB202609011234",
  "amount": 25000,
  "currency": "MWK",
  "msisdn": "265999123456",
  "reference": "0999123456",
  "businessCode": "500204",
  "paidAt": "2026-09-01T10:15:00+02:00"
}
```

## Security

- `MPAMBA_WEBHOOK_SECRET` env var — HMAC or bearer check.
- Reject wrong `businessCode`.
- Idempotent on `transactionId`.
- Log only masked MSISDN.

## Matching rules

1. Normalize phone (strip spaces, leading `+`, `0` → `265` if needed).
2. Match registration `phone` field.
3. Fallback: reference string contains registration phone or name.

## Bank deposits (NBM 1802283)

No public webhook. Options:

- Daily CSV from bank → admin import endpoint (future).
- Manual **Verify** in Control Room (current).

## Environment variables (Netlify)

| Variable | Purpose |
|----------|---------|
| `MPAMBA_WEBHOOK_SECRET` | Shared secret from TNM / aggregator |
| `EMAIL_API_KEY` | Resend / SendGrid / similar |
| `EMAIL_FROM` | e.g. `certificates@yourdomain.mw` |

## Completion certificates auto-send

When OC marks **Finish**, the app:

1. Opens the **Certificate of Completion** (print/PDF).
2. POSTs to `/.netlify/functions/send-certificate` with name, email, distance, finish time.

Configure the function with an email provider to deliver PDF/link automatically. Runners without email still get the on-screen certificate and can receive SMS later via a separate gateway.

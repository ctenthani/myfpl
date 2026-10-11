# MyFPL December subscription launch

Monthly USD prices: Pro $2.49; Ultra $4.99. Free preview ends 30 November 2026 (UTC). Checkout stays disabled until the merchant configuration is verified and live billing is deliberately enabled.

## Secure Netlify configuration

Enter secrets directly in Netlify, never in Git or chat. Configure function runtime variables:

- `AUTH_SECRET`: independently generated random secret, at least 32 bytes. Session cookies are signed, HttpOnly, Secure and SameSite=Lax.
- `RESEND_API_KEY`, `FROM_EMAIL`: existing verified sender for six-digit sign-in codes.
- `OWNER_EMAIL`: operator email; owner access requires email verification.
- `SITE_URL`: `https://myfpl.netlify.app`.
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`: app credentials belonging to the merchant account.
- `PAYPAL_ENV`: `sandbox` while testing; `live` only after successful testing.
- `PAYPAL_PRO_PLAN_ID`, `PAYPAL_ULTRA_PLAN_ID`: active USD plans with one infinite regular monthly billing cycle, no trial or setup fee, fixed prices exactly 2.49 and 4.99.
- `PAYPAL_WEBHOOK_ID`: webhook registered for this merchant REST app.
- `BILLING_LIVE_ENABLED`: keep `false` until the payment tests and merchant readiness checks pass. Set `true` only for approved live launch; checkout also enforces 1 December.

Webhook URL: `https://myfpl.netlify.app/api/paypal-webhook`. Subscribe to BILLING.SUBSCRIPTION.ACTIVATED, UPDATED, CANCELLED, SUSPENDED, EXPIRED and PAYMENT.SALE.COMPLETED, REFUNDED, REVERSED. Webhooks must pass PayPal signature verification. PayPal sandbox credentials and IDs cannot be reused in live mode.

## Before accepting money

Validate email delivery, incorrect and expired codes, single-use verification, account-linked access, exact-price monthly checkout, approval without payment, successful payment, duplicate webhooks, cancellation, expiry, suspension, refunds, reversal, and concurrent billing updates in an isolated sandbox. The current public preview intentionally does not permit checkout. To exercise sandbox checkout before December, use an isolated test deployment with an explicit test clock in the test harness; do not remove the production launch guard.

Confirm that the merchant account can receive these subscriptions and withdraw funds in its registered country. The customer's ability to use PayPal does not prove the merchant can receive payments. The operator must complete financial account approvals and any binding agreements themselves.

## Product limits

Forecasts use an experimental transparent blend of official next-event expected points, recent form, fixture difficulty and availability. They are not a calibrated probability of winning. Selling prices must be confirmed against official FPL; public picks do not reveal unpublished transfers. The report compares holding with single-player steady and rival-differential moves, including four-point hits. It does not automatically submit transfers. Progress and selling-price history currently remain on the manager's device.

## Run and publish

`npm ci`, `npm test`, `npm run build`. Public assets are copied to `site`; only MyFPL functions are copied from `netlify/functions` into `deploy-functions`. Unrelated race-event functions remain in source and are not deployed with this app. Run `node scripts/preview.cjs` for a local public-data preview without production email or payment credentials. Netlify reads `netlify.toml`, builds from Git and publishes `site`.

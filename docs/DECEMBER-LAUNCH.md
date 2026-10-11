# MyFPL: December 2026 paid launch

## Product promise

Help a manager make a better decision before every deadline and close the gap to their chosen mini-league rival. Never promise a guaranteed win. The primary screen should answer: hold or transfer, captain and vice-captain, starting XI, bench order, and chip decision, with reasons and uncertainty.

## Confirmed audience: global and Malawi managers

The user confirmed both audiences on 11 October 2026. Keep one product and plan entitlement system, with distinct payment routes:

- Global: current USD prices and PayPal links, subject to merchant-side verification of amounts, terms and settlement. Do not describe a payment link as recurring billing until verified.
- Malawi: explicit MWK prices and verified Airtel Money / TNM Mpamba merchant instructions. Until those details exist, display local payments as unavailable. Never invent till codes or silently convert USD to MWK.
- Regional expansion: add a country only after confirming a usable payment method and support process there; Malawi mobile-money access should not be assumed to work across the region.

Acquire early users through consenting mini-league organisers and useful weekly FPL content. Recruit both groups into the November beta and measure conversion and retention by payment route. Paid access must activate consistently regardless of currency or provider. Do not send promotional messages without authorisation.

## First release: decision reliability

- Reject players with zero availability instead of treating zero as full availability.
- Allow a replacement from the same club when the outgoing player releases the third club slot.
- Compare smaller transfer packages and holding after deducting points hits.
- Give the owner the same league strategy weighting as customers.
- Respect paid Ultra expiry after the launch promotion.
- Require a server secret for member administration; a public email cannot authorise writes or member-list access.
- Fail member activation visibly when persistent storage is unavailable.

Validation: `npm test`, JavaScript syntax checks, and `git diff --check`. These checks cover the changed logic; they are not evidence that the projections beat other strategies. Browser behaviour and Netlify configuration still need staging validation.

## Deployment requirements for this release

Configure a strong `OWNER_SECRET` in Netlify before deploying. Owner member actions request it for the current page session and send it in a header; it is not saved in browser storage. Confirm Netlify Blobs is working. Without a configured secret, member administration fails closed. Existing public-email-only administration will stop working by design.

This is an interim administration safeguard, not complete user authentication. Client-local plan flags and restartable trials remain unsuitable as a commercial access boundary. Complete verified sign-in and server-authorised entitlements before the paid launch. Member lookup now requires matching email and Team ID, but that does not prove the caller owns the email.

## Prioritised work before 1 December

### By 25 October: trustworthy decisions

Track official selling prices or ask managers to confirm them; public current prices alone can overstate transfer funds. Show whether the loaded squad reflects the last published gameweek rather than unpublished current selections. Validate squad, formation, club limit, transfer count, chip state and affordability before applying any plan. Handle blank and double gameweeks, late team news and stale data explicitly. Show data timestamps and a model estimate label. Fix live auto-sub timing before using live ranks as proof of progress.

### By 8 November: mini-league mission

Manager selects a league and a rival or target rank. Read the page containing that manager instead of assuming the first 50 entries contain them. Display the actual points gap, gameweeks remaining, chips remaining, rival captain exposure and players that can change the gap. Separate expected points from risk preference: changing a strategy score must not look like changing a factual projection. Offer hold, steady and chase options with net points after hits, budget and uncertainty. Preserve a multi-week plan across devices.

### By 15 November: accounts and payment

Use verified sign-in and server-side trial history, entitlements and expiry. Activate payments only after provider verification, with idempotent processing and a reconciliation path. Verify currency, price, term, customer and plan. Handle failed payments, refunds and cancellation. Do not treat a checkout return URL as payment proof. Choose global PayPal/card or local merchant payments after confirming the target audience and supported merchant account. Existing placeholder mobile-money tills must not be presented as usable payment instructions.

### By 22 November: evidence and retention

Recruit a small consenting beta group. Snapshot each recommendation before the deadline, including model version, inputs and uncertainty. Evaluate points, minutes, captain outcomes and hit-adjusted recommendations against hold and simple captain baselines. Keep actual manager decisions separate from suggestions. Track chosen-league rank and points gap over time; do not claim the app caused every rank change. Monitor import completion, first useful plan, repeat weekly usage and paid interest. Avoid marketing an unmeasured win rate.

### 23–30 November: launch rehearsal

Test complete sign-in, trial, payment, activation, renewal/expiry, cancellation and account recovery in staging. Test low-end phones, keyboard navigation, screen readers, failed API requests, storage outages and double gameweeks. Verify deadline notifications with explicit opt-in and unsubscribe. Publish clear billing/support information. Confirm a rollback path and clean installation/cache updates.

### 1 December: gated paid launch

Launch only if payment and access checks pass and recommendations are reliable enough to explain honestly. Keep a useful free tier. Start with a simple paid offer around the weekly decision plan and rival analysis; retain current listed prices as hypotheses until audience feedback supports them. Calculate revenue from actual conversions and retained subscribers, not promised league wins. A limited coaching cohort can provide early revenue if automated billing or model validation is not ready.

## Launch measures

- Product: successful team imports, plans viewed before deadline, weekly returning managers.
- Decision quality: hit-adjusted outcomes versus hold, minutes calibration and captain baseline; include sample sizes and losses.
- League value: change in selected-league points gap and rank, with chips and manager actions recorded.
- Revenue: verified paid activations, trial conversion, retention, refunds and payment failures.

## Open choices

The repository is confirmed as https://github.com/ctenthani/myfpl. The audience is global plus Malawi managers. MWK prices, merchant tills, support capacity and willingness to pay still need confirmation. The attempted GitHub push failed because credentials are unavailable; linked Netlify site configuration has not been verified in this chat. Do not assume that a local commit is deployed.

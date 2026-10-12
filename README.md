# MyFPL

Independent Fantasy Premier League planning app at https://myfpl.netlify.app.

Weekly plan combines public squad and mini-league data with a legal starting XI, captain shortlist, confirmed selling prices, and hold and transfer-package comparisons against the whole selected league. Points hits are deducted. Official FPL remains the place to submit transfers; no FPL password is requested.

Pro is US$2.49/month; Ultra US$4.99/month. Free preview runs through November 2026. Server-verified PayPal recurring billing is disabled until merchant configuration and tests are complete. Email codes verify MyFPL accounts; browser plan flags do not grant server report access.

Run `npm ci`, `npm test`, `npm run build`. Netlify publishes `site` and deploys only MyFPL functions copied into `deploy-functions` from `netlify/functions`. See `docs/SUBSCRIPTION-LAUNCH.md` for secure configuration and payment tests. Forecasts are experimental estimates, and league wins are not guaranteed. Signed-in managers can save private per-team plans with conflict protection and retrieve locked before-deadline decision records. Six-week scenarios carry banked transfers and flag blanks, doubles and advisory chip windows. See `docs/EVIDENCE-AND-SYNC.md` for the benchmark, privacy boundaries and limitations.

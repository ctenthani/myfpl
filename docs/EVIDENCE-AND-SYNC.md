# Evidence, six-week scenarios and private plans

The weekly coach blends official next-gameweek projections with a minutes-sensitive underlying estimate (xG, xA, xGC, saves and defensive contributions, plus calibrated form). Recent match minutes are fetched for the published squad and a leading candidate pool; other candidates fall back to season-average minutes. Availability and official injury/news timestamps are displayed. Confidence labels describe minutes support, not measured probability intervals. No independent injury-news service is integrated. Building a report refreshes squad and transfer estimates from the same server forecast for 15 minutes; before a report is built, the existing browser forecast remains the preview fallback.

## Historical benchmark

Community-collected official FPL data: https://github.com/vaastav/Fantasy-Premier-League/blob/master/data/2025-26/gws/merged_gw.csv

Input SHA256: `0d09f1f1cb1b5520ec8e2f25238aa652efe2a263d8ca7cb2b6538b27bf86727d`.

Only previous rounds build a forecast. Training GW6–20 selects form weight 0.35 by RMSE; untouched holdout GW21–38 contains 14,731 player-round observations. Holdout RMSE model 2.025 vs form 2.075; MAE model 1.033 vs form 1.021. Model policy 797 points, Hold 740, form policy 822, all net of hits. The form policy wins this restricted points comparison.

The same legal £100m past-data-selected starting squad is used. The benchmark does not reconstruct pre-deadline injuries, player availability, official ep_next, fixture revisions, blanks, doubles, chips or autosubs. It evaluates the underlying-data branch with neutral fixtures, not the complete current pipeline or league-winning performance. Current prices are represented by the last earlier observed round. Raw historical data is excluded from deployment.

To reproduce from the repository root:

1. Create `research` and download the linked CSV to `research/2025-26.csv` from the repository raw view. Check SHA256 against the hash above before comparing results; the upstream master URL can change.
2. Run `python scripts/prepare-backtest.py`.
3. Run `node scripts/backtest.cjs`. This writes the calibration and `assets/backtest-summary.json`; generatedAt varies. No live user plans or transfers are touched.

## Six-week scenario

Each week compares affordable legal packages with Hold, subtracts every hit, and carries remaining free transfers plus one into the next week (maximum five). Public current prices are frozen; future estimates exclude this week's official ep_next. This is a bounded greedy scenario, not a globally optimal season solver. Chip windows are alternatives based on published use in the relevant half-season. They are advisory, not activated, and do not alter the simulated path. Confirm future fixture changes and unpublished transfers on official FPL.

## Locked outcomes

The signed-in account's first report for each gameweek is stored server-side before its deadline. Later reports cannot rewrite it. Season is the year of the first season deadline, including January rounds. Once official results are both finished and data_checked, history replays the proposed XI, ordered autosubs, captain/vice and hits against Hold. It separately shows the manager's actual published points after transfer cost. League rank and gap are observations at recording, not proof of causation. Unfinished or unchecked weeks remain pending. Live outcome accuracy can only be assessed after future rounds finish.

## Private sync

Plans are keyed by verified account and Team ID. Customers can access their primary team; the owner can additionally access teams saved in their verified account. Browser email flags cannot grant access. Save/load preserves local backups before restoration. Revision and conditional-write checks reject stale or simultaneous saves; newer cloud plans pause automatic saving. Separate squads, bank, free-transfer confirmations, selling prices and chips are retained per team. Plans remain planning records: no official FPL credentials are collected and no transfers or chips are submitted.

Verification includes automated ownership, stale/concurrent writes, deadline locking, January season identity, checked-result gating and legal autosubs. Real physical second-device testing remains a separate user acceptance check.

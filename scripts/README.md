# Results feed updater

Run with Node 24; no npm install or Expo build is needed.

```
node --test scripts/updater/*.test.js
node scripts/scrape.js --backfill-days 1
node scripts/scrape.js --from 2026-11-01 --to 2026-11-20 --backfill-days 0
```

PCSO is queried first using its live ASP.NET form, selected option values, hidden fields, cookies and numbered pagination. Requests run one at a time. A bounded daily historical cursor starts on 2016-01-01 and advances only after a completed query. An explicit official “Data is unavailable.” response advances the checked cursor but is recorded in `data/coverage.json` under `unavailableRanges`; it does not establish that no draw occurred. Network, parser and pagination failures retain the cursor. Recover an unavailable range with `--from`/`--to`; coverage records the attempts and draw counts, not a promise of complete historical coverage. No empty response deletes existing draws.

`data/v2/latest.json` contains the last seven Manila calendar dates. `data/v2/results-{gameId}.json` contains each game's archive, wrapped in `{schemaVersion:2,generatedAt,coverage,draws}`. Keys are game/date/time. Confirmation values are `LegacyUnverified`, `Provisional`, `OfficialConfirmed`. Digit games use single digit components, except 2D uses two padded digits; six ball games use two padded digits in official drawn order. Revisions hash the meaningful draw fields and stay stable on unchanged observations. A correction from PCSO replaces the existing draw; conflicting rows in one response fail the update. Lower confidence sources cannot replace an official draw.

Only PCSO observations produce `OfficialConfirmed`. Six ball `JACKPOT (PHP)` is converted exactly to integer centavos. Digit game money is null because that column may represent a payout; winner counts are copied from the draw's own row. Unknown money/winners are null. `sourceUrl`, `provider`, and `observedAt` identify the observation; the canonical PCSO search URL requires the form query, whose date range is recorded in coverage.

The nine legacy filenames remain supported (`results.json` for 3D and `results-{gameId}.json` for the other eight). Existing 3D history is preserved, and new/corrected legacy combinations come only from PCSO. Missing legacy endpoints start with official observations only. V2 was seeded once from existing legacy history and missing Android asset snapshots with `LegacyUnverified`; seed money and winner metadata was deliberately discarded. Android seed source URLs identify the import via this repository's documented anchor, not an official source. Never relabel these imported records official without querying PCSO.

Third party fallback is limited to 2D/3D explicitly dated four-cell result rows. The row's own date must equal the requested Manila date. Page titles, metadata and unrelated dates cannot establish a result date. Accepted fallback draws remain `Provisional` and never change legacy feeds. Unsupported markup yields no draw. During local verification on 2026-11-21, Globe intercepted LottoBalita, LottoPCSO and PhilNews with a `forbiddenaccess.globe.com.ph` certificate; certificate validation was retained. PCSO remained reachable with a browser user agent. The actual PCSO range 2026-11-15–21 returned 54 official draws through November 20; 2016-01-02/03 returned 17; January 1 returned “Data is unavailable.”

GitHub Actions runs every five minutes for two hours following each 14:00/17:00/21:00 Manila draw and hourly otherwise. A single concurrency group serializes writers. Manual dispatch supports recovery ranges and 0–31 backfill days. Every run tests parsers and commits all data paths plus coverage, including outage diagnostics. A completely failed official run still preserves previous feeds and makes the job fail visibly. A push conflict is not force-resolved; rerun against current main.

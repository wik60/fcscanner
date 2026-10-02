## Market analyzer

The Pages app now stores observation history, card categories and manually entered market events in local browser storage. It seeds three price observations from the user-provided 2026-10-02 export, preserving timestamps. These are not refreshed automatically. Export backups to retain history across browsers/devices. The fictional history demo is isolated from real data and never saved.

Each exact card/version has up to 500 observations; duplicate timestamps are not added. The chart shows observed prices, not predicted prices. Card categories are assigned manually because the source can omit rating/version metadata. Event scope can be exact IDs, user-labelled SBC cards, playable cards, or an explicitly uncertain broad market scope. Start/end times and event creation times are retained.

Signal engine v1 is an **unvalidated heuristic**, not a trained forecasting model. A direction requires at least four observations over six hours and a latest observation no older than 30 minutes. It combines a +/-2% six-hour trend signal with active, manually scoped supply/demand events. Event contribution is capped at +/-2. Signals are qualitative, carry low confidence, and have a heuristic 6–24h horizon. It cannot predict exact prices, detect live underpriced auctions, estimate sell-through, or provide calibrated probabilities. There is no automatic SBC/store/rewards feed and no claimed backtest accuracy.

# FC Scanner · GitHub Pages

## Apify import

The browser app accepts JSON exports from `getdataforme/futbin-category-details` directly. Use Apify's Dataset → Export → JSON, then import that file on the site. The adapter reads only `prices.pc.lowestPrice`, retains `scrapedAt`, and checks `/27/player/` URLs. Console-only records and other game years are rejected. The documented Actor sample is FC26; live FC27 compatibility is not yet verified.

Apify exports contain reference prices, not purchasable auctions, sales volume, or one-hour history. The app displays **Price target**, zero suggested copies, and estimated profit **at your target buy price**. It does not invent missing listings or history. Always confirm the target in-game. Freshness reflects scrape time, not necessarily FUTBIN's underlying price update time.

Actor pricing was listed as from $9 / 1,000 results during setup. No paid run has been started. Automatic refresh needs an Apify data pipeline, credentials kept outside public page code, and a tested fresh output. Do not paste tokens in issues, source files, or chat. Actor documentation: https://apify.com/getdataforme/futbin-category-details

## GitHub Pages app

Open https://wik60.github.io/fcscanner/ after Pages deployment. The browser app runs entirely in JavaScript: adjust your balance/reserve, enter fresh PC observations, import CSV/JSON, calculate ranked bid ceilings, and export picks. The fictional demo is explicitly labelled. Data is kept in memory for the current tab only. Refreshing the page clears it.

**Live FUTBIN connection is not available:** direct FUTBIN access returned HTTP 403 during integration checks. No verified public FC27 PC API was identified. This app does not claim automatic live picks. The feed field supports public HTTPS JSON feeds matching the schema below; the server must allow CORS. Never paste secret API keys into it.

GitHub Pages publishing source: `main` branch, `/ (root)`. `.nojekyll` allows the static app to be served directly. GitHub Actions checks both the Python and browser engines.

# FC27 PC Trader

A standalone Python watchlist scanner for a 200,000-coin PC budget. It ranks supplied price observations and outputs a browser report with card names, maximum bid prices, conservative sell targets, net profit, and suggested quantities.

**Data connection status: no live FC27 price provider is included.** This is a working ranking engine, not a live market scanner yet. It accepts manual CSV/JSON observations or an HTTPS feed in the schema below. Sample cards are fictional and never live recommendations. It does not sign in to EA, scrape the Web App, bid, or buy cards.

## Run on Windows

Install Python 3.10 or newer. Extract this folder, open a terminal inside it, then run:

```powershell
py scanner.py --demo
start output/index.html
```

For real observations:

```powershell
py scanner.py --input prices.csv
start output/index.html
```

On macOS/Linux use `python3` instead of `py`.

## What to enter

Record the exact card version, not just the player name. Use PC prices from the in-game market or a source you are authorized to use. `market_price` is a realistic current resale price supported by at least three comparable PC listings, not a random high listing. `buy_price` is an actual candidate listing or auction price; it is not necessarily still available. `price_1h_ago` must be a genuine prior observation. If you have no history, collect observations an hour apart before running the scanner.

CSV header:

```csv
game,platform,card_id,name,version,buy_price,market_price,price_1h_ago,samples,updated_at
```

Example format only, fictional card/prices (replace timestamp and values with actual observations):

```csv
fc27,pc,example-id,Example midfielder,Example gold,4000,5000,5100,10,2026-10-02T02:00:00Z
```

JSON uses an array of objects with the same fields; see `sample.json`. Use a stable, unique card/version ID. `samples` means the number of comparable current listings observed; it is not sales volume. `updated_at` is the observation time in ISO 8601 with timezone. Never refresh timestamps without refreshing prices.

## Ranking and limits

Defaults are heuristic settings, not a proven profit strategy:

- 200k total balance; 100k reserve; shared 100k trading allocation.
- No card position above 20k, and at most three copies of a card.
- PC + FC27 only; timestamps no older than 30 minutes; at least three comparable listings.
- Skip cards whose observed market price fell more than 5% in one hour.
- Sell target = current resale reference minus 3%, rounded down to a standard market increment.
- Estimated net = sell target minus 5% tax, rounded down.
- Maximum buy = lower of (net minus 500 coins), (net / 1.08), and position limit; rounded down.
- BUY CANDIDATE means the observed price meets those limits. BID TARGET means wait for the maximum buy or cheaper.
- Rank by estimated ROI, weighted by observation freshness and number of samples. This is a heuristic score, not a measured probability of sale.
- Suggested quantities share one balance. They are upper limits for review, not an instruction to buy every pick. Always test one copy and confirm current prices.

Prices may change immediately. Listed supply does not establish sales volume. The scanner cannot know whether a card will sell quickly. A profitable spread in supplied data does not guarantee a completed trade.

Change defaults:

```powershell
py scanner.py --input prices.csv --budget 200000 --reserve 100000 --min-profit 750 --min-roi 0.10 --max-age 15
```

Tax and price increments should be checked against the game if EA changes the market rules. Adjust tax with `--tax 0.05`, resale buffer with `--haircut 0.03`.

## Connect your own price feed

The URL must return the normalized JSON array above. There is no built-in provider adapter or undocumented provider endpoint. Use only a feed you have permission to access. Optional authentication is supplied via `PRICE_FEED_TOKEN` as a Bearer header. Keep tokens out of the repository and never enter your EA credentials.

```powershell
py scanner.py --input https://YOUR-AUTHORIZED-FEED/cards.json
```

Each run fetches once. To support a provider with a different schema, write an adapter that maps its verified fields to this schema. Do not fabricate history, timestamps, or PC prices.

EA describes its Community API as a system for approved partners, not a general public API for this project: https://help.ea.com/en/articles/ea-sports-fc/community-api/

## Upload to GitHub

Create an empty repository such as `fc27-pc-trader` and upload this folder's contents (keep the `.github` folder). No dependencies or secrets are needed for demo mode. The included GitHub Actions workflow runs tests and produces a clearly marked fictional demo report as a downloadable artifact; it does not deploy a website or fetch live prices.

Run tests locally:

```powershell
py -m unittest discover -s tests -v
```

## Files

- `scanner.py`: calculation engine, CSV/JSON/feed reader, HTML/JSON report generator.
- `sample.json`: fictional demo observations.
- `tests/`: budget, profit, data validation, and report escaping checks.
- `.github/workflows/check.yml`: GitHub test and demo artifact workflow.
- `demo-report.html`: preview generated from fictional data.

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

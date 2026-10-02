"""PC trading watchlist. Python 3.10+, standard library only."""
import argparse
import csv
import html
import json
import math
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen


def floor_price(value):
    """Round down using standard transfer market increments."""
    value = math.floor(value)
    step = 50 if value < 1000 else 100 if value < 10000 else 250 if value < 50000 else 500 if value < 100000 else 1000
    return value // step * step


def timestamp(value):
    parsed = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('updated_at must include timezone')
    return parsed.astimezone(timezone.utc)


def number(row, key):
    value = float(row[key])
    if not math.isfinite(value) or value < 0:
        raise ValueError(f'{key} must be a finite nonnegative number')
    return value


def rank(rows, now=None, budget=200000, reserve=100000, min_profit=500,
         min_roi=.08, max_age=30, tax=.05, haircut=.03):
    if budget < 0 or reserve < 0 or reserve > budget:
        raise ValueError('Budget must be nonnegative and reserve must be between 0 and budget')
    if not 0 <= tax < 1 or not 0 <= haircut < 1 or min_roi < 0 or min_profit < 0 or max_age <= 0:
        raise ValueError('Invalid thresholds')
    now = now or datetime.now(timezone.utc)
    accepted, rejected, seen = [], [], set()
    available = budget - reserve
    per_card = min(available, budget * .10)
    for row in rows:
        name = str(row.get('name', '(unnamed)'))
        try:
            if str(row.get('game', '')).lower() != 'fc27':
                raise ValueError('not FC27')
            if str(row.get('platform', '')).lower() != 'pc':
                raise ValueError('not PC prices')
            card_id = str(row['card_id']).strip()
            if not card_id or card_id in seen:
                raise ValueError('missing or duplicate card_id')
            seen.add(card_id)
            age = (now - timestamp(row['updated_at'])).total_seconds() / 60
            if age < -1 or age > max_age:
                raise ValueError('stale or future-dated prices')
            buy = number(row, 'buy_price')
            market = number(row, 'market_price')
            prior = number(row, 'price_1h_ago')
            samples = number(row, 'samples')
            if buy < 150 or market < 150 or prior < 150:
                raise ValueError('missing or invalid price')
            if buy != floor_price(buy):
                raise ValueError('buy_price is not a valid price increment')
            if samples < 3:
                raise ValueError('fewer than 3 comparable listings')
            trend = market / prior - 1
            if trend < -.05:
                raise ValueError('market dropped more than 5% in 1 hour')
            sell = floor_price(market * (1 - haircut))
            net = math.floor(sell * (1 - tax))
            max_buy = floor_price(min(net - min_profit, net / (1 + min_roi), per_card))
            if max_buy < 150:
                raise ValueError('no affordable target')
            profit = net - buy
            roi = profit / buy
            actionable = buy <= max_buy
            # Limit concentration to 10% of total budget and 3 copies/card.
            units = min(3, int(per_card // buy)) if actionable else 0
            confidence = min(samples / 10, 1) * max(.2, 1 - max(age, 0) / max_age)
            score = (profit / buy if actionable else (net - max_buy) / max_buy) * confidence
            accepted.append(dict(card_id=card_id, name=name, version=str(row.get('version', '')),
                status='BUY CANDIDATE' if actionable else 'BID TARGET', buy_price=int(buy),
                max_buy=max_buy, sell_price=sell, profit=profit, roi=round(roi * 100, 1),
                age_minutes=round(age, 1), trend_percent=round(trend * 100, 1),
                max_copies=units, score=score))
        except (ValueError, KeyError, TypeError, OverflowError) as error:
            rejected.append(dict(name=name, reason=str(error)))
    accepted.sort(key=lambda item: (item['status'] == 'BUY CANDIDATE', item['score']), reverse=True)
    remaining = available
    for item in accepted:
        copies = min(item['max_copies'], int(remaining // item['buy_price']))
        item['suggested_copies'] = copies
        remaining -= copies * item['buy_price']
    return dict(generated_at=now.isoformat(), budget=budget, reserve=reserve,
                remaining_trading_budget=remaining, picks=accepted, rejected=rejected)


def load(source):
    if source.startswith('https://'):
        headers = {'Accept': 'application/json'}
        token = os.environ.get('PRICE_FEED_TOKEN')
        if token:
            headers['Authorization'] = 'Bearer ' + token
        with urlopen(Request(source, headers=headers), timeout=20) as response:
            raw = response.read(5_000_001)
        if len(raw) > 5_000_000:
            raise ValueError('Feed too large')
        data = json.loads(raw)
    else:
        path = Path(source)
        if path.suffix.lower() == '.csv':
            with path.open(encoding='utf-8-sig', newline='') as stream:
                return list(csv.DictReader(stream))
        data = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(data, list) or not all(isinstance(row, dict) for row in data):
        raise ValueError('JSON input must be an array of card objects')
    return data


def report_html(result, demo=False):
    escape = lambda value: html.escape(str(value))
    cards = ''
    for row in result['picks']:
        cells = [row['name'] + ' / ' + row['version'], row['status'],
                 f"{row['buy_price']:,}", f"{row['max_buy']:,}", f"{row['sell_price']:,}",
                 f"{row['profit']:,}", str(row['roi']) + '%', str(row['suggested_copies']),
                 str(row['age_minutes']) + ' min']
        cards += '<tr>' + ''.join('<td>' + escape(cell) + '</td>' for cell in cells) + '</tr>'
    rejected = ''.join('<li>' + escape(row['name']) + ': ' + escape(row['reason']) + '</li>' for row in result['rejected'])
    title = 'DEMO — fictional cards and prices' if demo else 'PC trading watchlist'
    return '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>FC27 PC Trader</title><style>
    body{margin:0;background:#10161c;color:#eef4f9;font:16px system-ui}main{max-width:1200px;margin:auto;padding:32px}h1{font-size:36px}p{color:#b9c9d4;line-height:1.6}.badge{color:#94f0ba}.table{overflow:auto}table{border-collapse:collapse;width:100%;white-space:nowrap}td,th{text-align:left;padding:15px;border-bottom:1px solid #34424e}th{color:#94f0ba}summary{cursor:pointer}footer{margin-top:24px;font-size:13px}</style><main><span class="badge">FC27 · PC · 200k starting strategy</span><h1>''' + escape(title) + '</h1><p>Generated ' + escape(result['generated_at']) + ' · Budget ' + escape(result['budget']) + ' · Reserve ' + escape(result['reserve']) + '''</p><p>Max buy is your bid ceiling. Sell target includes a 3% price buffer by default; profit includes selling tax. Profit shown is at the observed buy price. A BID TARGET is too expensive now: wait for a cheaper auction. Suggested copies share one budget, capped at three per card.</p><div class="table"><table><thead><tr>''' + ''.join('<th>' + heading + '</th>' for heading in ['Card/version', 'Action', 'Observed buy', 'Max buy', 'Sell target', 'Net profit', 'ROI', 'Copies', 'Price age']) + '</tr></thead><tbody>' + (cards or '<tr><td colspan="9">No eligible cards. Supply fresh PC observations.</td></tr>') + '</tbody></table></div><details><summary>Filtered cards (' + str(len(result['rejected'])) + ')</summary><ul>' + rejected + '</ul></details><footer>Watchlist estimates, not guaranteed sales. Verify prices in-game before bidding. No EA login or automatic purchases. This report is a snapshot; rerun to refresh.</footer></main></html>'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', help='CSV, normalized JSON file, or HTTPS JSON feed')
    parser.add_argument('--demo', action='store_true', help='Use fictional sample cards; never live recommendations')
    parser.add_argument('--budget', type=int, default=200000)
    parser.add_argument('--reserve', type=int, default=100000)
    parser.add_argument('--min-profit', type=int, default=500)
    parser.add_argument('--min-roi', type=float, default=.08)
    parser.add_argument('--max-age', type=float, default=30)
    parser.add_argument('--tax', type=float, default=.05)
    parser.add_argument('--haircut', type=float, default=.03)
    parser.add_argument('--output', default='output')
    args = parser.parse_args()
    if not args.demo and not args.input:
        parser.error('Supply --input with fresh PC observations, or --demo')
    try:
        rows = load(str(Path(__file__).with_name('sample.json')) if args.demo else args.input)
        if args.demo:
            for row in rows:
                row['updated_at'] = datetime.now(timezone.utc).isoformat()
        result = rank(rows, budget=args.budget, reserve=args.reserve, min_profit=args.min_profit,
                      min_roi=args.min_roi, max_age=args.max_age, tax=args.tax, haircut=args.haircut)
        result['demo'] = args.demo
        destination = Path(args.output)
        destination.mkdir(parents=True, exist_ok=True)
        (destination / 'picks.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
        (destination / 'index.html').write_text(report_html(result, args.demo), encoding='utf-8')
        print('DEMO: fictional data' if args.demo else 'PC price snapshot')
        for item in result['picks'][:15]:
            print(f"{item['status']:13} {item['name']:25} max buy {item['max_buy']:>7,} | sell {item['sell_price']:>7,} | copies {item['suggested_copies']}")
        print(f"Saved {destination / 'index.html'}; filtered {len(result['rejected'])} cards")
    except (ValueError, OSError, json.JSONDecodeError) as error:
        print(f'Cannot scan: {error}', file=sys.stderr)
        return 1
    return 0

if __name__ == '__main__':
    raise SystemExit(main())

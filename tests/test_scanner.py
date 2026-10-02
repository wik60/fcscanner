import unittest
from datetime import datetime, timezone, timedelta
from scanner import rank, floor_price, report_html

NOW = datetime(2026, 10, 2, 2, tzinfo=timezone.utc)
def card(**changes):
    row = dict(game='fc27', platform='pc', card_id='1', name='Player', version='gold', buy_price=4000,
               market_price=5000, price_1h_ago=5000, samples=10, updated_at=NOW.isoformat())
    row.update(changes)
    return row

class ScannerTests(unittest.TestCase):
    def test_net_profit_and_threshold(self):
        pick = rank([card()], now=NOW)['picks'][0]
        self.assertEqual(pick['sell_price'], 4800)
        self.assertEqual(pick['profit'], 560)
        self.assertEqual(pick['max_buy'], 4000)
        self.assertEqual(pick['status'], 'BUY CANDIDATE')
    def test_mixed_market_and_bad_data(self):
        for changes in [dict(platform='ps'), dict(game='fc26'), dict(samples=2),
                        dict(buy_price='NaN'), dict(buy_price=4020), dict(price_1h_ago=6000),
                        dict(updated_at=(NOW-timedelta(hours=1)).isoformat()),
                        dict(updated_at=(NOW+timedelta(hours=1)).isoformat())]:
            with self.subTest(changes=changes):
                result = rank([card(**changes)], now=NOW)
                self.assertFalse(result['picks'])
                self.assertEqual(len(result['rejected']), 1)
    def test_shared_budget(self):
        rows = [card(card_id=str(i), buy_price=8000, market_price=10000, price_1h_ago=10000) for i in range(20)]
        result = rank(rows, now=NOW)
        spent = sum(p['buy_price']*p['suggested_copies'] for p in result['picks'])
        self.assertLessEqual(spent, 100000)
        self.assertTrue(all(p['suggested_copies']*p['buy_price'] <= 20000 for p in result['picks']))
    def test_wait_for_bid(self):
        pick = rank([card(buy_price=4800)], now=NOW)['picks'][0]
        self.assertEqual(pick['status'], 'BID TARGET')
        self.assertEqual(pick['suggested_copies'], 0)
    def test_html_escape(self):
        rendered = report_html(rank([card(name='<script>alert(1)</script>')], now=NOW))
        self.assertNotIn('<script>', rendered)
    def test_price_boundaries(self):
        for value, expected in [(999,950),(1000,1000),(9999,9900),(10000,10000),
                                (49999,49750),(50000,50000),(99999,99500),(100000,100000)]:
            self.assertEqual(floor_price(value), expected)
    def test_zero_budget(self):
        self.assertFalse(rank([card()], now=NOW, budget=0, reserve=0)['picks'])

if __name__ == '__main__':
    unittest.main()

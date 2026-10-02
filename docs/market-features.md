# Market features

Independent implementation inspired by public project concepts, not copied source code. hazardPay suggests history/trend analysis; futbin-monitor suggests manual portfolios and after-tax signals; fifa-trading-assistant suggests explicit SBC requirements.

Means are arithmetic means of stored observations over 6/24 hours, not time-weighted averages or calibrated forecasts. Coverage and at least three observations are required. Existing freshness and minimum-history direction gates remain. No historical profitability claim.

Portfolio is a local manual journal with JSON export/import. It records whole-position sales and computes net proceeds using 5% EA tax. Stale prices are not used for open-position valuations. It is not stored in the public Supabase market tables.

SBC rating filters apply to individual cards, not full squad eligibility. Unknown rating excludes the card from filtered events. Manual verified ratings are retained during refresh. No automatic SBC scraper is connected.

No new live price source is installed. Candidate scrapers are unverified for FC27 PC, and known platform-selection risks prevent using them as trustworthy feeds without tests.

Tests: node tests/features.test.mjs; node tests/market.test.mjs.

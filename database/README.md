# Supabase database preparation

Status: schema prepared, not applied. Creation of a separate free project was rejected because the account has two active free projects. Choose a target project before applying schema.sql.

The isolated fcscanner schema stores FC27 card versions, timestamped PC prices, manually verified market events and model-versioned signals for future backtesting. It does not modify existing application tables or Auth configuration.

Run schema.sql once through a migration on the chosen project, verify constraints and RLS, and run Supabase security advisors. Add fcscanner to the Data API exposed schemas before connecting the frontend. Market tables allow public SELECT only; writes require a trusted server importer. Never put service-role or secret keys in GitHub Pages. Personal portfolios and account data are not part of these public tables.

The current app still uses local storage. No cloud connection, automatic imports, signal scheduler or backtesting is enabled by this draft.

## rfutbin assessment

Reviewed https://github.com/danielredondo/rfutbin: MIT-licensed R scraper. futbin_search.R hardcodes FIFA21 /21/players and parses the first HTML table via httr/rvest. It has no solution for HTTP403, no FC27 compatibility verification and no market event analysis. Reuse ideas or adapt selected code with the MIT notice; do not treat it as a working live FC27 feed.

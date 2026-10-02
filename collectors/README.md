# Price collection status

Direct requests tested 2026-10-02 for Gabriel 78, Bruno 53, Salah 738 and FC27 SBC list: all HTTP403. No direct FUTBIN feed or automatic SBC collector is enabled.

sync-prices.yml polls every 30 minutes (GitHub schedules may be delayed). It imports the latest successful getdataforme/futbin-category-details Actor dataset, or a fixed APIFY_DATASET_ID repository variable. It DOES NOT start Actor runs or create fresh data. New observations appear only when a new completed source dataset exists. Original scrapedAt is retained, duplicate imports do not refresh timestamps, zero/missing PC prices and non-FC27 cards are rejected.

Required repository Actions secrets:
- APIFY_API_TOKEN: new token; revoke the token previously shared in chat.
- SUPABASE_SERVICE_ROLE_KEY: server-side key for wik60's Project. Do not send it in chat or put it in Pages source.

Supabase URL is fixed to the chosen project. Service-role-only import RPC writes cards and prices atomically. Public visitors cannot execute it. Missing secrets fail explicitly without writing data.

Set secrets at https://github.com/wik60/fcscanner/settings/secrets/actions then run Sync completed Apify prices through Actions. No secrets were configured by the agent, and no paid Actor runs were started.

Local validation:
python collectors/apify_import.py --file your-export.json --dry-run

User's three-card export passed validation: 3 cards, 3 observations. The first Maradona/Pele export has one nonzero PC card (Maradona); budget filters remain the analyzer's responsibility.

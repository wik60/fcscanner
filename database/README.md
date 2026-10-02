# FC Scanner Supabase

Deployed in wik60's Project (ztxbktelvqfisafywmvx), isolated schema fcscanner. Applied migration create_fcscanner_market contains schema.sql plus public-views.sql. Do not rerun schema.sql on this project.

Three original user Apify observations were seeded with their original timestamps. Public views fcscanner_prices and fcscanner_events use security_invoker=true and read-only grants. All four underlying tables have RLS. Verified REST returns three prices and anon has no INSERT privilege. Security advisors found no issues on FC Scanner objects; existing Matura/Auth findings belong to the pre-existing project.

cloud.mjs reads central prices/events every five minutes with a public publishable key. No secret or service-role key is in the frontend. Current manual imports, categories and form events remain browser-local. The signals table is prepared, but no scheduler writes signals yet. Automatic FUTBIN/Apify ingestion is not enabled.

The public schema views avoid changing existing Data API exposure settings. Existing Matura tables and Auth configuration were not modified.

## rfutbin

https://github.com/danielredondo/rfutbin is an MIT-licensed R scraper. futbin_search.R hardcodes FIFA21 /21/players and parses HTML via httr/rvest. It does not resolve HTTP403. FC27 compatibility was not verified; do not treat it as a working live feed.

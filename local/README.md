# Local browser test

Run on your computer, not GitHub Actions. This is an interactive diagnostic, not an unattended collector. No cloud keys or paid services are required. Chromium uses a separate profile inside local/browser-profile. It does not alter your normal browser profile.

Install Python 3 and Playwright, then install Chromium with python -m playwright install chromium. Run python local/browser_test.py. For each card, view the page, select PC if necessary and press ENTER in the terminal. Confirm the extracted price only if it matches the visible PC price. If the page is blocked, stop; this script does not bypass challenges. A missing PC-specific selector results in rejection, never a fallback to console price.

The output confirmed-pc-prices.json can be imported in FC Scanner. browser-test-report.json contains statuses and candidates without full page/session dumps. Scrape time records when you read the page, not the original underlying market update time. Successful local tests are required before scheduling anything.

Do not commit browser-profile or local outputs. Supported on Mac/Windows where the installed Playwright version supports the OS.

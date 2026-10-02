# FC Scanner browser test

Chrome Manifest V3 extension for Mac and Windows. Download repository ZIP, extract it, open chrome://extensions, enable Developer mode, choose Load unpacked and select the extension folder containing manifest.json.

Open a FC27 player page on FUTBIN using your normal browser, select PC, click the extension and Check open card. It only proposes a price if a visible PC-specific selector yields one unique valid value. Otherwise enter the visible PC price manually. Explicit user confirmation is mandatory. Save three observations and export JSON; import that file in FC Scanner.

This is an interactive local feasibility test, not an automatic catalogue crawler. No cloud keys, EA access, session extraction or remote uploads. Permissions: activeTab for the user-selected page, scripting for the read, storage for local observations. The collector records observation time, not the original market update. Browser data is not synced to Supabase. No claim of live FC27 DOM selector compatibility without a user test.

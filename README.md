# Election Night 2026 — NBC News auto-updating dashboard

A static, responsive GitHub Pages dashboard for a custom 2026 election watchlist. The visual design remains the same: Democratic blue, Republican red, dark-mode toggle, incumbent badges, DDHQ links, filters and responsive race cards.

## What updates automatically

A GitHub Action runs every 5 minutes (GitHub's minimum scheduled interval), fetches NBC News' public browser-delivered 2026 election-results data, matches it to races in `data/races.json`, and writes vote totals, percentages, reporting status and winner/call status back to that file. The open page checks for fresh JSON every minute.

**No API key is required.**

NBC has announced real-time digital election results for Nov. 3, 2026. Its public results endpoint/schema is not a documented public API, so `scripts/update-nbc.mjs` is deliberately isolated and fails safely: if NBC changes the endpoint/schema, the Action errors and leaves the last good results untouched.

## Upload to GitHub

1. Create a new GitHub repository.
2. Upload **all contents of this folder**, including `.github`.
3. Commit to `main`.
4. Open **Settings → Pages**.
5. Choose **Deploy from a branch**, `main`, `/ (root)`, then Save.
6. Open **Actions → Update NBC election results → Run workflow** to test the updater.

No Secrets are required.

### Optional NBC URL override

The updater contains discovery/default URLs. If NBC publishes a different public Election Night endpoint, you do **not** need to edit code. Go to:

**Settings → Secrets and variables → Actions → Variables → New repository variable**

Name: `NBC_RESULTS_URL`

Value: NBC's public results page/data URL.

You can alternatively put the URL in `config.json` under `nbc.resultsUrl`.

## Add races

Use the dashboard's **+ Add race** button to generate a race object, then paste that object into the `races` array in `data/races.json`.

For strongest automatic matching, fill in:
- office (`house`, `senate`, or `governor`)
- state postal abbreviation
- House district when applicable
- candidate names exactly as NBC displays them
- candidate party
- incumbent status
- DDHQ race URL

Do **not** manually maintain live vote totals. The updater owns votes, percentages, reporting and winner/call fields.

## Files

- `index.html` — dashboard markup
- `style.css` — existing visual design and responsive styles
- `app.js` — dashboard rendering, filters, dark mode, race builder and auto-refresh
- `data/races.json` — watchlist + live results
- `data/control.json` — House/Senate control panel configuration
- `data/timeline.json` — timeline items
- `scripts/update-nbc.mjs` — isolated NBC public-data adapter
- `.github/workflows/update-results.yml` — automatic 5-minute updater
- `config.json` — election and NBC adapter configuration

## Important Election Night behavior

The NBC source is an undocumented public web payload, not a supported developer API. The updater therefore never replaces `data/races.json` unless it finds recognizable structured data and can match configured races. A fetch/schema/matching failure makes the GitHub Action fail visibly while preserving the last successful dashboard data.

Before Nov. 3, run the workflow manually after NBC's general-election results pages go live. If NBC's final URL differs from the defaults, set `NBC_RESULTS_URL` once and rerun the workflow.

## Watchlist architecture

`data/watchlist.json` is now the permanent source of truth for the races you want to track. Edit this file when adding or removing a race. The NBC updater never overwrites it.

`data/races.json` is generated output. The updater reads `watchlist.json`, finds those races in NBC's public results payload, carries forward the last good values for any temporarily unmatched race, and writes the latest display data to `races.json`. Do not maintain live vote totals manually in `races.json`.

The repository is preloaded with the 38 House and Senate races supplied for this dashboard. Incumbents are marked in `watchlist.json` and therefore retain the `INC` badge when results update.

## Command-center features

This version adds a transient **Just Called** banner, race sorting (closest, most reporting, recently called, state/district), automatic D/R margin, expected-vote and estimated-votes-remaining display when NBC exposes enough data, incumbent won/lost/outstanding counts, party-flip and incumbent-defeat callouts, poll-close support, recently-updated card highlighting, and an NBC feed-health monitor.

### Optional watchlist fields

Each race in `data/watchlist.json` can include:

- `previousParty`: `"D"`, `"R"`, or `"I"` to enable automatic flip detection.
- `pollClose`: an ISO timestamp with offset, e.g. `"2026-11-03T20:00:00-05:00"`.
- `ddhqUrl`: the race's Decision Desk HQ URL.

The Race Builder on the page now generates these fields too.

The health monitor treats data as stale after 12 minutes without a successful updater commit. GitHub's scheduled workflow still runs every five minutes, and the open page checks for newly committed JSON every minute.


## Poll-closing sort
The included 38-race watchlist is preloaded with November 3, 2026 poll-closing timestamps in Eastern Standard Time using the 270toWin 2026 poll-closing schedule, including its congressional-district exceptions. The dashboard defaults to **Poll closing time (ET)** and then sorts ties by state/district. You can still choose the other sort modes from the dropdown.

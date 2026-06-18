# GTFS-JP Sync Design

## Current approach

- Use `pnpm gtfs:sync` to download the latest GTFS-JP zip from the Toshibus feed.
- Expand the raw feed into `data/gtfs-jp/toshibus/` so source diffs are reviewable in Git.
- Generate a browser-ready normalized artifact at `public/gtfs/toshibus-static.json`.
- Load the normalized JSON from the web app instead of importing mock static data.

## Why this shape

- The app runs in the browser, so direct filesystem reads from `data/` are not a stable runtime path.
- Keeping the raw extracted feed in-repo makes timetable diffs visible in pull requests.
- Generating a minimized web artifact decouples runtime loading from GTFS CSV parsing.
- The same sync path can run locally and in GitHub Actions without changing the application code.

## Planned GitHub Actions flow

1. Run on `schedule` and `workflow_dispatch`.
2. Execute `pnpm gtfs:sync`.
3. Detect changes in `data/gtfs-jp/toshibus/` and `public/gtfs/toshibus-static.json`.
4. Open or update a PR with the refreshed timetable data.
5. Let the existing Pages deploy workflow publish the updated artifact after merge.

## Follow-up items

- Narrow the generated trip set if bundle size becomes a problem.
- Add feed-version based no-op detection to skip unnecessary PRs.
- Extend the normalized artifact with stop times when ETA logic moves beyond the current placeholder calculation.

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

## GitHub Actions flow

1. Run on `schedule` and `workflow_dispatch`.
2. Execute `scripts/sync-gtfs-jp.ps1` with the requested dataset id.
3. Build the static site with the generated GTFS JSON in the Actions workspace.
4. Upload `dist/` as the GitHub Pages artifact.
5. Deploy the freshly generated artifact directly to GitHub Pages without committing large files back to Git.

## Follow-up items

- Narrow the generated trip set if bundle size becomes a problem.
- Add feed-version based no-op detection to skip unnecessary PRs.
- Extend the normalized artifact with stop times when ETA logic moves beyond the current placeholder calculation.

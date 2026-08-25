# Legacy GolfMe (pre-refactor)

These files are the original static-HTML PWA (v7.1) kept for reference after
the v2 refactor. **They are no longer served by the application.**

| File         | Role                                                         |
| ------------ | ------------------------------------------------------------ |
| `index.html` | Full tracker: shot wizard, GPS, live dashboard, IndexedDB archive |
| `main.html`  | Minimal tracker with an incompatible data schema (`golf_shots`) |
| `manifest.json` | PWA manifest (no icons — never installable)              |
| `sw.js`      | Service worker (network-first, never populated its cache)     |

## Data migration

On first boot, v2 reads and converts (then removes) the legacy keys:

- `golf_v7_shots` / `golf_v7_pars` / `golf_course_name` (localStorage) → the
  active round (schema v2).
- `GolfTrackerDB` → `rounds` (IndexedDB) → archived rounds.
- `golf_shots` (localStorage, minimal tracker) → the active round when no
  v7 data exists.

Conversion is idempotent (guarded by `golfme.migration.v1.complete`).
Swedish UI labels are mapped to canonical English enum codes
(`'🔥 Bra'` → `GOOD`, `'PLIKT (OoB)'` → penalty `OUT_OF_BOUNDS`,
`'🟢 Till Green'` → `ON_GREEN`, …).

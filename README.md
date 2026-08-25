# ⛳ GolfMe

A golf round tracker built for **zero data loss** and **React Native portability**.

> **Status:** v2.0 — refactored from a legacy static-HTML PWA into a modular
> React + TypeScript application. All domain, persistence, and analytics
> logic lives in framework-agnostic TypeScript modules that can be copied
> into a React Native (APK/AAB) codebase verbatim.

---

## Quick start

```bash
npm install
npm run dev        # start the dev server
npm run lint       # ESLint (flat config, portability guard included)
npm run typecheck  # tsc --noEmit (strict mode)
npm test           # Vitest unit suite (84 tests)
npm run build      # tsc + vite production build
```

## Features

- **Shot-recording wizard** — per-shot club/quality/landing flow with GPS
  distance tracking (ported from the legacy v7.1 UX), chipping editor, and
  putting counter.
- **Zero data loss** — the active round snapshot (round + current hole +
  wizard step + selections) is persisted on *every* mutation and restored on
  boot. Corrupted payloads are quarantined instead of crashing the app.
- **Live dashboard** — score vs par, FIR%, GIR%, putts, scrambling, sand
  saves while you play.
- **Advanced analytics** — per-round deep dive with hole-by-hole momentum
  and performance distribution; multi-round aggregation with round
  multi-select / "All Rounds", scoring average, handicap index (simplified
  WHS differential), driving accuracy, GIR%, putts/round, sand saves.
- **History & backup** — archived rounds in IndexedDB, per-round CSV export,
  full JSON backup export/import.
- **Legacy migration** — v7.1 data (`golf_v7_shots`, `GolfTrackerDB`,
  `golf_shots`) is converted to schema v2 exactly once, automatically.

## Architecture

```
src/
├── domain/       Pure business logic — models + zod schemas, enums,
│                 scoring rules (GIR/FIR/scramble/sand save), geo utils.
│                 ZERO platform imports.
├── services/     Orchestration — round lifecycle, wizard actions,
│                 persistence, backup serializers, geolocation contract.
│                 ZERO platform imports.
├── storage/      StorageAdapter interface + localStorage / IndexedDB /
│                 memory implementations, schema versioning, quarantine,
│                 legacy migrations. ZERO platform imports.
├── analytics/    Pure calculation engine — single-round deep dive,
│                 multi-round aggregates, handicap, round selection.
│                 ZERO platform imports.
├── hooks/        React state orchestration (session, persistence,
│                 history, analytics). No DOM access.
├── components/   Accessible UI components (English labels).
├── pages/        Play / Dashboard / History views.
├── app/          Composition root — the ONLY place browser globals meet
│                 the core.
└── lib/          Browser-only helpers (geolocation impl, downloads).
```

### Portability contract

The folders `domain/`, `services/`, `storage/` and `analytics/` import only
the TypeScript standard library. ESLint **enforces** this: a
`no-restricted-imports` rule blocks React imports and a
`no-restricted-globals` rule blocks `window`, `document`, `navigator`,
`localStorage`, `indexedDB`, `alert`, `confirm` and friends inside them.

### Data model (schema v2)

```ts
Shot        { id, holeNumber, shotNumber, club?, quality?, result?,
              start?: LatLng, end?: LatLng, distanceMeters?,
              penalty?: 'OUT_OF_BOUNDS'|'WATER_HAZARD',
              isPutt?, putts?, puttDistance?, createdAt }
HoleScore   { holeNumber, par, strokes, putts, firstPuttDistance?,
              fairwayHit?, greenInRegulation?, sandSave?, scramble?, status }
Round       { id, courseName, courseRating?, courseSlope?, startedAt,
              completedAt?, status, players[], holes[], shots[],
              schemaVersion: 2 }
```

All payloads are wrapped in a versioned envelope
`{ schemaVersion, kind, payload }` and validated with zod on every read.
Wrong versions and corrupt data are moved to a `golfme.corrupt.*` quarantine
bucket, never misread.

### Persistence layers

| Concern            | Engine      | Key / store                    |
| ------------------ | ----------- | ------------------------------ |
| Active round       | localStorage | `golfme.activeRound.v2`        |
| Archived rounds    | IndexedDB   | `GolfMeDB` → store `rounds`    |
| Migration flag     | localStorage | `golfme.migration.v1.complete` |

## React Native migration path (next phase)

1. Copy `src/domain`, `src/services`, `src/storage`, `src/analytics`
   **verbatim** into the RN workspace — they have zero DOM imports.
2. Implement `StorageAdapter` over **AsyncStorage or MMKV** (the interface is
   Promise-based; only `read`/`readRaw`/`write`/`delete`/`list`/`clear` need
   implementing). The versioned envelope + zod validation carry over as-is,
   so a phone can read the same backup JSON a browser wrote.
3. Implement `GeolocationProvider` over
   `react-native-geolocation-service` (same `getCurrentPosition` contract).
4. Reuse `src/hooks` unchanged (React-only, no DOM).
5. Rebuild `src/components` with RN primitives; ship via EAS/Gradle →
   APK/AAB. **Business logic is never rewritten.**

## QA

- `npm run lint` — ESLint with the portability guard.
- `npm run typecheck` — strict TypeScript (`noUncheckedIndexedAccess` on).
- `npm test` — 84 unit tests: golden-value analytics fixtures,
  crash-recovery persistence tests (fake-indexeddb), corruption quarantine,
  legacy migration round-trips, wizard integration flow, and hook-level
  hydration/auto-save tests.

## Legacy

The pre-refactor app lives in [`legacy/`](legacy/) for reference. Its data
is migrated automatically on first boot of v2; the old entry points
(`index.html`, `main.html`) are superseded by the React app.

## License

MIT (see `LICENSE` — the original repo carried no explicit license file;
add one before public distribution).

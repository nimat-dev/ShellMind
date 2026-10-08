# Sprint Contract — F001: Monorepo + protocol core + scripts

Feature: F001 — Monorepo + protocol core + scripts
Phase: Phase 01 — Foundation (prove the pipe)
Date: 2026-10-07

## 1. Scope & Acceptance Criteria
- [x] pnpm workspace with `packages/protocol`, `packages/agent`, `packages/mobile`; TS strict mode across all; shared base tsconfig.
- [x] `@shellmind/protocol` exports the message envelope + zod schemas for `ping`/`pong` and the `error` message; a pure round-trip (parse→validate→serialize) unit test passes.
- [x] `scripts/init.sh` and `scripts/check-architecture.sh` exist and run; `check-architecture` runs dependency-cruiser against the rules in `rules/layer-boundaries.md` and passes on the skeleton (and would fail on a seeded violation — proven with throwaway test case).
- [x] CI workflow (`.github/workflows/ci.yml`) runs typecheck + lint + test + check-architecture on push.
- [x] Edge/error cases from §2 covered by tests: malformed JSON, oversized message, unknown message type, missing required envelope fields.
- [x] E2E: N/A — no user-facing flow yet (pure protocol library + tooling scaffold).
- [x] Boundary invariants: `check-architecture` passes; `packages/protocol` imports nothing with I/O (pure core).
- [x] No regressions: full verify (typecheck + lint + test + check-architecture) passes with zero errors.

## 2. Edge cases & failure paths (from `verification/edge-cases.md`)
- Malformed JSON string passed to parser -> returns typed parse failure error (`ERR_MALFORMED_JSON`).
- Missing required envelope fields (e.g. missing `id`, `type`, or `payload`) -> Zod validation error (`ERR_INVALID_ENVELOPE` / `ERR_SCHEMA_VALIDATION`).
- Oversized message exceeding MAX_MESSAGE_SIZE -> rejected with size limit error before expensive processing (`ERR_PAYLOAD_TOO_LARGE`).
- Unknown message type -> validated against known message schemas; rejected with unrecognized message type error (`ERR_UNKNOWN_MESSAGE_TYPE`).
- Protocol package isolation -> dependency-cruiser fails if any Node builtin or external I/O package is imported in `protocol` (proven with seeded violation).

## 3. E2E scenario(s)
N/A — Not user-facing (foundation scaffold & core protocol library). E2E testing starts in F003 with mobile client connection.

## 4. Plan (thinnest vertical slice)
1. Initialize pnpm monorepo root: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`.
2. Configure `packages/protocol` with Zod dependencies, schemas (`Envelope`, `PingMessage`, `PongMessage`, `ErrorMessage`), serializer, and parser.
3. Configure `packages/agent` and `packages/mobile` package skeletons.
4. Add Vitest and unit test suite in `packages/protocol`.
5. Set up ESLint and dependency-cruiser configuration (`.dependency-cruiser.cjs`).
6. Create `scripts/init.sh` and `scripts/check-architecture.sh`.
7. Verify seeded architectural violation test.
8. Add GitHub Actions CI workflow.
9. Execute full verify: typecheck, lint, test, check-architecture.

## 5. Out of scope (parked, not built)
- Transport socket servers or clients (F002).
- Terminal PTY handling (F004).
- Claude Code subprocess driver (F007).

## 6. New dependencies (with justification)
- `zod`: Schema declaration and validation for pure core protocol (`packages/protocol`).
- `vitest`: Fast TypeScript unit test runner for the monorepo.
- `typescript`: Strict type checking across workspace packages.
- `dependency-cruiser`: Mechanically enforces layer boundaries in `rules/layer-boundaries.md`.
- `eslint` + `typescript-eslint`: Code linting.

## 7. Risks
- Workspace dependency linking issues: ensure `pnpm-workspace.yaml` correctly resolves `"@shellmind/protocol": "workspace:*"`.
- Leakage of Node I/O into protocol: strictly verified by dependency-cruiser.

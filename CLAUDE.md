# CLAUDE.md

Operating manual for this repository. Read this before making changes.

> **Maintenance rule — applies to every change, no exceptions.**
> This file is the source of truth for what DojoPay *is* and what is *planned*.
> When you land a change you MUST update this file in the same commit:
> - Tick the phase checklist item you completed, and change its status marker.
> - If you added, moved, or deleted a directory or a route, update **Architecture** and **API surface**.
> - If you changed the data model, update **Data model**.
> - If you discovered a new flaw, add it to **Known issues** rather than leaving it in your head.
> - If you made a decision that constrains future work, add it to **Decisions**.
> A change that alters behaviour and leaves this file stale is an incomplete change.

---

## 1. What DojoPay is

A Solana-based micro-task marketplace. **Creators** fund a task (image labelling: pick the
best of N images); **workers** complete it and earn SOL; workers withdraw to their own wallet.

Both sides authenticate by signing a message with their Solana wallet — there are no passwords.

**Network:** devnet. **Money model:** currently custodial (a platform hot wallet holds task
funds and pays workers out); moving to an on-chain escrow program in Phase 6.

### Economics

| Quantity | Value | Where |
|---|---|---|
| Task price | 0.1 SOL (`100_000_000` lamports) | `TASK_PRICE_LAMPORTS` |
| Max submissions per task | 100 | `MAX_SUBMISSIONS_PER_TASK` |
| Worker reward per submission | task amount ÷ 100 = 0.001 SOL | derived |
| Lamports per SOL | `1_000_000_000` | `LAMPORTS_PER_SOL` |

A task is **full** (and `done`) once it has `MAX_SUBMISSIONS_PER_TASK` submissions. Until
Phase 3 this cap was not enforced, which is why the platform wallet could be drained.

---

## 2. Repository layout

```
dojopay/
├── CLAUDE.md            ← you are here
├── README.md            ← public-facing product README
├── DEPLOYMENT.md        ← gitignored; contains real secrets, never commit
├── render.yaml          ← backend deploy config (Render)
├── backend/             ← Express + Prisma API
├── frontend/            ← Next.js 14 App Router client
└── programs/            ← Anchor (Rust) on-chain escrow program — Phase 6
```

Backend and frontend are independent npm projects; the root `package.json` only wires up husky.

### Backend (`backend/src/`)

Target structure (Phase 1). Each layer may only import from layers below it.

```
src/
├── index.ts          app assembly + listen; no business logic
├── config/           env parsing & validation, economic constants. Imports nothing internal.
├── lib/              infrastructure clients: prisma, solana connection, s3, logger
├── middleware/       auth, error handler, rate limiting, request logging
├── services/         business logic; the only layer that touches prisma or the chain
├── controllers/      HTTP request/response only; delegates to services
├── routes/           route tables wiring paths → controllers
├── types/            zod schemas + shared TS types
└── utils/            pure helpers (serialization, lamport math)
```

**Rules**
- `config/` must never import from `index.ts`. The old code derived the worker JWT secret from
  a circular import of the Express app — see Known issues #1. Secrets live in `config/` only.
- Controllers never call `prismaClient` directly.
- Services never touch `req`/`res`.
- Everything that leaves the API is JSON-safe: BigInt is serialized via `utils/serialize.ts`,
  never with ad-hoc `.toString()` at call sites.

### Frontend (`frontend/`)

```
app/
├── page.tsx        landing + sign-in funnel (honours ?role, ?next, ?ref)
├── layout.tsx      mounts WalletProviders → AuthProvider
├── creator/        dashboard | tasks | create | task/[taskId] | task/[taskId]/edit | earnings
├── worker/         dashboard | tasks | earnings
└── task/[taskId]/  PUBLIC shareable task page — server-rendered, no session
components/
├── ui/             shadcn primitives — do not hand-edit, regenerate
├── landing/        marketing sections
├── creator/        creator-only feature components
├── worker/         worker-only feature components
└── shared/         AppShell, WalletProviders, ShareButton, PublicTaskView
hooks/              useWithdrawal, use-mobile
lib/
├── api/            typed client + endpoint functions + wire types
├── auth/           AuthProvider, useAuth, RoleGuard
└── solana/         cluster config, platform wallet, explorer links
utils/              pure helpers (lamport/SOL/USD conversion)
```

Every signed-in page is `<RoleGuard role=…><AppShell …>{content}</AppShell></RoleGuard>` and
nothing else — the page files are ~12 lines each.

**Rules**
- No component calls `axios` directly. All network access goes through `lib/api/`.
- No component reads `localStorage` directly for auth. Use the auth context.
- There is exactly one place that decides the Solana cluster: `lib/solana/config.ts`.

---

## 3. Data model

Prisma + PostgreSQL. Schema: `backend/prisma/schema.prisma`.

| Model | Purpose | Key constraints |
|---|---|---|
| `User` | a creator, identified by wallet `address` | `address` unique |
| `Worker` | a worker, identified by wallet `address` | `address` unique |
| `Task` | a funded unit of work owned by a `User` | `signature` unique (anti-replay) |
| `Option` | one image choice belonging to a `Task` | — |
| `Submission` | one worker's answer to one task | unique `[worker_id, task_id]` |
| `Payouts` | a withdrawal from platform wallet → worker | `signature` unique (idempotency) |

`User` and `Worker` are **separate tables**. The same wallet may hold both roles as two
independent identities; this is intentional and load-bearing for the two-token auth scheme.

Worker balances are lamport `BigInt`s:
- `pending_amount` — earned, not yet withdrawn.
- `withdrawn_amount` — cumulative amount already paid out. (Was `locked_amount`, which implied
  an escrow lock it never performed; renamed in Phase 3.)
- `referred_by` — wallet address of the worker whose share link brought them in, set once at
  creation so a returning worker cannot be re-attributed.

`Task` additionally carries `status` (`TaskStatus`), `submissionCount` for the capacity check,
and `vaultAddress`, which is null while a task is funded through the custodial wallet and set
once the escrow program owns its funds.

---

## 4. Auth model

Two parallel identities, two JWT secrets, two client-side token keys.

| Role | Sign-in message | JWT secret | Client storage |
|---|---|---|---|
| Creator | `Sign into DojoPay as a creator` | `JWT_SECRET` | `localStorage.token` |
| Worker | `Sign into DojoPay as a worker` | `WORKER_JWT_SECRET` | `localStorage.workerToken` |

Flow: client signs the literal message with the wallet → server verifies with
`nacl.sign.detached.verify` against the public key → upsert row → return JWT.

Both secrets must be supplied by the environment and must differ. See Known issues #1 for the
historical bug where the worker secret was derived from Express internals and thus guessable.

---

## 5. API surface

Base: `/v1`. All money values crossing the wire are **lamport strings**, never numbers
(BigInt does not survive JSON, and floats lose precision).

### Creator — `/v1/user`
| Method | Path | Purpose |
|---|---|---|
| POST | `/signin` | wallet-signature login |
| GET | `/presignedUrl` | S3 presigned POST for image upload |
| POST | `/task` | verify funding tx, create task |
| GET | `/tasks` | list own tasks |
| GET | `/task?taskId=` | task detail + per-option vote counts |
| GET | `/task/:id` | single task |
| PATCH | `/task/:id` | edit title / expiry |
| GET | `/dashboard` | analytics overview |
| GET | `/earnings` | spend + payout history |

### Worker — `/v1/worker`
| Method | Path | Purpose |
|---|---|---|
| POST | `/signin` | wallet-signature login |
| GET | `/nextTask` | next unanswered, unexpired, unfilled task |
| POST | `/submission` | submit a choice, credit `pending_amount` |
| GET | `/balance` | pending + withdrawn balances |
| GET | `/submissions` | own submission history |
| GET | `/payouts` | own withdrawal history |
| GET | `/earnings` | paginated combined ledger |
| GET | `/dashboard` | metrics + next task |
| POST | `/payout` | signed withdrawal request |

### Public
| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | liveness + DB check |
| GET | `/v1/public/task/:id` | share-link preview, no auth (Phase 5) |

---

## 6. Commands

```bash
# backend
cd backend
npm run dev              # nodemon + tsx
npm run build            # prisma generate && tsc
npm start
npm run test:run         # vitest, no watch

# frontend
cd frontend
npm run dev              # port 5174
npm run build
npm run test:run

# database
cd backend
npx prisma migrate dev --name <name>
npx prisma generate
npx prisma studio

# on-chain program (Phase 6)
cd programs/escrow
anchor build
anchor test
```

A husky **pre-commit hook runs both test suites** and blocks the commit on failure.
Do not `--no-verify` around it.

### Environment

Backend `.env`:
```
DATABASE_URL=postgresql://...
RPC_URL=https://api.devnet.solana.com
PLATFORM_WALLET_ADDRESS=<base58 pubkey>
PRIVATE_KEY=<base58 secret key for the platform wallet>
JWT_SECRET=<random>
WORKER_JWT_SECRET=<different random>
S3_BUCKET_NAME= S3_BUCKET_REGION= S3_BUCKET_ACCESS_KEY_ID= S3_BUCKET_SECRET_ACCESS_KEY=
FRONTEND_URL=
```

Frontend `.env.local`:
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
NEXT_PUBLIC_CLOUDFRONT_URL=https://<dist>.cloudfront.net/
NEXT_PUBLIC_SOLANA_NETWORK=devnet
```

The server must refuse to boot if a required variable is missing. No silent fallback secrets.

---

## 7. Phased implementation plan

Status markers: `TODO` · `WIP` · `DONE`.
Each phase is one commit (or a small series) and must leave both test suites green.

### Phase 0 — Baseline `DONE`
- [x] Branch `refactor/architecture-and-escrow` cut from `main`
- [x] Record baseline: 71 backend + 42 frontend tests passing
- [x] Author this document

### Phase 1 — Backend foundation `DONE`
Goal: make the backend's structure incapable of producing the class of bugs found in the audit.
- [x] `config/` module: parse + validate env at boot, fail fast on missing values
- [x] Fix `WORKER_JWT_SECRET` — real env secret, not derived from the Express app object
- [x] Break the `index.ts` ↔ router ↔ middleware circular imports (`app.ts` split from bootstrap)
- [x] Split routers into `routes/` + `controllers/` + `services/`
- [x] `lib/`: prisma, solana connection (honours `RPC_URL`), s3, structured logger
- [x] Central error-handling middleware; delete scattered try/catch duplication
- [x] `utils/serialize.ts` for BigInt-safe responses
- [x] Rate limiting on auth, payout and task-creation routes
- [x] Move `dotenv`/`prisma`/`tsx` to runtime deps — Render sets `NODE_ENV=production`,
      which skips devDependencies, so the old layout relied on `npx` fetching them at boot

### Phase 2 — Data model & migrations `DONE`
Goal: a schema that matches the database it actually runs on.
- [x] Delete SQLite-syntax migrations and `prisma/dev.db`; generate a clean Postgres baseline
- [x] `Task.signature` unique — closes the funding-replay hole
- [x] `Payouts.signature` unique — payout idempotency
- [x] Add `createdAt` to `Submission` and `Payouts` so ledger dates stop being fabricated
- [x] Add `Task.submissionCount` (denormalised) for cheap cap checks
- [x] `PayoutStatus` enum: `PROCESSING | SUCCESS | FAILED`; `TaskStatus` enum added alongside
- [x] `Worker.referred_by` and `Task.vaultAddress` for Phases 5 and 6

> **Applying it:** the baseline in `prisma/migrations/20260803000000_postgres_baseline` is a
> from-scratch schema. Per Decision 2 the dev database is disposable, so run
> `npx prisma migrate reset` locally and `npx prisma migrate deploy` on Render. This DROPS
> existing rows — do not run it against a database whose contents matter.

### Phase 3 — Correctness & economics `DONE`
Goal: the ledger tells the truth and the platform wallet cannot be drained.
- [x] Enforce `MAX_SUBMISSIONS_PER_TASK`; mark task `COMPLETED` when full
- [x] Reject submissions to full tasks, via a conditional `updateMany` that is race-safe
- [x] Payout: confirm on chain, then transition `PROCESSING → SUCCESS | FAILED`
- [x] Payout idempotency — debit before broadcast, restore balance on failure
- [x] Minimum withdrawal threshold (0.001 SOL) so dust withdrawals cannot cost more than they pay
- [x] Rename `locked_amount` → `withdrawn_amount`
- [x] Delete the unauthenticated `/v1/worker/test-earnings` debug endpoint
- [x] Collapse duplicate `PATCH`/`PUT /task/:id` handlers onto one implementation
- [x] Analytics use real `createdAt`; placeholder buckets and the hardcoded `85%` removed
- [x] Funding verification now checks `meta.err` — a *failed* transaction could previously fund a task

### Phase 4 — Frontend foundation `DONE`
Goal: one way to do each thing.
- [x] `lib/api/` typed client: single axios instance, auth header + 401 handling in interceptors
- [x] `lib/auth/` context + `useAuth`; every `setInterval(…, 1000)` localStorage poll deleted,
      replaced by a `dojopay:auth-changed` event plus cross-tab `storage`
- [x] `lib/solana/config.ts` — single cluster source; fixes the Mainnet/Devnet split
- [x] `<RoleGuard>` replaces copy-pasted access-denied blocks
- [x] Fix withdrawal on the earnings page (posted no signature → always 400)
- [x] `useWithdrawal` hook shared by the app bar and the earnings page
- [x] Dedupe the two `TaskDetailView`s and the three inline `WorkerAppbar` copies into `AppShell`
- [x] Local duplicate interfaces replaced by the shared `lib/api/types` contract
- [x] Creator sidebar was `hidden lg:block` — creators had no navigation at all on mobile
- [x] `UploadImage` no longer substitutes a `data:` URL on failure, which looked like a
      successful upload and then produced tasks with broken images
- [x] Deleted `app/(root)`, `Appbar`, `DashboardView`, `TasksView`, `WorkerView`,
      `MobileMenu`, `UserTypeModal`, `Hero`, `Footer`, `components/pages`

### Phase 5 — Share links & onboarding `DONE`
Goal: a task link works for someone who has never heard of DojoPay.
- [x] `GET /v1/public/task/:id` — unauthenticated preview payload, no worker identities
- [x] `/task/[id]` public page, server-rendered: title, reward, spots left, expiry, previews
- [x] Share button: copy link, native `navigator.share`, X/Telegram/WhatsApp intents
- [x] Deep-link preservation: `?next=` survives wallet-connect and role selection,
      guarded against open redirects (relative same-origin paths only)
- [x] Post-signup redirect drops the new worker on the shared task, not a generic dashboard
- [x] Referral attribution: `?ref=<address>` recorded once on worker creation
- [x] OG/Twitter card metadata so links unfurl with the task image

### Phase 6 — On-chain escrow program `TODO`
Goal: remove the platform's ability to abscond with or lose task funds.
- [ ] Anchor workspace at `programs/escrow`
- [ ] `TaskVault` PDA per task; creator funds it directly, platform never custodies
- [ ] Instructions: `initialize_task`, `record_submission`, `claim_reward`, `refund_expired`
- [ ] Backend becomes an attester/indexer, not a treasury
- [ ] `PaymentsProvider` interface so custodial and escrow paths coexist during migration
- [ ] Program tests (`anchor test`) against a local validator

### Phase 7 — Hardening & docs `TODO`
- [ ] Unit tests for every Phase 3 economic rule (cap, idempotency, status lifecycle)
- [ ] Integration test: create → submit ×N → task closes → withdraw
- [ ] Rotate the credentials exposed in `DEPLOYMENT.md`; move to a secret manager
- [ ] Truth-up `README.md` — it currently claims escrow, rate limiting, and reputation that do not exist
- [ ] CI workflow running both suites on PR

---

## 8. Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Wallet-only auth for now; no email/social login | Keeps the product non-custodial and dependency-free. Revisit with Privy/Dynamic if the share-link funnel measurably stalls at wallet install. |
| 2 | Dev database may be reset | Confirmed no production data worth preserving, so Phase 2 regenerates migrations from scratch rather than hand-writing a baseline. |
| 3 | Move to on-chain escrow (Phase 6) rather than adding fiat off-ramps | Custody is the deeper problem; an off-ramp on top of a hot-wallet ledger would compound it. USDC and fiat come after escrow. |
| 4 | Money crosses the wire as lamport strings | BigInt is not JSON-serializable and floats lose precision at 9 decimals. |
| 5 | `User` and `Worker` stay separate tables | Already load-bearing for two-token auth; merging them is a larger migration than this branch warrants. |

---

## 9. Known issues

Discovered in the audit of `main`. Each links to the phase that resolves it.

| # | Issue | Severity | Phase | Status |
|---|---|---|---|---|
| 1 | `WORKER_JWT_SECRET` derives from a default import of `index.ts`, which exports the **Express app**, not the secret. The secret is therefore Express's own source text — publicly reproducible, so worker tokens are forgeable. | Critical | 1 | FIXED |
| 2 | `Task.signature` not unique — one 0.1 SOL payment can create unlimited tasks. | Critical | 2 | FIXED |
| 3 | `MAX_SUBMISSIONS_PER_TASK` never enforced and `done` never set — unbounded workers claim 0.001 SOL each against a task funded with 0.1 SOL, draining the platform wallet. | Critical | 3 | FIXED |
| 4 | Unauthenticated `/v1/worker/test-earnings` exposes worker 1's ledger. | High | 3 | FIXED |
| 5 | Earnings-page withdrawal posts no signature; backend requires one, so it always 400s. Only the Appbar path works. | High | 4 | FIXED |
| 6 | Payouts are written `Processing` and never updated; creator earnings branch on `Success`, so paid work never shows as paid. | High | 3 | FIXED |
| 7 | Migrations are SQLite DDL (`AUTOINCREMENT`) against a `postgresql` datasource; `prisma/dev.db` is checked in. | High | 2 | FIXED |
| 8 | `JWT_SECRET` falls back to `"fallback-secret-for-dev"` in production if unset. | High | 1 | FIXED |
| 9 | `app/(root)/layout.tsx` selects **Mainnet** while every other path uses Devnet. | Medium | 4 | FIXED |
| 10 | Analytics fabricate data: weekly/monthly buckets dump everything into the current period, `/tasks` overwrites `createdAt` with `new Date()`, `retentionRate` is hardcoded `"85%"`. | Medium | 3 | FIXED |
| 11 | `PATCH` and `PUT /task/:id` are byte-identical duplicates. | Low | 3 | FIXED |
| 12 | Pages poll `localStorage` on a 1-second `setInterval` to detect auth changes. | Medium | 4 | FIXED |
| 13 | No rate limiting despite the README claiming it. | Medium | 1 | FIXED |
| 14 | `DEPLOYMENT.md` holds live-looking AWS keys, a Neon URL, and the platform wallet private key. Gitignored and never committed, but present in plaintext and duplicated into Render. | High | 7 | open |
| 15 | Funding verification ignored `meta.err`, so a transaction that **failed** on chain could fund a task if its balance deltas lined up. | High | 3 | FIXED |
| 16 | S3 upload keys used `Math.random()`, so two uploads could collide and silently overwrite. | Low | 1 | FIXED |
| 17 | `dotenv`/`prisma` were devDependencies but needed at runtime; Render's `NODE_ENV=production` skips those. | Medium | 1 | FIXED |

---

## 10. Conventions

- **TypeScript**, ESM (`"type": "module"`), `.js` extensions on relative imports in backend code.
- **Money**: lamports as `BigInt` in the DB and services; strings at the API boundary; convert
  to SOL only for display, via `frontend/utils/convert.ts`.
- **Errors**: services throw typed `AppError`s; the error middleware maps them to status codes.
  Controllers do not build error bodies by hand.
- **Logging**: no bare `console.log` in committed backend code — use `lib/logger`. The audit
  found request-level `console.log` of full transaction objects on the hot path.
- **Validation**: every request body is parsed with a zod schema from `types/`.
- **Tests**: vitest both sides. Backend mocks `lib/prisma`; frontend uses Testing Library.

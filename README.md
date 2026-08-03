# DojoPay

DojoPay is a task marketplace built on Solana. Creators fund small tasks, workers
complete them, and workers get paid in SOL to their own wallet.

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

> **Status: devnet, pre-production.** Payouts are currently **custodial** — a
> platform wallet holds task funds and pays workers out. The on-chain escrow
> program that removes this is written and builds, but is not deployed or
> audited. See [escrow/README.md](escrow/README.md).

## Table of Contents

- [What it does](#what-it-does)
- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [API](#api)
- [Deployment](#deployment)
- [Security](#security)
- [Roadmap](#roadmap)
- [Contributing](#contributing)

## What it does

The current task type is **image selection**: a creator uploads a set of images
and asks workers to pick the best one. Each task is funded with **0.1 SOL** and
accepts **100 submissions**, so each worker earns **0.001 SOL**. A task closes
automatically once it is full.

### For creators
- Create tasks, funded on chain before the task goes live
- Watch results and per-option vote counts as submissions arrive
- Share a task with a public link that works for people who have no account yet
- Analytics computed from real timestamps

### For workers
- Browse available tasks, one at a time
- Get credited immediately on submission
- Withdraw the accumulated balance to your own wallet, authorised by a wallet
  signature over the exact amount and destination

### Not yet built
Listed here because earlier versions of this README claimed them:
reputation/ratings, on-chain escrow (written, not deployed), fiat off-ramps,
real-time/WebSocket updates, task types other than image selection, and a
mobile app.

## How it works

**Creator:** connect wallet → sign in → upload images → send 0.1 SOL to the
platform wallet → the backend verifies that exact transaction on chain (correct
amount, correct recipient, correct payer, and that it did not fail) → the task
goes live. Each funding signature can only ever create one task.

**Worker:** connect wallet → sign in → open a task → pick an option → balance is
credited inside a database transaction that also claims one of the task's 100
slots → withdraw when ready.

**Withdrawal:** the worker signs `Withdraw <lamports> to <address>`. The backend
verifies the signature, debits the balance *before* broadcasting, sends the SOL,
and records the payout as `SUCCESS` or `FAILED` — restoring the balance if the
transfer fails.

## Tech stack

**Backend** — Node 22, Express 5, PostgreSQL via Prisma, JWT auth over Solana
wallet signatures, AWS S3 for images, deployed on Render.

**Frontend** — Next.js 14 (App Router), TypeScript, Tailwind, shadcn/ui, Solana
Wallet Adapter, Recharts, deployed on Vercel.

**On chain** — Solana devnet. Anchor program in [escrow/](escrow/) (not deployed).

Architecture, conventions, and the phased plan live in [CLAUDE.md](CLAUDE.md).

## Getting started

### Prerequisites
- Node.js 22+
- A PostgreSQL database
- A Solana wallet (Phantom, Solflare)
- An AWS S3 bucket

### Setup

```bash
git clone https://github.com/kingsleycj/dojopay.git
cd dojopay

# backend
cd backend
npm install
cp .env.example .env      # fill in the values below
npx prisma migrate dev
npm run dev

# frontend
cd ../frontend
npm install
cp .env.example .env.local
npm run dev               # http://localhost:5174
```

### Environment

Backend `.env` — **the server refuses to start if any of these are missing.**
There are no fallback secrets.

```env
DATABASE_URL=postgresql://...
JWT_SECRET=<random>
WORKER_JWT_SECRET=<a different random value>
RPC_URL=https://api.devnet.solana.com
PLATFORM_WALLET_ADDRESS=<base58 pubkey>
PRIVATE_KEY=<base58 secret key for that wallet>
S3_BUCKET_NAME=
S3_BUCKET_REGION=us-east-1
S3_BUCKET_ACCESS_KEY_ID=
S3_BUCKET_SECRET_ACCESS_KEY=
FRONTEND_URL=
```

`JWT_SECRET` and `WORKER_JWT_SECRET` must differ — sharing one would let a
creator token authenticate as a worker.

Frontend `.env.local`:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
NEXT_PUBLIC_CLOUDFRONT_URL=https://<dist>.cloudfront.net/
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_PLATFORM_WALLET_ADDRESS=<same as backend>
```

### Tests

```bash
cd backend  && npm run test:run   # 76 tests
cd frontend && npm run test:run   # 33 tests
cd escrow   && cargo test -p dojopay-escrow   # 7 tests
```

A pre-commit hook runs both JS suites.

## API

Base path `/v1`. All money values cross the wire as **lamport strings**.

### Creator — `/v1/user`
| Method | Path | Purpose |
|---|---|---|
| POST | `/signin` | wallet-signature login |
| GET | `/presignedUrl` | S3 presigned upload |
| POST | `/task` | verify funding, create task |
| GET | `/tasks` | list own tasks |
| GET | `/task?taskId=` | results + vote counts |
| GET | `/task/:id` | single task |
| PATCH | `/task/:id` | edit title / expiry |
| GET | `/dashboard` | analytics |
| GET | `/earnings` | spend + payout history |

### Worker — `/v1/worker`
| Method | Path | Purpose |
|---|---|---|
| POST | `/signin` | wallet-signature login |
| GET | `/nextTask` | next available task |
| POST | `/submission` | submit a choice |
| GET | `/balance` | pending + withdrawn |
| GET | `/submissions` | submission history |
| GET | `/payouts` | withdrawal history |
| GET | `/earnings` | paginated ledger |
| GET | `/dashboard` | metrics + next task |
| POST | `/payout` | signed withdrawal |

### Public
| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | liveness + DB check |
| GET | `/v1/public/task/:id` | share-link preview, no auth |

## Deployment

**Backend (Render)** — `render.yaml` is checked in. Set the environment
variables above, then run `npx prisma migrate deploy`.

**Frontend (Vercel)** — deploy from `frontend/`, set the `NEXT_PUBLIC_*`
variables.

## Security

What is actually implemented:

- **Non-custodial identity.** Users sign a message; DojoPay never sees a private
  key or a password.
- **Funding verification.** A task only goes live if a real, successful,
  correctly-addressed transaction of exactly 0.1 SOL exists on chain, paid by the
  signed-in creator. Funding signatures are unique, so one payment cannot create
  two tasks.
- **Withdrawal authorisation.** Each withdrawal requires a wallet signature over
  the exact amount and destination, so a captured signature cannot authorise a
  later or larger withdrawal.
- **Payout safety.** Balances are debited before broadcast and restored on
  failure; payout signatures are unique, so a retry cannot double-pay.
- **Capacity enforcement.** A task cannot accept more submissions than it funded;
  the check is a conditional update, so concurrent workers cannot both take the
  last slot.
- **Rate limiting** on sign-in, task creation, and payout routes.
- **Input validation** — every request body is parsed with a zod schema.
- **Separate role secrets** — creator and worker tokens are not interchangeable.

Known limitations:

- **Payouts are custodial.** One key controls all open task funds. This is the
  problem the escrow program exists to solve.
- Rate limiting is per-process and will not hold across multiple instances.
- The escrow program is unaudited and undeployed.

## Roadmap

Tracked in detail in [CLAUDE.md](CLAUDE.md) §7.

- [x] Layered backend, real Postgres migrations, enforced economics
- [x] Frontend API/auth foundation, shared shell
- [x] Public share links and referral attribution
- [x] Escrow program written and building
- [ ] Escrow deployed, integration-tested, audited
- [ ] USDC and fiat off-ramp (after escrow)
- [ ] Task types beyond image selection
- [ ] Reputation system

## Contributing

1. Fork and branch (`git checkout -b feature/thing`)
2. Read [CLAUDE.md](CLAUDE.md) — it explains the layering rules and must be
   updated alongside behaviour changes
3. Keep both test suites green (the pre-commit hook enforces this)
4. Open a pull request

## Support

- **Issues**: [GitHub Issues](https://github.com/kingsleycj/dojopay/issues)

---

**Built on Solana**

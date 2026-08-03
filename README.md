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
and asks workers to pick the best one.

**Creators choose their own economics.** You top up a **vault** — a per-account
balance of platform-held SOL — then fund each task with a budget and a number of
answers you want. The reward per answer is the budget divided by that count, and
exactly `reward × answers` is reserved against your vault. Slots nobody answers
are released back to you when the task closes.

### For creators
- A vault: top up once, fund any number of tasks with no further wallet approvals
- Choose a budget and answer count per task; the server quotes the exact split
  before you commit
- Close a task early and reclaim every unanswered slot
- Full statement: every deposit, reservation, reward paid, refund and withdrawal
- Watch results and per-option vote counts as submissions arrive
- Share a task with a public link that works for people who have no account yet
- Analytics computed from real timestamps

### For workers
- Sign up with an email, Google, or a wallet — no wallet needed to start
- Browse every task you can take, best-paying first, with the reward shown before
  you start
- Get credited immediately on submission
- Withdraw the accumulated balance to your own wallet, authorised by a wallet
  signature over the exact amount and destination

### One account, both sides
There is no separate creator and worker sign-up. The same account can do both and
switches between them in the app; profiles are created the first time you act in
each role.

### Not yet built
Listed here because earlier versions of this README claimed them:
reputation/ratings, on-chain escrow (written, not deployed), fiat off-ramps,
real-time/WebSocket updates, task types other than image selection, and a
mobile app.

## How it works

**Creator:** sign in → connect a wallet → transfer SOL to the platform wallet →
the backend verifies that transaction on chain (it succeeded, it credited the
platform wallet, and the payer is your linked wallet) and credits your vault.
Each transaction signature can only ever be credited once.

Then, per task: upload images → choose a budget and how many answers you want →
publish. The budget moves from `available` to `reserved` in the same transaction
that creates the task, so a task can never exist without its funding, and funding
can never be taken for a task that failed to create.

**Worker:** sign in → open a task → pick an option → your balance is credited
inside a database transaction that also claims one of the task's slots *and*
draws the same amount out of the creator's reservation → withdraw when ready.

**Refunds:** when a task expires, is force-closed, or is closed early by its
creator, every unfilled slot is released back to the creator's vault. The amount
owed is computed net of what has already been returned, so running the sweep
twice cannot pay twice.

**Withdrawal:** the worker signs `Withdraw <lamports> to <address>`. The backend
verifies the signature, debits the balance *before* broadcasting, sends the SOL,
and records the payout as `SUCCESS` or `FAILED` — restoring the balance if the
transfer fails.

## Tech stack

**Backend** — Node 22, Express 5, PostgreSQL via Prisma, JWT auth over Solana
wallet signatures, Cloudflare R2 for images, deployed on Render.

**Frontend** — Next.js 14 (App Router), TypeScript, Tailwind, shadcn/ui, Solana
Wallet Adapter, Recharts, deployed on Vercel.

**On chain** — Solana devnet. Anchor program in [escrow/](escrow/) (not deployed).

Architecture, conventions, and the phased plan live in [CLAUDE.md](CLAUDE.md).

## Getting started

### Prerequisites
- Node.js 22+
- A PostgreSQL database
- A Solana wallet (Phantom, Solflare)
- A Cloudflare R2 bucket

### Setup

```bash
git clone https://github.com/kingsleycj/dojopay.git
cd dojopay

npm run install:all                       # root + backend + frontend

cp backend/.env.example backend/.env      # fill in the values below
cp frontend/.env.example frontend/.env.local

npm run db:migrate                        # create the database schema
npm run dev                               # starts BOTH servers
```

- API → http://localhost:3000
- App → http://localhost:5174

`backend/` and `frontend/` are independent npm projects; the root `package.json`
just runs them together. Other useful root scripts:

```bash
npm run test           # both test suites
npm run typecheck      # both projects
npm run build          # both projects
npm run admin:create   # create the first admin account
npm run db:studio      # browse the database
```

### Environment

Backend `.env` — **the server refuses to start if any of these are missing.**
There are no fallback secrets.

See [backend/.env.example](backend/.env.example) for the annotated list. The
essentials:

```env
DATABASE_URL=postgresql://...
JWT_SECRET=<random>          # user sessions
ADMIN_JWT_SECRET=<different> # admin sessions
RESEND_API_KEY=              # optional locally; required in production
GOOGLE_CLIENT_ID=            # optional — omit to hide the Google button
GOOGLE_CLIENT_SECRET=
RPC_URL=https://api.devnet.solana.com
PLATFORM_WALLET_ADDRESS=<base58 pubkey>
PRIVATE_KEY=<base58 secret key for that wallet>
R2_ACCOUNT_ID=               # Cloudflare R2 — endpoint is derived from this
R2_BUCKET_NAME=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_PUBLIC_URL=               # r2.dev subdomain or custom domain
FRONTEND_URL=http://localhost:5174
```

`JWT_SECRET` and `ADMIN_JWT_SECRET` must differ — sharing one would let any user
token be replayed against the admin API.

Without `RESEND_API_KEY` the verification and reset links are printed to the
server log instead of emailed, which is fine for local development — the
server warns rather than refusing to start. To send real email, follow
[docs/email-setup.md](docs/email-setup.md).

Frontend `.env.local`:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
NEXT_PUBLIC_CDN_URL=https://<hash>.r2.dev/       # must match backend R2_PUBLIC_URL
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_PLATFORM_WALLET_ADDRESS=<same as backend>
```

### Tests

```bash
npm run test            # backend (222) + frontend (39)
npm run test:escrow     # on-chain program logic (7)
```

A pre-commit hook runs both JS suites.

## API

Base path `/v1`. All money values cross the wire as **lamport strings**.

### Auth — `/v1/auth`
| Method | Path | Purpose |
|---|---|---|
| POST | `/register` · `/login` | email + password |
| GET/POST | `/wallet/challenge` · `/wallet` | wallet sign-in |
| GET | `/google` · `/google/callback` | Google OAuth |
| POST | `/verify-email` · `/forgot-password` · `/reset-password` | email flows |
| GET | `/me` | current account |
| POST/DELETE | `/link-wallet` · `/link-email` | connect credentials |

### Creator — `/v1/user`
| Method | Path | Purpose |
|---|---|---|
| GET | `/presignedUrl` | R2 presigned PUT upload |
| POST | `/task` | create a task, funded from the vault |
| GET | `/tasks` | list own tasks |
| GET | `/task-quote` | preview the budget split before committing |
| GET | `/task?taskId=` | results + vote counts |
| GET | `/task/:id` | single task |
| PATCH | `/task/:id` | edit title / expiry |
| POST | `/task/:id/cancel` | close early, refund unfilled slots |
| GET | `/dashboard` | analytics |
| GET | `/earnings` | spend + payout history |

### Vault — `/v1/vault`
| Method | Path | Purpose |
|---|---|---|
| GET | `/` | balances: available, reserved, lifetime totals |
| GET | `/statement` | paginated ledger of every movement |
| POST | `/deposit` | credit a confirmed on-chain transfer |
| POST | `/withdraw` | signed withdrawal of the available balance |

### Worker — `/v1/worker`
| Method | Path | Purpose |
|---|---|---|
| GET | `/nextTask` | next available task |
| GET | `/tasks` | every task this worker can take, best-paying first |
| POST | `/submission` | submit a choice |
| GET | `/balance` | pending + withdrawn |
| GET | `/submissions` | submission history |
| GET | `/payouts` | withdrawal history |
| GET | `/earnings` | paginated ledger |
| GET | `/dashboard` | metrics + next task |
| POST | `/payout` | signed withdrawal — requires a linked wallet |

### Admin — `/v1/admin`
Separate credentials, separate secret, TOTP required. No signup route: the first
admin is created with `npm run admin:create`.

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

- **Flexible sign-up, non-custodial payouts.** Email, Google, or wallet. Passwords
  are argon2id-hashed; DojoPay never sees a private key. A wallet is required to
  withdraw, and it is proven by signature rather than simply typed in.
- **Separate admin surface.** Its own table, secret, and route prefix, with
  mandatory TOTP and no self-registration. Admins can read and moderate but cannot
  move money, adjust balances, or impersonate.
- **Append-only audit log** of every account, admin, and system action — including
  when an admin views someone's record.
- **Deposit verification.** A vault is only credited when a real, successful,
  correctly-addressed transaction exists on chain, paid by the account's own
  linked wallet. Deposit signatures are unique, so one transfer cannot be
  credited twice.
- **Vault accounting.** Every balance change writes an append-only ledger entry
  carrying the balances it produced, and a change that would make a balance
  negative aborts its transaction rather than persisting.
- **Withdrawal authorisation.** Each withdrawal requires a wallet signature over
  the exact amount and destination, so a captured signature cannot authorise a
  later or larger withdrawal.
- **Payout safety.** Balances are debited before broadcast and restored on
  failure; payout signatures are unique, so a retry cannot double-pay.
- **Capacity enforcement.** A task cannot accept more submissions than it funded;
  the check is a conditional update, so concurrent workers cannot both take the
  last slot. Reserving the budget and creating the task are one transaction, and
  crediting a worker and drawing down the creator's reservation are another — so
  what workers are owed and what creators have committed cannot drift apart.
- **Reserved funds are not withdrawable.** SOL committed to an open task cannot
  be pulled back out from under the workers who have not answered yet.
- **Rate limiting** on sign-in, task creation, and payout routes.
- **Input validation** — every request body is parsed with a zod schema, and
  lamport amounts cross the wire as digit-only strings rather than numbers.

Known limitations:

- **Payouts are custodial.** One key controls all open task funds. This is the
  problem the escrow program exists to solve.
- Rate limiting is per-process and will not hold across multiple instances.
- The escrow program is unaudited and undeployed.
- Signing out clears the device only; there is no server-side session revocation
  list, so a token stays valid until it expires.

## Roadmap

Tracked in detail in [CLAUDE.md](CLAUDE.md) §7.

- [x] Layered backend, real Postgres migrations, enforced economics
- [x] Frontend API/auth foundation, shared shell
- [x] Public share links and referral attribution
- [x] Per-creator vaults, creator-set budgets, and automatic refunds
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

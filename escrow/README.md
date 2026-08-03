# DojoPay escrow program

Anchor program that holds each task's funds in a program-owned PDA instead of a
platform hot wallet.

## Why

In the custodial model a creator sends 0.1 SOL to a wallet whose private key
lives in `PRIVATE_KEY`, and every worker is paid out of that same wallet. That
gives one key control of every open task's money, and it means an application
bug — such as the unenforced submission cap fixed in Phase 3 — drains real
funds rather than just producing wrong numbers.

Here the money never touches the platform.

## Design

| Account | Seeds | Holds |
|---|---|---|
| `TaskVault` | `["vault", task_id]` | one task's full payout budget |
| `ClaimReceipt` | `["receipt", vault, worker]` | proof a worker already claimed |

### Instructions

**`initialize_task(task_id, reward_lamports, max_submissions, expires_at)`**
Creator signs. Transfers `reward_lamports × max_submissions` from the creator
straight into the vault PDA and records the backend's key as `attester`.

**`claim_reward()`**
Requires two signatures: the **worker** (so funds can only reach a wallet
present in the transaction) and the **attester** (the backend confirming this
worker actually submitted). Creates a `ClaimReceipt` whose address is derived
from `(vault, worker)` — a second claim by the same worker fails at account
creation. This is the on-chain equivalent of the `@@unique([worker_id, task_id])`
constraint in Postgres.

**`refund_expired()`**
Creator only, and only after `expires_at`. Returns unclaimed lamports plus rent
and closes the vault. A creator cannot pull funds out from under workers who are
partway through the task.

### Trust model

- The **program** guarantees total claims never exceed the funded amount, that a
  worker claims at most once per task, and that refunds only happen after expiry.
- The **attester** chooses which workers are eligible. A compromised backend can
  direct rewards to workers of its choosing, but cannot exceed the funded amount,
  change the reward, or send funds to itself.
- The **creator** cannot reclaim funds while the task is live.

This is a meaningful reduction in trust, not its elimination. Removing the
attester entirely would require submission proofs verifiable on chain, which the
current image-labelling task type cannot produce.

## Building

The local toolchain is rustc 1.79 / solana-cli 1.18, so `anchor-lang` is pinned
to 0.30.1 and `Cargo.lock` pins several transitive crates that have since moved
to edition 2024. Do not run a blanket `cargo update` — it will break the build.

```bash
cd escrow
cargo test -p dojopay-escrow          # logic tests, no validator needed
cargo-build-sbf --manifest-path programs/dojopay-escrow/Cargo.toml
```

Produces `target/deploy/dojopay_escrow.so` (~248K).

## Before deploying

1. `declare_id!` currently holds the placeholder
   `Es1rwDojoPay11111111111111111111111111111111`. Generate the real program
   keypair, then sync the id in `lib.rs` and `Anchor.toml`:
   ```bash
   solana-keygen new -o target/deploy/dojopay_escrow-keypair.json
   solana address -k target/deploy/dojopay_escrow-keypair.json
   ```
2. Program keypairs are gitignored — they are the upgrade authority. A leaked
   key lets anyone replace the program holding every open task's funds.
3. **This program has not been audited and has not been deployed.** It builds and
   its arithmetic invariants are tested, but it has not been exercised against a
   validator. Do not put real funds behind it until it has integration tests
   (`anchor test` against `solana-test-validator`) and a review.

## Status

Phase 6 of the plan in `../CLAUDE.md`. The backend still settles through
`CustodialPaymentsProvider`; `EscrowPaymentsProvider` is the next step and slots
in behind the same `PaymentsProvider` interface.

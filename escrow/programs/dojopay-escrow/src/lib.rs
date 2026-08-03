//! DojoPay escrow.
//!
//! Replaces the custodial model, where creators sent 0.1 SOL to a platform hot
//! wallet whose private key sat in an environment variable, and workers were
//! paid from that same wallet. Under that design the platform could lose or
//! misappropriate every open task's funds, and a bug in the submission cap
//! drained real money.
//!
//! Here a task's funds live in a PDA owned by this program. The creator funds
//! the vault; workers claim their own reward directly from it; the creator can
//! reclaim whatever is unclaimed after expiry. The backend keeps its role as
//! the attester of *who did the work* — it signs off on submissions — but it
//! never holds custody and cannot move funds to an arbitrary destination.
//!
//! Trust model:
//!  - The **program** enforces that total claims never exceed what was funded,
//!    that a worker claims at most once per task, and that refunds only happen
//!    after expiry.
//!  - The **attester** (the backend's keypair, recorded on the vault at
//!    creation) decides which workers are eligible. A compromised attester can
//!    direct rewards to workers of its choosing, but cannot exceed the funded
//!    amount, cannot change the reward, and cannot withdraw to itself.
//!  - The **creator** cannot reclaim funds while the task is live.

use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("Es1rwDojoPay11111111111111111111111111111111");

/// Upper bound on submissions a task can accept. Bounds the vault's exposure
/// and keeps `reward_lamports * max_submissions` from overflowing.
pub const MAX_SUBMISSIONS_LIMIT: u16 = 1_000;

/// Rewards below this are not worth the transaction fee to claim.
pub const MIN_REWARD_LAMPORTS: u64 = 10_000;

#[program]
pub mod dojopay_escrow {
    use super::*;

    /// Create a task vault and move the full payout budget into it.
    ///
    /// The creator's lamports go straight from their wallet into the PDA, so
    /// there is no moment at which the platform holds them.
    pub fn initialize_task(
        ctx: Context<InitializeTask>,
        task_id: u64,
        reward_lamports: u64,
        max_submissions: u16,
        expires_at: i64,
    ) -> Result<()> {
        require!(max_submissions > 0, EscrowError::InvalidCapacity);
        require!(
            max_submissions <= MAX_SUBMISSIONS_LIMIT,
            EscrowError::InvalidCapacity
        );
        require!(
            reward_lamports >= MIN_REWARD_LAMPORTS,
            EscrowError::RewardTooSmall
        );

        let now = Clock::get()?.unix_timestamp;
        require!(expires_at > now, EscrowError::ExpiryInPast);

        // Checked arithmetic: an overflow here would let a vault promise more
        // than it holds.
        let total = reward_lamports
            .checked_mul(max_submissions as u64)
            .ok_or(EscrowError::MathOverflow)?;

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.creator.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            total,
        )?;

        let vault = &mut ctx.accounts.vault;
        vault.task_id = task_id;
        vault.creator = ctx.accounts.creator.key();
        vault.attester = ctx.accounts.attester.key();
        vault.reward_lamports = reward_lamports;
        vault.max_submissions = max_submissions;
        vault.claimed_count = 0;
        vault.total_funded = total;
        vault.expires_at = expires_at;
        vault.is_closed = false;
        vault.bump = ctx.bumps.vault;

        emit!(TaskInitialized {
            task_id,
            creator: vault.creator,
            total_funded: total,
            reward_lamports,
            max_submissions,
            expires_at,
        });

        Ok(())
    }

    /// Pay one worker their reward.
    ///
    /// Requires the attester's signature — the backend confirming this worker
    /// really submitted — and the worker's own signature, so a reward can only
    /// be sent to a wallet that is present in the transaction.
    ///
    /// The `receipt` account is what makes this idempotent: its PDA is derived
    /// from (vault, worker), so a second claim by the same worker fails at
    /// account creation. This is the on-chain analogue of the
    /// `@@unique([worker_id, task_id])` constraint in Postgres, and it closes
    /// the double-pay window the custodial version had.
    pub fn claim_reward(ctx: Context<ClaimReward>) -> Result<()> {
        // Read what we need up front and keep no long-lived borrow of the
        // account, so the lamport moves below can borrow the same AccountInfo.
        let (task_id, reward, max_submissions, claimed_count, expires_at, is_closed) = {
            let vault = &ctx.accounts.vault;
            (
                vault.task_id,
                vault.reward_lamports,
                vault.max_submissions,
                vault.claimed_count,
                vault.expires_at,
                vault.is_closed,
            )
        };

        require!(!is_closed, EscrowError::TaskClosed);
        require!(claimed_count < max_submissions, EscrowError::TaskFull);

        let now = Clock::get()?.unix_timestamp;
        require!(now < expires_at, EscrowError::TaskExpired);

        // The vault must stay rent-exempt, or the runtime reclaims the account
        // mid-task and strands every remaining claim.
        let rent_exempt = Rent::get()?.minimum_balance(TaskVault::LEN);
        let vault_info = ctx.accounts.vault.to_account_info();
        require!(
            vault_info.lamports().saturating_sub(reward) >= rent_exempt,
            EscrowError::InsufficientVaultFunds
        );

        // Direct lamport movement rather than a CPI: the vault is a
        // program-owned account carrying data, so `system_program::transfer`
        // would reject it.
        **vault_info.try_borrow_mut_lamports()? -= reward;
        **ctx
            .accounts
            .worker
            .to_account_info()
            .try_borrow_mut_lamports()? += reward;

        let vault_key = ctx.accounts.vault.key();
        let worker_key = ctx.accounts.worker.key();

        let new_count = claimed_count
            .checked_add(1)
            .ok_or(EscrowError::MathOverflow)?;

        let vault = &mut ctx.accounts.vault;
        vault.claimed_count = new_count;
        if new_count == max_submissions {
            vault.is_closed = true;
        }

        let receipt = &mut ctx.accounts.receipt;
        receipt.vault = vault_key;
        receipt.worker = worker_key;
        receipt.amount = reward;
        receipt.claimed_at = now;
        receipt.bump = ctx.bumps.receipt;

        emit!(RewardClaimed {
            task_id,
            worker: worker_key,
            amount: reward,
            claimed_count: new_count,
        });

        Ok(())
    }

    /// Return unclaimed funds to the creator once the task has expired.
    ///
    /// Only callable after `expires_at`, so a creator cannot pull the rug on
    /// workers who are partway through the task. Closing the account also
    /// returns its rent.
    pub fn refund_expired(ctx: Context<RefundExpired>) -> Result<()> {
        let vault = &ctx.accounts.vault;

        let now = Clock::get()?.unix_timestamp;
        require!(now >= vault.expires_at, EscrowError::NotYetExpired);

        let unclaimed = vault
            .max_submissions
            .checked_sub(vault.claimed_count)
            .ok_or(EscrowError::MathOverflow)? as u64;

        let refund = vault
            .reward_lamports
            .checked_mul(unclaimed)
            .ok_or(EscrowError::MathOverflow)?;

        emit!(TaskRefunded {
            task_id: vault.task_id,
            creator: vault.creator,
            refunded: refund,
            unclaimed_slots: unclaimed as u16,
        });

        // `close = creator` on the account constraint moves the vault's whole
        // remaining balance — refund plus rent — back to the creator.
        Ok(())
    }
}

/// Per-task escrow account. One PDA per task, seeded by the off-chain task id
/// so the backend can derive the address without storing it.
#[account]
pub struct TaskVault {
    pub task_id: u64,
    pub creator: Pubkey,
    /// Backend key permitted to authorise claims.
    pub attester: Pubkey,
    pub reward_lamports: u64,
    pub max_submissions: u16,
    pub claimed_count: u16,
    pub total_funded: u64,
    pub expires_at: i64,
    pub is_closed: bool,
    pub bump: u8,
}

impl TaskVault {
    // discriminator + u64 + 2*Pubkey + u64 + 2*u16 + u64 + i64 + bool + u8
    pub const LEN: usize = 8 + 8 + 32 + 32 + 8 + 2 + 2 + 8 + 8 + 1 + 1;
}

/// Proof that one worker has claimed from one vault. Existence is the guard —
/// creating it twice is impossible, so a reward cannot be claimed twice.
#[account]
pub struct ClaimReceipt {
    pub vault: Pubkey,
    pub worker: Pubkey,
    pub amount: u64,
    pub claimed_at: i64,
    pub bump: u8,
}

impl ClaimReceipt {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 1;
}

#[derive(Accounts)]
#[instruction(task_id: u64)]
pub struct InitializeTask<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    /// Recorded, not charged. Does not sign here — the backend registers its
    /// authority at creation and only signs later, on claims.
    /// CHECK: stored as a pubkey and verified on `claim_reward`.
    pub attester: UncheckedAccount<'info>,

    #[account(
        init,
        payer = creator,
        space = TaskVault::LEN,
        seeds = [b"vault", task_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub vault: Account<'info, TaskVault>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimReward<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault.task_id.to_le_bytes().as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, TaskVault>,

    /// Must sign, so rewards can only land in a wallet that consented.
    #[account(mut)]
    pub worker: Signer<'info>,

    /// The backend attesting that this worker completed the task. Constrained
    /// to the key recorded when the vault was created.
    #[account(constraint = attester.key() == vault.attester @ EscrowError::UnauthorizedAttester)]
    pub attester: Signer<'info>,

    /// Fails to initialise if this worker already claimed — that is the
    /// double-claim guard.
    #[account(
        init,
        payer = worker,
        space = ClaimReceipt::LEN,
        seeds = [b"receipt", vault.key().as_ref(), worker.key().as_ref()],
        bump,
    )]
    pub receipt: Account<'info, ClaimReceipt>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RefundExpired<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault.task_id.to_le_bytes().as_ref()],
        bump = vault.bump,
        // Only the original creator, and only their own vault.
        has_one = creator @ EscrowError::UnauthorizedCreator,
        close = creator,
    )]
    pub vault: Account<'info, TaskVault>,

    #[account(mut)]
    pub creator: Signer<'info>,
}

#[event]
pub struct TaskInitialized {
    pub task_id: u64,
    pub creator: Pubkey,
    pub total_funded: u64,
    pub reward_lamports: u64,
    pub max_submissions: u16,
    pub expires_at: i64,
}

#[event]
pub struct RewardClaimed {
    pub task_id: u64,
    pub worker: Pubkey,
    pub amount: u64,
    pub claimed_count: u16,
}

#[event]
pub struct TaskRefunded {
    pub task_id: u64,
    pub creator: Pubkey,
    pub refunded: u64,
    pub unclaimed_slots: u16,
}

/// Total lamports needed to fully fund a task.
///
/// Extracted so the solvency invariant can be tested without a validator: the
/// vault must always be able to pay every slot it sold.
pub fn total_funding_required(reward_lamports: u64, max_submissions: u16) -> Option<u64> {
    reward_lamports.checked_mul(max_submissions as u64)
}

/// Lamports owed back to the creator for slots nobody claimed.
pub fn refund_amount(
    reward_lamports: u64,
    max_submissions: u16,
    claimed_count: u16,
) -> Option<u64> {
    let unclaimed = max_submissions.checked_sub(claimed_count)?;
    reward_lamports.checked_mul(unclaimed as u64)
}

#[error_code]
pub enum EscrowError {
    #[msg("Capacity must be between 1 and MAX_SUBMISSIONS_LIMIT")]
    InvalidCapacity,
    #[msg("Reward is below the minimum worth claiming")]
    RewardTooSmall,
    #[msg("Expiry must be in the future")]
    ExpiryInPast,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("This task is closed")]
    TaskClosed,
    #[msg("This task has no remaining slots")]
    TaskFull,
    #[msg("This task has expired")]
    TaskExpired,
    #[msg("The task has not expired yet")]
    NotYetExpired,
    #[msg("Vault cannot cover this reward while staying rent-exempt")]
    InsufficientVaultFunds,
    #[msg("Signer is not the registered attester for this task")]
    UnauthorizedAttester,
    #[msg("Signer is not the creator of this task")]
    UnauthorizedCreator,
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The invariant that makes escrow safer than the custodial wallet: what a
    /// vault can ever pay out equals what was put in.
    #[test]
    fn funding_covers_every_slot() {
        let reward = 1_000_000u64; // 0.001 SOL
        let capacity = 100u16;

        let funded = total_funding_required(reward, capacity).unwrap();
        assert_eq!(funded, 100_000_000); // 0.1 SOL

        let max_payout = reward * capacity as u64;
        assert_eq!(funded, max_payout);
    }

    #[test]
    fn funding_rejects_overflow_instead_of_wrapping() {
        // A wrapped total would create a vault promising more than it holds.
        assert_eq!(total_funding_required(u64::MAX, 2), None);
        assert_eq!(total_funding_required(u64::MAX / 2, 1_000), None);
    }

    #[test]
    fn refund_returns_exactly_the_unclaimed_slots() {
        let reward = 1_000_000u64;

        assert_eq!(refund_amount(reward, 100, 0), Some(100_000_000));
        assert_eq!(refund_amount(reward, 100, 40), Some(60_000_000));
        assert_eq!(refund_amount(reward, 100, 100), Some(0));
    }

    /// Claims plus refund must reconcile to the funded total, so no lamport is
    /// double-spent and none is stranded.
    #[test]
    fn claims_plus_refund_equal_funding() {
        let reward = 1_000_000u64;
        let capacity = 100u16;
        let funded = total_funding_required(reward, capacity).unwrap();

        for claimed in [0u16, 1, 37, 99, 100] {
            let paid = reward * claimed as u64;
            let refunded = refund_amount(reward, capacity, claimed).unwrap();
            assert_eq!(paid + refunded, funded, "mismatch at {claimed} claims");
        }
    }

    #[test]
    fn refund_cannot_go_negative_if_counters_are_corrupt() {
        // claimed > capacity should surface as None rather than underflowing
        // into an enormous refund.
        assert_eq!(refund_amount(1_000_000, 10, 11), None);
    }

    #[test]
    fn capacity_limit_keeps_funding_in_a_sane_range() {
        let max_total = total_funding_required(MIN_REWARD_LAMPORTS, MAX_SUBMISSIONS_LIMIT);
        assert!(max_total.is_some());

        // Even at the maximum capacity a plausible reward cannot overflow.
        assert!(total_funding_required(1_000_000_000, MAX_SUBMISSIONS_LIMIT).is_some());
    }
}

use anchor_lang::prelude::*;
use solana_program::{ program::{ invoke_signed, invoke } };

declare_id!("9r8MYFtBHo7FkBpiD9KW3ddoJEiYNPuqGzDnU1nJpgAC");

#[program]
pub mod solana_faucet {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        max_amount: u64,
        vault_wallet_bump: u8
    ) -> Result<()> {
        let global_state = &mut ctx.accounts.global_state;

        // save admin
        global_state.admin = ctx.accounts.admin.key();
        global_state.max_amount_per_day = max_amount;
        global_state.vault_wallet_bump = vault_wallet_bump;

        Ok(())
    }

    pub fn update_limit(ctx: Context<UpdateLimit>, max_amount: u64) -> Result<()> {
        let global_state = &mut ctx.accounts.global_state;
        require!(ctx.accounts.admin.key().eq(&global_state.admin), ErrorCode::InvalidAdmin);

        global_state.max_amount_per_day = max_amount;

        Ok(())
    }

    pub fn deposit_vault(ctx: Context<DepositVault>, amount: u64) -> Result<()> {
        let global_state = &ctx.accounts.global_state;
        require!(ctx.accounts.admin.key().eq(&global_state.admin), ErrorCode::InvalidAdmin);

        if !has_balance(&ctx.accounts.rent, &ctx.accounts.admin, amount + TX_FEE)? {
            return Err(ErrorCode::InsufficientBalance.into());
        }

        sol_transfer_user(
            ctx.accounts.admin.to_account_info(),
            ctx.accounts.vault_wallet.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            amount
        )?;

        Ok(())
    }

    pub fn withdraw_vault(ctx: Context<WithdrawVault>, amount: u64) -> Result<()> {
        let global_state = &ctx.accounts.global_state;
        require!(ctx.accounts.admin.key().eq(&global_state.admin), ErrorCode::InvalidAdmin);

        if !has_balance(&ctx.accounts.rent, &ctx.accounts.vault_wallet, amount)? {
            return Err(ErrorCode::InsufficientBalance.into());
        }

        let seeds = &[VAULT_WALLET_SEED, &[global_state.vault_wallet_bump]];

        sol_transfer_with_signer(
            ctx.accounts.vault_wallet.to_account_info(),
            ctx.accounts.admin.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            &[seeds],
            amount
        )?;

        Ok(())
    }

    pub fn init_user_pool(ctx: Context<InitUserPool>) -> Result<()> {
        let user_pool = &mut ctx.accounts.user_pool;

        // save admin
        user_pool.owner = ctx.accounts.payer.key();

        let timestamp = Clock::get()?.unix_timestamp;
        user_pool.request_time = timestamp;
        user_pool.received_amount = 0;

        Ok(())
    }

    pub fn request_faucet(ctx: Context<RequestFaucet>, amount: u64) -> Result<()> {
        let global_state = &ctx.accounts.global_state;
        let user_pool = &mut ctx.accounts.user_pool;

        require!(ctx.accounts.payer.key().eq(&user_pool.owner), ErrorCode::InvalidUserPDA);

        let timestamp = Clock::get()?.unix_timestamp;
        let period: i64 = timestamp.checked_sub(user_pool.request_time).unwrap();
        if period >= DAY_TIME {
            require!(amount <= global_state.max_amount_per_day, ErrorCode::RequestTooManyFunds);

            user_pool.request_time = timestamp;
            user_pool.received_amount = amount;
        } else {
            user_pool.received_amount += amount;
            require!(
                user_pool.received_amount <= global_state.max_amount_per_day,
                ErrorCode::RequestTooManyFunds
            );
        }

        if !has_balance(&ctx.accounts.rent, &ctx.accounts.vault_wallet, amount)? {
            return Err(ErrorCode::InsufficientBalance.into());
        }

        let seeds = &[VAULT_WALLET_SEED, &[global_state.vault_wallet_bump]];

        sol_transfer_with_signer(
            ctx.accounts.vault_wallet.to_account_info(),
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            &[seeds],
            amount
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(vault_wallet_bump: u8)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        seeds = [GLOBAL_STATE_SEED.as_ref()],
        space = GlobalState::LEN,
        bump,
        payer = admin
    )]
    pub global_state: Account<'info, GlobalState>,

    /// CHECK: This account is not unsafe because using as vault account
    #[account(seeds = [VAULT_WALLET_SEED.as_ref()], bump)]
    pub vault_wallet: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction()]
pub struct UpdateLimit<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [GLOBAL_STATE_SEED.as_ref()],
        bump,
    )]
    pub global_state: Account<'info, GlobalState>,
}

#[derive(Accounts)]
#[instruction()]
pub struct DepositVault<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(seeds = [GLOBAL_STATE_SEED.as_ref()], bump)]
    pub global_state: Account<'info, GlobalState>,

    /// CHECK: This account is not unsafe because using as vault account
    #[account(mut, seeds = [VAULT_WALLET_SEED.as_ref()], bump)]
    pub vault_wallet: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction()]
pub struct WithdrawVault<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(seeds = [GLOBAL_STATE_SEED.as_ref()], bump)]
    pub global_state: Account<'info, GlobalState>,

    /// CHECK: This account is not unsafe because using as vault account
    #[account(mut, seeds = [VAULT_WALLET_SEED.as_ref()], bump)]
    pub vault_wallet: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction()]
pub struct InitUserPool<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        seeds = [USER_POOL_SEED.as_ref(), payer.key().as_ref()],
        space = UserPool::LEN,
        bump,
        payer = payer
    )]
    pub user_pool: Account<'info, UserPool>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction()]
pub struct RequestFaucet<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(seeds = [GLOBAL_STATE_SEED.as_ref()], bump)]
    pub global_state: Account<'info, GlobalState>,

    /// CHECK: This account is not unsafe because using as vault account
    #[account(mut, seeds = [VAULT_WALLET_SEED.as_ref()], bump)]
    pub vault_wallet: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [USER_POOL_SEED.as_ref(), payer.key().as_ref()],
        bump,
    )]
    pub user_pool: Account<'info, UserPool>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub const TX_FEE: u64 = 10000;
pub const DAY_TIME: i64 = 86400;
pub const GLOBAL_STATE_SEED: &[u8] = b"global-state";
pub const VAULT_WALLET_SEED: &[u8] = b"vault-wallet";
pub const USER_POOL_SEED: &[u8] = b"user-pool";

#[account]
#[derive(Default)]
pub struct GlobalState {
    pub admin: Pubkey, // 32
    pub max_amount_per_day: u64, // 8
    pub vault_wallet_bump: u8, // 1
}

impl GlobalState {
    pub const LEN: usize = 8 + 32 + 8 + 1;
}

#[account]
#[derive(Default)]
pub struct UserPool {
    pub owner: Pubkey, // 32
    pub received_amount: u64, // 8
    pub request_time: i64, // 8
}

impl UserPool {
    pub const LEN: usize = 8 + 32 + 8 + 8;
}

// transfer sol
pub fn sol_transfer_with_signer<'a>(
    source: AccountInfo<'a>,
    destination: AccountInfo<'a>,
    system_program: AccountInfo<'a>,
    signers: &[&[&[u8]]; 1],
    amount: u64
) -> Result<()> {
    let ix = solana_program::system_instruction::transfer(source.key, destination.key, amount);
    invoke_signed(&ix, &[source, destination, system_program], signers)?;
    Ok(())
}

pub fn sol_transfer_user<'a>(
    source: AccountInfo<'a>,
    destination: AccountInfo<'a>,
    system_program: AccountInfo<'a>,
    amount: u64
) -> Result<()> {
    let ix = solana_program::system_instruction::transfer(source.key, destination.key, amount);
    invoke(&ix, &[source, destination, system_program])?;
    Ok(())
}

pub fn has_balance<'a>(
    rent: &Sysvar<'a, Rent>,
    account: &AccountInfo,
    amount: u64
) -> Result<bool> {
    Ok(
        account
            .try_borrow_lamports()?
            .checked_sub(rent.minimum_balance(account.data_len()))
            .unwrap() >= amount
    )
}

#[error_code]
pub enum ErrorCode {
    // 6000
    #[msg("Global state admin does not match the payer")]
    InvalidAdmin,

    // 6001
    #[msg("Source account doesn't have enough fund to transfer the amount")]
    InsufficientBalance,

    // 6002
    #[msg("User pool PDA owner does not match with payer")]
    InvalidUserPDA,

    // 6003
    #[msg("Request too many funds more than max daily amount")]
    RequestTooManyFunds,
}
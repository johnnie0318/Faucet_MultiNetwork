import * as anchor from "@project-serum/anchor";
import {
  PublicKey,
  Connection,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { GLOBAL_STATE_SEED, USER_POOL_SEED, VAULT_WALLET_SEED } from "./types";
import { getPDA, toBN } from "./utils";

export const createInitializeIx = async (
  userAddress: PublicKey,
  maxAmountPerDay: number,
  program: anchor.Program
) => {
  const [globalStateKey] = await getPDA(program.programId, [GLOBAL_STATE_SEED]);
  const [vaultWalletKey, vaultWalletBump] = await getPDA(program.programId, [
    VAULT_WALLET_SEED,
  ]);

  console.log(
    "==>initializing global",
    globalStateKey.toBase58(),
    vaultWalletKey.toBase58()
  );

  const ix = program.methods
    .initialize(toBN(BigInt(maxAmountPerDay)), vaultWalletBump)
    .accounts({
      admin: userAddress,
      globalState: globalStateKey,
      vaultWallet: vaultWalletKey,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    });

  return ix;
};

export const createUpdateLimitIx = async (
  userAddress: PublicKey,
  maxAmountPerDay: number,
  program: anchor.Program
) => {
  const [globalStateKey] = await getPDA(program.programId, [GLOBAL_STATE_SEED]);

  console.log("==>updating limit global", globalStateKey.toBase58());

  const ix = program.methods
    .updateLimit(toBN(BigInt(maxAmountPerDay)))
    .accounts({
      admin: userAddress,
      globalState: globalStateKey,
    });

  return ix;
};

export const createInitialDepositVaultIx = async (
  userAddress: PublicKey,
  program: anchor.Program,
  connection: Connection
) => {
  const [vaultWalletKey] = await getPDA(program.programId, [VAULT_WALLET_SEED]);

  console.log("==>initial depositing vault", vaultWalletKey.toBase58());

  const ix = SystemProgram.transfer({
    fromPubkey: userAddress,
    toPubkey: vaultWalletKey,
    lamports: await connection.getMinimumBalanceForRentExemption(0),
  });

  return ix;
};

export const createDepositVaultIx = async (
  userAddress: PublicKey,
  amount: number,
  program: anchor.Program
) => {
  const [globalStateKey] = await getPDA(program.programId, [GLOBAL_STATE_SEED]);
  const [vaultWalletKey] = await getPDA(program.programId, [VAULT_WALLET_SEED]);

  console.log("==>depopsiting vault", vaultWalletKey.toBase58(), amount);

  const ix = program.methods.depositVault(toBN(BigInt(amount))).accounts({
    admin: userAddress,
    globalState: globalStateKey,
    vaultWallet: vaultWalletKey,
    systemProgram: SystemProgram.programId,
    rent: SYSVAR_RENT_PUBKEY,
  });

  return ix;
};

export const createWithdrawVaultIx = async (
  userAddress: PublicKey,
  amount: number,
  program: anchor.Program
) => {
  const [globalStateKey] = await getPDA(program.programId, [GLOBAL_STATE_SEED]);
  const [vaultWalletKey] = await getPDA(program.programId, [VAULT_WALLET_SEED]);

  console.log("==>withdrawing vault", vaultWalletKey.toBase58(), amount);

  const ix = program.methods.withdrawVault(toBN(BigInt(amount))).accounts({
    admin: userAddress,
    globalState: globalStateKey,
    vaultWallet: vaultWalletKey,
    systemProgram: SystemProgram.programId,
    rent: SYSVAR_RENT_PUBKEY,
  });

  return ix;
};

export const createInitUserPoolIx = async (
  userAddress: PublicKey,
  program: anchor.Program
) => {
  const [userPoolKey] = await getPDA(program.programId, [
    USER_POOL_SEED,
    userAddress,
  ]);

  const ix = program.methods.initUserPool().accounts({
    payer: userAddress,
    userPool: userPoolKey,
    systemProgram: SystemProgram.programId,
    rent: SYSVAR_RENT_PUBKEY,
  });

  return ix;
};

export const createRequestFaucetIx = async (
  userAddress: PublicKey,
  amount: number,
  program: anchor.Program,
) => {
  const [globalStateKey] = await getPDA(program.programId, [GLOBAL_STATE_SEED]);
  const [vaultWalletKey] = await getPDA(program.programId, [VAULT_WALLET_SEED]);
  const [userPoolKey] = await getPDA(program.programId, [
    USER_POOL_SEED,
    userAddress,
  ]);

  const ix = program.methods.requestFaucet(toBN(BigInt(amount))).accounts({
    payer: userAddress,
    globalState: globalStateKey,
    vaultWallet: vaultWalletKey,
    userPool: userPoolKey,
    systemProgram: SystemProgram.programId,
    rent: SYSVAR_RENT_PUBKEY,
  });

  return ix;
};

import { PublicKey } from "@solana/web3.js";

export type Option<T> = T | undefined;

export const DAY_TIME = 86400;
export const DEFAULT_MAX_PER_DAY = 0.00001 * 1e9;

export const GLOBAL_STATE_SEED = "global-state";
export const USER_POOL_SEED = "user-pool";
export const VAULT_WALLET_SEED = "vault-wallet";
export const PROGRAM_ID = new PublicKey(
  "9r8MYFtBHo7FkBpiD9KW3ddoJEiYNPuqGzDnU1nJpgAC"
);

export interface GlobalState {
  admin: PublicKey;
  maxAmountPerDay: bigint;
  vaultWalletBump: number;
}
export const GLOBAL_STATE_LEN = 8 + 32 + 8 + 1;

export interface UserPool {
  owner: PublicKey; // 32
  receivedAmount: bigint; // 8
  requestTime: bigint; // 8
}
export const USER_POOL_LEN = 8 + 32 + 8 + 8;

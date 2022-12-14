import { Program, web3 } from "@project-serum/anchor";
import * as anchor from "@project-serum/anchor";
import fs from "fs";
import { PublicKey } from "@solana/web3.js";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";

import {
  DEFAULT_MAX_PER_DAY,
  GLOBAL_STATE_SEED,
  PROGRAM_ID,
  USER_POOL_SEED,
  VAULT_WALLET_SEED,
} from "../lib/types";
import {
  createDepositVaultIx,
  createInitialDepositVaultIx,
  createInitializeIx,
  createInitUserPoolIx,
  createRequestFaucetIx,
  createUpdateLimitIx,
  createWithdrawVaultIx,
} from "../lib/instructions";
import {
  getGlobalState,
  getUserPoolInfo as getUserPoolState,
} from "../lib/actions";
import { getPDA, isExistAccount, toBN } from "../lib/utils";
import { tryTransactionAndReport } from "../lib/utils";

// GlobalState:  DGAUEk4BymEtF5kV7MRJPt7TbHRf2tzDaj6x7SLyNwes
let provider: anchor.AnchorProvider = null;
let program: Program = null;

// Address of the deployed program.
const programId = new anchor.web3.PublicKey(PROGRAM_ID);

/** loading program & payer of the given clusters */
export const setClusterConfig = async (cluster: web3.Cluster) => {
  provider = anchor.AnchorProvider.local(web3.clusterApiUrl(cluster));
  anchor.setProvider(provider);

  const idl = JSON.parse(
    fs.readFileSync(
      __dirname + "/../lib/solana_faucet.json",
      // __dirname + "/../target/idl/solana_faucet.json",
      "utf8"
    )
  );

  // Generate the program client from IDL.
  program = new anchor.Program(idl, programId);
  console.log("ProgramId: ", PROGRAM_ID.toBase58());

  const [globalState] = await getPDA(PROGRAM_ID, [GLOBAL_STATE_SEED]);
  console.log("GlobalState: ", globalState.toBase58());
};

export const initProject = async (maxPerDay?: number) => {
  const ix = await createInitializeIx(
    provider.publicKey,
    maxPerDay ?? DEFAULT_MAX_PER_DAY,
    program as Program
  );
  const postIx = await createInitialDepositVaultIx(
    provider.publicKey,
    program as Program,
    provider.connection
  );
  const txId = await tryTransactionAndReport(provider, async () => {
    return await ix
      .postInstructions([postIx])
      .signers([(provider.wallet as NodeWallet).payer])
      .rpc();
  });

  console.log("txHash =", txId);
};

export const udpateLimit = async (maxPerDay: number) => {
  const ix = await createUpdateLimitIx(
    provider.publicKey,
    maxPerDay,
    program as Program
  );
  const txId = await tryTransactionAndReport(provider, async () => {
    return await ix.signers([(provider.wallet as NodeWallet).payer]).rpc();
  });

  console.log("txHash =", txId);
};

export const depositReward = async (amount: number) => {
  const ix = await createDepositVaultIx(provider.publicKey, amount, program);
  const txId = await tryTransactionAndReport(provider, async () => {
    return await ix.signers([(provider.wallet as NodeWallet).payer]).rpc();
  });
  console.log("TxHash=", txId);
};

export const withdrawReward = async (amount: number) => {
  const ix = await createWithdrawVaultIx(provider.publicKey, amount, program);
  const txId = await tryTransactionAndReport(provider, async () => {
    return await ix.signers([(provider.wallet as NodeWallet).payer]).rpc();
  });
  console.log("TxHash=", txId);
};

export const initUserPDA = async () => {
  const ix = await createInitUserPoolIx(provider.publicKey, program as Program);
  const txId = await tryTransactionAndReport(provider, async () => {
    return await ix.signers([(provider.wallet as NodeWallet).payer]).rpc();
  });
  console.log("TxHash=", txId);
};

export const requestFaucet = async (amount: number) => {
  const [userPoolKey] = await getPDA(program.programId, [
    USER_POOL_SEED,
    provider.publicKey,
  ]);
  if (!(await isExistAccount(userPoolKey, provider.connection))) {
    console.log(`User PDA is not initialized. Sending init user Tx at first`);
    await initUserPDA();
  }
  const ix = await createRequestFaucetIx(provider.publicKey, amount, program);

  const txId = await tryTransactionAndReport(provider, async () => {
    return await ix.signers([(provider.wallet as NodeWallet).payer]).rpc();
  });
  console.log("TxHash=", txId);
};

export const getGlobalStateInfo = async () => {
  const info = await getGlobalState(program, provider.connection);

  return {
    admin: info.admin.toBase58(),
    maxAmountPerDay: toBN(info.maxAmountPerDay).toNumber(),
  };
};

export const getUserPoolInfo = async (address: PublicKey) => {
  const info = await getUserPoolState(address, program, provider.connection);

  return {
    owner: info.owner.toBase58(),
    requestTime: toBN(info.requestTime).toNumber(),
    receivedAmount: toBN(info.receivedAmount).toNumber(),
  };
};

export const getVaultBalance = async () => {
  const [vaultWalletKey] = await getPDA(PROGRAM_ID, [VAULT_WALLET_SEED]);

  try {
    const vaultBalance = await provider.connection.getBalance(vaultWalletKey);
    return vaultBalance;
  } catch (e) {
    console.log(e);
    throw `Error while get balance ${e}`;
  }
};

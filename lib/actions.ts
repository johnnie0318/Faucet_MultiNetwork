import * as anchor from "@project-serum/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  GlobalState,
  GLOBAL_STATE_SEED,
  UserPool,
  USER_POOL_SEED,
} from "./types";
import { getParser, getPDA } from "./utils";

export const getGlobalState = async (
  program: anchor.Program,
  connection: Connection
): Promise<GlobalState | null> => {
  const [globalStateKey] = await getPDA(program.programId, [GLOBAL_STATE_SEED]);

  try {
    const globalStateInfo = await connection.getAccountInfo(globalStateKey);
    const globalStateAccount = getParser<GlobalState>(
      program,
      "GlobalState"
    )(globalStateInfo);

    return globalStateAccount;
  } catch {
    return null;
  }
};

export const getUserPoolInfo = async (
  userAddress: PublicKey,
  program: anchor.Program,
  connection: Connection
): Promise<UserPool | null> => {
  const [userPoolKey] = await getPDA(program.programId, [
    USER_POOL_SEED,
    userAddress,
  ]);

  try {
    const userPool = await connection.getAccountInfo(userPoolKey);
    const userPoolAccount = getParser<UserPool>(program, "UserPool")(userPool);

    return userPoolAccount;
  } catch {
    return null;
  }
};

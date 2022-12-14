import * as anchor from "@project-serum/anchor";
import { BN, Coder, Provider } from "@project-serum/anchor";
import { AccountInfo, Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Option } from "./types";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";

function encodeString(input: string) {
  return anchor.utils.bytes.utf8.encode(input);
}

function encodeUInt32(input: number) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(input);
  return new Uint8Array(b);
}

/**
 * Gets a PDA derived based on seed
 * @param programId ProgramID to derive this key from
 * @param seeds array of seeds
 * @returns
 */
export async function getPDA(
  programId: PublicKey,
  seeds: (PublicKey | string | number)[]
) {
  const parsedSeeds = seeds.map((seed) => {
    if (typeof seed === "string") return encodeString(seed);
    if (typeof seed === "number") return encodeUInt32(seed);
    return seed.toBuffer();
  });

  const [pubkey, bump] = await anchor.web3.PublicKey.findProgramAddress(
    parsedSeeds,
    programId
  );
  return [pubkey, bump] as [typeof pubkey, typeof bump];
}

export function toBigInt(amount: BN): BigInt {
  return BigInt(amount.toString());
}

export function toBN(amount: BigInt): BN {
  const str = amount.toString();
  return new BN(str);
}

/**
 * Return the first tokenAccount publicKey for the given mint address
 * @param connection network Connection
 * @param mint mintAddress
 * @returns publicKey
 */
export async function getExistingOwnerTokenAccount(
  owner: PublicKey,
  mint: PublicKey,
  connection: Connection
): Promise<Option<PublicKey>> {
  const account = await connection.getTokenAccountsByOwner(owner, {
    mint,
  });
  const accounts = account.value;
  if (accounts.length > 0) {
    return accounts[0].pubkey;
  }
  return undefined;
}

export const isExistAccount = async (
  address: PublicKey,
  connection: Connection
) => {
  try {
    const res = await connection.getAccountInfo(address);
    if (res && res.data) return true;
  } catch (e) {
    return false;
  }
};

/**
 * Create a parser function to parse using the given coder
 * @param program
 * @param name
 * @returns
 */
export function getParser<T>(program: { coder: Coder }, name: string) {
  return (info: AccountInfo<Buffer>) =>
    program.coder.accounts.decode(name, info.data) as T;
}

export async function createNewTester(provider: Provider) {
  const newUserWallet = Keypair.generate();
  const wallet = new NodeWallet(newUserWallet);

  // Configure the client to use the local cluster.
  await provider.connection.confirmTransaction(
    await provider.connection.requestAirdrop(wallet.publicKey, 10000000000),
    "confirmed"
  );

  const provider2 = new anchor.AnchorProvider(provider.connection, wallet, {
    commitment: "confirmed",
  });

  return provider2;
}

export function isKp(toCheck: PublicKey | Keypair): toCheck is Keypair {
  return typeof (<Keypair>toCheck).publicKey !== "undefined";
}

export function isPk(obj: any): boolean {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof obj.toBase58 === "function"
  );
}

export function stringifyPKsAndBNs(i: any): any {
  if (isPk(i)) {
    return (<PublicKey>i).toBase58();
  }
  if (i instanceof anchor.BN) {
    return (<anchor.BN>i).toNumber();
  }
  if (parseType(i) === "array") {
    return stringifyPKsAndBNInArray(i);
  }
  if (parseType(i) === "object") {
    return stringifyPKsAndBNsInObject(i);
  }
  return i;
}

function stringifyPKsAndBNsInObject(o: any): any {
  const newO = { ...o };
  for (const [k, v] of Object.entries(newO)) {
    if (isPk(v)) {
      newO[k] = (<PublicKey>v).toBase58();
    } else if (v instanceof anchor.BN) {
      newO[k] = v.toNumber();
    } else if (parseType(v) === "array") {
      newO[k] = stringifyPKsAndBNInArray(v as any);
    } else if (parseType(v) === "object") {
      newO[k] = stringifyPKsAndBNsInObject(v);
    } else {
      newO[k] = v;
    }
  }
  return newO;
}

function stringifyPKsAndBNInArray(a: any[]): any[] {
  const newA = [];
  for (const i of a) {
    if (isPk(i)) {
      newA.push(i.toBase58());
    } else if (i instanceof anchor.BN) {
      newA.push(i.toNumber());
    } else if (parseType(i) === "array") {
      newA.push(stringifyPKsAndBNInArray(i));
    } else if (parseType(i) === "object") {
      newA.push(stringifyPKsAndBNs(i));
    } else {
      newA.push(i);
    }
  }
  return newA;
}

function parseType<T>(v: T): string {
  if (v === null || v === undefined) {
    return "null";
  }
  if (typeof v === "object") {
    if (v instanceof Array) {
      return "array";
    }
    if (v instanceof Date) {
      return "date";
    }
    return "object";
  }
  return typeof v;
}

export async function tryTransactionAndReport(
  provider: anchor.Provider,
  tx: Promise<string> | (() => Promise<string>),
  expectFailure?: boolean
): Promise<string> {
  try {
    if (typeof tx === "function") {
      return await tx();
    }
    await tx;
  } catch (e) {
    const regex = /Error: Raw transaction ([A-z0-9]*)/gm;
    const result = regex.exec(e);

    const blockhashRegex = /Error: Unable to obtain a new blockhash after/gm;
    const blockhashResult = blockhashRegex.exec(e);
    if (blockhashResult && blockhashResult[0]) {
      if (!expectFailure) {
        console.log("retrying tx...");
      }
      return await tryTransactionAndReport(provider, tx);
    }

    if (!expectFailure) {
      console.log(`Tx Error:`, e.toString());
      console.log({ ...e });
      console.log(e);
    }

    console.log(result);
    if (result && result[1]) {
      console.log(`Transaction failed: ${result[1]}`);
      await new Promise((res) => setTimeout(res, 1000));
      const sig = await provider.connection.getTransaction(result[1].trim(), {
        commitment: "confirmed",
      });

      console.log(stringifyPKsAndBNs(sig));
      console.log(stringifyPKsAndBNs(sig.transaction.message.accountKeys));
      // if (!expectFailure) {
      console.log(result);
      console.log(sig);
      console.log(sig?.meta);
      // }
    } else {
      if (!expectFailure) {
        console.log(e);
      }
    }

    throw e;
  }
}

export async function recordPreandPostAccountBalances(
  connection: Connection,
  keys: PublicKey[],
  promise: Promise<string>
) {
  const prebalances = await Promise.all(
    keys.map((key) => connection.getBalance(key))
  );
  const signature = await promise;
  const postbalances = await Promise.all(
    keys.map((key) => connection.getBalance(key))
  );

  return {
    signature,
    balances: prebalances.map((prebalance, i) => ({
      prebalance,
      postbalance: postbalances[i],
    })),
  };
}

export async function airdrop(
  provider: anchor.AnchorProvider | Connection,
  to: anchor.web3.PublicKey,
  amount = 10e9
) {
  if (provider instanceof anchor.AnchorProvider) {
    provider = provider.connection;
  }

  const sig = await provider.requestAirdrop(to, amount);
  const result = await provider.confirmTransaction(sig, "confirmed");
  await new Promise((resolve) => setTimeout(resolve, 250));
}

export async function sleep(duration: number) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(0);
    }, duration);
  });
}

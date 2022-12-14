import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import assert from "assert";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";
import { getGlobalState, getUserPoolInfo } from "../lib/actions";
import {
  createDepositVaultIx,
  createInitialDepositVaultIx,
  createInitializeIx,
  createInitUserPoolIx,
  createRequestFaucetIx,
  createUpdateLimitIx,
  createWithdrawVaultIx,
} from "../lib/instructions";
import { SolanaFaucet } from "../target/types/solana_faucet";
import {
  createNewTester,
  getPDA,
  recordPreandPostAccountBalances,
  sleep,
  toBN,
  tryTransactionAndReport,
} from "../lib/utils";
import { DAY_TIME, VAULT_WALLET_SEED } from "../lib/types";

// Configure the client to use the local cluster.
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

let noAdminProvider: anchor.AnchorProvider;
let userProvider: anchor.AnchorProvider;

const program = anchor.workspace.SolanaFaucet as Program<SolanaFaucet>;
const MAX_TIME_DELTA_FOR_TX = 2000;

describe("Maintain as Admin", () => {
  before(async () => {
    noAdminProvider = await createNewTester(provider);
  });

  it("Is initialized!", async () => {
    const ix = await createInitializeIx(
      provider.publicKey,
      0.001 * 1e9,
      program as Program
    );
    const postIx = await createInitialDepositVaultIx(
      provider.publicKey,
      program as Program,
      provider.connection
    );
    const [vaultWalletKey] = await getPDA(program.programId, [
      VAULT_WALLET_SEED,
    ]);

    const {
      balances: [vaultBalance],
    } = await recordPreandPostAccountBalances(
      provider.connection,
      [vaultWalletKey],
      tryTransactionAndReport(provider, async () => {
        return await ix
          .postInstructions([postIx])
          .signers([(provider.wallet as NodeWallet).payer])
          .rpc();
      })
    );

    const globalStateInfo = await getGlobalState(
      program as Program,
      provider.connection
    );
    const accountRent =
      await provider.connection.getMinimumBalanceForRentExemption(0);

    assert.equal(
      globalStateInfo.admin.toString(),
      provider.publicKey.toString()
    );
    assert.equal(globalStateInfo.maxAmountPerDay, BigInt(0.001 * 1e9));
    assert.equal(vaultBalance.postbalance, accountRent);
  });

  it("Should not able to update max limit without admin", async () => {
    const ix = await createUpdateLimitIx(
      noAdminProvider.publicKey,
      0.002 * 1e9,
      program as Program
    );

    try {
      await ix.signers([(noAdminProvider.wallet as NodeWallet).payer]).rpc();
    } catch (e) {
      assert.ok(JSON.stringify(e).includes("InvalidAdmin"));
    }
  });

  it("Admin can update max limit", async () => {
    const ix = await createUpdateLimitIx(
      provider.publicKey,
      0.002 * 1e9,
      program as Program
    );
    await tryTransactionAndReport(provider, async () => {
      return await ix.signers([(provider.wallet as NodeWallet).payer]).rpc();
    });
    const globalStateInfo = await getGlobalState(
      program as Program,
      provider.connection
    );

    assert.equal(globalStateInfo.maxAmountPerDay, BigInt(0.002 * 1e9));
  });

  it("Should not able to deposit without admin", async () => {
    const ix = await createDepositVaultIx(
      noAdminProvider.publicKey,
      0.001 * 1e9,
      program as Program
    );
    try {
      await ix.signers([(noAdminProvider.wallet as NodeWallet).payer]).rpc();
    } catch (e) {
      assert.ok(JSON.stringify(e).includes("InvalidAdmin"));
    }
  });

  it("Admin can deposit vault", async () => {
    const ix = await createDepositVaultIx(
      provider.publicKey,
      0.001 * 1e9,
      program as Program
    );
    const [vaultWalletKey] = await getPDA(program.programId, [
      VAULT_WALLET_SEED,
    ]);

    const {
      balances: [vaultBalance],
    } = await recordPreandPostAccountBalances(
      provider.connection,
      [vaultWalletKey],
      tryTransactionAndReport(provider, async () => {
        return await ix.signers([(provider.wallet as NodeWallet).payer]).rpc();
      })
    );

    const accountRent =
      await provider.connection.getMinimumBalanceForRentExemption(0);

    assert.equal(vaultBalance.postbalance, 0.001 * 1e9 + accountRent);
  });

  it("Should not able to withdraw without admin", async () => {
    const ix = await createWithdrawVaultIx(
      noAdminProvider.publicKey,
      0.0005 * 1e9,
      program as Program
    );
    try {
      await ix.signers([(noAdminProvider.wallet as NodeWallet).payer]).rpc();
    } catch (e) {
      assert.ok(JSON.stringify(e).includes("InvalidAdmin"));
    }
  });

  it("Admin can withdraw vault", async () => {
    const ix = await createWithdrawVaultIx(
      provider.publicKey,
      0.0005 * 1e9,
      program as Program
    );
    const [vaultWalletKey] = await getPDA(program.programId, [
      VAULT_WALLET_SEED,
    ]);

    const {
      balances: [vaultBalance],
    } = await recordPreandPostAccountBalances(
      provider.connection,
      [vaultWalletKey],
      tryTransactionAndReport(provider, async () => {
        return await ix.signers([(provider.wallet as NodeWallet).payer]).rpc();
      })
    );

    const accountRent =
      await provider.connection.getMinimumBalanceForRentExemption(0);

    assert.equal(vaultBalance.postbalance, 0.0005 * 1e9 + accountRent);
  });
});

describe("Faucet as User", () => {
  before(async () => {
    userProvider = await createNewTester(provider);
  });

  it("Initializ user pool", async () => {
    const ix = await createInitUserPoolIx(
      userProvider.publicKey,
      program as Program
    );

    await tryTransactionAndReport(userProvider, async () => {
      return await ix
        .signers([(userProvider.wallet as NodeWallet).payer])
        .rpc();
    });

    const userPoolInfo = await getUserPoolInfo(
      userProvider.publicKey,
      program as Program,
      provider.connection
    );

    assert.equal(
      userPoolInfo.owner.toString(),
      userProvider.publicKey.toString()
    );
    assert.equal(userPoolInfo.receivedAmount, BigInt(0));
    const timeDelta =
      Date.now() - toBN(userPoolInfo.requestTime).toNumber() * 1000;
    assert.ok(
      timeDelta < MAX_TIME_DELTA_FOR_TX,
      `Time delta too big ${timeDelta}`
    );
  });

  it("Should not able to faucet more than max amount per day", async () => {
    const ix = await createRequestFaucetIx(
      userProvider.publicKey,
      0.003 * 1e9,
      program as Program
    );
    try {
      await ix.signers([(userProvider.wallet as NodeWallet).payer]).rpc();
    } catch (e) {
      assert.ok(JSON.stringify(e).includes("RequestTooManyFunds"));
    }
  });

  it("Should not able to faucet valid amount due to insufficient balance", async () => {
    const ix = await createRequestFaucetIx(
      userProvider.publicKey,
      0.001 * 1e9,
      program as Program
    );
    try {
      await ix.signers([(userProvider.wallet as NodeWallet).payer]).rpc();
    } catch (e) {
      assert.ok(JSON.stringify(e).includes("InsufficientBalance"));
    }
  });

  it("Admin deposit vault enough funds for user to able faucet", async () => {
    const ix = await createDepositVaultIx(
      provider.publicKey,
      10 * 1e9,
      program as Program
    );
    const [vaultWalletKey] = await getPDA(program.programId, [
      VAULT_WALLET_SEED,
    ]);

    const {
      balances: [vaultBalance],
    } = await recordPreandPostAccountBalances(
      provider.connection,
      [vaultWalletKey],
      tryTransactionAndReport(provider, async () => {
        return await ix.signers([(provider.wallet as NodeWallet).payer]).rpc();
      })
    );

    assert.equal(vaultBalance.postbalance - vaultBalance.prebalance, 10 * 1e9);
  });

  it("User should able to faucet valid amount", async () => {
    const ix = await createRequestFaucetIx(
      userProvider.publicKey,
      0.0015 * 1e9,
      program as Program
    );
    const [vaultWalletKey] = await getPDA(program.programId, [
      VAULT_WALLET_SEED,
    ]);

    const {
      balances: [userBalance, vaultBalance],
    } = await recordPreandPostAccountBalances(
      userProvider.connection,
      [userProvider.publicKey, vaultWalletKey],
      tryTransactionAndReport(userProvider, async () => {
        return await ix
          .signers([(userProvider.wallet as NodeWallet).payer])
          .rpc();
      })
    );

    const userPoolInfo = await getUserPoolInfo(
      userProvider.publicKey,
      program as Program,
      provider.connection
    );
    const timeDelta =
      Date.now() - toBN(userPoolInfo.requestTime).toNumber() * 1000;
    assert.ok(
      timeDelta < MAX_TIME_DELTA_FOR_TX + DAY_TIME * 1000,
      `Time delta too big ${timeDelta}`
    );

    assert.equal(userPoolInfo.receivedAmount, BigInt(0.0015 * 1e9));
    assert.equal(
      vaultBalance.prebalance - vaultBalance.postbalance,
      0.0015 * 1e9
    );
    assert.equal(
      userBalance.postbalance - userBalance.prebalance,
      0.0015 * 1e9
    );
  });

  it("Should not able to faucet again because the received sum is more than max amount per day", async () => {
    const userPoolInfo = await getUserPoolInfo(
      userProvider.publicKey,
      program as Program,
      provider.connection
    );

    const timeDelta =
      Date.now() - toBN(userPoolInfo.requestTime).toNumber() * 1000;
    assert.ok(
      timeDelta < MAX_TIME_DELTA_FOR_TX + DAY_TIME * 1000,
      `Time delta too big ${timeDelta}`
    );

    const ix = await createRequestFaucetIx(
      userProvider.publicKey,
      0.001 * 1e9,
      program as Program
    );
    try {
      await ix.signers([(userProvider.wallet as NodeWallet).payer]).rpc();
    } catch (e) {
      assert.ok(JSON.stringify(e).includes("RequestTooManyFunds"));
    }
  });

  it("User should able to faucet again on the next day", async () => {
    await sleep(DAY_TIME * 1000);
    let userPoolInfo = await getUserPoolInfo(
      userProvider.publicKey,
      program as Program,
      provider.connection
    );

    let timeDelta =
      Date.now() - toBN(userPoolInfo.requestTime).toNumber() * 1000;
    assert.ok(
      timeDelta > MAX_TIME_DELTA_FOR_TX + DAY_TIME * 1000,
      `Time delta too small ${timeDelta}`
    );

    const ix = await createRequestFaucetIx(
      userProvider.publicKey,
      0.001 * 1e9,
      program as Program
    );
    const [vaultWalletKey] = await getPDA(program.programId, [
      VAULT_WALLET_SEED,
    ]);

    const {
      balances: [userBalance, vaultBalance],
    } = await recordPreandPostAccountBalances(
      userProvider.connection,
      [userProvider.publicKey, vaultWalletKey],
      tryTransactionAndReport(userProvider, async () => {
        return await ix
          .signers([(userProvider.wallet as NodeWallet).payer])
          .rpc();
      })
    );

    userPoolInfo = await getUserPoolInfo(
      userProvider.publicKey,
      program as Program,
      provider.connection
    );

    timeDelta = Date.now() - toBN(userPoolInfo.requestTime).toNumber() * 1000;
    assert.ok(
      timeDelta < MAX_TIME_DELTA_FOR_TX,
      `Time delta too big ${timeDelta}`
    );

    assert.equal(userPoolInfo.receivedAmount, BigInt(0.001 * 1e9));
    assert.equal(
      vaultBalance.prebalance - vaultBalance.postbalance,
      0.001 * 1e9
    );
    assert.equal(userBalance.postbalance - userBalance.prebalance, 0.001 * 1e9);
  });
});

#!/usr/bin/env ts-node
import { program } from "commander";
import { PublicKey } from "@solana/web3.js";
import {
  depositReward,
  getGlobalStateInfo,
  getUserPoolInfo,
  getVaultBalance,
  initProject,
  initUserPDA,
  requestFaucet,
  setClusterConfig,
  udpateLimit,
  withdrawReward,
} from "./script";

program.version("0.0.1");

const clusterHelp = `
  Common Option - Cluster can be configured by env string: \
  mainnet-beta, testnet, devnet (default)\n`;

programCommand("status")
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .description(
    `
    Get Faucet Contract Global PDA Info\n
  ${clusterHelp}`
  )
  .action(async (directory, cmd) => {
    const { env } = cmd.opts();
    console.log("Solana config: ", env);
    await setClusterConfig(env);

    console.log("globalInfo =", await getGlobalStateInfo());
  });

programCommand("user_status")
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .description(
    `
    Get user pda info\n
    Must pass user address
  ${clusterHelp}`
  )
  .requiredOption("-a, --address <string>", "The claimer address")
  .action(async (directory, cmd) => {
    const { env, address } = cmd.opts();

    console.log("Solana config: ", env);
    await setClusterConfig(env);

    console.log(await getUserPoolInfo(new PublicKey(address)));
  });

programCommand("init_user")
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .description(
    `
    Initialize User PDA for this payer
    This will be costed around 0.03 SOL
  ${clusterHelp}`
  )
  .action(async (directory, cmd) => {
    const { env } = cmd.opts();

    console.log("Solana config: ", env);
    await setClusterConfig(env);

    await initUserPDA();
  });

programCommand("get_vault_balance")
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .description(
    `
    Get vault wallet balance\n
  ${clusterHelp}`
  )
  .action(async (directory, cmd) => {
    const { env } = cmd.opts();

    console.log("Solana config: ", env);
    await setClusterConfig(env);

    console.log(await getVaultBalance());
  });

programCommand("deposit_vault")
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .description(
    `
    Deposit vault wallet as admin
  ${clusterHelp}`
  )
  .requiredOption("-m, --amount <string>", "Depositing amount")
  .action(async (directory, cmd) => {
    const { env, amount } = cmd.opts();

    if (isNaN(parseFloat(amount))) {
      throw `Invalid depositing amount`;
    }

    console.log("Solana config: ", env);
    await setClusterConfig(env);

    const depositAmount = Math.floor(parseFloat(amount) * 1e9);
    console.log("Depositing amount", depositAmount);
    await depositReward(depositAmount);
  });

programCommand("withdraw_vault")
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .description(
    `
    Withdraw vault wallet as Admin
  ${clusterHelp}`
  )
  .requiredOption("-m, --amount <string>", "Withdrawing amount")
  .action(async (directory, cmd) => {
    const { env, amount } = cmd.opts();

    if (isNaN(parseFloat(amount))) {
      throw `Invalid withdrawing amount`;
    }

    console.log("Solana config: ", env);
    await setClusterConfig(env);

    const withdrawAmount = Math.floor(parseFloat(amount) * 1e9);
    console.log("Withdraw amount", withdrawAmount);
    await withdrawReward(withdrawAmount);
  });

programCommand("request_faucet")
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .description(
    `
    Request faucet as User
  ${clusterHelp}`
  )
  .requiredOption("-m, --amount <string>", "Faucet amount")
  .action(async (directory, cmd) => {
    const { env, amount } = cmd.opts();

    if (isNaN(parseFloat(amount))) {
      throw `Invalid faucet amount`;
    }

    console.log("Solana config: ", env);
    await setClusterConfig(env);

    const faucetAmount = Math.floor(parseFloat(amount) * 1e9);
    console.log("Faucet amount", faucetAmount);
    await requestFaucet(faucetAmount);
  });

programCommand("update_limit")
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .description(
    `
    Update Max amount per day as admin
  ${clusterHelp}`
  )
  .requiredOption("-m, --amount <string>", "max amount per day")
  .action(async (directory, cmd) => {
    const { env, amount } = cmd.opts();

    if (isNaN(parseFloat(amount))) {
      throw `Invalid limit amount`;
    }

    console.log("Solana config: ", env);
    await setClusterConfig(env);

    const maxAmount = Math.floor(parseFloat(amount) * 1e9);
    console.log("Max amount", maxAmount);
    await udpateLimit(maxAmount);
  });

programCommand("init")
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .description(
    `
    Initialize Global PDA of contract
  ${clusterHelp}`
  )
  .option("-m, --amount <string>", "max amount per day")
  .action(async (directory, cmd) => {
    const { env, amount } = cmd.opts();

    if (amount !== undefined) {
      if (isNaN(parseFloat(amount))) {
        throw `Invalid limit amount`;
      }
    }

    console.log("Solana config: ", env);
    await setClusterConfig(env);

    let maxAmount = undefined;
    if (amount) {
      maxAmount = Math.floor(parseFloat(amount) * 1e9);
    }
    console.log("maxAmount", maxAmount);
    await initProject(maxAmount);
  });

function programCommand(name: string) {
  return program.command(name).option(
    "-e, --env <string>",
    "Solana cluster env name",
    "devnet" //mainnet-beta, testnet, devnet
  );
}

program.parse(process.argv);

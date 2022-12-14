import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { SolanaFaucet } from "../target/types/solana_faucet";

describe("Solana_Faucet", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.SolanaFaucet as Program<SolanaFaucet>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});

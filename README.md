# Faucet_MultiNetwork
Provide faucet program for **Mainnet, Devnet, Testnet** on `Solana Chain` \
***Built by Rust / Anchor framework***

## Program Features
- This program will be deployed on all networks: Mainnet, Devnet, Testnet
- Admin can deposit sol to vault for daily faucet
- Originally, planned to allow maximum 0.00001 SOL for MAINNET
- Admin can configure the max faucet amount per day for each network
- Users can airdrop sol up to admin allowed amount per day on any network which they need

## Project Architecture
This project consist of on-chain program and web3 lib for frontend
`programs` - contain main program's rust codes \
`tests` - contain unit-tests for rust code working \
`lib` - provide typescript module which is useful for web3 integration \
`cli` - provide node-cli commands to interact with on-chain program as admin. Working based on the `lib` module

## Instructions Commands
### As admin
- `yarn ts-node init`
Initialize Global PDA \
After deploy program, the deployer should initialize global PDA. \
Can determine the `MAX_AMOUNT_PER_DAY` treshold value with `-m` or `-amount` option. \
If don't specify this amount, the default amount 0.00001 SOL will be used.
> **Note that**: the program deployer should fund the ***vault wallet rent fee*** once after deploy the program 
on a certain network.
- `yarn ts-node update_limit`
Admin can change the `MAX_AMOUNT_PER_DAY` treshold value they needed.
- `yarn ts-node deposit_vault`
Deposit funds to the vault wallet \
Should deposit enough reward tokens for the users can request faucet.
- `yarn ts-node withdraw_vault`
Withdraw some funds from the vault wallet

### As user
- `yarn ts-node init_user`
Before request faucet for first time, users should initialize the User PDA of program
- `yarn ts-node request_faucet`
Request some amount of sol to airdrop. No limit per request but total sum of requested amount \
per day should be less than the `MAX_AMOUNT_PER_DAY` which admin configured.

### Utilities
- `yarn status`
Get global PDA configuration
- `yarn user_status`
Get user faucet requested status
- `yarn get_vault_balance`
Get the vault wallet balance

***All command can be used for multiple network. \
Can specify the network by `-e` or `--env` and the cluster names \
The default network is devnet***

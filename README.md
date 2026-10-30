# LuckyChain — Decentralized Lottery dApp

LuckyChain is a decentralized lottery smart contract built with Solidity, Foundry, and Chainlink VRF v2.5.

The project uses verifiable randomness to select winners on-chain and implements a multi-round lottery system with prize accounting, refund handling, timeout recovery, and secure ETH withdrawals.

> **Project status:** Smart contract implementation and local testing completed. Sepolia deployment and live VRF verification are pending.

## Features

- **Verifiable randomness:** Chainlink VRF v2.5 integration for random winner selection.
- **Multi-round lottery:** Independent rounds with individual players, deadlines, and prize pools.
- **Entry management:** Players can enter an active round by paying the minimum entry fee.
- **Prize accounting:** Tracks winnings and outstanding prize liabilities.
- **Refund mechanism:** Supports refunds when VRF fulfillment times out.
- **Secure withdrawals:** Effects-before-interactions pattern for prize and refund withdrawals.
- **Surplus recovery:** Manager can recover ETH exceeding protected liabilities.
- **Empty-round handling:** Expired rounds without participants can advance without requesting randomness.

## Technology Stack

| Technology | Purpose |
|---|---|
| Solidity | Smart contract development |
| Foundry | Development, testing, and deployment |
| Chainlink VRF v2.5 | Verifiable randomness |
| Ethereum / EVM | Smart contract execution |
| Sepolia | Planned testnet deployment |

## Lottery Lifecycle

1. **Open:** Players enter the lottery by sending ETH.
2. **Close:** After the round deadline, the lottery requests randomness from Chainlink VRF.
3. **Calculate:** The contract receives the verified random result.
4. **Payout:** A winner is selected and the prize is credited.
5. **Refund:** If VRF fulfillment times out, eligible players can claim refunds.
6. **Next round:** A new lottery round can begin after the previous round finishes.

## Project Structure

```text
lucky-chain/
├── src/
│   └── Lottery.sol
├── test/
│   └── Lottery.t.sol
├── script/
│   └── DeployLottery.s.sol
├── lib/
├── .github/
├── .env.example
├── .gitignore
├── foundry.toml
└── README.md
```

## Getting Started

### Prerequisites

- Git
- Foundry
- A Sepolia RPC endpoint for testnet deployment
- A Chainlink VRF v2.5 subscription for live randomness

### Installation

Clone the repository with its submodules:

```bash
git clone --recurse-submodules <YOUR_REPOSITORY_URL>
cd lucky-chain
```

If the repository was cloned without submodules:

```bash
git submodule update --init --recursive
```

### Install dependencies

```bash
forge install
```

### Configure environment

Create your local environment file:

```bash
cp .env.example .env
```

Configure the required values:

```env
SEPOLIA_RPC_URL=
PRIVATE_KEY=
VRF_COORDINATOR=
VRF_SUBSCRIPTION_ID=
VRF_KEY_HASH=
```

**Security:** Never commit `.env` or expose your private key.

## Build and Test

Build the contracts:

```bash
forge build
```

Run the complete test suite:

```bash
forge test -vv
```

Current local verification:

- 56 Lottery tests passed.
- 2 Counter tests passed.
- 58 total tests passed.
- Zero failed tests.

## Deployment

The deployment script is:

```text
script/DeployLottery.s.sol
```

First, simulate deployment without broadcasting:

```bash
source .env

forge script script/DeployLottery.s.sol:DeployLottery \
  --rpc-url "$SEPOLIA_RPC_URL" -vvvv
```

Only after reviewing the simulation and explicitly approving deployment should the broadcast command be used:

```bash
forge script script/DeployLottery.s.sol:DeployLottery \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --broadcast -vvvv
```

After deployment, register the deployed contract as a consumer in the Chainlink VRF v2.5 subscription dashboard and verify live randomness fulfillment.

**Deployment and live VRF verification are not yet completed.**

## Security Considerations

The implementation includes:

- Checks-effects-interactions for ETH withdrawals.
- Coordinator-only VRF callback authorization inherited from Chainlink.
- Duplicate fulfillment protection.
- Round-specific refund accounting.
- Protection of outstanding prize and refund liabilities.
- Timeout-based refund recovery.

This project has undergone local testing and source-level review. It has not undergone an independent professional security audit and should not be treated as production-audited software.

## Future Improvements

- Sepolia deployment and live VRF testing.
- Professional frontend integration.
- Additional invariant and fuzz testing.
- Portfolio documentation and demonstration.

## License

MIT
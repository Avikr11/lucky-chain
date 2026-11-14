# LuckyChain — Decentralized Lottery dApp

LuckyChain is a multi-round decentralized lottery application built with Solidity, Foundry, Chainlink VRF v2.5, and a Next.js frontend.

The smart contract uses verifiable randomness to select lottery winners on-chain. It includes round-specific accounting, prize and refund withdrawals, timeout recovery, and protection of outstanding liabilities.

**Project status:** Deployed on Ethereum Sepolia. Core smart contract functionality has been tested locally and live Chainlink VRF fulfillment has been verified.

## Live Deployment

| Detail | Value |
|---|---|
| Network | Ethereum Sepolia |
| Chain ID | `11155111` |
| Contract | `0x01a0f015f8b450402c2a2f38251b22e48967d157` |
| Entry fee | `0.01 ETH` minimum |
| Round duration | 1 hour |
| VRF timeout | 24 hours |
| Randomness provider | Chainlink VRF v2.5 |

- [View LuckyChain contract on Sepolia Etherscan](https://sepolia.etherscan.io/address/0x01a0f015f8b450402c2a2f38251b22e48967d157)

### Chainlink VRF Configuration

| Parameter | Value |
|---|---|
| Coordinator | `0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B` |
| Subscription ID | `47612767146377122984499823127239378454864379843156468264688287645044647352724` |
| Key hash | `0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae` |
| Request confirmations | 3 |
| Callback gas limit | 1,000,000 |
| Number of random words | 1 |
| Payment mode | LINK |

The deployed contract is configured as a consumer of the Chainlink VRF v2.5 subscription. The subscription requires sufficient LINK funding for randomness requests.

## Features

### Smart Contract

- **Verifiable randomness:** Uses Chainlink VRF v2.5 to obtain random words for winner selection.
- **Multi-round lottery:** Maintains independent round data, players, deadlines, and results.
- **Entry management:** Allows players to enter an open round by paying at least the minimum entry fee.
- **Prize accounting:** Tracks winner credits and outstanding prize liabilities.
- **Refund mechanism:** Supports round-specific refunds when randomness fulfillment times out.
- **Secure withdrawals:** Uses checks-effects-interactions for prize and refund transfers.
- **Prize redirection:** Allows a winner to withdraw their prize to another address.
- **Surplus recovery:** Restricts manager recovery to ETH exceeding protected prize and refund liabilities.
- **Empty-round handling:** Allows expired rounds without participants to advance without requesting randomness.
- **Historical results:** Preserves round-specific results across subsequent rounds.

### Frontend

- Next.js application using React and TypeScript.
- Wallet connection through Wagmi and Viem.
- Sepolia network detection.
- Contract-connected lottery interface.
- Rewards and manager panels with configuration-dependent states.
- Activity history support using the deployment address and deployment block configuration.

The frontend has been verified against the live Sepolia deployment, including wallet connection, round results, rewards, manager accounting, and on-chain activity history.

## Lottery Lifecycle

1. **Open:** Players enter the active round by sending ETH.
2. **Close:** After the deadline, the lottery requests randomness from Chainlink VRF.
3. **Calculate:** The contract receives and validates the VRF fulfillment.
4. **Payout:** The winner is selected and credited with the round's prize.
5. **Withdraw:** The winner withdraws their winnings.
6. **Refund:** If VRF fulfillment times out and the round is aborted, eligible players can claim their refunds.
7. **Next round:** A subsequent round can begin while historical round results and outstanding liabilities remain accounted for.

## Technology Stack

| Technology | Purpose |
|---|---|
| Solidity | Smart contract development |
| Foundry | Compilation, testing, and deployment |
| Chainlink VRF v2.5 | Verifiable randomness |
| Ethereum Sepolia | Testnet deployment |
| Next.js | Frontend framework |
| React | User interface |
| TypeScript | Frontend type safety |
| Wagmi | Wallet and blockchain interactions |
| Viem | EVM client and contract interactions |
| TanStack React Query | Asynchronous data management |
| Tailwind CSS | Frontend styling |

## Project Structure

```text
lucky-chain/
├── src/
│   ├── Lottery.sol
│   └── Counter.sol
├── test/
│   ├── Lottery.t.sol
│   ├── ForkCallbackGas.t.sol
│   ├── Counter.t.sol
│   └── mocks/
│       └── MockVRFCoordinatorV2Plus.sol
├── script/
│   ├── DeployLottery.s.sol
│   ├── DeployLocalDiagnostic.s.sol
│   └── Counter.s.sol
├── frontend/
│   ├── app/
│   ├── public/
│   └── src/
│       ├── components/
│       ├── config/
│       ├── hooks/
│       ├── lib/
│       └── types/
├── lib/
├── .env.example
├── .gitignore
├── foundry.toml
├── foundry.lock
└── README.md
```

## Getting Started

### Prerequisites

- Git
- Foundry
- Node.js and npm
- A Sepolia RPC endpoint for blockchain access
- A Web3 wallet configured for Sepolia when interacting with the application

### Clone the repository

```bash
git clone --recurse-submodules <YOUR_REPOSITORY_URL>
cd lucky-chain
```

If dependencies were not cloned with the repository:

```bash
git submodule update --init --recursive
```

### Smart Contract Setup

Install Foundry dependencies if needed:

```bash
forge install
```

Create your local environment file:

```bash
cp .env.example .env
```

Configure the required deployment and RPC values:

```env
SEPOLIA_RPC_URL=
PRIVATE_KEY=

VRF_COORDINATOR=0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B
VRF_SUBSCRIPTION_ID=47612767146377122984499823127239378454864379843156468264688287645044647352724
VRF_KEY_HASH=0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae
```

The private key is only needed for deployment or transactions requiring a signing account. Never commit `.env` or expose private keys.

### Build the smart contracts

```bash
forge build
```

### Run the tests

```bash
forge test
```

To view detailed traces:

```bash
forge test -vvvv
```

The historical fork-replay diagnostic test requires additional environment configuration. Without it, that test is skipped automatically.

### Frontend Setup

Open a separate terminal:

```bash
cd frontend
npm install
```

Create the frontend environment file:

```bash
touch .env.local
```

Configure:

```env
NEXT_PUBLIC_LOTTERY_CONTRACT_ADDRESS=0x01a0f015f8b450402c2a2f38251b22e48967d157
NEXT_PUBLIC_LOTTERY_DEPLOYMENT_BLOCK=12123898
```

Set `NEXT_PUBLIC_LOTTERY_DEPLOYMENT_BLOCK` to the actual deployment block when configuring activity history. Do not guess this value.

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Other frontend checks:

```bash
npm run lint
npm run build
```

## Deployment

LuckyChain is already deployed at the contract address listed above.

The deployment script is:

```text
script/DeployLottery.s.sol
```

For developers who intentionally want to deploy a separate instance, configure `.env` and simulate first:

```bash
set -a
source .env
set +a

forge script script/DeployLottery.s.sol:DeployLottery \
  --rpc-url "$SEPOLIA_RPC_URL" -vvvv
```

Only broadcast after reviewing the simulation and confirming the intended deployment:

```bash
forge script script/DeployLottery.s.sol:DeployLottery \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --broadcast -vvvv
```

A new deployment requires its own correct Chainlink VRF subscription consumer configuration and frontend environment values. Do not run the broadcast command merely to reproduce the existing deployment.

## Testing and Verification

### Local tests

Latest recorded Foundry test results:

| Test suite | Result |
|---|---:|
| Lottery tests | 61 passed |
| Counter tests | 2 passed |
| Historical fork diagnostic | 1 skipped |
| **Total** | **63 passed, 0 failed, 1 skipped** |

The Lottery test suite covers:

- Round lifecycle and player entry.
- VRF request and fulfillment.
- Invalid request IDs and duplicate callbacks.
- Prize and refund accounting.
- Multiple rounds and historical results.
- Timeout and refund recovery.
- Reentrancy protection.
- Failed ETH transfers.
- Manager surplus recovery.
- VRF callback gas measurements.

The skipped fork diagnostic requires an archive RPC endpoint and additional transaction replay configuration. It is not counted as a passing test.

### Live Sepolia verification

The deployed contract has undergone live transaction verification, including:

- Chainlink VRF randomness request and fulfillment.
- Round 1 winner selection and prize accounting.
- Round 1 winner withdrawal.
- Round 2 randomness fulfillment and winner accounting.

Round 2 winner withdrawal was successfully verified on-chain. Final frontend live-data verification was also completed, including the rewards dashboard, manager accounting, and transaction history.

These live checks demonstrate testnet functionality; they do not constitute a production security audit.

## Security Considerations

The implementation includes:

- Coordinator authorization through Chainlink's VRF consumer base.
- Request-to-round mapping and callback validation.
- Duplicate fulfillment protection.
- Round-specific prize and refund accounting.
- Checks-effects-interactions for ETH withdrawals.
- Protected prize and refund liabilities.
- Timeout-based refund recovery.
- Manager surplus recovery limited to unprotected ETH.

### Security Disclaimer

This project has undergone local testing, live Sepolia testing, and source-level review.

It has **not** undergone an independent professional security audit. It should not be considered audited or production-ready software. Use testnet assets only when experimenting with this project.

## Known Limitations and Future Improvements

- Configure and execute the optional historical fork-replay diagnostic.
- Complete deployment and activity-history documentation.
- Obtain an independent professional security audit before any production deployment.

## License

This project is licensed under the MIT License.

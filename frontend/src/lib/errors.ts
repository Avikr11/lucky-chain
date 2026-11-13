export type AppErrorType =
  | "rejected"
  | "insufficient-funds"
  | "contract-revert"
  | "network"
  | "unknown";

export function classifyError(message?: string): AppErrorType {
  const text = message?.toLowerCase() ?? "";

  if (
    /user rejected|user denied|rejected the request|request rejected|action_rejected/.test(
      text
    )
  ) {
    return "rejected";
  }

  if (
    /insufficient funds|insufficient balance|exceeds the balance|not enough funds|funds for gas/.test(
      text
    )
  ) {
    return "insufficient-funds";
  }

  if (
    /execution reverted|contract function execution|revert reason|transaction reverted|call exception/.test(
      text
    )
  ) {
    return "contract-revert";
  }

  if (
    /network|timeout|failed to fetch|connection|rpc|disconnected|chain not configured|switch chain/.test(
      text
    )
  ) {
    return "network";
  }

  return "unknown";
}

export function getTransactionErrorMessage(
  type: AppErrorType,
  isReceiptError = false
): string {
  if (isReceiptError) {
    return "The transaction was submitted, but confirmation failed. Check its status on Etherscan before retrying.";
  }

  switch (type) {
    case "rejected":
      return "You rejected the transaction in your wallet. You can try again.";

    case "insufficient-funds":
      return "Insufficient Sepolia ETH. You need enough ETH to cover the entry fee and transaction gas.";

    case "contract-revert":
      return "The lottery contract rejected this transaction. Check the lottery state and transaction details.";

    case "network":
      return "A network or RPC error interrupted the transaction. Check your connection and transaction status before retrying.";

    default:
      return "The transaction could not be submitted. Check your wallet and network, then try again.";
  }
}

export function getWalletErrorMessage(message?: string): string {
  const type = classifyError(message);

  switch (type) {
    case "rejected":
      return "The request was cancelled in your wallet.";

    case "network":
      return "Network connection failed. Check your connection and try again.";

    default:
      return "Unable to complete the wallet request. Please try again.";
  }
}

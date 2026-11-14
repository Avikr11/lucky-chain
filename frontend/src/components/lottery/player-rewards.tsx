"use client";

import { useState } from "react";
import { useHydrated } from "@/src/hooks/use-hydrated";
import { formatEther, isAddress } from "viem";
import { classifyError, getTransactionErrorMessage } from "@/src/lib/errors";
import { usePlayerRewards } from "@/src/hooks/use-player-rewards";

function formatEth(value: bigint | undefined) {
  return value === undefined ? "—" : `${formatEther(value)} ETH`;
}

export function PlayerRewards() {
  const mounted = useHydrated();
  const [recipient, setRecipient] = useState("");
  const [lastAction, setLastAction] = useState<
    "winnings" | "winnings-to" | "current-refund" | "historical-refund" | null
  >(null);

  const {
    submittedBy,
    isDifferentWalletOrNetwork,
    isConnected,
    isCorrectNetwork,
    isConfigured,
    pendingWinnings,
    refundCredits,
    currentRoundRefund,
    historicalRefunds,
    canWithdrawHistoricalRefund,
    currentRoundId,
    lotteryState,
    canWithdrawWinnings,
    canWithdrawRefund,
    withdrawWinnings,
    withdrawWinningsTo,
    withdrawCurrentRoundRefund,
    withdrawHistoricalRefund,
    retryReceiptTracking,
    dismissTransactionError,
    hash,
    replacementReason,
    receipt,
    writeError,
    receiptError,
    isWriting,
    isConfirming,
    isLocked,
  } = usePlayerRewards();

  const recipientValid = isAddress(recipient);
  const hasWinnings = (pendingWinnings.data ?? BigInt(0)) > BigInt(0);
  const hasCurrentRefund = canWithdrawRefund;

  const pendingWinningsDisplay = pendingWinnings.isLoading
    ? "Checking..."
    : pendingWinnings.isError
      ? "Unavailable"
      : formatEth(pendingWinnings.data);

  const currentRefundLoading =
    lotteryState.isLoading ||
    currentRoundId.isLoading ||
    currentRoundRefund.isLoading;

  const currentRefundError =
    lotteryState.isError ||
    currentRoundId.isError ||
    currentRoundRefund.isError;

  const currentRefundDisplay = currentRefundLoading
    ? "Checking..."
    : currentRefundError
      ? "Unavailable"
      : canWithdrawRefund
        ? formatEth(currentRoundRefund.data)
        : "0 ETH";

  const currentRefundEligibilityDisplay = currentRefundLoading
    ? "Checking..."
    : currentRefundError
      ? "Unavailable"
      : canWithdrawRefund
        ? formatEth(currentRoundRefund.data)
        : "Not eligible";

  const actionLabel =
    lastAction === "winnings"
      ? "Winnings withdrawal"
      : lastAction === "winnings-to"
        ? "Recipient withdrawal"
        : lastAction === "current-refund"
          ? "Current-round refund"
          : lastAction === "historical-refund"
            ? "Historical refund"
            : "Withdrawal";

  const transactionError = writeError ?? receiptError;
  const transactionErrorType = classifyError(transactionError?.message);
  const transactionErrorMessage = transactionError
    ? getTransactionErrorMessage(transactionErrorType, Boolean(receiptError))
    : null;

  return (
    <section className="mt-12 rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
      <div className="mb-7">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-violet-400">
          Player dashboard
        </p>
        <h2 className="mt-2 text-2xl font-bold text-white">
          Your rewards
        </h2>
        <p className="mt-2 text-sm text-gray-400">
          View your winnings and eligible lottery refunds.
        </p>
      </div>

      {!mounted ? (
        <p className="text-sm text-gray-400">
          Checking wallet and rewards...
        </p>
      ) : !isConnected ? (
        <p className="text-sm text-gray-400">
          Connect your wallet to view your rewards.
        </p>
      ) : !isConfigured ? (
        <p className="text-sm text-amber-400">
          Rewards will be available after contract configuration.
        </p>
      ) : !isCorrectNetwork ? (
        <p className="text-sm text-amber-400">
          Switch to Sepolia to access your rewards.
        </p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/20 p-5">
              <p className="text-sm text-gray-400">Pending winnings</p>
              <p className="mt-3 text-2xl font-semibold text-white">
                {pendingWinningsDisplay}
              </p>

              <button
                type="button"
                onClick={() => {
                  setLastAction("winnings");
                  withdrawWinnings();
                }}
                disabled={!canWithdrawWinnings}
                className="mt-5 w-full rounded-lg bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Withdraw winnings
              </button>

              <div className="mt-4 border-t border-white/10 pt-4">
                <label
                  htmlFor="winnings-recipient"
                  className="text-sm text-gray-400"
                >
                  Or send winnings to another address
                </label>
                <input
                  id="winnings-recipient"
                  value={recipient}
                  onChange={(event) => setRecipient(event.target.value)}
                  placeholder="0x..."
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none focus:border-violet-400"
                />
                {recipient.length > 0 && !recipientValid && (
                  <p className="mt-2 text-xs text-red-400">
                    Enter a valid wallet address.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setLastAction("winnings-to");
                    withdrawWinningsTo(recipient);
                  }}
                  disabled={
                    !canWithdrawWinnings ||
                    !recipientValid
                  }
                  className="mt-3 w-full rounded-lg border border-violet-400/40 px-4 py-3 text-sm font-semibold text-violet-300 transition hover:bg-violet-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Withdraw to recipient
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-5">
              <p className="text-sm text-gray-400">
                Currently withdrawable refund
              </p>
              <p className="mt-3 text-2xl font-semibold text-white">
                {currentRefundDisplay}
              </p>

              <div className="mt-5 border-t border-white/10 pt-4">
                <p className="text-sm text-gray-400">
                  Current round #{currentRoundId.data?.toString() ?? "—"} eligible refund
                </p>
                <p className="mt-2 text-xl font-semibold text-white">
                  {currentRefundEligibilityDisplay}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setLastAction("current-refund");
                    withdrawCurrentRoundRefund();
                  }}
                  disabled={!canWithdrawRefund}
                  className="mt-5 w-full rounded-lg border border-emerald-400/40 px-4 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Withdraw current round refund
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-5">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-white">
                Historical refund claims
              </h3>
              <p className="mt-1 text-sm text-gray-400">
                Refunds from previous rounds that entered the REFUND state.
              </p>
            </div>

            {historicalRefunds.isLoading ? (
              <p className="text-sm text-gray-400">
                Checking historical refund eligibility...
              </p>
            ) : historicalRefunds.isError ? (
              <p role="alert" className="text-sm text-red-400">
                Unable to load historical refunds. Please refresh and try again.
              </p>
            ) : historicalRefunds.data && historicalRefunds.data.length > 0 ? (
              <div className="space-y-3">
                {historicalRefunds.data.map((refund) => (
                  <div
                    key={refund.roundId.toString()}
                    className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">
                        Round #{refund.roundId.toString()}
                      </p>
                      <p className="mt-1 text-sm text-emerald-300">
                        Refund available: {formatEth(refund.amount)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setLastAction("historical-refund");
                        withdrawHistoricalRefund(refund.roundId);
                      }}
                      disabled={!canWithdrawHistoricalRefund || isLocked}
                      className="rounded-lg border border-emerald-400/40 px-4 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Claim Round #{refund.roundId.toString()} refund
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                No eligible historical refunds found for this wallet.
              </p>
            )}
          </div>

          {refundCredits.data !== undefined &&
            refundCredits.data > BigInt(0) &&
            !hasCurrentRefund &&
            (historicalRefunds.data?.length ?? 0) === 0 && (
              <p className="mt-4 text-sm text-amber-300/90">
                Your recorded entries are not currently eligible for a
                refund. Refunds can only be claimed when a round enters the
                REFUND state.
              </p>
            )}

          {pendingWinnings.isSuccess &&
            refundCredits.isSuccess &&
            currentRoundRefund.isSuccess &&
            currentRoundId.isSuccess &&
            lotteryState.isSuccess &&
            historicalRefunds.isSuccess &&
            !hasWinnings &&
            !hasCurrentRefund &&
            refundCredits.data === BigInt(0) && (
              <p className="mt-4 text-sm text-gray-500">
                No winnings or refund credits are currently recorded
                for this wallet.
              </p>
            )}
        </>
      )}

      {(isWriting || isConfirming) && (
        <p role="status" className="mt-5 text-sm text-violet-300">
          {isWriting
            ? `Confirm ${actionLabel.toLowerCase()} in your wallet...`
            : `${actionLabel} submitted. Waiting for Sepolia confirmation...`}
        </p>
      )}

      {replacementReason === "repriced" && receipt?.status === "success" && (
        <p role="status" className="mt-3 text-sm text-gray-400">
          The wallet repriced this withdrawal. The replacement transaction was confirmed.
        </p>
      )}

      {replacementReason === "cancelled" && (
        <div role="status" className="mt-5 rounded-lg border border-amber-400/20 bg-amber-400/5 p-4">
          <p className="text-sm text-amber-300">
            The original withdrawal was cancelled by a replacement transaction.
          </p>
          {receipt && (
            <button
              type="button"
              onClick={() => dismissTransactionError()}
              className="mt-3 rounded-lg border border-amber-400/40 px-3 py-2 text-xs font-semibold text-amber-300"
            >
              Dismiss cancellation
            </button>
          )}
        </div>
      )}

      {replacementReason === "replaced" && (
        <div role="alert" className="mt-5 rounded-lg border border-amber-400/20 bg-amber-400/5 p-4">
          <p className="text-sm text-amber-300">
            This withdrawal was replaced. Check the replacement transaction on Etherscan to determine whether the withdrawal occurred.
          </p>
          {receipt && (
            <button
              type="button"
              onClick={() => dismissTransactionError(true)}
              className="mt-3 rounded-lg border border-amber-400/40 px-3 py-2 text-xs font-semibold text-amber-300"
            >
              I checked the replacement outcome — dismiss
            </button>
          )}
        </div>
      )}

      {receipt?.status === "success" &&
        replacementReason !== "replaced" &&
        replacementReason !== "cancelled" && (
        <p role="status" className="mt-5 text-sm text-emerald-400">
          {actionLabel} confirmed successfully. Your balances are refreshing.
        </p>
      )}

      {receipt?.status === "reverted" &&
        replacementReason !== "replaced" &&
        replacementReason !== "cancelled" && (
        <p role="alert" className="mt-5 text-sm text-red-400">
          {actionLabel} failed. The transaction was reverted; no withdrawal was completed.
        </p>
      )}

      {transactionErrorMessage && (
        <div role="alert" className="mt-5 rounded-lg border border-red-400/20 bg-red-400/5 p-4">
          <p className="text-sm font-semibold text-red-300">
            {transactionErrorType === "rejected"
              ? "Transaction cancelled"
              : "Transaction error"}
          </p>
          <p className="mt-1 break-words text-sm text-red-400">
            {transactionErrorMessage}
          </p>
          {receiptError && hash && !receipt && (
            <button
              type="button"
              onClick={retryReceiptTracking}
              disabled={isConfirming}
              className="mt-3 rounded-lg border border-amber-400/40 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isConfirming ? "Checking transaction..." : "Retry confirmation check"}
            </button>
          )}
          {receiptError && hash && !receipt && (
            <p className="mt-2 text-xs text-gray-500">
              This retries receipt tracking only. It does not submit another withdrawal.
            </p>
          )}
        </div>
      )}

      {hash && (
        <a
          href={`https://sepolia.etherscan.io/tx/${hash}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-sm text-violet-300 underline underline-offset-4"
        >
          View transaction on Etherscan
        </a>
      )}

      {isLocked && (
        <p className="mt-2 text-xs text-gray-500">
          Please wait for the current transaction to finish before
          submitting another withdrawal.
        </p>
      )}

      {isDifferentWalletOrNetwork && submittedBy && (
        <p role="status" className="mt-4 break-words text-sm text-amber-300">
          This transaction was submitted by {submittedBy.slice(0, 6)}...
          {submittedBy.slice(-4)}. The connected wallet or network has changed.
          Transaction tracking remains attached to the original Sepolia transaction.
        </p>
      )}
    </section>
  );
}

"use client";

import { useHydrated } from "@/src/hooks/use-hydrated";
import { formatEther } from "viem";
import { useManagerControls } from "@/src/hooks/use-manager-controls";
import {
  classifyError,
  getTransactionErrorMessage,
} from "@/src/lib/errors";

function formatEth(value: bigint | undefined) {
  return value === undefined ? "—" : `${formatEther(value)} ETH`;
}

export function ManagerPanel() {
  const mounted = useHydrated();

  const {
    isConnected,
    isCorrectNetwork,
    isConfigured,
    isManager,
    manager,
    contractBalance,
    liabilities,
    surplus,
    hasAccountingData,
    accountingError,
    isAccountingLoading,
    canRecoverSurplus,
    recoverSurplus,
    lotteryState,
    canStartNextRound,
    startNextRound,
    lastAction,
    hash,
    retryReceiptTracking,
    dismissTransactionError,
    replacementReason,
    submittedBy,
    isDifferentWalletOrNetwork,
    receipt,
    writeError,
    receiptError,
    isWriting,
    isConfirming,
    isLocked,
  } = useManagerControls();

  const transactionError = writeError ?? receiptError;
  const errorText = [writeError?.message, receiptError?.message]
    .filter(Boolean)
    .join(" ");
  const errorType = classifyError(errorText);
  const transactionErrorMessage = transactionError
    ? getTransactionErrorMessage(errorType, Boolean(receiptError))
    : null;

  return (
    <section className="mt-12 rounded-2xl border border-amber-400/20 bg-amber-400/[0.03] p-6 md:p-8">
      <div className="mb-6">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-400">
          Protocol administration
        </p>
        <h2 className="mt-2 text-2xl font-bold text-white">
          Manager controls
        </h2>
        <p className="mt-2 text-sm text-gray-400">
          Monitor contract funds and recover only ETH exceeding
          outstanding prize and refund liabilities.
        </p>
      </div>

      {!mounted ? (
        <p className="text-sm text-gray-400">
          Checking manager access...
        </p>
      ) : !isConnected ? (
        <p className="text-sm text-gray-400">
          Connect your wallet to check manager access.
        </p>
      ) : !isConfigured ? (
        <p className="text-sm text-amber-300">
          Manager controls require contract configuration.
        </p>
      ) : !isCorrectNetwork ? (
        <p className="text-sm text-amber-300">
          Switch to Sepolia to access manager controls.
        </p>
      ) : manager.isLoading ? (
        <p className="text-sm text-gray-400">
          Checking manager permissions...
        </p>
      ) : manager.error ? (
        <p role="alert" className="text-sm text-red-400">
          Unable to verify manager permissions: {manager.error.message}
        </p>
      ) : !isManager ? (
        <div className="rounded-xl border border-white/10 bg-black/20 p-5">
          <p className="font-medium text-white">
            Manager access not available
          </p>
          <p className="mt-2 break-all text-sm text-gray-400">
            Manager: {manager.data}
          </p>
          <p className="mt-2 text-sm text-gray-500">
            The connected wallet does not have manager privileges.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] p-4">
            <p className="text-sm text-emerald-300">
              Manager wallet verified
            </p>
            <p className="mt-1 break-all text-xs text-gray-400">
              {manager.data}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/20 p-5">
              <p className="text-sm text-gray-400">Contract balance</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {contractBalance.isLoading
                  ? "Loading..."
                  : contractBalance.error
                    ? "Unavailable"
                    : formatEth(contractBalance.data?.value)}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-5">
              <p className="text-sm text-gray-400">
                Protected liabilities
              </p>
              <p className="mt-2 text-xl font-semibold text-white">
                {isAccountingLoading
                  ? "Loading..."
                  : accountingError
                    ? "Unavailable"
                    : hasAccountingData
                      ? formatEth(liabilities)
                      : "—"}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-5">
            <p className="text-sm text-gray-400">
              Recoverable surplus
            </p>
            <p className="mt-2 text-2xl font-bold text-amber-300">
              {isAccountingLoading
                ? "Loading..."
                : accountingError
                  ? "Unavailable"
                  : hasAccountingData
                    ? formatEth(surplus)
                    : "—"}
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Calculated as contract balance minus outstanding prize
              and refund liabilities. The contract enforces this check
              again during execution.
            </p>

            <button
              type="button"
              onClick={recoverSurplus}
              disabled={!canRecoverSurplus}
              className="mt-5 w-full rounded-lg bg-amber-400 px-4 py-3 text-sm font-semibold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isWriting && lastAction === "recover"
                ? "Confirm in wallet..."
                : isConfirming && lastAction === "recover"
                  ? "Waiting for confirmation..."
                  : "Recover surplus"}
            </button>
            {lastAction === "recover" && isWriting && (
              <p role="status" className="mt-3 text-sm text-violet-300">
                Confirm the surplus recovery transaction in your wallet.
              </p>
            )}
            {lastAction === "recover" && isConfirming && (
              <p role="status" className="mt-3 text-sm text-amber-300">
                Transaction submitted. Waiting for Sepolia confirmation...
              </p>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-5">
            <p className="text-sm text-gray-400">Round management</p>
            <p className="mt-2 text-lg font-semibold text-white">
              Current round state:{" "}
              {lotteryState.isLoading
                ? "Loading..."
                : lotteryState.error
                  ? "Unavailable"
                  : Number(lotteryState.data) === 2
                  ? "Payout"
                  : Number(lotteryState.data) === 3
                    ? "Refund"
                    : Number(lotteryState.data) === 0
                      ? "Open"
                      : Number(lotteryState.data) === 1
                        ? "Calculating"
                        : "Unavailable"}
            </p>
            <p className="mt-2 text-xs text-gray-500">
              A new round can start after the previous round reaches Payout
              or Refund. This action is restricted to the manager in this
              frontend; the contract function itself is permissionless.
            </p>

            <button
              type="button"
              onClick={startNextRound}
              disabled={!canStartNextRound}
              className="mt-5 w-full rounded-lg bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isWriting && lastAction === "start-round"
                ? "Confirm in wallet..."
                : isConfirming && lastAction === "start-round"
                  ? "Waiting for confirmation..."
                  : "Start next round"}
            </button>
            {lastAction === "start-round" && isWriting && (
              <p role="status" className="mt-3 text-sm text-violet-300">
                Confirm the new round transaction in your wallet.
              </p>
            )}
            {lastAction === "start-round" && isConfirming && (
              <p role="status" className="mt-3 text-sm text-amber-300">
                Transaction submitted. Waiting for Sepolia confirmation...
              </p>
            )}
          </div>
        </>
      )}

      {replacementReason === "repriced" && !receipt && (
        <p role="status" className="mt-3 text-sm text-gray-400">
          The wallet repriced this manager transaction. Tracking the replacement.
        </p>
      )}

      {replacementReason === "cancelled" && (
        <div role="status" className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/5 p-4">
          <p className="text-sm text-amber-300">
            The original manager action was cancelled by a replacement transaction.
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
        <div role="alert" className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/5 p-4">
          <p className="text-sm text-amber-300">
            This manager transaction was replaced. Check the replacement transaction on Etherscan before dismissing.
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
        replacementReason !== "cancelled" &&
        lastAction === "recover" && (
        <p role="status" className="mt-4 text-sm text-emerald-400">
          Surplus recovery confirmed successfully.
        </p>
      )}

      {receipt?.status === "success" &&
        replacementReason !== "replaced" &&
        replacementReason !== "cancelled" &&
        lastAction === "start-round" && (
        <p role="status" className="mt-4 text-sm text-emerald-400">
          New lottery round started successfully.
        </p>
      )}

      {receipt?.status === "reverted" &&
        replacementReason !== "replaced" &&
        replacementReason !== "cancelled" &&
        lastAction === "recover" && (
        <p role="alert" className="mt-4 text-sm text-red-400">
          Recovery transaction reverted.
        </p>
      )}

      {receipt?.status === "reverted" &&
        replacementReason !== "replaced" &&
        replacementReason !== "cancelled" &&
        lastAction === "start-round" && (
        <p role="alert" className="mt-4 text-sm text-red-400">
          Starting the next round failed. The transaction reverted.
        </p>
      )}

      {transactionError && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-4"
        >
          <p className="text-sm font-semibold text-red-400">
            {errorType === "rejected"
              ? "Transaction cancelled"
              : "Transaction error"}
          </p>
          <p className="mt-1 break-words text-sm leading-5 text-gray-300">
            {transactionErrorMessage}
          </p>
          {receiptError && hash && !receipt && (
            <>
              <button
                type="button"
                onClick={retryReceiptTracking}
                disabled={isConfirming}
                className="mt-3 rounded-lg border border-amber-400/40 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isConfirming ? "Checking transaction..." : "Retry confirmation check"}
              </button>
              <p className="mt-2 text-xs text-gray-500">
                This retries receipt tracking only. It does not submit another manager transaction.
              </p>
            </>
          )}
        </div>
      )}

      {isDifferentWalletOrNetwork && submittedBy && (
        <p role="status" className="mt-3 break-words text-sm text-amber-300">
          This manager transaction was submitted by {submittedBy.slice(0, 6)}...
          {submittedBy.slice(-4)}. The connected wallet or network has changed.
          Transaction tracking remains attached to the original Sepolia transaction.
        </p>
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
          Wait for the current transaction before submitting another.
        </p>
      )}
    </section>
  );
}

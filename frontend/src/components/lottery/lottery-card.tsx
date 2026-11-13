"use client";

import { formatEther } from "viem";
import { useAccount, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { useEffect, useState } from "react";
import { useHydrated } from "@/src/hooks/use-hydrated";

import { useLotteryData } from "@/src/hooks/use-lottery-data";
import { useLotteryActivity } from "@/src/hooks/use-lottery-activity";
import { useEnterLottery } from "@/src/hooks/use-enter-lottery";
import {
  classifyError,
  getTransactionErrorMessage,
  getWalletErrorMessage,
} from "@/src/lib/errors";

const stateLabels = [
  "Open",
  "Calculating",
  "Payout",
  "Refund",
];

function formatCountdown(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return [hours, minutes, remainingSeconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(" : ");
}

export function LotteryCard() {
  const { address, isConnected, chainId } = useAccount();
  const {
    switchChain,
    isPending: isSwitching,
    error: switchError,
    reset: resetSwitch,
  } = useSwitchChain();

  const {
    isConfigured,
    entryFee,
    currentRoundId,
    roundEndTime,
    lotteryState,
    totalEntries,
  } = useLotteryData();

  const { activities, isLoading: isActivityLoading } =
    useLotteryActivity();

  const latestCompletedPrize = activities.find(
    (activity) =>
      activity.eventName === "WinnerSelected" &&
      activity.prizeAmount !== undefined
  );

  const {
    enterLottery,
    canEnter,
    hash,
    isWriting,
    isConfirming,
    isConfirmed,
    isReverted,
    replacementReason,
    writeError,
    receiptError,
    retryReceiptTracking,
    dismissTransactionError,
    recoveryRequired,
    isLocked,
    submittedBy,
    isDifferentWalletOrNetwork,
  } = useEnterLottery();

  const [now, setNow] = useState<number | null>(null);
  const mounted = useHydrated();

  useEffect(() => {
    const updateTime = () => setNow(Math.floor(Date.now() / 1000));

    updateTime();

    const interval = window.setInterval(updateTime, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const endTime =
    roundEndTime.data != null
      ? Number(roundEndTime.data)
      : undefined;

  const remaining =
    endTime !== undefined && now !== null
      ? Math.max(0, endTime - now)
      : undefined;

  const stateValue =
    lotteryState.data == null
      ? undefined
      : Number(lotteryState.data);

  const contractReadError = [
    entryFee.error,
    currentRoundId.error,
    roundEndTime.error,
    lotteryState.error,
    totalEntries.error,
  ].find((error) => error != null);

  const status =
    !isConfigured
      ? "Deployment pending"
      : contractReadError
        ? "Contract read failed"
        : stateValue === undefined
          ? "Loading contract state"
          : stateLabels[stateValue] ?? "Unknown";

  const walletStatus = !mounted
    ? "Checking wallet..."
    : !isConnected
      ? "Wallet not connected"
      : chainId !== sepolia.id
        ? "Wrong network"
        : `Connected: ${address?.slice(0, 6)}...${address?.slice(-4)}`;

  const transactionError = writeError ?? receiptError;

  const errorText = [
    writeError?.message,
    receiptError?.message,
  ]
    .filter(Boolean)
    .join(" ");

  const isWalletRejected = classifyError(errorText) === "rejected";

  const transactionErrorMessage = transactionError
    ? getTransactionErrorMessage(
        classifyError(errorText),
        Boolean(receiptError)
      )
    : null;

  const switchErrorMessage = switchError
    ? getWalletErrorMessage(switchError.message)
    : null;

  const buttonLabel = !isConfigured
    ? "Deployment pending"
    : !isConnected
      ? "Connect wallet to enter"
      : chainId !== sepolia.id
        ? isSwitching
          ? "Switching network..."
          : "Switch to Sepolia"
        : isWriting
          ? "Confirm transaction in wallet..."
          : recoveryRequired
            ? replacementReason === "cancelled"
              ? "Transaction cancelled"
              : replacementReason === "replaced"
                ? "Review replacement"
                : "Verify transaction status"
            : isReverted
              ? "Transaction reverted"
              : isConfirming
              ? "Waiting for confirmation..."
              : isConfirmed
                ? "Transaction confirmed"
                : !canEnter
                  ? "Lottery is not open"
                  : "Enter lottery";

  function handleEntry() {
    if (!isConnected) return;

    if (chainId !== sepolia.id) {
      resetSwitch();
      switchChain({ chainId: sepolia.id });
      return;
    }

    enterLottery();
  }

  return (
    <div id="lottery" className="mx-auto max-w-5xl">
      <div className="relative overflow-hidden rounded-3xl border border-violet-400/20 bg-gradient-to-br from-[#17142b] via-[#111323] to-[#10111d] p-6 shadow-2xl shadow-violet-950/20 sm:p-10">
        <div className="pointer-events-none absolute -right-20 -top-32 h-80 w-80 rounded-full bg-violet-600/15 blur-[100px]" />

        <div className="relative grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
              <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-violet-300">
                CURRENT ROUND
              </span>
              <span>
                {!isConfigured
                  ? "Awaiting deployment"
                  : currentRoundId.isLoading
                    ? "Loading round..."
                    : currentRoundId.error
                      ? "Round unavailable"
                      : currentRoundId.data != null
                        ? `Round #${currentRoundId.data.toString()}`
                        : "Round data unavailable"}
              </span>
            </div>

            <p className="text-sm font-medium text-gray-400">
              Last completed prize
            </p>

            <div className="mt-3 flex flex-wrap items-baseline gap-3">
              <span className="text-5xl font-black tracking-tight sm:text-6xl">
                {latestCompletedPrize?.prizeAmount !== undefined
                  ? `${formatEther(latestCompletedPrize.prizeAmount)} ETH`
                  : isActivityLoading
                    ? "Loading..."
                    : "Unavailable"}
              </span>
            </div>

            <p className="mt-4 max-w-md text-sm leading-6 text-gray-400">
              Prize recorded on-chain for the most recently completed lottery
              round. This is not the current round's jackpot.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3">
                <p className="text-xs text-gray-500">Entry fee</p>
                <p className="mt-1 font-semibold">
                  {!isConfigured
                    ? "Awaiting deployment"
                    : entryFee.isLoading
                      ? "Loading..."
                      : entryFee.error
                        ? "Unavailable"
                        : entryFee.data != null
                          ? `${formatEther(entryFee.data)} ETH`
                          : "Unavailable"}
                </p>
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3">
                <p className="text-xs text-gray-500">Network</p>
                <p className="mt-1 font-semibold">Ethereum Sepolia</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#090b16]/70 p-6">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="font-semibold">Round overview</h3>
              <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-400">
                {status}
              </span>
            </div>

            {contractReadError && (
              <div
                role="alert"
                className="mb-5 rounded-xl border border-red-400/20 bg-red-500/10 p-4"
              >
                <p className="text-sm font-semibold text-red-400">
                  Unable to read lottery contract
                </p>
                <p className="mt-1 break-words text-xs leading-5 text-gray-400">
                  Unable to retrieve on-chain lottery data. Please check the Sepolia RPC connection and try again.
                </p>
              </div>
            )}

            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-white/[0.07] pb-4">
                <span className="text-sm text-gray-500">
                  Entries in current round
                </span>
                <span className="font-semibold">
                  {!isConfigured
                    ? "--"
                    : totalEntries.isLoading
                      ? "Loading..."
                      : totalEntries.error
                        ? "Unavailable"
                        : totalEntries.data?.toString() ?? "Unavailable"}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-white/[0.07] pb-4">
                <span className="text-sm text-gray-500">
                  {stateValue === 0 ? "Round ends in" : "Round status"}
                </span>

                <span className="text-right text-sm font-semibold">
                  {!isConfigured
                    ? "Unavailable"
                    : lotteryState.isLoading
                      ? "Loading..."
                      : lotteryState.error
                        ? "Unavailable"
                        : stateValue === 0
                          ? remaining === undefined
                            ? "-- : -- : --"
                            : remaining === 0
                              ? "Awaiting round close"
                              : formatCountdown(remaining)
                          : stateValue === 1
                            ? "Winner selection in progress"
                            : stateValue === 2
                              ? "Payout phase"
                              : stateValue === 3
                                ? "Refund phase"
                                : "Unavailable"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Wallet</span>
                <span className="max-w-[60%] break-all text-right text-xs font-semibold text-gray-300">
                  {walletStatus}
                </span>
              </div>
            </div>

            <button
              onClick={handleEntry}
              disabled={
                !isConfigured ||
                !isConnected ||
                (chainId === sepolia.id && !canEnter) ||
                isWriting ||
                isConfirming ||
                isSwitching ||
                isLocked
              }
              className="mt-8 w-full rounded-xl bg-violet-600 px-5 py-4 font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-violet-600/40 disabled:text-white/60"
            >
              {buttonLabel}
            </button>

            {isWriting && (
              <div
                role="status"
                aria-live="polite"
                className="mt-4 rounded-xl border border-violet-400/20 bg-violet-500/10 p-4 text-center"
              >
                <p className="text-sm font-semibold text-violet-300">
                  Confirm transaction in your wallet
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Approve the entry transaction to submit it to Sepolia.
                </p>
              </div>
            )}

            {isConfirming && (
              <div
                role="status"
                aria-live="polite"
                className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 p-4 text-center"
              >
                <p className="text-sm font-semibold text-amber-300">
                  Transaction submitted
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Waiting for blockchain confirmation...
                </p>
              </div>
            )}

            {isConfirmed && (
              <div
                role="status"
                aria-live="polite"
                className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-center"
              >
                <p className="text-sm font-semibold text-emerald-400">
                  Transaction confirmed!
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Your lottery entry transaction has been confirmed on Sepolia.
                </p>
              </div>
            )}

            {isReverted && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-4"
              >
                <p className="text-sm font-semibold text-red-400">
                  Transaction reverted
                </p>
                <p className="mt-1 text-xs leading-5 text-gray-400">
                  The transaction was mined but execution failed. Your lottery
                  entry was not recorded. Network gas fees may still have been
                  charged. Review the transaction details on Etherscan.
                </p>
              </div>
            )}

            {hash && (
              <a
                href={`https://sepolia.etherscan.io/tx/${hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block text-center text-xs text-violet-300 hover:text-violet-200"
              >
                View transaction on Etherscan ↗
              </a>
            )}

            {isDifferentWalletOrNetwork && submittedBy && (
              <div
                role="status"
                className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 p-4"
              >
                <p className="text-sm font-semibold text-amber-300">
                  Wallet or network changed
                </p>
                <p className="mt-1 break-words text-xs leading-5 text-gray-400">
                  This entry transaction was submitted by {submittedBy.slice(0, 6)}...
                  {submittedBy.slice(-4)}. The connected wallet or network has changed.
                  Transaction tracking remains attached to the original Sepolia transaction.
                </p>
              </div>
            )}

            {switchErrorMessage && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 p-4"
              >
                <p className="text-sm font-semibold text-amber-300">
                  Network switch failed
                </p>
                <p className="mt-1 text-xs leading-5 text-gray-400">
                  {switchErrorMessage}
                </p>
              </div>
            )}

            {recoveryRequired && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 p-4"
              >
                <p className="text-sm font-semibold text-amber-300">
                  {replacementReason === "cancelled"
                    ? "Transaction cancelled"
                    : replacementReason === "replaced"
                      ? "Transaction replaced"
                      : "Transaction status uncertain"}
                </p>

                <p className="mt-1 text-xs leading-5 text-gray-400">
                  {replacementReason === "cancelled"
                    ? "Your wallet cancelled the pending transaction. No lottery entry was recorded by this transaction."
                    : replacementReason === "replaced"
                      ? "Another transaction replaced the submitted transaction. We cannot assume it entered the lottery. Review the replacement on Etherscan before trying again."
                      : "We could not confirm the transaction status. Check the transaction on Etherscan before attempting another entry. Your entry is temporarily disabled to prevent duplicate payment."}
                </p>

                {(replacementReason === "cancelled" ||
                  replacementReason === "replaced") && (
                  <button
                    onClick={() =>
                      dismissTransactionError(replacementReason === "replaced")
                    }
                    className="mt-3 text-xs font-semibold text-gray-300 hover:text-white"
                  >
                    {replacementReason === "replaced"
                      ? "I verified no lottery entry was recorded"
                      : "Dismiss cancellation"}
                  </button>
                )}
              </div>
            )}

            {transactionError && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-4"
              >
                <p className="text-sm font-semibold text-red-400">
                  {isWalletRejected ? "Transaction cancelled" : "Transaction error"}
                </p>

                <p className="mt-1 break-words text-xs leading-5 text-gray-400">
                  {transactionErrorMessage}
                </p>

                {receiptError && hash && !replacementReason && (
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
                      This retries receipt tracking only. It does not submit another lottery entry.
                    </p>
                  </>
                )}

                {!recoveryRequired && (
                  <button
                    onClick={() => dismissTransactionError()}
                    className="mt-3 text-xs font-semibold text-gray-300 hover:text-white"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            )}

            <p className="mt-3 text-center text-xs text-gray-600">
              {isConfigured
                ? "Entry requires a connected Sepolia wallet and an open round."
                : "Lottery participation will activate after contract deployment."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

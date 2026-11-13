"use client";

import { useEffect, useState } from "react";
import {
  useAccount,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import type { Address, ReplacementReturnType } from "viem";

import { useLotteryData } from "@/src/hooks/use-lottery-data";
import {
  lotteryContract,
  lotteryContractAddress,
  isLotteryContractConfigured,
} from "@/src/config/contracts";

type ReplacementReason = "repriced" | "replaced" | "cancelled";

export function useEnterLottery() {
  const { address, isConnected, chainId } = useAccount();
  const queryClient = useQueryClient();

  const [recoveryRequiredState, setRecoveryRequired] = useState(false);
  const [submittedBy, setSubmittedBy] = useState<Address | undefined>();
  const [replacementReason, setReplacementReason] =
    useState<ReplacementReason | null>(null);
  const [replacementHash, setReplacementHash] = useState<
    `0x${string}` | undefined
  >();

  const { entryFee, lotteryState } = useLotteryData();

  const {
    writeContract,
    data: submittedHash,
    error: writeError,
    isPending: isWriting,
    reset,
  } = useWriteContract();

  const {
    data: receipt,
    isLoading: isConfirming,
    error: receiptError,
    refetch: refetchReceipt,
  } = useWaitForTransactionReceipt({
    hash: submittedHash,
    chainId: lotteryContract.chainId,
    onReplaced: (replacement: ReplacementReturnType) => {
      setReplacementReason(replacement.reason);
      setReplacementHash(replacement.transaction.hash);

      if (
        replacement.reason === "replaced" ||
        replacement.reason === "cancelled"
      ) {
        setRecoveryRequired(true);
      }
    },
  });

  function retryReceiptTracking() {
    if (!submittedHash) return;
    void refetchReceipt();
  }

  const activeHash = replacementHash ?? submittedHash;
  const recoveryRequired =
    recoveryRequiredState || Boolean(receiptError && submittedHash);

  const isConfirmed =
    receipt?.status === "success" &&
    replacementReason !== "replaced" &&
    replacementReason !== "cancelled";

  const isReverted = receipt?.status === "reverted";

  const isCorrectNetwork = chainId === lotteryContract.chainId;
  const isLotteryOpen =
    lotteryState.isSuccess &&
    !lotteryState.isError &&
    lotteryState.data === 0;

  const hasValidEntryFee =
    entryFee.isSuccess &&
    !entryFee.isError &&
    entryFee.data != null;

  const isTransactionPending = Boolean(submittedHash) && !receipt;

  const isLocked =
    isWriting || isTransactionPending || recoveryRequired;

  const isDifferentWalletOrNetwork = Boolean(
    submittedHash &&
    submittedBy &&
    (
      !isConnected ||
      !address ||
      address.toLowerCase() !== submittedBy.toLowerCase() ||
      !isCorrectNetwork
    )
  );

  const canEnter =
    isConnected &&
    isCorrectNetwork &&
    isLotteryContractConfigured &&
    hasValidEntryFee &&
    isLotteryOpen &&
    !isLocked;

  function enterLottery() {
    if (
      !canEnter ||
      !lotteryContractAddress ||
      entryFee.data == null
    ) {
      return;
    }

    setRecoveryRequired(false);
    setReplacementReason(null);
    setReplacementHash(undefined);
    reset();
    setSubmittedBy(address);

    writeContract({
      address: lotteryContractAddress,
      abi: lotteryContract.abi,
      functionName: "enterLottery",
      value: entryFee.data,
      chainId: lotteryContract.chainId,
    });
  }

  useEffect(() => {
    if (receipt) {
      queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey.some(
            (key) =>
              typeof key === "string" &&
              key.includes("readContract")
          ),
      });

      return;
    }

  }, [receipt, queryClient]);

  function dismissTransactionError(verifiedNoEntry = false) {
    if (submittedHash && !receipt) {
      return;
    }

    // A replacement may itself have entered the lottery.
    if (replacementReason === "replaced" && !verifiedNoEntry) {
      return;
    }

    setRecoveryRequired(false);
    setReplacementReason(null);
    setReplacementHash(undefined);
    reset();
  }

  return {
    enterLottery,
    canEnter,
    hash: activeHash,
    originalHash: submittedHash,
    receipt,
    isWriting,
    isConfirming,
    isConfirmed,
    isReverted,
    replacementReason,
    replacementHash,
    writeError,
    receiptError,
    retryReceiptTracking,
    reset,
    dismissTransactionError,
    recoveryRequired,
    isLocked,
    submittedBy,
    isDifferentWalletOrNetwork,
    isConnected,
    isCorrectNetwork,
    isConfigured: isLotteryContractConfigured,
  };
}

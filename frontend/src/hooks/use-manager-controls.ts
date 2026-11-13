"use client";

import { useEffect, useState } from "react";
import {
  useAccount,
  useBalance,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import type { Address, ReplacementReturnType } from "viem";

import {
  lotteryContract,
  lotteryContractAddress,
  isLotteryContractConfigured,
} from "@/src/config/contracts";

export function useManagerControls() {
  const { address, isConnected, chainId } = useAccount();
  const queryClient = useQueryClient();
  const [submittedBy, setSubmittedBy] = useState<Address | undefined>();
  const [recoveryRequired, setRecoveryRequired] = useState(false);
  const [replacementReason, setReplacementReason] =
    useState<"repriced" | "replaced" | "cancelled" | null>(null);
  const [replacementHash, setReplacementHash] = useState<`0x${string}` | undefined>();

  const enabled = Boolean(isConnected && address && isLotteryContractConfigured);
  const isCorrectNetwork = chainId === lotteryContract.chainId;

  const manager = useReadContract({
    ...lotteryContract,
    functionName: "manager",
    query: { enabled },
  });

  const lotteryState = useReadContract({
    ...lotteryContract,
    functionName: "state",
    query: { enabled },
  });

  const prizeLiability = useReadContract({
    ...lotteryContract,
    functionName: "totalPrizeLiability",
    query: { enabled },
  });

  const refundLiability = useReadContract({
    ...lotteryContract,
    functionName: "totalRefundLiability",
    query: { enabled },
  });

  const contractBalance = useBalance({
    address: lotteryContractAddress,
    chainId: lotteryContract.chainId,
    query: { enabled: enabled && isCorrectNetwork },
  });

  const isManager =
    manager.isSuccess &&
    !manager.isError &&
    Boolean(address) &&
    Boolean(manager.data) &&
    address?.toLowerCase() === manager.data?.toLowerCase();

  const accountingError =
    prizeLiability.error ??
    refundLiability.error ??
    contractBalance.error;

  const isAccountingLoading =
    prizeLiability.isLoading ||
    refundLiability.isLoading ||
    contractBalance.isLoading;

  const hasAccountingData =
    !accountingError &&
    prizeLiability.data !== undefined &&
    refundLiability.data !== undefined &&
    contractBalance.data !== undefined;

  const liabilities =
    (prizeLiability.data ?? BigInt(0)) +
    (refundLiability.data ?? BigInt(0));

  const surplus =
    hasAccountingData && contractBalance.data!.value > liabilities
      ? contractBalance.data!.value - liabilities
      : BigInt(0);

  const {
    writeContract,
    data: hash,
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
    hash,
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

  const activeHash = replacementHash ?? hash;

  const isLocked =
    isWriting || Boolean(hash && !receipt) || recoveryRequired;

  function retryReceiptTracking() {
    if (!hash) return;
    void refetchReceipt();
  }

  function dismissTransactionError(verifiedOutcome = false) {
    if (hash && !receipt) return;
    if (replacementReason === "replaced" && !verifiedOutcome) return;

    setRecoveryRequired(false);
    setReplacementReason(null);
    setReplacementHash(undefined);
    reset();
  }

  const isDifferentWalletOrNetwork = Boolean(
    hash &&
    submittedBy &&
    (
      !isConnected ||
      !address ||
      address.toLowerCase() !== submittedBy.toLowerCase() ||
      !isCorrectNetwork
    )
  );

  const canRecoverSurplus =
    enabled &&
    isCorrectNetwork &&
    isManager &&
    hasAccountingData &&
    surplus > BigInt(0) &&
    !isLocked;

  const currentState = Number(lotteryState.data);

  const canStartNextRound =
    enabled &&
    isCorrectNetwork &&
    isManager &&
    lotteryState.isSuccess &&
    !lotteryState.isError &&
    (currentState === 2 || currentState === 3) &&
    !isLocked;

  const [lastAction, setLastAction] = useState<"recover" | "start-round" | null>(null);

  function recoverSurplus() {
    if (!canRecoverSurplus || !lotteryContractAddress) return;

    reset();
    setRecoveryRequired(false);
    setReplacementReason(null);
    setReplacementHash(undefined);
    setSubmittedBy(address);
    setLastAction("recover");

    writeContract({
      address: lotteryContractAddress,
      abi: lotteryContract.abi,
      functionName: "recoverSurplus",
      chainId: lotteryContract.chainId,
    });
  }

  function startNextRound() {
    if (!canStartNextRound || !lotteryContractAddress) return;

    reset();
    setRecoveryRequired(false);
    setReplacementReason(null);
    setReplacementHash(undefined);
    setSubmittedBy(address);
    setLastAction("start-round");

    writeContract({
      address: lotteryContractAddress,
      abi: lotteryContract.abi,
      functionName: "startNextRound",
      chainId: lotteryContract.chainId,
    });
  }

  useEffect(() => {
    if (receipt?.status === "success") {
      queryClient.invalidateQueries({ queryKey: ["readContract"] });
      queryClient.invalidateQueries({ queryKey: ["getBalance"] });
    }
  }, [receipt, queryClient]);

  return {
    isConnected,
    isCorrectNetwork,
    isConfigured: isLotteryContractConfigured,
    isManager,
    manager,
    contractBalance,
    prizeLiability,
    refundLiability,
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
    hash: activeHash,
    retryReceiptTracking,
    dismissTransactionError,
    replacementReason,
    recoveryRequired,
    submittedBy,
    isDifferentWalletOrNetwork,
    receipt,
    writeError,
    receiptError,
    isWriting,
    isConfirming,
    isLocked,
  };
}

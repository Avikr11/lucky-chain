"use client";

import { useEffect, useState } from "react";
import {
  useAccount,
  useReadContract,
  usePublicClient,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAddress, type Address, type ReplacementReturnType, zeroAddress } from "viem";

import { useLotteryData } from "@/src/hooks/use-lottery-data";
import {
  lotteryContract,
  lotteryContractAddress,
  isLotteryContractConfigured,
} from "@/src/config/contracts";

type HistoricalRefund = {
  roundId: bigint;
  amount: bigint;
};

export function usePlayerRewards() {
  const { address, isConnected, chainId } = useAccount();
  const queryClient = useQueryClient();
  const { currentRoundId, lotteryState } = useLotteryData();
  const publicClient = usePublicClient({ chainId: lotteryContract.chainId });
  const [submittedBy, setSubmittedBy] = useState<Address | undefined>();
  const [recoveryRequired, setRecoveryRequired] = useState(false);
  const [replacementReason, setReplacementReason] =
    useState<"repriced" | "replaced" | "cancelled" | null>(null);
  const [replacementHash, setReplacementHash] = useState<`0x${string}` | undefined>();

  const enabled = Boolean(
    isConnected && address && isLotteryContractConfigured
  );

  const pendingWinnings = useReadContract({
    ...lotteryContract,
    functionName: "pendingWinnings",
    args: [address ?? zeroAddress],
    query: { enabled },
  });

  const refundCredits = useReadContract({
    ...lotteryContract,
    functionName: "refundCredits",
    args: [address ?? zeroAddress],
    query: { enabled },
  });

  const currentRoundRefund = useReadContract({
    ...lotteryContract,
    functionName: "roundRefundCredits",
    args: [currentRoundId.data ?? BigInt(0), address ?? zeroAddress],
    query: {
      enabled: enabled && currentRoundId.data !== undefined,
    },
  });

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

  const isCorrectNetwork = chainId === lotteryContract.chainId;
  const isLocked =
    isWriting || Boolean(hash && !receipt) || recoveryRequired;

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

  const historicalRefunds = useQuery({
    queryKey: [
      "lottery-historical-refunds",
      address,
      currentRoundId.data?.toString(),
    ],
    enabled:
      enabled &&
      isCorrectNetwork &&
      publicClient !== undefined &&
      currentRoundId.data !== undefined,
    staleTime: 15_000,
    refetchInterval: 30_000,
    queryFn: async (): Promise<HistoricalRefund[]> => {
      if (!publicClient || !address || !lotteryContractAddress || currentRoundId.data === undefined) {
        return [];
      }

      const refunds: HistoricalRefund[] = [];

      for (let roundId = BigInt(1); roundId < currentRoundId.data; roundId += BigInt(1)) {
        const [, , roundState] = await publicClient.readContract({
          address: lotteryContractAddress,
          abi: lotteryContract.abi,
          functionName: "getRoundResult",
          args: [roundId],
        });

        // LotteryState.REFUND = 3.
        if (Number(roundState) !== 3) continue;

        const amount = await publicClient.readContract({
          address: lotteryContractAddress,
          abi: lotteryContract.abi,
          functionName: "roundRefundCredits",
          args: [roundId, address],
        });

        if (amount > BigInt(0)) {
          refunds.push({ roundId, amount });
        }
      }

      return refunds;
    },
  });

  const canWithdrawHistoricalRefund =
    enabled &&
    isCorrectNetwork &&
    (historicalRefunds.data?.length ?? 0) > 0 &&
    !isLocked;

  const canWithdrawWinnings =
    enabled &&
    isCorrectNetwork &&
    (pendingWinnings.data ?? BigInt(0)) > BigInt(0) &&
    !isLocked;

  // LotteryState.REFUND = 3.
  // Only the current round is offered here because historical round
  // states are not exposed through a public contract getter.
  const canWithdrawRefund =
    enabled &&
    isCorrectNetwork &&
    lotteryState.data === 3 &&
    (currentRoundRefund.data ?? BigInt(0)) > BigInt(0) &&
    !isLocked;

  function retryReceiptTracking() {
    if (!hash) return;
    void refetchReceipt();
  }

  function prepareTransaction() {
    setRecoveryRequired(false);
    setReplacementReason(null);
    setReplacementHash(undefined);
    setSubmittedBy(address);
    reset();
  }

  function dismissTransactionError(verifiedOutcome = false) {
    if (hash && !receipt) return;
    if (replacementReason === "replaced" && !verifiedOutcome) return;

    setRecoveryRequired(false);
    setReplacementReason(null);
    setReplacementHash(undefined);
    reset();
  }

  function withdrawWinnings() {
    if (!canWithdrawWinnings || !lotteryContractAddress) return;

    prepareTransaction();

    writeContract({
      address: lotteryContractAddress,
      abi: lotteryContract.abi,
      functionName: "withdrawWinnings",
      chainId: lotteryContract.chainId,
    });
  }

  function withdrawWinningsTo(recipient: string) {
    if (
      !canWithdrawWinnings ||
      !lotteryContractAddress ||
      !isAddress(recipient)
    ) {
      return;
    }

    prepareTransaction();

    writeContract({
      address: lotteryContractAddress,
      abi: lotteryContract.abi,
      functionName: "withdrawWinningsTo",
      args: [recipient as Address],
      chainId: lotteryContract.chainId,
    });
  }

  function withdrawHistoricalRefund(roundId: bigint) {
    const eligible = historicalRefunds.data?.some(
      (refund) => refund.roundId === roundId && refund.amount > BigInt(0)
    );

    if (
      !eligible ||
      !enabled ||
      !isCorrectNetwork ||
      isLocked ||
      !lotteryContractAddress
    ) {
      return;
    }

    prepareTransaction();

    writeContract({
      address: lotteryContractAddress,
      abi: lotteryContract.abi,
      functionName: "withdrawRefundForRound",
      args: [roundId],
      chainId: lotteryContract.chainId,
    });
  }

  function withdrawCurrentRoundRefund() {
    if (!canWithdrawRefund || !lotteryContractAddress) return;

    prepareTransaction();

    writeContract({
      address: lotteryContractAddress,
      abi: lotteryContract.abi,
      functionName: "withdrawRefund",
      chainId: lotteryContract.chainId,
    });
  }

  useEffect(() => {
    if (receipt?.status === "success") {
      queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey.some(
            (key) =>
              typeof key === "string" &&
              key.includes("readContract")
          ),
      });
      queryClient.invalidateQueries({
        queryKey: ["lottery-historical-refunds"],
      });
    }
  }, [receipt, queryClient]);

  return {
    address,
    submittedBy,
    isDifferentWalletOrNetwork,
    isConnected,
    isCorrectNetwork,
    isConfigured: isLotteryContractConfigured,
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
    hash: activeHash,
    replacementReason,
    recoveryRequired,
    receipt,
    writeError,
    receiptError,
    isWriting,
    isConfirming,
    isLocked,
  };
}

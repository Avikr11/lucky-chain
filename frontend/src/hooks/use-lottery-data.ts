"use client";

import {
  useReadContract,
} from "wagmi";

import {
  isLotteryContractConfigured,
  lotteryContract,
  lotteryContractAddress,
} from "@/src/config/contracts";

export function useLotteryData() {
  const enabled = isLotteryContractConfigured;

  const entryFee = useReadContract({
    address: lotteryContractAddress,
    abi: lotteryContract.abi,
    functionName: "ENTRY_FEE",
    chainId: lotteryContract.chainId,
    query: { enabled },
  });

  const roundDuration = useReadContract({
    address: lotteryContractAddress,
    abi: lotteryContract.abi,
    functionName: "ROUND_DURATION",
    chainId: lotteryContract.chainId,
    query: { enabled },
  });

  const currentRoundId = useReadContract({
    address: lotteryContractAddress,
    abi: lotteryContract.abi,
    functionName: "currentRoundId",
    chainId: lotteryContract.chainId,
    query: { enabled },
  });

  const roundEndTime = useReadContract({
    address: lotteryContractAddress,
    abi: lotteryContract.abi,
    functionName: "roundEndTime",
    chainId: lotteryContract.chainId,
    query: { enabled },
  });

  const lotteryState = useReadContract({
    address: lotteryContractAddress,
    abi: lotteryContract.abi,
    functionName: "state",
    chainId: lotteryContract.chainId,
    query: { enabled },
  });

  const totalEntries = useReadContract({
    address: lotteryContractAddress,
    abi: lotteryContract.abi,
    functionName: "getPlayersCount",
    chainId: lotteryContract.chainId,
    query: { enabled },
  });

  const latestWinner = useReadContract({
    address: lotteryContractAddress,
    abi: lotteryContract.abi,
    functionName: "winner",
    chainId: lotteryContract.chainId,
    query: { enabled },
  });

  const totalPrizeLiability = useReadContract({
    address: lotteryContractAddress,
    abi: lotteryContract.abi,
    functionName: "totalPrizeLiability",
    chainId: lotteryContract.chainId,
    query: { enabled },
  });

  return {
    isConfigured: enabled,
    entryFee,
    roundDuration,
    currentRoundId,
    roundEndTime,
    lotteryState,
    totalEntries,
    latestWinner,
    totalPrizeLiability,
  };
}

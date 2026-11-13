"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { decodeEventLog, formatEther } from "viem";
import { usePublicClient } from "wagmi";

import {
  isLotteryContractConfigured,
  lotteryContractAddress,
  LOTTERY_CHAIN_ID,
} from "@/src/config/contracts";

import { lotteryAbi } from "@/src/lib/abi/lottery-abi";

const deploymentBlockValue =
  process.env.NEXT_PUBLIC_LOTTERY_DEPLOYMENT_BLOCK;

const deploymentBlock =
  deploymentBlockValue && /^\d+$/.test(deploymentBlockValue)
    ? BigInt(deploymentBlockValue)
    : undefined;

const BLOCK_RANGE = BigInt(2000);
const CONFIRMATION_DEPTH = BigInt(3);
const BLOCK_STEP = BigInt(1);

export type LotteryActivity = {
  id: string;
  eventName: string;
  description: string;
  transactionHash: `0x${string}`;
  blockNumber: bigint;
  logIndex: number;
  prizeAmount?: bigint;
  requestId?: bigint;
  winner?: `0x${string}`;
};

type ActivityFeedData = {
  activities: LotteryActivity[];
  scannedThrough: bigint | null;
};

function describeActivity(
  eventName: string,
  args: Record<string, unknown>
): string | undefined {
  switch (eventName) {
    case "RandomnessRequested":
      return `VRF randomness requested · ID ${String(args.requestId)}`;

    case "RandomnessReceived":
      return `VRF randomness fulfilled · ID ${String(args.requestId)}`;

    case "WinnerSelected":
      return `Winner selected: ${String(args.winner)} · Prize ${formatEther(args.prizePool as bigint)} ETH`;

    case "LotteryAborted":
      return `Lottery aborted · Request ID ${String(args.requestId)}`;

    case "WinningsWithdrawn":
      return `Winnings withdrawn · ${formatEther(args.amount as bigint)} ETH`;

    case "WinningsRedirected":
      return `Winnings redirected to ${String(args.recipient)} · ${formatEther(args.amount as bigint)} ETH`;

    case "RefundWithdrawn":
      return `Refund withdrawn · ${formatEther(args.amount as bigint)} ETH`;

    case "SurplusRecovered":
      return `Contract surplus recovered · ${formatEther(args.amount as bigint)} ETH`;

    default:
      return undefined;
  }
}

function sortActivities(activities: LotteryActivity[]) {
  return activities.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) {
      return a.blockNumber > b.blockNumber ? -1 : 1;
    }

    return b.logIndex - a.logIndex;
  });
}

export function useLotteryActivity() {
  const publicClient = usePublicClient({
    chainId: LOTTERY_CHAIN_ID,
  });

  const queryClient = useQueryClient();

  const queryKey = [
    "lottery-activity",
    lotteryContractAddress,
    deploymentBlock?.toString(),
  ] as const;

  const isConfigured =
    isLotteryContractConfigured &&
    deploymentBlock !== undefined;

  const query = useQuery({
    queryKey,

    enabled: isConfigured && publicClient !== undefined,

    staleTime: 30_000,
    refetchInterval: 30_000,

    queryFn: async (): Promise<ActivityFeedData> => {
      if (
        !publicClient ||
        !lotteryContractAddress ||
        deploymentBlock === undefined
      ) {
        throw new Error("Lottery activity configuration is incomplete.");
      }

      const previousData =
        queryClient.getQueryData<ActivityFeedData>(queryKey);

      const latestBlock = await publicClient.getBlockNumber();

      // Only scan blocks with at least three confirmations.
      const safeLatestBlock =
        latestBlock > CONFIRMATION_DEPTH
          ? latestBlock - CONFIRMATION_DEPTH
          : BigInt(0);

      if (safeLatestBlock < deploymentBlock) {
        return (
          previousData ?? {
            activities: [],
            scannedThrough: null,
          }
        );
      }

      // Resume immediately after the last successfully scanned block.
      const fromBlock =
        previousData?.scannedThrough !== null &&
        previousData?.scannedThrough !== undefined
          ? previousData.scannedThrough + BLOCK_STEP
          : deploymentBlock;

      // Nothing new to scan.
      if (fromBlock > safeLatestBlock) {
        return (
          previousData ?? {
            activities: [],
            scannedThrough: null,
          }
        );
      }

      const activities = [
        ...(previousData?.activities ?? []),
      ];

      for (
        let startBlock = fromBlock;
        startBlock <= safeLatestBlock;
        startBlock += BLOCK_RANGE
      ) {
        const endBlock =
          startBlock + BLOCK_RANGE - BLOCK_STEP > safeLatestBlock
            ? safeLatestBlock
            : startBlock + BLOCK_RANGE - BLOCK_STEP;

        const logs = await publicClient.getLogs({
          address: lotteryContractAddress,
          fromBlock: startBlock,
          toBlock: endBlock,
        });

        for (const log of logs) {
          if (
            !log.transactionHash ||
            log.blockNumber === null
          ) {
            continue;
          }

          try {
            const decoded = decodeEventLog({
              abi: lotteryAbi,
              data: log.data,
              topics: log.topics,
              strict: false,
            });

            const args = decoded.args as unknown as Record<
              string,
              unknown
            >;

            const description = describeActivity(
              decoded.eventName,
              args
            );

            if (!description) continue;

            activities.push({
              id: `${log.transactionHash}-${log.logIndex ?? 0}`,
              eventName: decoded.eventName,
              description,
              transactionHash: log.transactionHash,
              blockNumber: log.blockNumber,
              logIndex: log.logIndex ?? 0,
              prizeAmount:
                decoded.eventName === "WinnerSelected"
                  ? (args.prizePool as bigint)
                  : undefined,
              requestId:
                decoded.eventName === "RandomnessRequested" ||
                decoded.eventName === "RandomnessReceived"
                  ? (args.requestId as bigint)
                  : undefined,
              winner:
                decoded.eventName === "WinnerSelected"
                  ? (args.winner as `0x${string}`)
                  : undefined,
            });
          } catch {
            // Ignore logs that cannot be decoded using the lottery ABI.
          }
        }
      }

      // Deduplicate by transaction hash and log index.
      const uniqueActivities = Array.from(
        new Map(
          activities.map((activity) => [
            activity.id,
            activity,
          ])
        ).values()
      );

      return {
        activities: sortActivities(uniqueActivities),
        scannedThrough: safeLatestBlock,
      };
    },
  });

  return {
    activities: query.data?.activities ?? [],
    isConfigured,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

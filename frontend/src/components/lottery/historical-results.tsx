"use client";

import { useQuery } from "@tanstack/react-query";
import { formatEther } from "viem";
import { usePublicClient } from "wagmi";

import { useLotteryActivity } from "@/src/hooks/use-lottery-activity";
import {
  isLotteryContractConfigured,
  lotteryContractAddress,
  LOTTERY_CHAIN_ID,
} from "@/src/config/contracts";
import { lotteryAbi } from "@/src/lib/abi/lottery-abi";

type HistoricalRound = {
  roundId: bigint;
  winner: `0x${string}`;
  prizeAmount: bigint;
  randomWord: bigint;
  transactionHash: `0x${string}`;
};

export function HistoricalResults() {
  const publicClient = usePublicClient({
    chainId: LOTTERY_CHAIN_ID,
  });

  const {
    activities,
    isLoading: isActivityLoading,
    error: activityError,
  } = useLotteryActivity();

  const activityKey = activities
    .map((activity) => activity.id)
    .join(",");

  const resultsQuery = useQuery({
    queryKey: [
      "lottery-historical-results",
      lotteryContractAddress,
      activityKey,
    ],

    enabled:
      isLotteryContractConfigured &&
      publicClient !== undefined &&
      !isActivityLoading,

    staleTime: 30_000,
    refetchInterval: 30_000,

    queryFn: async (): Promise<HistoricalRound[]> => {
      if (!publicClient || !lotteryContractAddress) {
        return [];
      }

      const winnerEvents = activities.filter(
        (activity) =>
          activity.eventName === "WinnerSelected" &&
          activity.winner !== undefined &&
          activity.prizeAmount !== undefined
      );

      const randomnessByTransaction = new Map(
        activities
          .filter(
            (activity) =>
              activity.eventName === "RandomnessReceived" &&
              activity.requestId !== undefined
          )
          .map((activity) => [
            activity.transactionHash,
            activity.requestId!,
          ])
      );

      const results: HistoricalRound[] = [];

      for (const event of winnerEvents) {
        const winner = event.winner;
        const prizeAmount = event.prizeAmount;
        const requestId = randomnessByTransaction.get(
          event.transactionHash
        );

        if (
          !winner ||
          prizeAmount === undefined ||
          requestId === undefined
        ) {
          continue;
        }

        const roundId = await publicClient.readContract({
          address: lotteryContractAddress,
          abi: lotteryAbi,
          functionName: "requestIdToRoundId",
          args: [requestId],
        });

        if (roundId === BigInt(0)) {
          continue;
        }

        const [
          randomWord,
          contractWinner,
          roundState,
        ] = await publicClient.readContract({
          address: lotteryContractAddress,
          abi: lotteryAbi,
          functionName: "getRoundResult",
          args: [roundId],
        });

        if (
          Number(roundState) !== 2 ||
          contractWinner.toLowerCase() !== winner.toLowerCase()
        ) {
          continue;
        }

        results.push({
          roundId,
          winner: contractWinner,
          prizeAmount,
          randomWord,
          transactionHash: event.transactionHash,
        });
      }

      return results.sort((a, b) =>
        a.roundId > b.roundId ? -1 : a.roundId < b.roundId ? 1 : 0
      );
    },
  });

  const results = resultsQuery.data ?? [];

  return (
    <section
      id="historical-results"
      className="mx-auto mt-12 max-w-5xl"
    >
      <div className="mb-6">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-violet-400">
          On-chain history
        </p>
        <h2 className="mt-2 text-2xl font-bold text-white">
          Historical lottery results
        </h2>
        <p className="mt-2 text-sm text-gray-400">
          Completed rounds verified against Chainlink VRF records
          and the lottery smart contract.
        </p>
      </div>

      {isActivityLoading || resultsQuery.isLoading ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6 text-sm text-gray-400">
          Loading historical results from Sepolia...
        </div>
      ) : activityError || resultsQuery.error ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-400/20 bg-red-500/5 p-6 text-sm text-red-300"
        >
          Unable to retrieve historical results. Check the Sepolia
          RPC connection and try refreshing.
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6 text-sm text-gray-400">
          No verifiable completed winner rounds were found.
        </div>
      ) : (
        <div className="grid gap-4">
          {results.map((result) => (
            <article
              key={result.roundId.toString()}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-white">
                  Round #{result.roundId.toString()}
                </h3>

                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                  Completed · Verified
                </span>
              </div>

              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-gray-500">
                    Winning address
                  </p>
                  <p className="mt-2 break-all text-sm font-semibold text-gray-200">
                    {result.winner}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">
                    Prize awarded
                  </p>
                  <p className="mt-2 text-2xl font-bold text-violet-300">
                    {formatEther(result.prizeAmount)} ETH
                  </p>
                </div>
              </div>

              <div className="mt-5 border-t border-white/[0.07] pt-4">
                <p className="text-xs text-gray-500">
                  VRF random word
                </p>
                <p className="mt-2 break-all font-mono text-xs text-gray-400">
                  {result.randomWord.toString()}
                </p>

                <a
                  href={`https://sepolia.etherscan.io/tx/${result.transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-block text-sm text-violet-300 underline underline-offset-4 hover:text-violet-200"
                >
                  Verify winner transaction on Etherscan
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

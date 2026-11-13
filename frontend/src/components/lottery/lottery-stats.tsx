"use client";

import { formatEther, isAddress } from "viem";
import { useLotteryData } from "@/src/hooks/use-lottery-data";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function LotteryStats() {
  const {
    isConfigured,
    totalEntries,
    latestWinner,
    totalPrizeLiability,
  } = useLotteryData();

  const winner =
    typeof latestWinner.data === "string" &&
    isAddress(latestWinner.data) &&
    latestWinner.data !== ZERO_ADDRESS
      ? latestWinner.data
      : undefined;

  const stats = [
    {
      label: "Entries in current round",
      value: totalEntries.data?.toString() ?? "--",
      description: "Entries in current round",
      loading: totalEntries.isLoading,
      error: totalEntries.error,
    },
    {
      label: "Latest winner",
      value: winner
        ? `${winner.slice(0, 6)}...${winner.slice(-4)}`
        : latestWinner.data === ZERO_ADDRESS
          ? "No winner yet"
          : "Unavailable",
      description: "Most recently selected winner",
      loading: latestWinner.isLoading,
      error: latestWinner.error,
    },
    {
      label: "Outstanding prize liability",
      value:
        totalPrizeLiability.data != null
          ? `${formatEther(totalPrizeLiability.data)} ETH`
          : "-- ETH",
      description: "Prize winnings awaiting withdrawal",
      loading: totalPrizeLiability.isLoading,
      error: totalPrizeLiability.error,
    },
  ];

  return (
    <div className="mx-auto mt-8 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-3">
      {stats.map((stat) => {
        const displayValue = !isConfigured
          ? "--"
          : stat.loading
            ? "Loading..."
            : stat.error
              ? "Unavailable"
              : stat.value;

        const description = !isConfigured
          ? "Awaiting contract deployment"
          : stat.loading
            ? "Fetching on-chain data..."
            : stat.error
              ? "Unable to retrieve contract data"
              : stat.description;

        return (
          <div
            key={stat.label}
            className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6"
          >
            <p className="text-sm text-gray-500">{stat.label}</p>

            <p
              className={`mt-3 break-all text-2xl font-bold ${
                stat.error && isConfigured ? "text-red-400" : ""
              }`}
            >
              {displayValue}
            </p>

            <p className="mt-1 text-xs text-gray-600">
              {description}
            </p>
          </div>
        );
      })}
    </div>
  );
}

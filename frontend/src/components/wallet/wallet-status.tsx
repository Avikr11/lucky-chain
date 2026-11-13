"use client";

import { useHydrated } from "@/src/hooks/use-hydrated";
import { useAccount } from "wagmi";
import { sepolia } from "wagmi/chains";

export function WalletStatus() {
  const mounted = useHydrated();

  const {
    address,
    chainId,
    isConnected,
    isConnecting,
    isReconnecting,
  } = useAccount();

  const isChecking =
    !mounted || isConnecting || isReconnecting;

  const isSepolia = chainId === sepolia.id;

  const statusColor = isChecking
    ? "bg-blue-400"
    : !isConnected
      ? "bg-gray-500"
      : isSepolia
        ? "bg-emerald-400"
        : "bg-amber-400";

  const statusText = isChecking
    ? "Checking wallet connection..."
    : !isConnected
      ? "Wallet disconnected"
      : isSepolia
        ? `Connected to Sepolia · ${address?.slice(0, 6)}...${address?.slice(-4)}`
        : `Wrong network · Chain ${chainId}`;

  const description = isChecking
    ? "Checking your wallet connection and network."
    : !isConnected
      ? "Connect your wallet to access the Sepolia test environment."
      : isSepolia
        ? "Your wallet is connected and ready for the Sepolia test environment."
        : "Switch your wallet to Ethereum Sepolia to interact with LuckyChain.";

  return (
    <div className="mx-auto mt-8 max-w-5xl rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="font-semibold">Your wallet connection</h3>
          <p className="mt-1 text-sm text-gray-500">
            {description}
          </p>
        </div>

        <div
          className="flex items-center gap-2 text-sm"
          role="status"
          aria-live="polite"
        >
          <span className={`h-2 w-2 rounded-full ${statusColor}`} />
          <span className="text-gray-400">{statusText}</span>
        </div>
      </div>
    </div>
  );
}

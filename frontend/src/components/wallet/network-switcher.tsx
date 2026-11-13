
"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";

export function NetworkSwitcher() {
  const { chainId, isConnected } = useAccount();
  const {
    chains,
    switchChain,
    isPending,
    error,
  } = useSwitchChain();

  if (!isConnected || chainId === sepolia.id) {
    return null;
  }

  const sepoliaChain = chains.find(
    (chain) => chain.id === sepolia.id
  );

  if (!sepoliaChain) {
    return null;
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => switchChain({ chainId: sepolia.id })}
        disabled={isPending}
        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Switching network..." : "Switch to Sepolia"}
      </button>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error.message}
        </p>
      )}
    </div>
  );
}

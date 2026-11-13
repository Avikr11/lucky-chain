"use client";

import { useHydrated } from "@/src/hooks/use-hydrated";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { sepolia } from "wagmi/chains";
import { getWalletErrorMessage } from "@/src/lib/errors";

export function WalletButton() {
  const mounted = useHydrated();

  const { address, isConnected, chainId } = useAccount();

  const {
    connect,
    connectors,
    isPending: isConnecting,
    error: connectError,
    reset: resetConnect,
  } = useConnect();

  const {
    disconnect,
    isPending: isDisconnecting,
    error: disconnectError,
    reset: resetDisconnect,
  } = useDisconnect();

  const {
    switchChain,
    isPending: isSwitching,
    error: switchError,
    reset: resetSwitch,
  } = useSwitchChain();

  const injectedConnector = connectors.find(
    (connector) => connector.id === "injected"
  );

  const isWrongNetwork = isConnected && chainId !== sepolia.id;

  function handleConnect() {
    if (!injectedConnector || isConnecting) return;

    resetConnect();
    connect({ connector: injectedConnector });
  }

  function handleSwitchNetwork() {
    if (isSwitching) return;

    resetSwitch();
    switchChain({ chainId: sepolia.id });
  }

  function handleDisconnect() {
    if (isDisconnecting) return;

    resetDisconnect();
    disconnect();
  }

  if (!mounted) {
    return (
      <button
        disabled
        aria-label="Loading wallet connection"
        className="rounded-xl bg-violet-600/40 px-5 py-3 font-semibold text-white/60"
      >
        Connect Wallet
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {!isConnected ? (
        <button
          onClick={handleConnect}
          disabled={!injectedConnector || isConnecting}
          className="rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isConnecting
            ? "Connecting..."
            : !injectedConnector
              ? "Wallet not detected"
              : "Connect Wallet"}
        </button>
      ) : isWrongNetwork ? (
        <button
          onClick={handleSwitchNetwork}
          disabled={isSwitching}
          className="rounded-xl bg-amber-500 px-5 py-3 font-semibold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSwitching ? "Switching..." : "Switch to Sepolia"}
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <span
            className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300"
            aria-label={`Connected wallet ${address}`}
          >
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </span>

          <button
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            aria-label="Disconnect wallet"
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-sm text-gray-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDisconnecting ? "..." : "Disconnect"}
          </button>
        </div>
      )}

      {connectError && !isConnected && (
        <p role="alert" className="max-w-56 text-right text-xs text-red-400">
          {getWalletErrorMessage(connectError.message)}
        </p>
      )}

      {switchError && isWrongNetwork && (
        <p role="alert" className="max-w-56 text-right text-xs text-red-400">
          {getWalletErrorMessage(switchError.message)}
        </p>
      )}

      {disconnectError && (
        <p role="alert" className="max-w-56 text-right text-xs text-red-400">
          {getWalletErrorMessage(disconnectError.message)}
        </p>
      )}
    </div>
  );
}

import Link from "next/link";

export function Footer() {
  return (
    <footer className="relative mt-28 border-t border-white/[0.07] bg-[#090a12]/60">
      <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-lg font-black text-white shadow-lg shadow-violet-900/20">
                L
              </div>
              <span className="text-lg font-bold text-white">
                LuckyChain
              </span>
            </Link>

            <p className="mt-5 max-w-sm text-sm leading-7 text-gray-400">
              A decentralized lottery project exploring smart contract
              automation, blockchain transparency and verifiable randomness.
            </p>

            <p className="mt-4 text-xs text-gray-600">
              Ethereum Sepolia test environment
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">
              Explore
            </h3>

            <nav className="mt-5 flex flex-col gap-3 text-sm text-gray-400">
              <a href="#lottery" className="transition hover:text-violet-300">
                Lottery
              </a>
              <a
                href="#how-it-works"
                className="transition hover:text-violet-300"
              >
                How it works
              </a>
              <a
                href="#transparency"
                className="transition hover:text-violet-300"
              >
                Transparency
              </a>
            </nav>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">
              Technology
            </h3>

            <div className="mt-5 flex flex-wrap gap-2">
              {["Solidity", "Foundry", "Next.js", "Wagmi", "Viem", "Chainlink VRF"].map(
                (technology) => (
                  <span
                    key={technology}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-gray-400"
                  >
                    {technology}
                  </span>
                )
              )}
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/[0.07] pt-6 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 LuckyChain. Built on Ethereum.</p>
          <p>
            Powered by Chainlink VRF · For testnet demonstration
          </p>
        </div>
      </div>
    </footer>
  );
}

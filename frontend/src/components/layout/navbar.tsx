import Link from "next/link";
import { WalletButton } from "@/src/components/wallet-button";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#0b0c16]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
        <Link href="/" className="group flex shrink-0 items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-xl font-black text-white shadow-lg shadow-violet-900/30 transition duration-300 group-hover:scale-105 group-hover:shadow-violet-700/30">
            L
          </div>

          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">
              LuckyChain
            </h1>
            <p className="text-[9px] font-medium tracking-[0.23em] text-gray-500">
              DECENTRALIZED LOTTERY
            </p>
          </div>
        </Link>

        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-8 text-sm font-medium text-gray-400 md:flex"
        >
          <a
            href="#lottery"
            className="transition-colors duration-200 hover:text-violet-300"
          >
            Lottery
          </a>

          <a
            href="#how-it-works"
            className="transition-colors duration-200 hover:text-violet-300"
          >
            How it works
          </a>

          <a
            href="#transparency"
            className="transition-colors duration-200 hover:text-violet-300"
          >
            Transparency
          </a>
        </nav>

        <WalletButton />
      </div>
    </header>
  );
}

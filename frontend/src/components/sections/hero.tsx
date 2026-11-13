export function Hero() {
  return (
    <section className="relative mx-auto mb-16 max-w-4xl overflow-hidden px-5 pt-16 text-center sm:pt-24">
      <div className="pointer-events-none absolute left-1/2 top-20 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-violet-600/15 blur-[120px]" />

      <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-2 text-xs font-medium text-emerald-400">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        Built on Ethereum · Chainlink VRF
      </div>

      <h2 className="text-5xl font-black leading-[1.08] tracking-[-0.045em] text-white sm:text-7xl lg:text-8xl">
        Luck meets
        <span className="mt-2 block bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 bg-clip-text pb-2 text-transparent">
          blockchain.
        </span>
      </h2>

      <p className="mx-auto mt-7 max-w-2xl text-base leading-8 text-gray-400 sm:text-lg">
        A transparent, decentralized lottery where randomness is verifiable
        and every transaction lives on-chain.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs font-medium text-gray-500">
        <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2">
          On-chain transparency
        </span>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2">
          Verifiable randomness
        </span>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2">
          Ethereum Sepolia
        </span>
      </div>
    </section>
  );
}

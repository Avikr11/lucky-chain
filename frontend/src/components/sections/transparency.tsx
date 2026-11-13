const features = [
  {
    number: "01",
    title: "On-chain records",
    description:
      "Lottery participation and round state are managed through smart contract transactions that can be independently inspected on the blockchain.",
  },
  {
    number: "02",
    title: "Verifiable randomness",
    description:
      "Chainlink VRF provides verifiable randomness for winner selection, rather than relying on a centralized random number generator.",
  },
  {
    number: "03",
    title: "Prize accounting",
    description:
      "The contract tracks outstanding prize and refund liabilities to support transparent accounting of funds owed to participants.",
  },
];

export function Transparency() {
  return (
    <section
      id="transparency"
      className="mx-auto mt-28 max-w-6xl px-5 lg:px-8"
    >
      <div className="relative overflow-hidden rounded-3xl border border-violet-400/15 bg-gradient-to-br from-[#17142b] via-[#111323] to-[#10111d] p-7 shadow-2xl shadow-violet-950/10 sm:p-10 lg:p-12">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet-600/10 blur-[100px]" />

        <div className="relative">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-400">
              Trust through verification
            </p>

            <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Transparency by design.
            </h2>

            <p className="mt-5 text-sm leading-7 text-gray-400 sm:text-base">
              LuckyChain is built around smart contract execution,
              blockchain transparency and verifiable randomness.
              Its core lottery operations are designed to be independently
              inspectable rather than hidden behind a centralized system.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature.number}
                className="rounded-2xl border border-white/[0.08] bg-black/20 p-6 transition duration-300 hover:border-violet-400/30 hover:bg-white/[0.035]"
              >
                <span className="text-xs font-bold tracking-wider text-violet-400">
                  {feature.number}
                </span>

                <h3 className="mt-5 text-lg font-bold text-white">
                  {feature.title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-gray-400">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-black/20 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">
                Built with Ethereum & Chainlink
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Smart contract powered · Sepolia test environment
              </p>
            </div>

            <span className="w-fit rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-1.5 text-xs font-medium text-emerald-400">
              Verification-focused architecture
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

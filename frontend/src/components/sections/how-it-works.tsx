const steps = [
  {
    number: "01",
    label: "WALLET",
    title: "Connect your wallet",
    description:
      "Connect your Ethereum wallet and switch to the Sepolia test network to interact with LuckyChain.",
  },
  {
    number: "02",
    label: "PARTICIPATION",
    title: "Enter the lottery",
    description:
      "Pay the fixed entry fee to register your participation in the current lottery round.",
  },
  {
    number: "03",
    label: "RANDOMNESS",
    title: "Verifiable winner selection",
    description:
      "Chainlink VRF supplies verifiable randomness for selecting a winner, making the selection independently verifiable.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="mx-auto mt-28 max-w-6xl px-5 lg:px-8"
    >
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-400">
          Simple & transparent
        </p>

        <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
          How LuckyChain works
        </h2>

        <p className="mt-4 text-sm leading-7 text-gray-400 sm:text-base">
          Three straightforward steps connect your wallet to a lottery
          powered by blockchain technology and verifiable randomness.
        </p>
      </div>

      <div className="relative grid gap-5 md:grid-cols-3">
        <div className="pointer-events-none absolute left-[17%] right-[17%] top-9 hidden h-px bg-gradient-to-r from-violet-500/40 via-indigo-400/40 to-violet-500/40 md:block" />

        {steps.map((item) => (
          <article
            key={item.number}
            className="group relative rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.045] to-white/[0.015] p-7 transition duration-300 hover:-translate-y-1 hover:border-violet-400/30 hover:bg-white/[0.045]"
          >
            <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-xl border border-violet-400/20 bg-[#17142b] text-sm font-black text-violet-300 shadow-lg shadow-violet-950/20 transition duration-300 group-hover:border-violet-400/50 group-hover:bg-violet-500/15">
              {item.number}
            </div>

            <p className="mt-8 text-[10px] font-bold tracking-[0.2em] text-violet-400">
              {item.label}
            </p>

            <h3 className="mt-3 text-xl font-bold tracking-tight text-white">
              {item.title}
            </h3>

            <p className="mt-4 text-sm leading-7 text-gray-400">
              {item.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

"use client";

import { Navbar } from "@/src/components/layout/navbar";
import { Footer } from "@/src/components/layout/footer";
import { Hero } from "@/src/components/sections/hero";
import { HowItWorks } from "@/src/components/sections/how-it-works";
import { Transparency } from "@/src/components/sections/transparency";
import { LotteryCard } from "@/src/components/lottery/lottery-card";
import { LotteryStats } from "@/src/components/lottery/lottery-stats";
import { PlayerRewards } from "@/src/components/lottery/player-rewards";
import { ManagerPanel } from "@/src/components/lottery/manager-panel";
import { LotteryActivity } from "@/src/components/lottery/lottery-activity";
import { HistoricalResults } from "@/src/components/lottery/historical-results";
import { WalletStatus } from "@/src/components/wallet/wallet-status";
import { NetworkSwitcher } from "@/src/components/wallet/network-switcher";

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#080912] text-white">
      {/* Background effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-60 left-1/3 h-[500px] w-[500px] rounded-full bg-violet-700/10 blur-[150px]" />
        <div className="absolute top-[500px] -right-40 h-[400px] w-[400px] rounded-full bg-indigo-600/10 blur-[140px]" />
      </div>

      <Navbar />

      {/* Main content */}
      <section className="relative z-10 mx-auto max-w-7xl px-5 pb-20 pt-16 lg:px-8 lg:pt-24">
<Hero />

        <LotteryCard />

                <LotteryStats />

        <HistoricalResults />

        <PlayerRewards />

        <ManagerPanel />

                <WalletStatus />
                <NetworkSwitcher />

                <HowItWorks />

        <Transparency />

        <LotteryActivity />
      </section>

      <Footer />
    </main>
  );
}

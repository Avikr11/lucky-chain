import type { Metadata } from "next";
import { Providers } from "@/src/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "LuckyChain | Decentralized Lottery",
  description:
    "A transparent, decentralized lottery powered by Ethereum and Chainlink VRF.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { WalletProviders } from "@/components/shared/WalletProviders";
import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";

export const metadata: Metadata = {
  title: "DojoPay — earn SOL for micro-tasks",
  description:
    "A Solana task marketplace. Creators fund tasks, workers complete them and get paid in SOL.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50">
        <WalletProviders>{children}</WalletProviders>
      </body>
    </html>
  );
}

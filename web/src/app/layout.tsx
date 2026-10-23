import type { Metadata } from "next";
import "./globals.css";
import { Web3Provider } from "@/context/Web3Context";

export const metadata: Metadata = {
  title: "MediChain — Secure Inter-Hospital Medical Record Sharing",
  description:
    "Decentralized, patient-controlled cryptographic medical ledger with off-chain zero-knowledge ciphertext storage and instant mathematical authenticity verification.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#F6F4EF] text-[#0F1F2E] antialiased min-h-screen">
        <Web3Provider>
          {children}
        </Web3Provider>
      </body>
    </html>
  );
}

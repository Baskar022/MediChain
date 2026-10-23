"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useWeb3, DEMO_ACCOUNTS, SOVEREIGN_NETWORKS, SovereignNetwork } from "@/context/Web3Context";
import {
  Wallet,
  ShieldCheck,
  Check,
  ChevronDown,
  LogOut,
  Lock,
  Search,
  ChevronRight,
} from "lucide-react";

export function Header() {
  const pathname = usePathname();
  const {
    account,
    role,
    activeNetwork,
    setActiveNetwork,
    isConnecting,
    connectWallet,
    disconnectWallet,
    signInWithEthereum,
    isAuthenticated,
  } = useWeb3();

  const [showNetworkMenu, setShowNetworkMenu] = useState(false);

  const getBreadcrumbs = (path: string) => {
    const parts = path.split("/").filter(Boolean);
    if (parts.length === 0) return [{ label: "Dashboard", href: "/dashboard" }];

    const breadcrumbs = [];
    let currentHref = "";
    for (const part of parts) {
      currentHref += `/${part}`;
      let label = part;
      if (part === "doctor") label = "Clinical";
      else if (part === "patient") label = "Patient";
      else if (part === "admin") label = "Consortium";
      else if (part === "records") label = "Records";
      else if (part === "upload") label = "Upload & Sign";
      else if (part === "consents") label = "Consents";
      else if (part === "federation") label = "Federation";
      else if (part === "inspector") label = "Inspector";
      else if (part === "explorer") label = "Chain Explorer";
      else if (part === "verify") label = "Public Verifier";
      else if (part === "emergency") label = "Emergency";
      else if (part === "register") label = "Register";
      breadcrumbs.push({ label, href: currentHref });
    }
    return breadcrumbs;
  };

  const getPageTitle = (path: string) => {
    if (path.includes("/patient/records")) return "My Medical Records";
    if (path.includes("/patient/consents")) return "Active Access Consents";
    if (path.includes("/patient/register")) return "Register Sovereign Patient";
    if (path.includes("/doctor/upload")) return "Upload & Sign Clinical Record";
    if (path.includes("/doctor/records")) return "Patient Directory & Records";
    if (path.includes("/doctor/emergency")) return "Emergency Break-Glass Protocol";
    if (path.includes("/admin/federation")) return "Federation Registry & Interop Portal";
    if (path.includes("/admin/hospitals")) return "Hospital Consortium Registry";
    if (path.includes("/admin/inspector")) return "Zero-PHI Storage Inspector";
    if (path.includes("/explorer")) return "Multi-Chain Block & Ledger Explorer";
    if (path.includes("/audit")) return "Consortium Audit Trail";
    if (path.includes("/verify")) return "Public Mathematical Record Verifier";
    if (path.includes("/demo/tamper")) return "Live Tamper & Integrity Demo";
    if (path.includes("/dashboard")) return "System Overview & Telemetry";
    return "MediChain Portal";
  };

  const openCommandPalette = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
  };

  const crumbs = getBreadcrumbs(pathname);

  return (
    <header className="h-16 bg-white border-b border-[#E4DFD5] px-6 flex items-center justify-between shrink-0 select-none">
      {/* Page Title & Breadcrumb Navigation */}
      <div className="flex flex-col justify-center">
        <h1 className="font-serif text-base text-[#0F1F2E] font-bold tracking-tight">
          {getPageTitle(pathname)}
        </h1>
        <nav aria-label="Breadcrumb" className="flex items-center space-x-1 text-[11px] font-mono text-[#6B7A88]">
          <Link href="/dashboard" className="hover:text-[#0F1F2E] transition-colors">
            Consortium
          </Link>
          {crumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.href}>
              <ChevronRight className="w-3 h-3 text-[#9BA6B0]" />
              {idx === crumbs.length - 1 ? (
                <span className="text-[#0F1F2E] font-medium capitalize">{crumb.label}</span>
              ) : (
                <Link href={crumb.href} className="hover:text-[#0F1F2E] transition-colors capitalize">
                  {crumb.label}
                </Link>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-3">
        {/* Command Palette Trigger */}
        <button
          onClick={openCommandPalette}
          className="hidden sm:flex items-center space-x-2 px-2.5 py-1.5 bg-[#F6F4EF] hover:bg-[#EAE6DD] border border-[#E4DFD5] rounded-sm text-xs text-[#6B7A88] transition-colors"
          title="Open Command Palette (Ctrl+K)"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Search...</span>
          <kbd className="font-mono text-[10px] bg-white px-1 py-0.2 border border-[#E4DFD5] rounded-sm text-[#0F1F2E]">
            Ctrl+K
          </kbd>
        </button>

        {/* Sovereign Network Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNetworkMenu(!showNetworkMenu)}
            className="flex items-center space-x-2 bg-[#F6F4EF] hover:bg-[#EAE6DD] border border-[#E4DFD5] px-3 py-1.5 rounded-sm text-xs transition-colors"
            title="Click to switch active sovereign hospital chain"
          >
            <div className={`w-2 h-2 rounded-full ${activeNetwork.type === "EVM" ? "bg-emerald-500" : "bg-purple-500"}`} />
            <span className="text-[#0F1F2E] font-medium truncate max-w-[150px] sm:max-w-none">
              {activeNetwork.name}
            </span>
            <span className={`hidden sm:inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-semibold ${
              activeNetwork.type === "EVM"
                ? "bg-blue-50 text-blue-700 border border-blue-200"
                : "bg-purple-50 text-purple-700 border border-purple-200"
            }`}>
              {activeNetwork.badgeLabel}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#6B7A88]" />
          </button>

          {showNetworkMenu && (
            <div className="absolute right-0 mt-1.5 w-72 bg-white border border-[#E4DFD5] rounded-sm shadow-dropdown z-50 py-1.5 text-xs">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-[#6B7A88] uppercase tracking-wider border-b border-[#E4DFD5] font-mono">
                Switch Sovereign Chain
              </div>
              {SOVEREIGN_NETWORKS.map((net) => (
                <button
                  key={net.id}
                  onClick={() => {
                    setActiveNetwork(net);
                    setShowNetworkMenu(false);
                  }}
                  className={`w-full text-left px-3 py-2 flex items-start space-x-2.5 hover:bg-[#F6F4EF] transition-colors ${
                    activeNetwork.id === net.id ? "bg-[#F6F4EF] border-l-2 border-[#1F7A7A]" : ""
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${net.type === "EVM" ? "bg-emerald-500" : "bg-purple-500"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[#0F1F2E] flex items-center justify-between">
                      <span className="truncate">{net.name}</span>
                      {activeNetwork.id === net.id && <Check className="w-3.5 h-3.5 text-[#1F7A7A] shrink-0 ml-1" />}
                    </div>
                    <div className="text-[10px] text-[#6B7A88] mt-0.5 flex items-center space-x-2 font-mono">
                      <span>Port {net.port}</span>
                      <span>&bull;</span>
                      <span>{net.type === "EVM" ? `Chain ${net.chainId}` : "Permissioned Ledger"}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* SIWE Status */}
        {account && (
          <div>
            {isAuthenticated ? (
              <div className="hidden md:flex items-center space-x-1.5 bg-[#EBF5F0] text-[#2E7D5B] border border-[#2E7D5B]/30 px-2.5 py-1.5 rounded-sm text-xs font-mono font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-[#2E7D5B]" />
                <span>SIWE Verified</span>
              </div>
            ) : (
              <button
                onClick={() => signInWithEthereum()}
                className="flex items-center space-x-1.5 bg-[#FEF7EA] hover:bg-[#FCEFD9] text-[#D98E04] border border-[#D98E04]/40 px-2.5 py-1.5 rounded-sm text-xs font-medium transition-colors"
              >
                <Lock className="w-3.5 h-3.5 text-[#D98E04]" />
                <span>Sign In with Ethereum</span>
              </button>
            )}
          </div>
        )}

        {/* Wallet Connect / Account Pill */}
        {account ? (
          <div className="flex items-center space-x-2">
            <div className="bg-[#F6F4EF] border border-[#E4DFD5] px-3 py-1.5 rounded-sm flex items-center space-x-2 text-xs font-mono text-[#0F1F2E]">
              <span className="w-2 h-2 rounded-full bg-[#1F7A7A]" />
              <span>{account.slice(0, 6)}...{account.slice(-4)}</span>
            </div>
            <button
              onClick={disconnectWallet}
              title="Disconnect Wallet"
              className="p-1.5 text-[#6B7A88] hover:text-[#B3402F] hover:bg-red-50 rounded-sm border border-transparent hover:border-red-200 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className="flex items-center space-x-2 bg-[#1F7A7A] hover:bg-[#176161] text-white px-3.5 py-1.5 rounded-sm text-xs font-medium transition-colors shadow-card disabled:opacity-50"
          >
            <Wallet className="w-4 h-4" />
            <span>{isConnecting ? "Connecting..." : "Connect MetaMask"}</span>
          </button>
        )}
      </div>
    </header>
  );
}

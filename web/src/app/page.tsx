"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useWeb3, DEMO_ACCOUNTS } from "@/context/Web3Context";
import { BrandLogo, GeometricMark } from "@/components/ui/BrandLogo";
import { PROJECT_INFO } from "@/config/project-info";
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Lock,
  EyeOff,
  ExternalLink,
  ChevronRight,
  FileText,
  Building2,
  Users,
  Search,
  Database,
  Network,
  Cpu,
  Layers,
  KeyRound,
  FileCheck2,
} from "lucide-react";

export default function EditorialLandingPage() {
  const { account, selectDemoAccount } = useWeb3();

  return (
    <div className="min-h-screen bg-[#F6F4EF] text-[#0F1F2E] flex flex-col justify-between selection:bg-[#1F7A7A] selection:text-white">
      {/* Editorial Top Navigation */}
      <header className="border-b border-[#E4DFD5] bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <BrandLogo size="md" showWordmark={true} showSubtitle={true} asLink={false} />
            <span className="hidden lg:inline-block text-[11px] font-mono text-[#6B7A88] border-l border-[#E4DFD5] pl-6">
              Sovereign Cross-Chain Medical Consortium
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <Link
              href="/verify"
              className="text-xs font-mono font-medium text-[#0F1F2E] hover:text-[#1F7A7A] transition-colors hidden sm:block px-2.5 py-1.5"
            >
              Public Verifier
            </Link>
            <Link
              href="/explorer"
              className="text-xs font-mono font-medium text-[#0F1F2E] hover:text-[#1F7A7A] transition-colors hidden sm:block px-2.5 py-1.5"
            >
              Block Explorer
            </Link>
            <Link
              href="/dashboard"
              className="bg-[#1F7A7A] hover:bg-[#176161] text-white px-4 py-2 rounded-sm text-xs font-medium transition-colors shadow-card flex items-center space-x-2"
            >
              <span>Access Consortium Portal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Editorial Content Container */}
      <main className="max-w-7xl mx-auto px-6 py-12 md:py-16 space-y-16 flex-1">
        {/* Asymmetrical Editorial Header Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start border-b border-[#E4DFD5] pb-16">
          {/* Left Column (Editorial Typography & Mission) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center space-x-2 bg-[#EAF3F3] border border-[#C8D9D2] px-3 py-1 rounded-sm text-[11px] font-mono text-[#1F7A7A] uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-[#1F7A7A]" />
              <span>Multi-Chain Architecture • Zero-PHI Off-Chain Storage</span>
            </div>

            <h1 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight text-[#0F1F2E] leading-[1.12]">
              Sovereign cross-chain medical record sharing with mathematical proof.
            </h1>

            <p className="text-base sm:text-lg text-[#4A5866] leading-relaxed max-w-2xl font-normal">
              A decentralized framework enabling hospitals running heterogeneous blockchains—both EVM-compatible
              ledgers and permissioned diagnostic ledgers—to verify document authenticity and honor patient consent
              without exposing protected health information.
            </p>

            {/* Call to Action Buttons */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Link
                href="/dashboard"
                className="bg-[#1F7A7A] hover:bg-[#176161] text-white px-5 py-2.5 rounded-sm text-xs font-medium transition-colors shadow-card flex items-center space-x-2"
              >
                <span>Enter Consortium Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>

              <Link
                href="/verify"
                className="bg-white hover:bg-[#F2EFE9] text-[#0F1F2E] border border-[#E4DFD5] px-4 py-2.5 rounded-sm text-xs font-medium transition-colors"
              >
                Verify Any Document Hash
              </Link>

              <Link
                href="/demo/tamper"
                className="bg-[#FEF7EA] hover:bg-[#FCEFD7] text-[#9A6400] border border-[#F4DCB0] px-4 py-2.5 rounded-sm text-xs font-medium transition-colors flex items-center space-x-1.5"
              >
                <span>Adversarial Tamper Demo</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Right Column (High-Density Consortium Status Card) */}
          <div className="lg:col-span-5 bg-white border border-[#E4DFD5] p-6 rounded-sm shadow-card space-y-5">
            <div className="border-b border-[#E4DFD5] pb-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#6B7A88] block">
                  Consortium Status
                </span>
                <span className="font-serif font-bold text-base text-[#0F1F2E]">
                  Heterogeneous Network Federation
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono font-semibold bg-[#EBF5F0] text-[#2E7D5B] border border-[#2E7D5B]/30">
                HEALTHY
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-[#F6F4EF]/50 border border-[#E4DFD5] rounded-sm">
                <div>
                  <div className="font-semibold text-[#0F1F2E]">Network A: City General Hospital</div>
                  <div className="text-[10px] font-mono text-[#6B7A88]">EVM Hardhat / Anvil • Port 8545 • Chain ID 31337</div>
                </div>
                <span className="w-2 h-2 rounded-full bg-[#2E7D5B]" />
              </div>

              <div className="flex items-center justify-between p-2.5 bg-[#F6F4EF]/50 border border-[#E4DFD5] rounded-sm">
                <div>
                  <div className="font-semibold text-[#0F1F2E]">Network B: Regional Specialty Hospital</div>
                  <div className="text-[10px] font-mono text-[#6B7A88]">EVM Hardhat / Anvil • Port 8546 • Chain ID 31338</div>
                </div>
                <span className="w-2 h-2 rounded-full bg-[#2E7D5B]" />
              </div>

              <div className="flex items-center justify-between p-2.5 bg-[#F6F4EF]/50 border border-[#E4DFD5] rounded-sm">
                <div>
                  <div className="font-semibold text-[#0F1F2E]">Network C: Metro Diagnostics Lab</div>
                  <div className="text-[10px] font-mono text-[#6B7A88]">Fabric-Style Simulated Ledger • Port 9000</div>
                </div>
                <span className="w-2 h-2 rounded-full bg-[#2E7D5B]" />
              </div>

              <div className="flex items-center justify-between p-2.5 bg-[#F6F4EF]/50 border border-[#E4DFD5] rounded-sm">
                <div>
                  <div className="font-semibold text-[#0F1F2E]">Federation Interoperability Registry</div>
                  <div className="text-[10px] font-mono text-[#6B7A88]">Hub Chain • Port 8547 • Chain ID 31340</div>
                </div>
                <span className="w-2 h-2 rounded-full bg-[#2E7D5B]" />
              </div>
            </div>

            <div className="pt-2 border-t border-[#E4DFD5] flex items-center justify-between text-[11px] font-mono text-[#6B7A88]">
              <span>Zero-PHI Guarantee</span>
              <span className="text-[#0F1F2E] font-medium">Mathematical Non-Repudiation</span>
            </div>
          </div>
        </section>

        {/* Hand-Built SVG Architecture Diagram (Record Journey Between Heterogeneous Chains) */}
        <section className="space-y-6">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#1F7A7A] font-semibold">
              System Architecture
            </span>
            <h2 className="font-serif text-2xl font-bold text-[#0F1F2E]">
              Cross-Chain Verification & Interoperability Trace
            </h2>
            <p className="text-xs text-[#6B7A88] max-w-2xl">
              How a clinical record created on an EVM sovereign chain is transferred, re-wrapped, and verified on a
              non-EVM permissioned ledger via cryptographic inclusion proofs.
            </p>
          </div>

          <div className="bg-white border border-[#E4DFD5] p-6 rounded-sm shadow-card overflow-x-auto">
            <svg
              viewBox="0 0 960 340"
              className="w-full min-w-[760px] text-[#0F1F2E] font-sans"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Background Zones */}
              {/* Zone 1: Network A (EVM) */}
              <rect x="10" y="10" width="280" height="320" rx="4" fill="#FBF9F5" stroke="#E4DFD5" strokeWidth="1" />
              <text x="25" y="38" className="text-xs font-mono font-bold" fill="#0F1F2E">
                NETWORK A: CITY GENERAL
              </text>
              <text x="25" y="55" className="text-[10px] font-mono" fill="#1F7A7A">
                EVM Architecture (Chain ID 31337)
              </text>

              {/* Step 1: Doctor Upload & Client-Side Encryption */}
              <rect x="25" y="75" width="250" height="60" rx="3" fill="#FFFFFF" stroke="#E4DFD5" />
              <text x="35" y="98" className="text-xs font-semibold" fill="#0F1F2E">
                1. Client-Side AES-256-GCM
              </text>
              <text x="35" y="116" className="text-[10px] font-mono" fill="#6B7A88">
                Raw file never leaves browser in plaintext
              </text>

              {/* Step 2: Hash & ECDSA Signature */}
              <rect x="25" y="148" width="250" height="65" rx="3" fill="#FFFFFF" stroke="#E4DFD5" />
              <text x="35" y="170" className="text-xs font-semibold" fill="#0F1F2E">
                2. Dual SHA-256 & Doctor ECDSA
              </text>
              <text x="35" y="188" className="text-[10px] font-mono" fill="#6B7A88">
                H(Plaintext) signed with physician key
              </text>
              <text x="35" y="202" className="text-[9px] font-mono" fill="#D98E04">
                Anchored to RecordRegistry.sol
              </text>

              {/* Step 3: Off-chain Ciphertext Storage */}
              <rect x="25" y="225" width="250" height="65" rx="3" fill="#FFFFFF" stroke="#E4DFD5" />
              <text x="35" y="248" className="text-xs font-semibold" fill="#0F1F2E">
                3. Off-Chain Zero-PHI Store
              </text>
              <text x="35" y="266" className="text-[10px] font-mono" fill="#6B7A88">
                storage/{`{recordId}`}.enc written to disk
              </text>
              <text x="35" y="279" className="text-[9px] font-mono" fill="#1F7A7A">
                Only ciphertext + hashes stored
              </text>

              {/* Arrow 1 -> Zone 2 */}
              <path d="M290 180 H350" stroke="#1F7A7A" strokeWidth="2" strokeDasharray="4 4" />
              <polygon points="350,176 358,180 350,184" fill="#1F7A7A" />
              <text x="295" y="170" className="text-[9px] font-mono" fill="#1F7A7A">
                Proof Packet
              </text>

              {/* Zone 2: Interop Gateway Hub */}
              <rect x="360" y="10" width="240" height="320" rx="4" fill="#F4F8F8" stroke="#C8D9D2" strokeWidth="1" />
              <text x="375" y="38" className="text-xs font-mono font-bold" fill="#0F1F2E">
                INTEROP RELAYER HUB
              </text>
              <text x="375" y="55" className="text-[10px] font-mono" fill="#1F7A7A">
                Federation Registry (Chain ID 31340)
              </text>

              {/* Hub Step A: Inclusion Proof & Attestation */}
              <rect x="375" y="75" width="210" height="95" rx="3" fill="#FFFFFF" stroke="#C8D9D2" />
              <text x="385" y="98" className="text-xs font-semibold" fill="#0F1F2E">
                4. Gateway Attestation
              </text>
              <text x="385" y="118" className="text-[10px] font-mono" fill="#6B7A88">
                • Verifies Network A block inclusion
              </text>
              <text x="385" y="134" className="text-[10px] font-mono" fill="#6B7A88">
                • Verifies active patient consent ticket
              </text>
              <text x="385" y="150" className="text-[10px] font-mono" fill="#2E7D5B">
                • Signs attestation envelope (secp256k1)
              </text>

              {/* Hub Step B: Key Re-wrapping (ECIES) */}
              <rect x="375" y="185" width="210" height="95" rx="3" fill="#FFFFFF" stroke="#C8D9D2" />
              <text x="385" y="208" className="text-xs font-semibold" fill="#0F1F2E">
                5. ECIES Key Re-Wrapping
              </text>
              <text x="385" y="228" className="text-[10px] font-mono" fill="#6B7A88">
                Patient encrypts symmetric AES key
              </text>
              <text x="385" y="244" className="text-[10px] font-mono" fill="#6B7A88">
                for Recipient Public Key (secp256k1)
              </text>
              <text x="385" y="260" className="text-[9px] font-mono" fill="#D98E04">
                Zero hospital collusion possible
              </text>

              {/* Arrow 2 -> Zone 3 */}
              <path d="M600 180 H660" stroke="#1F7A7A" strokeWidth="2" strokeDasharray="4 4" />
              <polygon points="660,176 668,180 660,184" fill="#1F7A7A" />
              <text x="605" y="170" className="text-[9px] font-mono" fill="#1F7A7A">
                Anchor Tx
              </text>

              {/* Zone 3: Network C (Fabric-Style Simulated Ledger) */}
              <rect x="670" y="10" width="280" height="320" rx="4" fill="#FBF9F5" stroke="#E4DFD5" strokeWidth="1" />
              <text x="685" y="38" className="text-xs font-mono font-bold" fill="#0F1F2E">
                NETWORK C: METRO LAB
              </text>
              <text x="685" y="55" className="text-[10px] font-mono" fill="#1F7A7A">
                Fabric-Style Simulated Ledger (Port 9000)
              </text>

              {/* Target Step 1: Ledger Anchoring */}
              <rect x="685" y="75" width="250" height="95" rx="3" fill="#FFFFFF" stroke="#E4DFD5" />
              <text x="695" y="98" className="text-xs font-semibold" fill="#0F1F2E">
                6. Heterogeneous Anchoring
              </text>
              <text x="695" y="118" className="text-[10px] font-mono" fill="#6B7A88">
                FabricAdapter registers foreign proof:
              </text>
              <text x="695" y="134" className="text-[10px] font-mono" fill="#6B7A88">
                recordId, sourceChain, hashes, signatures
              </text>
              <text x="695" y="150" className="text-[9px] font-mono" fill="#2E7D5B">
                Committed to ledger state on disk
              </text>

              {/* Target Step 2: Recipient Verification */}
              <rect x="685" y="185" width="250" height="95" rx="3" fill="#FFFFFF" stroke="#E4DFD5" />
              <text x="695" y="208" className="text-xs font-semibold" fill="#0F1F2E">
                7. Mathematical Verification
              </text>
              <text x="695" y="228" className="text-[10px] font-mono" fill="#6B7A88">
                1. Recipient un-wraps key via ECIES private key
              </text>
              <text x="695" y="244" className="text-[10px] font-mono" fill="#6B7A88">
                2. Decrypts AES ciphertext locally
              </text>
              <text x="695" y="260" className="text-[10px] font-mono text-[#2E7D5B] font-bold">
                3. Recalculates SHA-256 = MATCH CONFIRMED
              </text>
            </svg>
          </div>
        </section>

        {/* Two-Column Comparison: "What Stays Private / What Goes On-Chain" */}
        <section className="space-y-6 border-t border-[#E4DFD5] pt-16">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#1F7A7A] font-semibold">
              Zero-Knowledge Principles
            </span>
            <h2 className="font-serif text-2xl font-bold text-[#0F1F2E]">
              What Stays Private vs. What Goes On-Chain
            </h2>
            <p className="text-xs text-[#6B7A88] max-w-2xl">
              Strict cryptographic division of patient data. Raw clinical information is mathematically segregated
              from public ledger immutability.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: What Stays Strictly Private */}
            <div className="bg-white border-2 border-[#1A2E40] p-6 rounded-sm shadow-card space-y-4">
              <div className="flex items-center space-x-3 border-b border-[#E4DFD5] pb-3">
                <div className="w-8 h-8 rounded-sm bg-[#0F1F2E] flex items-center justify-center text-white">
                  <EyeOff className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-[#0F1F2E]">
                    What Stays Strictly Private (Off-Chain)
                  </h3>
                  <span className="text-[10px] font-mono text-[#6B7A88]">
                    Zero Protected Health Information (Zero-PHI)
                  </span>
                </div>
              </div>

              <ul className="space-y-3 text-xs text-[#4A5866]">
                <li className="flex items-start space-x-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B3402F] mt-1.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-[#0F1F2E]">Patient Legal Identity:</span> Names, government IDs,
                    addresses, phone numbers, and emergency contacts are never broadcast or committed to any chain.
                  </div>
                </li>
                <li className="flex items-start space-x-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B3402F] mt-1.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-[#0F1F2E]">Clinical Diagnostics & Notes:</span> Medical history,
                    laboratory values, physician observations, prescriptions, and diagnoses remain encrypted at rest.
                  </div>
                </li>
                <li className="flex items-start space-x-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B3402F] mt-1.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-[#0F1F2E]">Medical Files & Scans:</span> Diagnostic PDFs, high-resolution
                    radiology images (DICOM/JPG), and laboratory reports are stored only as AES-256-GCM ciphertexts.
                  </div>
                </li>
                <li className="flex items-start space-x-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B3402F] mt-1.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-[#0F1F2E]">Unwrapped Symmetric Keys:</span> Ephemeral 256-bit encryption
                    keys exist only in local browser memory and are never persisted unencrypted.
                  </div>
                </li>
              </ul>
            </div>

            {/* Right: What Goes On-Chain */}
            <div className="bg-white border-2 border-[#1F7A7A] p-6 rounded-sm shadow-card space-y-4">
              <div className="flex items-center space-x-3 border-b border-[#E4DFD5] pb-3">
                <div className="w-8 h-8 rounded-sm bg-[#1F7A7A] flex items-center justify-center text-white">
                  <ShieldCheck className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-[#0F1F2E]">
                    What Goes On-Chain (Immutable Ledger)
                  </h3>
                  <span className="text-[10px] font-mono text-[#1F7A7A]">
                    Cryptographic Proofs & Verifiable Claims Only
                  </span>
                </div>
              </div>

              <ul className="space-y-3 text-xs text-[#4A5866]">
                <li className="flex items-start space-x-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1F7A7A] mt-1.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-[#0F1F2E]">Pseudonymous Identity Digest:</span> Salted cryptographic
                    hash representing the patient identity, allowing proof of ownership without revealing identity.
                  </div>
                </li>
                <li className="flex items-start space-x-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1F7A7A] mt-1.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-[#0F1F2E]">Dual SHA-256 Commitments:</span> Plaintext hash (for legal
                    attestation) and ciphertext hash (for storage integrity) pinned immutably on-chain.
                  </div>
                </li>
                <li className="flex items-start space-x-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1F7A7A] mt-1.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-[#0F1F2E]">Physician Attestation (ECDSA):</span> Digital signature
                    of the attending physician proving non-repudiable legal authorship.
                  </div>
                </li>
                <li className="flex items-start space-x-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1F7A7A] mt-1.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-[#0F1F2E]">ECIES Encapsulated Keys:</span> Symmetric file keys wrapped
                    exclusively for the public key of the authorized recipient hospital.
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Quick Demo Accounts for Live Live Evaluators */}
        <section className="bg-white border border-[#E4DFD5] p-6 rounded-sm shadow-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E4DFD5] pb-3">
            <div>
              <h3 className="font-serif font-bold text-sm text-[#0F1F2E]">
                Direct Evaluator Accounts
              </h3>
              <p className="text-xs text-[#6B7A88]">
                Click any role to test sovereign permissions, record upload, cross-chain transfer, or consent revocation.
              </p>
            </div>
            <span className="text-[10px] font-mono text-[#1F7A7A] bg-[#EAF3F3] px-2.5 py-1 rounded-sm border border-[#C8D9D2] self-start sm:self-auto font-semibold">
              LOCAL TESTNET SPONSORSHIP ACTIVE
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {DEMO_ACCOUNTS.map((acc) => (
              <Link
                key={acc.address}
                href="/dashboard"
                onClick={() => selectDemoAccount(acc)}
                className="group border border-[#E4DFD5] hover:border-[#1F7A7A] hover:bg-[#FBF9F5] p-3 rounded-sm transition-all text-left block"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#0F1F2E] group-hover:text-[#1F7A7A]">
                    {acc.name}
                  </span>
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-sm bg-[#F6F4EF] text-[#4A5866] border border-[#E4DFD5]">
                    {acc.role}
                  </span>
                </div>
                <div className="text-[11px] text-[#6B7A88] mt-1">{acc.label}</div>
                <div className="text-[10px] font-mono text-[#9BA6B0] mt-2 truncate">
                  {acc.address}
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>

      {/* Institutional Project Footer (Backed by project-info.ts) */}
      <footer className="border-t border-[#E4DFD5] bg-white py-10 mt-16 text-xs text-[#6B7A88]">
        <div className="max-w-7xl mx-auto px-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 border-b border-[#E4DFD5] pb-8">
            <div className="space-y-2 md:col-span-2">
              <BrandLogo size="md" showWordmark={true} showSubtitle={true} asLink={false} />
              <p className="text-xs text-[#4A5866] max-w-md pt-1">
                {PROJECT_INFO.tagline}
              </p>
              <div className="text-[11px] font-mono text-[#6B7A88] pt-1">
                {PROJECT_INFO.institutionName} • {PROJECT_INFO.university} ({PROJECT_INFO.academicYear})
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#0F1F2E] block">
                Project Supervision
              </span>
              <div className="text-xs font-semibold text-[#0F1F2E]">{PROJECT_INFO.guide.name}</div>
              <div className="text-[11px] text-[#6B7A88]">{PROJECT_INFO.guide.designation}</div>
              <div className="text-[11px] text-[#6B7A88]">{PROJECT_INFO.guide.department}</div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#0F1F2E] block">
                Engineering Team
              </span>
              {PROJECT_INFO.team.map((m, idx) => (
                <div key={idx} className="text-xs">
                  <span className="font-semibold text-[#0F1F2E]">{m.name}</span>
                  <span className="block text-[10px] text-[#6B7A88]">{m.role}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] font-mono">
            <div>
              License: <span className="text-[#0F1F2E] font-medium">{PROJECT_INFO.license}</span>
            </div>
            <div className="flex items-center space-x-4">
              <span>Next.js 14 App Router</span>
              <span>•</span>
              <span>Solidity ^0.8.24</span>
              <span>•</span>
              <span>AES-256-GCM + ECIES</span>
              <span>•</span>
              <span>Version {PROJECT_INFO.version}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

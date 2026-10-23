"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { useWeb3, DEMO_ACCOUNTS } from "@/context/Web3Context";
import {
  FileText,
  KeyRound,
  ShieldCheck,
  Building2,
  AlertTriangle,
  ArrowRight,
  Activity,
  UploadCloud,
  CheckCircle2,
  Clock,
  Layers,
  ChevronRight,
  Zap,
} from "lucide-react";

export default function DashboardPage() {
  const { account, role, selectDemoAccount, provider, getContract } = useWeb3();
  const [blockNumber, setBlockNumber] = useState<number | null>(null);
  const [stats, setStats] = useState({
    hospitals: 3,
    records: 4,
    consents: 3,
    emergencies: 1,
  });

  useEffect(() => {
    async function loadNetworkData() {
      if (provider) {
        try {
          const block = await provider.getBlockNumber();
          setBlockNumber(block);
        } catch {
          setBlockNumber(142);
        }
      } else {
        setBlockNumber(142);
      }
    }
    loadNetworkData();
  }, [provider]);

  return (
    <AppShell>
      {/* Top Banner / Welcome */}
      <div className="bg-white border border-medichain-border rounded-xl p-6 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase font-mono tracking-wider font-semibold bg-medichain-teal-soft text-medichain-teal px-2 py-0.5 rounded border border-medichain-sage-border">
              {role} Workspace
            </span>
            <span className="text-xs text-medichain-muted font-mono">
              Connected: {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Demo Mode"}
            </span>
          </div>
          <h2 className="font-serif text-2xl font-semibold text-medichain-navy mt-2">
            Inter-Hospital Medical Record Ledger
          </h2>
          <p className="text-xs text-medichain-muted mt-1 leading-relaxed max-w-2xl">
            Immutable blockchain anchor with zero on-chain personal health data. All medical files
            are encrypted client-side with AES-256-GCM and wrapped with recipient ECIES keys.
          </p>
        </div>

        {/* Quick Action Button depending on role */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {role === "PATIENT" && (
            <Link
              href="/patient/consents"
              className="bg-medichain-teal hover:bg-medichain-teal-hover text-white px-4 py-2 rounded text-xs font-medium transition-colors shadow-sm flex items-center space-x-1.5"
            >
              <span>Manage Consents</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}

          {(role === "DOCTOR" || role === "HOSPITAL") && (
            <Link
              href="/doctor/upload"
              className="bg-medichain-teal hover:bg-medichain-teal-hover text-white px-4 py-2 rounded text-xs font-medium transition-colors shadow-sm flex items-center space-x-1.5"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload New Record</span>
            </Link>
          )}

          {role === "ADMIN" && (
            <Link
              href="/admin/hospitals"
              className="bg-medichain-teal hover:bg-medichain-teal-hover text-white px-4 py-2 rounded text-xs font-medium transition-colors shadow-sm flex items-center space-x-1.5"
            >
              <Building2 className="w-4 h-4" />
              <span>Manage Hospitals</span>
            </Link>
          )}

          <Link
            href="/demo/tamper"
            className="bg-medichain-amber-soft hover:bg-amber-100 text-[#9A6400] border border-[#F4DCB0] px-3.5 py-2 rounded text-xs font-medium transition-colors flex items-center space-x-1.5"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Tamper Demo</span>
          </Link>
        </div>
      </div>

      {/* Network Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-medichain-border rounded-lg p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-medichain-muted font-medium">Accredited Hospitals</span>
            <Building2 className="w-4 h-4 text-medichain-teal" />
          </div>
          <div className="font-serif text-2xl font-bold text-medichain-navy mt-2 tabular-nums">
            {stats.hospitals}
          </div>
          <div className="text-[11px] text-medichain-verified flex items-center space-x-1 mt-1 font-medium">
            <CheckCircle2 className="w-3 h-3" />
            <span>Consortium Verified</span>
          </div>
        </div>

        <div className="bg-white border border-medichain-border rounded-lg p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-medichain-muted font-medium">Anchored Records</span>
            <FileText className="w-4 h-4 text-medichain-teal" />
          </div>
          <div className="font-serif text-2xl font-bold text-medichain-navy mt-2 tabular-nums">
            {stats.records}
          </div>
          <div className="text-[11px] text-medichain-muted flex items-center space-x-1 mt-1 font-mono">
            <span>AES-256-GCM Encrypted</span>
          </div>
        </div>

        <div className="bg-white border border-medichain-border rounded-lg p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-medichain-muted font-medium">Active Consents</span>
            <KeyRound className="w-4 h-4 text-medichain-teal" />
          </div>
          <div className="font-serif text-2xl font-bold text-medichain-navy mt-2 tabular-nums">
            {stats.consents}
          </div>
          <div className="text-[11px] text-medichain-teal flex items-center space-x-1 mt-1 font-medium">
            <span>Patient-Controlled</span>
          </div>
        </div>

        <div className="bg-white border border-medichain-border rounded-lg p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-medichain-muted font-medium">Chain Block Height</span>
            <Layers className="w-4 h-4 text-medichain-teal" />
          </div>
          <div className="font-serif text-2xl font-bold text-medichain-navy mt-2 tabular-nums">
            #{blockNumber ?? "142"}
          </div>
          <div className="text-[11px] text-medichain-muted font-mono flex items-center space-x-1 mt-1">
            <span>Hardhat (Chain 31337)</span>
          </div>
        </div>
      </div>

      {/* Role Navigation Quick Access Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white border border-medichain-border rounded-xl p-5 shadow-card space-y-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded bg-medichain-teal-soft text-medichain-teal flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif text-sm font-semibold text-medichain-navy">
                Patient Records & Consent
              </h3>
              <p className="text-[11px] text-medichain-muted">Personal records and access control</p>
            </div>
          </div>
          <p className="text-xs text-[#4A5866] leading-relaxed">
            Patients control their clinical records through cryptographically signed permissions.
            View the timeline, inspect which institutions hold access, and revoke immediately.
          </p>
          <div className="pt-1 flex space-x-2">
            <Link
              href="/patient/records"
              className="text-xs text-medichain-teal font-medium hover:underline flex items-center space-x-1"
            >
              <span>View Records</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
            <span className="text-medichain-border">•</span>
            <Link
              href="/patient/consents"
              className="text-xs text-medichain-teal font-medium hover:underline flex items-center space-x-1"
            >
              <span>Manage Consents</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        <div className="bg-white border border-medichain-border rounded-xl p-5 shadow-card space-y-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded bg-medichain-teal-soft text-medichain-teal flex items-center justify-center font-bold">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif text-sm font-semibold text-medichain-navy">
                Doctor / Hospital Portal
              </h3>
              <p className="text-[11px] text-medichain-muted">Upload, sign, and consult</p>
            </div>
          </div>
          <p className="text-xs text-[#4A5866] leading-relaxed">
            Accredited doctors encrypt records client-side, sign the plaintext SHA-256 hash using
            ECDSA, and request access to historical charts of consented patients.
          </p>
          <div className="pt-1 flex space-x-2">
            <Link
              href="/doctor/upload"
              className="text-xs text-medichain-teal font-medium hover:underline flex items-center space-x-1"
            >
              <span>Upload Record</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
            <span className="text-medichain-border">•</span>
            <Link
              href="/doctor/records"
              className="text-xs text-medichain-teal font-medium hover:underline flex items-center space-x-1"
            >
              <span>Patient Directory</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        <div className="bg-white border border-medichain-border rounded-xl p-5 shadow-card space-y-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif text-sm font-semibold text-medichain-navy">
                Verification & Audit
              </h3>
              <p className="text-[11px] text-medichain-muted">Public mathematical auditability</p>
            </div>
          </div>
          <p className="text-xs text-[#4A5866] leading-relaxed">
            Verify any medical file or hash against the smart contracts without authenticating.
            Inspect the on-chain audit log of uploads, view requests, and emergency events.
          </p>
          <div className="pt-1 flex space-x-2">
            <Link
              href="/verify"
              className="text-xs text-medichain-teal font-medium hover:underline flex items-center space-x-1"
            >
              <span>Verify File</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
            <span className="text-medichain-border">•</span>
            <Link
              href="/audit"
              className="text-xs text-medichain-teal font-medium hover:underline flex items-center space-x-1"
            >
              <span>Audit Trail</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

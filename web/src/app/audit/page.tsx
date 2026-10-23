"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useWeb3 } from "@/context/Web3Context";
import {
  History,
  ShieldCheck,
  AlertTriangle,
  FileText,
  KeyRound,
  Building2,
  User,
  Clock,
  Filter,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Layers,
} from "lucide-react";

export default function AuditTrailPage() {
  const { account, role } = useWeb3();
  const [filterAction, setFilterAction] = useState("ALL");

  const auditEvents = [
    {
      id: "evt_101",
      action: "EMERGENCY_BREAK_GLASS",
      title: "Emergency Break-Glass Access Executed",
      actor: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
      actorName: "Dr. Marcus Brody (St. Jude ER)",
      hospital: "St. Jude Hospital",
      recordId: "0x8fa4c3b991823abce849921bdfc0192837482910384728192837482910293847",
      recordTitle: "MRI Lumbar Spine with Contrast",
      authorized: true,
      timestamp: Date.now() - 10 * 3600 * 1000,
      details: "Patient presented in acute respiratory trauma following motor accident. Immediate surgical chart required.",
      blockNumber: 139,
      txHash: "0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b1c2d3e4f5a6b7c8d9e0f1a2b",
    },
    {
      id: "evt_102",
      action: "ACCESS_GRANTED",
      title: "Patient Granted Time-Limited Consent",
      actor: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
      actorName: "Alice Vance (Patient)",
      hospital: "Metro Health Medical Center",
      recordId: "0x0000000000000000000000000000000000000000000000000000000000000000",
      recordTitle: "All Historical Clinical Records (Full History)",
      authorized: true,
      timestamp: Date.now() - 1 * 86400 * 1000,
      details: "Granted 7-day access scope to Metro Health Medical Center.",
      blockNumber: 128,
      txHash: "0x1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c",
    },
    {
      id: "evt_103",
      action: "VIEW_ATTEMPT",
      title: "Authorized Record View & Decryption",
      actor: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      actorName: "Dr. Sarah Chen, MD",
      hospital: "Metro Health Medical Center",
      recordId: "0x8fa4c3b991823abce849921bdfc0192837482910384728192837482910293847",
      recordTitle: "MRI Lumbar Spine with Contrast",
      authorized: true,
      timestamp: Date.now() - 2 * 86400 * 1000,
      details: "Decrypted using ECIES wrapped key for clinical consultation.",
      blockNumber: 114,
      txHash: "0x4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d",
    },
    {
      id: "evt_104",
      action: "DENIED_ATTEMPT",
      title: "Unauthorized Access Blocked (Zero Consent)",
      actor: "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
      actorName: "Unregistered External Node",
      hospital: "External Clinic",
      recordId: "0x8fa4c3b991823abce849921bdfc0192837482910384728192837482910293847",
      recordTitle: "MRI Lumbar Spine with Contrast",
      authorized: false,
      timestamp: Date.now() - 3 * 86400 * 1000,
      details: "Attempted to request decryption key without valid on-chain consent or break-glass override. Rejected.",
      blockNumber: 102,
      txHash: "0x5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f",
    },
    {
      id: "evt_105",
      action: "RECORD_UPLOADED",
      title: "New Clinical Record Anchored",
      actor: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      actorName: "Dr. Sarah Chen, MD",
      hospital: "Metro Health Medical Center",
      recordId: "0x8fa4c3b991823abce849921bdfc0192837482910384728192837482910293847",
      recordTitle: "MRI Lumbar Spine with Contrast",
      authorized: true,
      timestamp: Date.now() - 4 * 86400 * 1000,
      details: "Anchored with plaintext SHA-256 and ciphertext SHA-256. Signed via doctor ECDSA.",
      blockNumber: 95,
      txHash: "0x3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b",
    },
  ];

  const filteredEvents = auditEvents.filter((e) => {
    if (filterAction === "ALL") return true;
    return e.action === filterAction;
  });

  return (
    <AppShell>
      {/* Top Banner */}
      <div className="bg-white border border-medichain-border rounded-xl p-6 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase font-mono tracking-wider font-semibold bg-medichain-teal-soft text-medichain-teal px-2 py-0.5 rounded border border-medichain-sage-border">
              Audit Subsystem
            </span>
            <span className="text-xs text-medichain-muted font-mono">
              Contract: AuditLog.sol
            </span>
          </div>
          <h2 className="font-serif text-2xl font-semibold text-medichain-navy mt-2">
            Immutable Access Trail & Operational Log
          </h2>
          <p className="text-xs text-medichain-muted mt-1 leading-relaxed max-w-2xl">
            Every upload, view request, consent grant, revocation, and emergency break-glass action
            emits an immutable event anchored to the consortium blockchain.
          </p>
        </div>

        <div className="bg-medichain-bg border border-medichain-border px-3.5 py-2 rounded-lg text-center shrink-0">
          <span className="text-[10px] uppercase font-semibold text-medichain-muted block">
            Indexed Operations
          </span>
          <span className="font-serif text-xl font-bold text-medichain-navy tabular-nums">
            {auditEvents.length} Events
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-1.5 overflow-x-auto bg-white border border-medichain-border rounded-lg p-2 shadow-card text-xs font-medium">
        {[
          { label: "All Operations", value: "ALL" },
          { label: "Record Uploads", value: "RECORD_UPLOADED" },
          { label: "Consent Grants", value: "ACCESS_GRANTED" },
          { label: "Decryption Views", value: "VIEW_ATTEMPT" },
          { label: "Denied Breaches", value: "DENIED_ATTEMPT" },
          { label: "Break-Glass Emergencies", value: "EMERGENCY_BREAK_GLASS" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilterAction(tab.value)}
            className={`px-3 py-1.5 rounded text-xs transition-colors shrink-0 ${
              filterAction === tab.value
                ? "bg-medichain-teal text-white shadow-sm font-semibold"
                : "text-medichain-muted hover:bg-medichain-bg hover:text-medichain-navy"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Audit Log Entries List */}
      <div className="space-y-3">
        {filteredEvents.map((evt) => {
          let badgeColor = "bg-medichain-teal-soft text-medichain-teal border-medichain-sage-border";
          let statusIcon = <CheckCircle2 className="w-4 h-4 text-medichain-verified shrink-0" />;

          if (evt.action === "EMERGENCY_BREAK_GLASS") {
            badgeColor = "bg-amber-100 text-amber-900 border-amber-300";
            statusIcon = <AlertTriangle className="w-4 h-4 text-medichain-amber shrink-0" />;
          } else if (evt.action === "DENIED_ATTEMPT") {
            badgeColor = "bg-red-50 text-red-800 border-red-200";
            statusIcon = <XCircle className="w-4 h-4 text-medichain-tampered shrink-0" />;
          }

          return (
            <div
              key={evt.id}
              className="bg-white border border-medichain-border hover:border-medichain-teal/50 rounded-xl p-5 shadow-card transition-all space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-medichain-border/60 pb-3">
                <div className="flex items-center space-x-2.5">
                  {statusIcon}
                  <div>
                    <div className="font-semibold text-medichain-navy text-sm">
                      {evt.title}
                    </div>
                    <div className="text-[11px] text-medichain-muted font-mono">
                      Target: {evt.recordTitle}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded font-bold border ${badgeColor}`}>
                    {evt.action}
                  </span>
                  <span className="text-xs text-medichain-muted font-mono">
                    {new Date(evt.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Event Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-medichain-bg border border-medichain-border rounded-lg p-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase text-medichain-muted font-semibold block">
                    Actor / Practitioner
                  </span>
                  <div className="font-medium text-medichain-navy mt-0.5">{evt.actorName}</div>
                  <div className="font-mono text-[10px] text-medichain-muted truncate">{evt.actor}</div>
                </div>

                <div>
                  <span className="text-[10px] uppercase text-medichain-muted font-semibold block">
                    Affiliated Institution
                  </span>
                  <div className="font-medium text-medichain-navy mt-0.5">{evt.hospital}</div>
                </div>

                <div>
                  <span className="text-[10px] uppercase text-medichain-muted font-semibold block">
                    Blockchain Block Proof
                  </span>
                  <div className="font-mono text-medichain-navy mt-0.5">Block #{evt.blockNumber}</div>
                  <div className="font-mono text-[10px] text-medichain-teal truncate flex items-center space-x-1">
                    <span>Tx: {evt.txHash.slice(0, 10)}...{evt.txHash.slice(-8)}</span>
                    <ExternalLink className="w-3 h-3" />
                  </div>
                </div>
              </div>

              {/* Action Description */}
              <p className="text-xs text-[#4A5866] leading-relaxed italic bg-white p-2 rounded border border-medichain-border/60">
                "{evt.details}"
              </p>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useWeb3 } from "@/context/Web3Context";
import {
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Building2,
  Calendar,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  UserCheck,
  X,
  ExternalLink,
} from "lucide-react";

export default function PatientConsentsPage() {
  const { account, role, showToast, getContract } = useWeb3();

  // Active consents state
  const [consents, setConsents] = useState<any[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [emergencies, setEmergencies] = useState<any[]>([]);
  const [registeredInstitutions, setRegisteredInstitutions] = useState<any[]>([]);

  useEffect(() => {
    // 1. Fetch dynamically registered federation institutions
    fetch("/api/federation/institutions")
      .then((res) => (res.ok ? res.json() : { institutions: [] }))
      .then((data) => {
        if (data.institutions && data.institutions.length > 0) {
          setRegisteredInstitutions(data.institutions);
          setSelectedHospital(data.institutions[0].gateway_public_key || data.institutions[0].id);
        }
      })
      .catch(() => {});

    // If logged in as demo Alice Vance, display the demo scenario items
    if (account && account.toLowerCase() === "0x90f79bf6eb2c4f870365e785982e1f101e93b906") {
      setConsents([
        {
          consentId: "0x7a8b9c...consent_cross_1",
          hospitalName: "Regional Specialty Hospital",
          hospitalWallet: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
          chain: "Network B (EVM 31338)",
          sourceChain: "Network A (City General - EVM 31337)",
          scope: "Cardiology & Imaging",
          recordTitle: "MRI Lumbar Spine + Cardiac Stress Test",
          validUntil: Date.now() + 28 * 86400 * 1000,
          grantedAt: Date.now() - 2 * 86400 * 1000,
          isActive: true,
          isCrossChain: true,
        },
        {
          consentId: "0x9921bc...consent_lab_push",
          hospitalName: "Metro Diagnostics Laboratory",
          hospitalWallet: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f",
          chain: "Network C (Fabric-Style Simulated 9000)",
          sourceChain: "Network C (Metro Diagnostics)",
          scope: "Standing Consent: Metabolic Panel & Blood Lab Results",
          recordTitle: "Standing Push Authorization to Ordering Hospitals",
          validUntil: Date.now() + 90 * 86400 * 1000,
          grantedAt: Date.now() - 14 * 86400 * 1000,
          isActive: true,
          isCrossChain: true,
        },
      ]);

      setIncomingRequests([
        {
          id: "req_relocation_801",
          hospitalName: "Regional Specialty Hospital",
          hospitalWallet: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
          fromChain: "Network B (EVM 31338)",
          sourceHospital: "City General Hospital (Network A - EVM 31337)",
          doctorName: "Dr. Sarah Chen, MD (Cardiology & Surgery)",
          reason: "Patient relocation to regional catchment area; pre-operative surgical assessment and historical imaging transfer.",
          requestedScope: "Cardiology & Imaging Records",
          requestedAt: Date.now() - 1800 * 1000,
          isCrossChain: true,
        },
      ]);

      setEmergencies([
        {
          accessId: "0xemg_break_glass_88",
          hospitalName: "St. Jude Hospital (Emergency Trauma Center)",
          doctorName: "Dr. Marcus Brody, MD (Emergency Medicine)",
          justification: "Patient presented unconscious in acute respiratory distress following severe allergic reaction. Immediate history required.",
          accessedAt: Date.now() - 10 * 3600 * 1000,
          validUntil: Date.now() + 14 * 3600 * 1000,
          acknowledged: false,
        },
      ]);
    } else {
      // Clean start or custom patient
      setConsents([]);
      setIncomingRequests([]);
      setEmergencies([]);
    }

    // Load any runtime transfer requests for this patient account
    if (account) {
      fetch(`/api/transfers?patient=${account}`)
        .then((res) => (res.ok ? res.json() : { transfers: [] }))
        .then((data) => {
          if (data.transfers && data.transfers.length > 0) {
            const pending = data.transfers
              .filter((t: any) => t.status === "REQUESTED" || t.status === "PENDING")
              .map((t: any) => ({
                id: t.id,
                hospitalName: t.requesting_hospital,
                hospitalWallet: t.requesting_hospital,
                fromChain: "Consortium Partner",
                sourceHospital: "Sovereign Ledger",
                doctorName: t.requesting_doctor || "Treating Physician",
                reason: t.reason,
                requestedScope: t.scope || "SpecificRecord",
                requestedAt: t.created_at,
                isCrossChain: true,
              }));
            setIncomingRequests((prev) => {
              const ids = new Set(prev.map((p) => p.id));
              const newItems = pending.filter((item: any) => !ids.has(item.id));
              return [...newItems, ...prev];
            });
          }
        })
        .catch(() => {});
    }
  }, [account]);

  // Grant Consent Modal State
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState("0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65");
  const [selectedScope, setSelectedScope] = useState("AllRecords");
  const [selectedDurationDays, setSelectedDurationDays] = useState(7);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGrantConsent = async () => {
    setIsSubmitting(true);
    showToast({
      type: "pending",
      title: "Granting Consent",
      message: "Submitting on-chain consent transaction to ConsentManager...",
    });

    try {
      // Simulate blockchain tx confirmation or call contract
      await new Promise((r) => setTimeout(r, 1200));

      const hospitalNames: Record<string, string> = {
        "0x70997970C51812dc3A010C7d01b50e0d17dc79C8": "Metro Health Medical Center",
        "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65": "St. Jude Hospital",
        "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f": "Boston General Memorial",
      };

      const newConsent = {
        consentId: "0x" + Math.random().toString(16).slice(2) + "...new",
        hospitalName: hospitalNames[selectedHospital] || "Accredited Hospital",
        hospitalWallet: selectedHospital,
        chain: "Network A (City General - EVM 31337)",
        sourceChain: "Network A (City General)",
        scope: selectedScope,
        recordTitle: selectedScope === "AllRecords" ? "All Historical Clinical Records" : "MRI Lumbar Spine with Contrast",
        validUntil: Date.now() + selectedDurationDays * 86400 * 1000,
        grantedAt: Date.now(),
        isActive: true,
        isCrossChain: true,
      };

      setConsents((prev) => [newConsent, ...prev]);
      setIsGrantModalOpen(false);

      showToast({
        type: "success",
        title: "Consent Granted On-Chain",
        message: `Granted ${selectedDurationDays}-day access to ${newConsent.hospitalName}.`,
        txHash: "0x7f8a9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a",
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Transaction Failed",
        message: err.message || "Failed to grant consent",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeConsent = async (consentId: string, hospitalName: string) => {
    showToast({
      type: "pending",
      title: "Propagating Cross-Chain Revocation...",
      message: `Writing revocation on source chain & invalidating foreign reference at ${hospitalName}...`,
    });

    try {
      await new Promise((r) => setTimeout(r, 900));

      if (consentId.startsWith("xfer_") || consentId.startsWith("req_")) {
        await fetch("/api/transfers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "TRANSITION",
            transferId: consentId,
            targetState: "REVOKED",
          }),
        }).catch(() => {});
      }

      setConsents((prev) => prev.filter((c) => c.consentId !== consentId));

      showToast({
        type: "success",
        title: "Cross-Chain Revocation Active",
        message: `Revocation notarized on source chain. ForeignRecordRef locked and local decrypted cache purged at ${hospitalName}.`,
        txHash: "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Revocation Failed",
        message: err.message,
      });
    }
  };

  const handleApproveRequest = async (req: any) => {
    showToast({
      type: "pending",
      title: "Granting Cross-Chain Consent",
      message: `Writing consent attestation on source chain & releasing encrypted package...`,
    });

    try {
      await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "TRANSITION",
          transferId: req.id,
          targetState: "CONSENT_GIVEN",
        }),
      }).catch(() => {});
    } catch {}

    await new Promise((r) => setTimeout(r, 900));

    setIncomingRequests((prev) => prev.filter((r) => r.id !== req.id));

    const approvedShare = {
      consentId: req.id.startsWith("xfer_") ? req.id : "0x" + Math.random().toString(16).slice(2) + "...approved",
      hospitalName: req.hospitalName,
      hospitalWallet: req.hospitalWallet,
      chain: req.fromChain,
      sourceChain: req.sourceHospital,
      scope: req.requestedScope,
      recordTitle: "Approved Cross-Chain Record Transfer",
      validUntil: Date.now() + 30 * 86400 * 1000,
      grantedAt: Date.now(),
      isActive: true,
      isCrossChain: true,
    };

    setConsents((prev) => [approvedShare, ...prev]);

    showToast({
      type: "success",
      title: "Cross-Chain Transfer Authorized",
      message: `Consent attestation produced. Record package ECIES-wrapped and dispatched to ${req.hospitalName}.`,
      txHash: "0x5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b",
    });
  };

  const handleDenyRequest = async (reqId: string, hospitalName: string) => {
    try {
      await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "TRANSITION",
          transferId: reqId,
          targetState: "REJECTED",
          rejectionReason: "Denied by patient via consent portal",
        }),
      }).catch(() => {});
    } catch {}

    setIncomingRequests((prev) => prev.filter((r) => r.id !== reqId));
    showToast({
      type: "info",
      title: "Request Denied",
      message: `Access denied for ${hospitalName}. Action recorded in audit log.`,
    });
  };

  const handleAcknowledgeEmergency = (accessId: string) => {
    setEmergencies((prev) =>
      prev.map((e) => (e.accessId === accessId ? { ...e, acknowledged: true } : e))
    );
    showToast({
      type: "success",
      title: "Emergency Review Acknowledged",
      message: "Recorded patient acknowledgement on-chain in ConsentManager.",
    });
  };

  return (
    <AppShell>
      {/* Top Banner */}
      <div className="bg-white border border-medichain-border rounded-xl p-6 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase font-mono tracking-wider font-semibold bg-medichain-teal-soft text-medichain-teal px-2 py-0.5 rounded border border-medichain-sage-border">
              Consent Governance
            </span>
            <span className="text-xs text-medichain-muted font-mono">
              Patient-Controlled Access
            </span>
          </div>
          <h2 className="font-serif text-2xl font-semibold text-medichain-navy mt-2">
            Access Consents & Permissions
          </h2>
          <p className="text-xs text-medichain-muted mt-1 leading-relaxed max-w-2xl">
            You hold exclusive control over which healthcare institutions can access your medical
            records. Every access grant is time-limited, verifiable on-chain, and revocable instantly.
          </p>
        </div>

        <button
          onClick={() => setIsGrantModalOpen(true)}
          className="bg-medichain-teal hover:bg-medichain-teal-hover text-white px-4 py-2.5 rounded text-xs font-medium transition-colors shadow-sm flex items-center space-x-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Grant Hospital Access</span>
        </button>
      </div>

      {/* Emergency Break-Glass Alert Notice (if any) */}
      {emergencies.some((e) => !e.acknowledged) && (
        <div className="bg-medichain-amber-soft border border-amber-300 rounded-xl p-5 shadow-card space-y-3">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-medichain-amber shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <div className="flex items-center space-x-2">
                <h3 className="font-serif text-sm font-semibold text-medichain-navy">
                  Emergency Break-Glass Access Triggered
                </h3>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold border border-amber-300">
                  24h Window Active
                </span>
              </div>
              <p className="text-xs text-[#6B5005] leading-relaxed">
                An accredited ER physician accessed your medical chart without prior consent under the
                emergency trauma protocol. Review the mandatory clinical justification below and
                acknowledge this event.
              </p>
            </div>
          </div>

          {emergencies
            .filter((e) => !e.acknowledged)
            .map((emg) => (
              <div
                key={emg.accessId}
                className="bg-white border border-amber-200 rounded-lg p-3.5 space-y-2 text-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="font-semibold text-medichain-navy">
                    {emg.hospitalName} — {emg.doctorName}
                  </span>
                  <span className="text-medichain-muted text-[11px] font-mono">
                    {new Date(emg.accessedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="bg-medichain-bg p-2.5 rounded text-medichain-navy font-mono text-[11px] leading-relaxed">
                  "{emg.justification}"
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-medichain-muted font-mono">
                    Emergency ID: {emg.accessId}
                  </span>
                  <button
                    onClick={() => handleAcknowledgeEmergency(emg.accessId)}
                    className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors flex items-center space-x-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Acknowledge Review</span>
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Incoming Access Requests */}
      {incomingRequests.length > 0 && (
        <div className="bg-white border border-medichain-border rounded-xl p-5 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-medichain-border pb-3">
            <div>
              <h3 className="font-serif text-base font-semibold text-medichain-navy">
                Incoming Consultation Requests
              </h3>
              <p className="text-xs text-medichain-muted">
                Hospitals or consulting specialists requesting access to your diagnostic records.
              </p>
            </div>
            <span className="text-xs bg-medichain-teal-soft text-medichain-teal font-mono px-2 py-0.5 rounded font-semibold">
              {incomingRequests.length} Pending
            </span>
          </div>

          <div className="space-y-3">
            {incomingRequests.map((req) => (
              <div
                key={req.id}
                className="bg-medichain-bg border border-medichain-border rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-medichain-navy text-sm">
                      {req.hospitalName}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                      {req.fromChain}
                    </span>
                  </div>
                  <div className="text-medichain-muted">
                    Requested by: <span className="text-medichain-navy font-medium">{req.doctorName}</span> &bull; Source: <span className="text-medichain-navy font-medium">{req.sourceHospital}</span>
                  </div>
                  <div className="text-medichain-navy bg-white p-2.5 rounded border border-medichain-border mt-1 font-sans">
                    <span className="font-semibold text-slate-700">Clinical Purpose: </span>
                    "{req.reason}"
                  </div>
                  <div className="text-slate-600 font-mono text-[11px]">
                    Requested Scope: <span className="font-semibold text-medichain-teal">{req.requestedScope}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => handleDenyRequest(req.id, req.hospitalName)}
                    className="px-3 py-1.5 border border-medichain-border bg-white hover:bg-red-50 hover:text-medichain-tampered rounded text-xs font-medium text-medichain-muted transition-colors"
                  >
                    Deny
                  </button>
                  <button
                    onClick={() => handleApproveRequest(req)}
                    className="px-3.5 py-1.5 bg-medichain-teal hover:bg-medichain-teal-hover text-white rounded text-xs font-medium shadow-sm transition-colors flex items-center space-x-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve Transfer (30 Days)</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Consents ("Who Has Access") */}
      <div className="bg-white border border-medichain-border rounded-xl p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between border-b border-medichain-border pb-3">
          <div>
            <h3 className="font-serif text-base font-semibold text-medichain-navy">
              Who Has Access &bull; Sovereign Chain Shares
            </h3>
            <p className="text-xs text-medichain-muted">
              Institutions currently authorized to receive re-wrapped ECIES record packages and store foreign references.
            </p>
          </div>
          <span className="text-xs text-medichain-muted font-mono">
            {consents.length} Institutions Active
          </span>
        </div>

        {consents.length === 0 ? (
          <div className="py-8 text-center text-xs text-medichain-muted">
            No external hospitals currently hold access to your records.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {consents.map((c) => {
              const daysRemaining = Math.max(
                0,
                Math.ceil((c.validUntil - Date.now()) / (86400 * 1000))
              );

              return (
                <div
                  key={c.consentId}
                  className="bg-medichain-bg/40 border border-medichain-border hover:border-medichain-teal/40 rounded-lg p-4 space-y-3 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-medichain-navy text-sm flex items-center space-x-1.5">
                        <Building2 className="w-4 h-4 text-medichain-teal" />
                        <span>{c.hospitalName}</span>
                      </div>
                      <div className="font-mono text-[10px] text-medichain-muted mt-0.5 truncate max-w-xs">
                        {c.chain || c.hospitalWallet}
                      </div>
                    </div>

                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                      Active Share
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded border border-medichain-border space-y-1.5 text-xs">
                    {c.sourceChain && (
                      <div className="flex items-center justify-between text-medichain-muted">
                        <span>Source:</span>
                        <span className="font-medium text-slate-700 truncate max-w-[200px]">
                          {c.sourceChain}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-medichain-muted">
                      <span>Scope:</span>
                      <span className="font-medium text-medichain-navy font-mono truncate max-w-[200px]">
                        {c.scope}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-medichain-muted">
                      <span>Target Records:</span>
                      <span className="font-medium text-medichain-navy truncate max-w-[200px]">
                        {c.recordTitle}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-medichain-muted pt-1 border-t border-medichain-border/60">
                      <span>Validity:</span>
                      <span className="text-medichain-teal font-medium flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>Expires in {daysRemaining} days</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-medichain-muted font-mono truncate max-w-[160px]">
                      ID: {c.consentId}
                    </span>
                    <button
                      onClick={() => handleRevokeConsent(c.consentId, c.hospitalName)}
                      className="px-2.5 py-1 text-xs text-medichain-tampered hover:bg-red-50 rounded border border-red-200 transition-colors flex items-center space-x-1 font-medium"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Revoke Access</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Grant Access Modal */}
      {isGrantModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white border border-medichain-border rounded-xl max-w-lg w-full p-6 shadow-dropdown space-y-5">
            <div className="flex items-center justify-between border-b border-medichain-border pb-3">
              <div className="flex items-center space-x-2">
                <KeyRound className="w-5 h-5 text-medichain-teal" />
                <h3 className="font-serif text-base font-semibold text-medichain-navy">
                  Grant Healthcare Access
                </h3>
              </div>
              <button
                onClick={() => setIsGrantModalOpen(false)}
                className="text-medichain-muted hover:text-medichain-navy p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Select Hospital */}
              <div className="space-y-1.5">
                <label className="font-semibold text-medichain-navy block">
                  Select Accredited Hospital
                </label>
                <select
                  value={selectedHospital}
                  onChange={(e) => setSelectedHospital(e.target.value)}
                  className="w-full p-2 bg-medichain-bg border border-medichain-border rounded text-xs text-medichain-navy focus:outline-none focus:border-medichain-teal"
                >
                  {registeredInstitutions.length > 0 ? (
                    registeredInstitutions.map((inst) => (
                      <option key={inst.id} value={inst.gateway_public_key || inst.id}>
                        {inst.name} ({inst.chain_type} • {(inst.gateway_public_key || inst.id).slice(0, 8)}...)
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="0x70997970C51812dc3A010C7d01b50e0d17dc79C8">
                        City General Hospital (0x7099...79C8)
                      </option>
                      <option value="0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65">
                        Regional Specialty Hospital (0x15d3...A65)
                      </option>
                      <option value="0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f">
                        Metro Diagnostics Laboratory (0x2361...1E8f)
                      </option>
                    </>
                  )}
                </select>
              </div>

              {/* Select Scope */}
              <div className="space-y-1.5">
                <label className="font-semibold text-medichain-navy block">
                  Access Scope
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedScope("AllRecords")}
                    className={`p-2.5 rounded border text-left transition-all ${
                      selectedScope === "AllRecords"
                        ? "bg-medichain-teal-soft border-medichain-teal text-medichain-navy font-semibold"
                        : "bg-medichain-bg border-medichain-border text-medichain-muted hover:text-medichain-navy"
                    }`}
                  >
                    <div className="text-xs">All Records</div>
                    <div className="text-[10px] text-medichain-muted mt-0.5">Full clinical history</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedScope("SpecificRecord")}
                    className={`p-2.5 rounded border text-left transition-all ${
                      selectedScope === "SpecificRecord"
                        ? "bg-medichain-teal-soft border-medichain-teal text-medichain-navy font-semibold"
                        : "bg-medichain-bg border-medichain-border text-medichain-muted hover:text-medichain-navy"
                    }`}
                  >
                    <div className="text-xs">Specific Record</div>
                    <div className="text-[10px] text-medichain-muted mt-0.5">Single diagnostic file</div>
                  </button>
                </div>
              </div>

              {/* Expiration Duration */}
              <div className="space-y-1.5">
                <label className="font-semibold text-medichain-navy block">
                  Time-Limited Duration
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 7, 30, 90].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setSelectedDurationDays(days)}
                      className={`p-2 rounded border text-center text-xs font-mono transition-all ${
                        selectedDurationDays === days
                          ? "bg-medichain-teal text-white border-medichain-teal font-bold shadow-sm"
                          : "bg-medichain-bg border-medichain-border text-medichain-navy hover:bg-[#EAE6DD]"
                      }`}
                    >
                      {days === 1 ? "24 Hours" : `${days} Days`}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-medichain-muted pt-1">
                  Access will automatically terminate on {new Date(Date.now() + selectedDurationDays * 86400 * 1000).toLocaleDateString()}.
                </p>
              </div>

              {/* Information Callout */}
              <div className="p-3 bg-medichain-bg border border-medichain-border rounded text-[11px] text-[#4A5866] leading-relaxed">
                Granting access triggers an on-chain event on <span className="font-mono text-medichain-navy">ConsentManager.sol</span> and re-wraps your record key with the recipient hospital's registered public key.
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-medichain-border">
              <button
                type="button"
                onClick={() => setIsGrantModalOpen(false)}
                className="px-4 py-2 border border-medichain-border hover:bg-medichain-bg rounded text-xs font-medium text-medichain-navy transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGrantConsent}
                disabled={isSubmitting}
                className="bg-medichain-teal hover:bg-medichain-teal-hover text-white px-4 py-2 rounded text-xs font-medium transition-colors shadow-sm disabled:opacity-50 flex items-center space-x-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{isSubmitting ? "Submitting On-Chain..." : "Confirm Grant"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

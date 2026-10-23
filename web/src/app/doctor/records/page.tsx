"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useWeb3, DEMO_ACCOUNTS } from "@/context/Web3Context";
import { RecordDetailsModal } from "@/components/ui/RecordDetailsModal";
import {
  Search,
  Users,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  FileText,
  Building2,
  Calendar,
  Lock,
  Unlock,
  Layers,
  ArrowRight,
  GitBranch,
  Send,
  AlertTriangle,
  Network,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

export default function DoctorPatientDirectoryPage() {
  const { account, role, showToast } = useWeb3();

  const [searchPseudonym, setSearchPseudonym] = useState(
    "0x90F79bf6EB2c4f870365E785982E1f101E93b906" // Alice Vance
  );
  const [activePatient, setActivePatient] = useState<any | null>({
    name: "Alice Vance",
    pseudonym: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    globalPatientId: "0x88f5a1334c9c7f1a30f3f2f81498c4bc6ec2e5bfa780d6f30a990a42a08ab8d8",
    hasConsent: true,
    consentScope: "Cardiology, Imaging & Lab Reports",
    validUntil: Date.now() + 28 * 86400 * 1000,
    locatorHits: [
      {
        institution: "City General Hospital",
        chain: "Network A (EVM 31337)",
        categories: "Imaging, Cardiology",
        count: 1,
        status: "Transferred & Anchored",
      },
      {
        institution: "Metro Diagnostics Laboratory",
        chain: "Network C (Fabric-Style Simulated 9000)",
        categories: "Metabolic Panel, Pathology",
        count: 1,
        status: "Standing Push Active",
      },
      {
        institution: "Regional Specialty Hospital",
        chain: "Network B (EVM 31338)",
        categories: "Discharge Summary",
        count: 1,
        status: "Local Sovereign Anchor",
      },
    ],
    records: [
      {
        record_id: "0x8fa4c3b991823abce849921bdfc0192837482910384728192837482910293847",
        record_type: "Imaging",
        record_hash: "0x3f7b2c9a8e1d5f6a4b3c2e1d0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a",
        cipher_hash: "0x8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b",
        issuer_hospital: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        issuer_doctor: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        issuer_signature: "0x5a4b3c2d1e0f...signed_by_dr_chen",
        storage_path: "storage/rec_mri_lumbar.enc",
        version: 1,
        created_at: Date.now() - 3 * 86400 * 1000,
        is_revoked: 0,
        hospital_name: "City General Hospital",
        source_chain: "Network A (EVM 31337)",
        is_foreign: true,
        verification_status: "VERIFIED_AUTHENTIC",
        doctor_name: "Dr. Sarah Chen, MD",
        mockDecrypted: {
          testType: "MRI Lumbar Spine with Contrast",
          diagnosis: "L4-L5 disc protrusion with nerve root impingement",
          findings: "Posterior disc protrusion at L4-L5 impinging upon the descending right L5 nerve root.",
          prescriptions: ["Gabapentin 300mg oral capsule qHS", "Naproxen 500mg BID"],
          notes: "Recommend conservative management with targeted physical therapy.",
        },
      },
      {
        record_id: "0x1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c",
        record_type: "LabReport",
        record_hash: "0x7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e",
        cipher_hash: "0x4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d",
        issuer_hospital: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        issuer_doctor: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        issuer_signature: "0x9f8e7d6c5b4a...signed_by_dr_chen",
        storage_path: "storage/rec_blood_panel.enc",
        version: 1,
        created_at: Date.now() - 14 * 86400 * 1000,
        is_revoked: 0,
        hospital_name: "Metro Diagnostics Laboratory",
        source_chain: "Network C (Fabric-Style Simulated 9000)",
        is_foreign: true,
        verification_status: "VERIFIED_AUTHENTIC",
        doctor_name: "Dr. Alan Vance, PhD (Pathology)",
        mockDecrypted: {
          testType: "Lipid & Metabolic Profile",
          diagnosis: "Mild Dyslipidemia",
          labResults: { "Total Cholesterol": "218 mg/dL", "LDL": "136 mg/dL", "HbA1c": "5.6%" },
          prescriptions: ["Atorvastatin 10mg daily"],
          notes: "Initiated low-dose statin therapy.",
        },
      },
      {
        record_id: "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba",
        record_type: "DischargeSummary",
        record_hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        cipher_hash: "0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
        issuer_hospital: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
        issuer_doctor: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
        issuer_signature: "0x112233445566...signed_by_st_jude",
        storage_path: "storage/rec_discharge_summary.enc",
        version: 2,
        previous_record_id: "0x8fa4c3b991823abce849921bdfc0192837482910384728192837482910293847",
        created_at: Date.now() - 45 * 86400 * 1000,
        is_revoked: 0,
        hospital_name: "Regional Specialty Hospital",
        source_chain: "Network B (EVM 31338)",
        is_foreign: false,
        verification_status: "VERIFIED_AUTHENTIC",
        doctor_name: "Dr. Marcus Brody, MD",
        mockDecrypted: {
          testType: "Observation Discharge Summary (v2)",
          diagnosis: "Acute Bronchospasm, Fully Resolved",
          findings: "Patient asymptomatic post-treatment. Normal breath sounds bilaterally.",
          notes: "Discharged in stable clinical state.",
        },
      },
    ],
  });

  // Modal inspection state
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [decryptedData, setDecryptedData] = useState<any | null>(null);
  const [isDecrypted, setIsDecrypted] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);

  // Cross-Chain Transfer Timeline State
  const [transferStep, setTransferStep] = useState<number>(5);
  const [isTransferring, setIsTransferring] = useState<boolean>(false);

  // Request Consultation Modal State
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestReason, setRequestReason] = useState(
    "Specialist cardiology evaluation and surgical clearance review."
  );

  const handleSearchPatient = async () => {
    const trimmed = searchPseudonym.trim();
    if (!trimmed) return;

    try {
      // 1. Check if patient exists in registered patients API
      const patientsRes = await fetch("/api/patients/register");
      const patientsData = await patientsRes.json();
      const matched = (patientsData.patients || []).find(
        (p: any) =>
          p.global_patient_id?.toLowerCase() === trimmed.toLowerCase() ||
          p.local_pseudonym?.toLowerCase() === trimmed.toLowerCase() ||
          p.wallet_address?.toLowerCase() === trimmed.toLowerCase()
      );

      // 2. Fetch records for this patient
      const recordsRes = await fetch(`/api/records/patient/${trimmed}`);
      const recordsData = recordsRes.ok ? await recordsRes.json() : { records: [] };

      if (matched || (recordsData.records && recordsData.records.length > 0)) {
        setActivePatient({
          name: matched ? matched.name : `Patient (${trimmed.slice(0, 10)}...)`,
          pseudonym: matched ? matched.local_pseudonym : trimmed,
          globalPatientId: matched ? matched.global_patient_id : trimmed,
          hasConsent: true,
          consentScope: "Consortium Clinical Data",
          validUntil: Date.now() + 14 * 86400 * 1000,
          records: recordsData.records || [],
        });
        showToast({
          type: "success",
          title: "Patient Record Loaded",
          message: `Found ${recordsData.records?.length || 0} records for ${matched ? matched.name : trimmed.slice(0, 8)}...`,
        });
        return;
      }

      if (trimmed.toLowerCase() === "0x90f79bf6eb2c4f870365e785982e1f101e93b906".toLowerCase()) {
        setActivePatient({
          name: "Alice Vance",
          pseudonym: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
          hasConsent: true,
          consentScope: "AllRecords",
          validUntil: Date.now() + 6 * 86400 * 1000,
          records: activePatient.records,
        });
        showToast({ type: "success", title: "Patient Found", message: "Active consent verified on ConsentManager." });
      } else {
        setActivePatient({
          name: "Unregistered Patient",
          pseudonym: trimmed,
          hasConsent: false,
          records: [],
        });
        showToast({ type: "info", title: "Consent Required", message: "Patient found but no active consent grant found on-chain." });
      }
    } catch {
      showToast({ type: "error", title: "Search Error", message: "Could not query patient directory." });
    }
  };

  const handleDecrypt = async () => {
    if (!selectedRecord) return;
    setIsDecrypting(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
      setDecryptedData(selectedRecord.mockDecrypted);
      setIsDecrypted(true);
      showToast({
        type: "success",
        title: "Integrity Verified",
        message: "Record decrypted using unwrapped ECIES hospital key.",
      });
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleSendRequest = async () => {
    setIsRequestModalOpen(false);
    if (!activePatient) return;

    try {
      showToast({
        type: "pending",
        title: "Dispatching Request",
        message: "Initiating cross-chain transfer request envelope via Interop Hub...",
      });

      const res = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE",
          patientPseudonym: activePatient.pseudonym || activePatient.globalPatientId,
          recordId: selectedRecord?.record_id || undefined,
          requestingHospital: account || "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
          requestingDoctor: "Dr. Treating Physician",
          reason: requestReason,
          scope: selectedRecord ? "SpecificRecord" : "AllRecords",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          showToast({
            type: "error",
            title: "Duplicate Transfer Rejected",
            message: data.error || "A transfer for this record is already active.",
          });
          return;
        }
        if (res.status === 403) {
          showToast({
            type: "error",
            title: "Authorization Error",
            message: data.error || "Institution is suspended or lacks permissions.",
          });
          return;
        }
        throw new Error(data.error || "Failed to initiate transfer");
      }

      showToast({
        type: "success",
        title: "Consultation Request Dispatched",
        message: data.message || "Sent access authorization request to patient portal.",
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Request Error",
        message: err.message || "Failed to dispatch cross-chain request.",
      });
    }
  };

  const handleSimulateTransfer = async () => {
    setIsTransferring(true);
    setTransferStep(1);
    showToast({
      type: "pending",
      title: "Step 1/5: Request Dispatched",
      message: "Gateway routing REQUEST_RECORDS envelope via Interop Hub...",
    });

    await new Promise((r) => setTimeout(r, 900));
    setTransferStep(2);
    showToast({
      type: "pending",
      title: "Step 2/5: Consent Verified",
      message: "Source chain signed consent attestation verified by Hub.",
    });

    await new Promise((r) => setTimeout(r, 900));
    setTransferStep(3);
    showToast({
      type: "pending",
      title: "Step 3/5: Package Released",
      message: "ECIES-wrapped ciphertext & Merkle inclusion proof transferred.",
    });

    await new Promise((r) => setTimeout(r, 900));
    setTransferStep(4);
    showToast({
      type: "pending",
      title: "Step 4/5: Ingestion & Verification",
      message: "Destination gateway verified proof & anchored ForeignRecordRef.",
    });

    await new Promise((r) => setTimeout(r, 800));
    setTransferStep(5);
    setIsTransferring(false);
    showToast({
      type: "success",
      title: "Step 5/5: Available to Clinician",
      message: "Cross-chain transfer complete. Live integrity badge: VERIFIED_AUTHENTIC.",
    });
  };

  return (
    <AppShell>
      {/* Top Banner */}
      <div className="bg-white border border-medichain-border rounded-xl p-6 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase font-mono tracking-wider font-semibold bg-medichain-teal-soft text-medichain-teal px-2 py-0.5 rounded border border-medichain-sage-border">
              Hospital Consulting Room
            </span>
            <span className="text-xs text-medichain-muted font-mono">
              Consortium Access Engine
            </span>
          </div>
          <h2 className="font-serif text-2xl font-semibold text-medichain-navy mt-2">
            Patient Directory & Shared Records
          </h2>
          <p className="text-xs text-medichain-muted mt-1 leading-relaxed max-w-2xl">
            Query patients by pseudonymous identifier. View and decrypt historical charts when
            explicit on-chain consent is active, or dispatch an urgent consultation request.
          </p>
        </div>

        {/* Emergency Break-Glass Link */}
        <a
          href="/doctor/emergency"
          className="bg-medichain-amber-soft hover:bg-amber-100 text-[#9A6400] border border-[#F4DCB0] px-4 py-2.5 rounded text-xs font-medium transition-colors flex items-center space-x-1.5 shrink-0"
        >
          <AlertTriangle className="w-4 h-4 text-medichain-amber" />
          <span>Emergency Break-Glass</span>
        </a>
      </div>

      {/* Patient Search Bar */}
      <div className="bg-white border border-medichain-border rounded-xl p-5 shadow-card space-y-3">
        <label className="text-xs font-semibold text-medichain-navy block">
          Search Patient by Pseudonymous Identifier
        </label>
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-medichain-subtle absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchPseudonym}
              onChange={(e) => setSearchPseudonym(e.target.value)}
              placeholder="Enter patient salted hash (0x...)"
              className="w-full pl-9 pr-3 py-2 bg-medichain-bg border border-medichain-border rounded font-mono text-xs text-medichain-navy focus:outline-none focus:border-medichain-teal transition-colors"
            />
          </div>
          <button
            onClick={handleSearchPatient}
            className="w-full sm:w-auto bg-medichain-teal hover:bg-medichain-teal-hover text-white px-5 py-2 rounded text-xs font-medium shadow-sm transition-colors flex items-center justify-center space-x-1.5"
          >
            <span>Lookup Patient</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Demo Patient Fast Fill */}
        <div className="flex items-center space-x-2 pt-1 text-[11px] text-medichain-muted">
          <span>Quick Lookup:</span>
          <button
            onClick={() => {
              setSearchPseudonym("0x90F79bf6EB2c4f870365E785982E1f101E93b906");
              handleSearchPatient();
            }}
            className="text-medichain-teal font-mono hover:underline"
          >
            Alice Vance (Consented)
          </button>
          <span>•</span>
          <button
            onClick={() => {
              setSearchPseudonym("0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199");
              handleSearchPatient();
            }}
            className="text-medichain-teal font-mono hover:underline"
          >
            Unknown Patient (Unconsented)
          </button>
        </div>
      </div>

      {/* Patient Profile & Consent Status Card */}
      {activePatient && (
        <div className="space-y-6">
          <div className="bg-white border border-medichain-border rounded-xl p-5 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="font-serif text-lg font-semibold text-medichain-navy">
                  {activePatient.name}
                </span>
                {activePatient.hasConsent ? (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold flex items-center space-x-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Consent Active</span>
                  </span>
                ) : (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300 font-bold flex items-center space-x-1">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Consent Required</span>
                  </span>
                )}
              </div>
              <div className="font-mono text-xs text-medichain-muted">
                Local Pseudonym: {activePatient.pseudonym} &bull; Global ID: <span className="font-semibold text-medichain-navy">{activePatient.globalPatientId?.slice(0, 16)}...</span>
              </div>
            </div>

            {/* Consent Action Trigger */}
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={handleSimulateTransfer}
                disabled={isTransferring}
                className="bg-medichain-bg hover:bg-slate-100 text-medichain-navy border border-medichain-border px-3.5 py-2 rounded text-xs font-medium transition-colors flex items-center space-x-1.5"
                title="Run live cross-chain transfer simulation via Interop Hub"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-medichain-teal ${isTransferring ? "animate-spin" : ""}`} />
                <span>Simulate Hub Transfer</span>
              </button>

              {!activePatient.hasConsent && (
                <button
                  onClick={() => setIsRequestModalOpen(true)}
                  className="bg-medichain-teal hover:bg-medichain-teal-hover text-white px-4 py-2 rounded text-xs font-medium shadow-sm transition-colors flex items-center space-x-1.5 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Request Consultation Access</span>
                </button>
              )}
            </div>
          </div>

          {/* Cross-Chain Record Locator Hits */}
          {activePatient.locatorHits && (
            <div className="bg-white border border-medichain-border rounded-xl p-5 shadow-card space-y-3">
              <div className="flex items-center justify-between border-b border-medichain-border pb-3">
                <div className="flex items-center space-x-2">
                  <Network className="w-4 h-4 text-medichain-teal" />
                  <h3 className="font-serif text-sm font-semibold text-medichain-navy">
                    Federation Record Locator Index &bull; Discovered Autonomous Chains
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-medichain-muted">
                  Indexed on Federation Chain 31340
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {activePatient.locatorHits.map((hit: any, i: number) => (
                  <div key={i} className="bg-medichain-bg border border-medichain-border rounded-lg p-3 text-xs space-y-1.5">
                    <div className="font-semibold text-medichain-navy flex items-center justify-between">
                      <span>{hit.institution}</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    </div>
                    <div className="text-[10px] text-medichain-muted font-mono">{hit.chain}</div>
                    <div className="text-[11px] text-slate-700">Scope: {hit.categories}</div>
                    <div className="flex items-center justify-between pt-1 border-t border-medichain-border text-[10px] font-mono">
                      <span className="text-medichain-teal font-semibold">{hit.count} Record Available</span>
                      <span className="text-emerald-700">{hit.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cross-Chain Transfer Timeline */}
          <div className="bg-white border border-medichain-border rounded-xl p-5 shadow-card space-y-3">
            <div className="flex items-center justify-between border-b border-medichain-border pb-2.5">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-medichain-teal" />
                <h3 className="font-serif text-sm font-semibold text-medichain-navy">
                  Cross-Chain Transfer Timeline &bull; Hub Verification Pipeline
                </h3>
              </div>
              <span className="text-[11px] text-emerald-700 font-medium flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Zero-PHI Signed Transit</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-2">
              {[
                { step: 1, title: "1. Requested", desc: "Gateway envelope routed via Hub" },
                { step: 2, title: "2. Consent Attested", desc: "Source chain signed attestation" },
                { step: 3, title: "3. Package Released", desc: "ECIES wrapped + Merkle proof" },
                { step: 4, title: "4. Ingested & Verified", desc: "Anchored ForeignRecordRef" },
                { step: 5, title: "5. Available", desc: "Live authentic view for doctor" },
              ].map((s) => (
                <div
                  key={s.step}
                  className={`p-3 rounded-lg border text-xs transition-colors ${
                    transferStep >= s.step
                      ? "bg-medichain-sage/40 border-medichain-teal text-medichain-navy"
                      : "bg-medichain-bg border-medichain-border text-medichain-muted"
                  }`}
                >
                  <div className="flex items-center space-x-1.5 font-semibold text-xs mb-1">
                    {transferStep >= s.step ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-medichain-teal shrink-0" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                    <span>{s.title}</span>
                  </div>
                  <div className="text-[10px] text-medichain-muted leading-tight">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Shared Records List */}
          {activePatient.hasConsent ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-base font-semibold text-medichain-navy">
                  Accessible Diagnostic Records ({activePatient.records.length})
                </h3>
                <span className="text-xs text-medichain-muted font-mono">
                  ECIES Keys Wrapped for Your Hospital
                </span>
              </div>

              <div className="space-y-3">
                {activePatient.records.map((rec: any) => (
                  <div
                    key={rec.record_id}
                    className="bg-white border border-medichain-border hover:border-medichain-teal/50 rounded-xl p-5 shadow-card transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-medichain-teal-soft text-medichain-teal font-semibold border border-medichain-sage-border">
                          {rec.record_type}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-medichain-bg text-medichain-muted">
                          v{rec.version}
                        </span>
                        {rec.is_foreign && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-semibold flex items-center space-x-1">
                            <Network className="w-3 h-3 text-purple-600" />
                            <span>Received from {rec.hospital_name} ({rec.source_chain})</span>
                          </span>
                        )}
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold flex items-center space-x-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          <span>VERIFIED AUTHENTIC</span>
                        </span>
                        {rec.previous_record_id && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FEF7EA] text-[#9A6400] border border-[#F4DCB0] flex items-center space-x-1">
                            <GitBranch className="w-3 h-3" />
                            <span>Linked to prior version</span>
                          </span>
                        )}
                        <span className="text-medichain-border hidden sm:inline">•</span>
                        <span className="text-xs text-medichain-muted flex items-center space-x-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{new Date(rec.created_at).toLocaleDateString()}</span>
                        </span>
                      </div>

                      <div className="text-sm font-semibold text-medichain-navy">
                        {rec.mockDecrypted?.testType || rec.mockDecrypted?.diagnosis}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-medichain-muted">
                        <div className="truncate">
                          Hospital: <span className="text-medichain-navy font-medium">{rec.hospital_name}</span>
                        </div>
                        <div className="truncate">
                          Doctor: <span className="text-medichain-navy font-medium">{rec.doctor_name}</span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-medichain-border">
                      <button
                        onClick={() => {
                          setSelectedRecord(rec);
                          setIsDecrypted(false);
                          setDecryptedData(null);
                        }}
                        className="px-4 py-2 bg-medichain-teal hover:bg-medichain-teal-hover text-white rounded text-xs font-medium shadow-sm transition-colors flex items-center space-x-1.5"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Decrypt & Consult</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-medichain-border rounded-xl p-12 text-center space-y-3 shadow-card">
              <Lock className="w-8 h-8 text-medichain-muted mx-auto" />
              <h3 className="font-serif text-base font-semibold text-medichain-navy">
                Clinical Records Are Encrypted & Restricted
              </h3>
              <p className="text-xs text-medichain-muted max-w-sm mx-auto">
                In compliance with patient privacy protocols, no health data can be decrypted without
                explicit on-chain consent. Dispatch an access request to the patient.
              </p>
              <button
                onClick={() => setIsRequestModalOpen(true)}
                className="mt-2 bg-medichain-teal hover:bg-medichain-teal-hover text-white px-4 py-2 rounded text-xs font-medium shadow-sm transition-colors inline-flex items-center space-x-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Access Request</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Record Inspection Modal */}
      <RecordDetailsModal
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        record={selectedRecord}
        decryptedData={decryptedData}
        isDecrypted={isDecrypted}
        onDecrypt={handleDecrypt}
        isDecrypting={isDecrypting}
      />

      {/* Request Access Modal */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white border border-medichain-border rounded-xl max-w-md w-full p-6 shadow-dropdown space-y-4">
            <h3 className="font-serif text-base font-semibold text-medichain-navy">
              Request Clinical Access Authorization
            </h3>
            <p className="text-xs text-medichain-muted">
              Specify your clinical justification. The patient will review and approve access from
              their portal.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-medichain-navy block">
                Clinical Justification
              </label>
              <textarea
                rows={3}
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                className="w-full p-2.5 bg-medichain-bg border border-medichain-border rounded text-xs text-medichain-navy focus:outline-none focus:border-medichain-teal leading-relaxed"
                required
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-medichain-border">
              <button
                onClick={() => setIsRequestModalOpen(false)}
                className="px-3.5 py-1.5 border border-medichain-border hover:bg-medichain-bg rounded text-xs font-medium text-medichain-navy"
              >
                Cancel
              </button>
              <button
                onClick={handleSendRequest}
                className="bg-medichain-teal hover:bg-medichain-teal-hover text-white px-4 py-1.5 rounded text-xs font-medium shadow-sm transition-colors flex items-center space-x-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Request</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

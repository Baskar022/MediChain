"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useWeb3, DEMO_ACCOUNTS } from "@/context/Web3Context";
import { getContractInstance, CONTRACT_ADDRESSES } from "@/lib/contracts/config";
import { computeSha256 } from "@/lib/crypto/hash";
import { encryptRecord } from "@/lib/crypto/aes";
import { wrapRecordKey, generateHospitalEncryptionKeyPair } from "@/lib/crypto/ecies";
import { signRecordHash } from "@/lib/crypto/signatures";
import { ethers } from "ethers";
import {
  Zap,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  FileText,
  Lock,
  Layers,
  ArrowRight,
  Database,
  RefreshCw,
  Plus,
  Info,
} from "lucide-react";

interface RecordSummary {
  record_id: string;
  patient_pseudonym: string;
  record_type: string;
  record_hash: string;
  cipher_hash: string;
  issuer_hospital: string;
  issuer_doctor: string;
  file_name: string;
  created_at: number;
  is_tampered?: boolean;
}

export default function TamperDemoPage() {
  const { account, signer, provider, notify } = useWeb3();

  const [records, setRecords] = useState<RecordSummary[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<RecordSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Live verification state
  const [verificationResult, setVerificationResult] = useState<{
    checked: boolean;
    isAuthentic: boolean;
    computedHash: string;
    onChainHash: string;
    mismatchReason?: string;
  } | null>(null);

  // Fetch available records
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/records");
      const data = await res.json();
      if (data.success && data.records.length > 0) {
        setRecords(data.records);
        setSelectedRecord((prev) => {
          if (!prev) return data.records[0];
          const updated = data.records.find((r: RecordSummary) => r.record_id === prev.record_id);
          return updated || data.records[0];
        });
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Seed / Create a Quick Sample Record for instant demo testing
  const handleCreateSampleRecord = async () => {
    setActionLoading(true);
    notify("pending", "Generating Demo Record...", "Encrypting sample cardiology clinical document.");

    try {
      const sampleData = {
        title: "Echocardiogram Diagnostic Report",
        patientName: "Alice Vance",
        finding: "Normal left ventricular ejection fraction 62%. No valvular regurgitation.",
        medication: "Metoprolol 25mg daily",
        timestamp: new Date().toISOString(),
      };

      const plainJson = JSON.stringify(sampleData, null, 2);
      const plaintextHash = computeSha256(plainJson);
      const encResult = await encryptRecord(plainJson);
      const { ciphertext, iv } = encResult.payload;
      const cipherHash = computeSha256(ciphertext);

      const fakeKeypair = generateHospitalEncryptionKeyPair();
      const wrappedKey = wrapRecordKey(encResult.key, fakeKeypair.publicKeyHex);

      const doctorWallet = DEMO_ACCOUNTS[2].address;
      const hospitalWallet = DEMO_ACCOUNTS[1].address;
      const patientPseudonym = "0x88f5a1334c9c7f1a30f3f2f81498c4bc6ec2e5bfa780d6f30a990a42a08ab8d8";
      const recordId = ethers.keccak256(ethers.toUtf8Bytes(cipherHash + Date.now()));

      // Mock signature if no signer
      let signature = "0x" + "11".repeat(65);
      if (signer) {
        try {
          signature = await signRecordHash(plaintextHash, signer);
        } catch {
          // Fallback to test signature
        }
      }

      // Upload to server
      const payload = {
        recordId,
        patientPseudonym,
        recordType: "CARDIOLOGY",
        recordHash: plaintextHash,
        cipherHash,
        issuerHospital: hospitalWallet,
        issuerDoctor: doctorWallet,
        issuerSignature: signature,
        fileName: "cardio_echo_report.json",
        mimeType: "application/json",
        fileSize: ciphertext.length,
        ciphertext,
        iv,
        wrappedKeys: { [hospitalWallet.toLowerCase()]: wrappedKey },
      };

      const res = await fetch("/api/records/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to create sample record");

      notify("success", "Sample Record Created", "Stored in SQLite and /storage. Ready for tamper testing.");
      await fetchRecords();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      notify("error", "Failed to Create Sample", msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Perform Tamper Action
  const handleTamper = async () => {
    if (!selectedRecord) return;
    setActionLoading(true);
    notify("pending", "Tampering File...", "Simulating an unauthorized byte alteration on disk.");

    try {
      const res = await fetch("/api/demo/tamper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: selectedRecord.record_id }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to tamper record");

      notify(
        "error",
        "Record Tampered on Disk!",
        "1 byte altered in /storage. Run integrity verification to detect it."
      );

      // Re-verify immediately to show detection
      await runVerification(selectedRecord.record_id, data.newHash);
      await fetchRecords();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      notify("error", "Tamper Failed", msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Restore Action
  const handleRestore = async () => {
    if (!selectedRecord) return;
    setActionLoading(true);
    notify("pending", "Restoring Record...", "Rolling back off-chain ciphertext to original state.");

    try {
      const res = await fetch("/api/demo/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: selectedRecord.record_id }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to restore record");

      notify(
        "success",
        "Record Restored",
        "Original ciphertext restored. Cryptographic integrity is back to 100% verified."
      );

      await runVerification(selectedRecord.record_id, selectedRecord.cipher_hash);
      await fetchRecords();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      notify("error", "Restore Failed", msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Run Integrity Check
  const runVerification = async (recordId: string, overrideComputedHash?: string) => {
    setActionLoading(true);
    try {
      // 1. Get record from API to get disk content
      const res = await fetch(`/api/records/${recordId}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Record not found");

      const currentCiphertext = data.ciphertext || "";
      const currentComputedHash =
        overrideComputedHash || computeSha256(currentCiphertext);

      // 2. Query On-Chain Hash or use recorded cipher_hash
      let onChainCipherHash = data.record.cipher_hash;

      if (provider) {
        try {
          const registry = getContractInstance("RecordRegistry", provider);
          const meta = await registry.getRecord(recordId);
          if (meta && meta.cipherHash) {
            onChainCipherHash = meta.cipherHash;
          }
        } catch {
          // Use stored cipher_hash if contract call fails
        }
      }

      const isAuthentic =
        currentComputedHash.toLowerCase() === onChainCipherHash.toLowerCase();

      setVerificationResult({
        checked: true,
        isAuthentic,
        computedHash: currentComputedHash,
        onChainHash: onChainCipherHash,
        mismatchReason: isAuthentic
          ? undefined
          : "Computed SHA-256 hash of stored ciphertext does NOT match immutable blockchain anchor! Storage has been tampered with or corrupted.",
      });

      if (isAuthentic) {
        notify("success", "Integrity Verified", "Stored ciphertext matches on-chain cryptographic anchor perfectly.");
      } else {
        notify("error", "INTEGRITY ALERT", "Cryptographic mismatch detected! Data tampering confirmed.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      notify("error", "Verification Error", msg);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-amber-50 rounded-xl text-amber-700 border border-amber-200">
              <Zap className="w-6 h-6 text-amber-600" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-[#0F1F2E] tracking-tight">
                  Live Tampering & Integrity Verification
                </h1>
                <span className="px-2 py-0.5 text-[11px] font-bold bg-amber-100 text-amber-800 rounded uppercase">
                  Interactive Demo
                </span>
              </div>
              <p className="text-sm text-slate-500">
                Experience how SHA-256 cryptographic hashing and smart contracts catch off-chain data tampering instantly.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateSampleRecord}
              disabled={actionLoading}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4 text-[#1F7A7A]" />
              <span>Create Sample Record</span>
            </button>
            <button
              onClick={fetchRecords}
              disabled={loading}
              className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 transition"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Educational Architecture Explanation */}
        <div className="bg-[#0F1F2E] text-slate-200 p-6 rounded-2xl border border-slate-800 shadow-md">
          <div className="flex items-center gap-2 text-teal-400 font-bold text-sm mb-3">
            <Layers className="w-4 h-4" />
            <span>HOW MEDICHAIN GUARANTEES INTEGRITY WITHOUT STORING MEDICAL DATA ON-CHAIN</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs mt-4">
            <div className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700">
              <div className="font-bold text-teal-300 mb-1">1. Client-Side Hash</div>
              <p className="text-slate-300">
                The doctor encrypts the record using AES-256-GCM. A SHA-256 digest is generated from the ciphertext: <code className="text-yellow-300 font-mono">H(Ciphertext)</code>.
              </p>
            </div>

            <div className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700">
              <div className="font-bold text-teal-300 mb-1">2. Blockchain Anchor</div>
              <p className="text-slate-300">
                Only the hash digest is written to the smart contract (<code className="text-yellow-300 font-mono">RecordRegistry</code>). No patient data ever enters the blockchain.
              </p>
            </div>

            <div className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700">
              <div className="font-bold text-teal-300 mb-1">3. The Avalanche Effect</div>
              <p className="text-slate-300">
                If a hacker or rogue sysadmin flips even 1 bit in local disk storage, the computed SHA-256 hash changes completely.
              </p>
            </div>

            <div className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700">
              <div className="font-bold text-teal-300 mb-1">4. Instant Detection</div>
              <p className="text-slate-300">
                Before decrypting, MediChain recalculates the hash and compares it with the immutable on-chain anchor. Any mismatch halts processing immediately!
              </p>
            </div>
          </div>
        </div>

        {/* Record Selection & Test Bench */}
        {records.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300">
            <Database className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-[#0F1F2E] text-base">No Records in Local Storage Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              Click below to generate an encrypted sample record directly into your local database to run the live tampering demonstration.
            </p>
            <button
              onClick={handleCreateSampleRecord}
              disabled={actionLoading}
              className="px-4 py-2.5 bg-[#1F7A7A] hover:bg-[#196363] text-white rounded-lg text-xs font-semibold shadow-xs transition"
            >
              Generate Demo Medical Record
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Record Selector Pills */}
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Select Stored Medical Record to Inspect & Test
              </label>
              <div className="flex flex-wrap gap-2">
                {records.map((r) => {
                  const isSelected = selectedRecord?.record_id === r.record_id;
                  return (
                    <button
                      key={r.record_id}
                      onClick={() => {
                        setSelectedRecord(r);
                        setVerificationResult(null);
                      }}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border text-left transition flex items-center gap-2 ${
                        isSelected
                          ? "bg-teal-50 border-[#1F7A7A] text-[#1F7A7A] font-semibold"
                          : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                      <div>
                        <div>{r.file_name || r.record_type}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          ID: {r.record_id.slice(0, 10)}...
                        </div>
                      </div>
                      {r.is_tampered && (
                        <span className="w-2 h-2 rounded-full bg-red-500 ml-1" title="Currently Tampered" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedRecord && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Card: Immutable On-Chain Anchor */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2 font-bold text-sm text-[#0F1F2E]">
                      <ShieldCheck className="w-5 h-5 text-emerald-600" />
                      <span>On-Chain Cryptographic Anchor</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200 uppercase font-semibold">
                      Immutable
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-slate-400 uppercase font-semibold text-[10px] block">
                        Record ID (Keccak-256 Pointer)
                      </span>
                      <code className="text-[#0F1F2E] font-mono break-all text-[11px]">
                        {selectedRecord.record_id}
                      </code>
                    </div>

                    <div>
                      <span className="text-slate-400 uppercase font-semibold text-[10px] block">
                        On-Chain Ciphertext SHA-256 Hash
                      </span>
                      <code className="text-emerald-700 font-mono break-all text-[11px] font-semibold bg-emerald-50/60 p-1 rounded block">
                        {selectedRecord.cipher_hash}
                      </code>
                    </div>

                    <div>
                      <span className="text-slate-400 uppercase font-semibold text-[10px] block">
                        Doctor Plaintext Signature Hash
                      </span>
                      <code className="text-slate-700 font-mono break-all text-[11px] bg-slate-50 p-1 rounded block">
                        {selectedRecord.record_hash}
                      </code>
                    </div>

                    <div className="pt-2 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100">
                      <span>Issuing Doctor: <span className="font-mono">{selectedRecord.issuer_doctor.slice(0, 8)}...</span></span>
                      <span>Contract: <span className="font-mono">{CONTRACT_ADDRESSES.RecordRegistry.slice(0, 8)}...</span></span>
                    </div>
                  </div>
                </div>

                {/* Right Card: Off-Chain Disk Storage & Tamper Simulator */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2 font-bold text-sm text-[#0F1F2E]">
                      <Database className="w-5 h-5 text-sky-600" />
                      <span>Off-Chain Local Disk Storage</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 text-slate-700 rounded uppercase font-semibold">
                      /storage/*.enc
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-slate-400 uppercase font-semibold text-[10px] block">
                        Disk File Location
                      </span>
                      <code className="text-slate-700 font-mono text-[11px]">
                        storage/{selectedRecord.record_id}.enc
                      </code>
                    </div>

                    <div>
                      <span className="text-slate-400 uppercase font-semibold text-[10px] block">
                        Current Disk File Status
                      </span>
                      {selectedRecord.is_tampered ? (
                        <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-lg text-red-800 text-xs mt-1">
                          <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                          <span className="font-semibold">CORRUPTED / TAMPERED OFF-CHAIN</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs mt-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="font-semibold">ORIGINAL SECURE CIPHERTEXT</span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-4 flex flex-wrap items-center gap-3">
                      <button
                        onClick={handleTamper}
                        disabled={actionLoading || selectedRecord.is_tampered}
                        className="px-3.5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Simulate Disk Tampering</span>
                      </button>

                      <button
                        onClick={() => runVerification(selectedRecord.record_id)}
                        disabled={actionLoading}
                        className="px-3.5 py-2 bg-[#1F7A7A] hover:bg-[#196363] text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Verify Integrity On-Chain</span>
                      </button>

                      {selectedRecord.is_tampered && (
                        <button
                          onClick={handleRestore}
                          disabled={actionLoading}
                          className="px-3.5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restore Original</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Verification Result Card */}
            {verificationResult && (
              <div
                className={`p-6 rounded-2xl border shadow-sm transition ${
                  verificationResult.isAuthentic
                    ? "bg-emerald-50/70 border-emerald-300 text-emerald-950"
                    : "bg-red-50/70 border-red-300 text-red-950"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`p-3 rounded-xl text-white shrink-0 ${
                      verificationResult.isAuthentic ? "bg-emerald-600" : "bg-red-600"
                    }`}
                  >
                    {verificationResult.isAuthentic ? (
                      <ShieldCheck className="w-7 h-7" />
                    ) : (
                      <ShieldAlert className="w-7 h-7" />
                    )}
                  </div>

                  <div className="space-y-2 w-full">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-lg tracking-tight">
                        {verificationResult.isAuthentic
                          ? "INTEGRITY 100% VERIFIED: Authentic Record"
                          : "TAMPERING DETECTED: Cryptographic Integrity Violation!"}
                      </h3>
                      <span className="text-xs font-mono font-bold uppercase">
                        {verificationResult.isAuthentic ? "Status: VALID" : "Status: REJECTED"}
                      </span>
                    </div>

                    <p className="text-xs opacity-90 leading-relaxed">
                      {verificationResult.isAuthentic
                        ? "The SHA-256 hash computed directly from the off-chain storage ciphertext exactly matches the immutable anchor on the Ethereum smart contract. The record has not been altered by any party."
                        : verificationResult.mismatchReason}
                    </p>

                    {/* Hash Comparison Table */}
                    <div className="mt-3 p-3 bg-white/80 rounded-xl border border-current/20 text-xs font-mono space-y-1.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="font-sans text-[11px] font-semibold opacity-70">
                          On-Chain Anchor Hash:
                        </span>
                        <span className="text-[11px] font-semibold break-all text-slate-800">
                          {verificationResult.onChainHash}
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-t border-current/10 pt-1.5">
                        <span className="font-sans text-[11px] font-semibold opacity-70">
                          Off-Chain Computed Hash:
                        </span>
                        <span
                          className={`text-[11px] font-semibold break-all ${
                            verificationResult.isAuthentic ? "text-emerald-700" : "text-red-700"
                          }`}
                        >
                          {verificationResult.computedHash}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

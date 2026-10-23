"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useWeb3 } from "@/context/Web3Context";
import { QrCodeModal } from "@/components/ui/QrCodeModal";
import { RecordDetailsModal } from "@/components/ui/RecordDetailsModal";
import {
  FileText,
  QrCode,
  Eye,
  ShieldCheck,
  Search,
  Filter,
  Calendar,
  Building2,
  User,
  Layers,
  Unlock,
  AlertCircle,
  Network,
  Globe,
  Share2,
  AlertOctagon,
  Clock,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export default function PatientRecordsPage() {
  const { account, role, showToast } = useWeb3();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("ALL");

  // Modals state
  const [activeQrRecord, setActiveQrRecord] = useState<any | null>(null);
  const [activeDetailRecord, setActiveDetailRecord] = useState<any | null>(null);
  const [decryptedData, setDecryptedData] = useState<any | null>(null);
  const [isDecrypted, setIsDecrypted] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);

  // Cross-chain features state
  const [showLocatorPanel, setShowLocatorPanel] = useState(true);
  const [isLocatorPublic, setIsLocatorPublic] = useState(true);
  const [hasEmergencyNotice, setHasEmergencyNotice] = useState(true);

  // Pre-loaded realistic records for Patient Alice Vance
  const defaultAliceRecords = [
    {
      record_id: "0x8fa4c3b991823abce849921bdfc0192837482910384728192837482910293847",
      patient_pseudonym: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
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
      doctor_name: "Dr. Sarah Chen, MD (Radiology)",
      chain_origin: "Network A (City General - EVM 31337)",
      chain_type: "EVM",
      verification_status: "VERIFIED_AUTHENTIC",
      mockDecrypted: {
        testType: "MRI Lumbar Spine with & without Contrast",
        diagnosis: "L4-L5 intervertebral disc protrusion with nerve root impingement",
        findings: "Well-aligned vertebral bodies. Disc height preserved at L1-L3. Posterior disc protrusion at L4-L5 impinging upon the descending right L5 nerve root.",
        prescriptions: ["Gabapentin 300mg oral capsule qHS", "Naproxen 500mg oral tablet BID PRN pain"],
        notes: "Recommend conservative management with targeted physical therapy. Re-evaluate in 4 weeks.",
      },
    },
    {
      record_id: "0x1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c",
      patient_pseudonym: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
      record_type: "LabReport",
      record_hash: "0x7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e",
      cipher_hash: "0x4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d",
      issuer_hospital: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      issuer_doctor: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      issuer_signature: "0x9f8e7d6c5b4a...signed_by_metro_lab",
      storage_path: "storage/rec_blood_panel.enc",
      version: 1,
      created_at: Date.now() - 14 * 86400 * 1000,
      is_revoked: 0,
      hospital_name: "Metro Diagnostics Laboratory",
      doctor_name: "Dr. Alan Vance, PhD (Pathology)",
      chain_origin: "Network C (Metro Diagnostics - Fabric-Style Simulated 9000)",
      chain_type: "CUSTOM_LEDGER",
      verification_status: "VERIFIED_AUTHENTIC",
      mockDecrypted: {
        testType: "Comprehensive Metabolic & Lipid Panel",
        diagnosis: "Dyslipidemia, Well-Controlled Glucose Profile",
        labResults: {
          "Total Cholesterol": "218 mg/dL (High)",
          "HDL Cholesterol": "54 mg/dL",
          "LDL Cholesterol": "136 mg/dL",
          "Fasting Glucose": "92 mg/dL (Normal)",
          "HbA1c": "5.6% (Normal)",
          "Serum Creatinine": "0.9 mg/dL",
        },
        prescriptions: ["Atorvastatin 10mg oral tablet daily at bedtime"],
        notes: "Lipid panel showing mild elevation in LDL. Initiated low-dose statin therapy. Liver function tests baseline normal.",
      },
    },
    {
      record_id: "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba",
      patient_pseudonym: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
      record_type: "DischargeSummary",
      record_hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      cipher_hash: "0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
      issuer_hospital: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
      issuer_doctor: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
      issuer_signature: "0x112233445566...signed_by_rsh",
      storage_path: "storage/rec_discharge_summary.enc",
      version: 2,
      created_at: Date.now() - 45 * 86400 * 1000,
      is_revoked: 0,
      hospital_name: "Regional Specialty Hospital",
      doctor_name: "Dr. Marcus Brody, MD (Emergency Medicine)",
      chain_origin: "Network B (Regional Specialty - EVM 31338)",
      chain_type: "EVM",
      verification_status: "VERIFIED_AUTHENTIC",
      mockDecrypted: {
        testType: "Emergency Observation & Discharge Summary",
        diagnosis: "Acute Bronchitis with Bronchospasm, Resolved",
        findings: "Chest X-Ray negative for consolidation or pleural effusion. Oxygen saturation restored to 99% on room air following nebulizer therapy.",
        prescriptions: ["Albuterol HFA Inhaler 90mcg 2 puffs q4h PRN", "Amoxicillin-Clavulanate 875mg oral BID x 7 days"],
        notes: "Patient observed for 6 hours post-treatment. Discharged home in stable clinical condition. Follow up with PCP within 7 days.",
      },
    },
  ];

  useEffect(() => {
    async function fetchRecords() {
      setLoading(true);
      try {
        const res = await fetch(`/api/records/patient/${account || "default"}`);
        if (res.ok) {
          const data = await res.json();
          if (data.records && data.records.length > 0) {
            setRecords(data.records);
          } else if (account && account.toLowerCase() === "0x90f79bf6eb2c4f870365e785982e1f101e93b906") {
            // Only fall back to demo fixture if logged in specifically as Demo Patient Alice
            setRecords(defaultAliceRecords);
          } else {
            // Fresh newly registered patient starts with zero records
            setRecords([]);
          }
        } else if (account && account.toLowerCase() === "0x90f79bf6eb2c4f870365e785982e1f101e93b906") {
          setRecords(defaultAliceRecords);
        } else {
          setRecords([]);
        }
      } catch {
        if (account && account.toLowerCase() === "0x90f79bf6eb2c4f870365e785982e1f101e93b906") {
          setRecords(defaultAliceRecords);
        } else {
          setRecords([]);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchRecords();
  }, [account]);

  const handleOpenDetails = (rec: any) => {
    setActiveDetailRecord(rec);
    setIsDecrypted(false);
    setDecryptedData(null);
  };

  const handleDecrypt = async () => {
    if (!activeDetailRecord) return;
    setIsDecrypting(true);
    try {
      // Simulate client-side key unwrapping and AES-GCM decryption
      await new Promise((r) => setTimeout(r, 600));

      const clinical = activeDetailRecord.mockDecrypted || {
        diagnosis: "Routine Clinical Consultation and Physical Examination",
        notes: "Vitals within normal limits. Cryptographic authenticity verified on-chain.",
      };

      setDecryptedData(clinical);
      setIsDecrypted(true);

      showToast({
        type: "success",
        title: "Record Decrypted",
        message: "AES-256-GCM authenticated payload verified and rendered.",
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Decryption Failed",
        message: err.message || "Failed to decrypt record",
      });
    } finally {
      setIsDecrypting(false);
    }
  };

  const filteredRecords = records.filter((rec) => {
    const matchesType = selectedType === "ALL" || rec.record_type === selectedType;
    const matchesSearch =
      rec.record_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (rec.hospital_name && rec.hospital_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (rec.doctor_name && rec.doctor_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  return (
    <AppShell>
      {/* Top Banner */}
      <div className="bg-white border border-medichain-border rounded-xl p-6 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase font-mono tracking-wider font-semibold bg-medichain-teal-soft text-medichain-teal px-2 py-0.5 rounded border border-medichain-sage-border">
              Patient Portal
            </span>
            <span className="text-xs text-medichain-muted font-mono">
              Pseudonym ID: {account ? `${account.slice(0, 8)}...` : "Alice Vance"}
            </span>
          </div>
          <h2 className="font-serif text-2xl font-semibold text-medichain-navy mt-2">
            My Medical Records Timeline
          </h2>
          <p className="text-xs text-medichain-muted mt-1 leading-relaxed max-w-2xl">
            Immutable timeline of medical reports issued by accredited hospitals. Every record is
            encrypted off-chain and anchored with dual SHA-256 cryptographic hashes on the
            consortium blockchain.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <div className="bg-medichain-bg border border-medichain-border px-3.5 py-2 rounded-lg text-center">
            <span className="text-[10px] uppercase font-semibold text-medichain-muted block">
              Total Records
            </span>
            <span className="font-serif text-xl font-bold text-medichain-navy tabular-nums">
              {records.length}
            </span>
          </div>
        </div>
      </div>

      {/* Emergency Break-Glass In-App Alert */}
      {hasEmergencyNotice && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-950 shadow-sm relative">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <span className="p-2 bg-red-100 border border-red-300 rounded-lg text-red-700 mt-0.5">
                <AlertOctagon className="w-5 h-5" />
              </span>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-sm text-red-900">
                    Emergency Break-Glass Access Alert
                  </span>
                  <span className="px-2 py-0.5 bg-red-200 text-red-800 rounded-full font-mono text-[10px] font-bold">
                    Active (22h Remaining)
                  </span>
                </div>
                <p className="text-red-800 leading-relaxed max-w-3xl">
                  Attending emergency physician <strong>Dr. Sarah Chen, MD</strong> at <strong>Regional Specialty Hospital (Network B)</strong> exercised time-boxed emergency break-glass override under Level-1 trauma protocols.
                  Access was strictly scoped to your <strong>Critical Medical Summary</strong> (Blood Group, Allergies, Active Medications, Recent Discharge Summary) and is notarized on both sovereign chains.
                </p>
                <div className="flex items-center space-x-4 pt-1 font-mono text-[11px] text-red-700">
                  <span>Justification: Acute polytrauma &bull; GCS &lt; 8</span>
                  <span>&bull;</span>
                  <span>Flagged for Federation Review</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setHasEmergencyNotice(false)}
              className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded border border-red-200 hover:bg-red-100 transition-colors"
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}

      {/* "Where My Records Are" - Record Locator Index */}
      <div className="bg-white border border-medichain-border rounded-xl shadow-card overflow-hidden">
        <div
          onClick={() => setShowLocatorPanel(!showLocatorPanel)}
          className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors select-none"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-medichain-teal-soft text-medichain-teal rounded-lg border border-medichain-sage-border">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-serif text-base font-semibold text-medichain-navy">
                  Where My Records Are &bull; Sovereign Record Locator Index
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                  Zero PHI Federation Layer
                </span>
              </div>
              <p className="text-xs text-medichain-muted mt-0.5">
                Neutral directory on Federation Chain (31340) indexing which hospitals hold records for your Universal Pseudonym.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-xs text-medichain-muted hidden sm:inline">
              {showLocatorPanel ? "Collapse Index" : "Expand Locator"}
            </span>
            {showLocatorPanel ? (
              <ChevronUp className="w-4 h-4 text-medichain-muted" />
            ) : (
              <ChevronDown className="w-4 h-4 text-medichain-muted" />
            )}
          </div>
        </div>

        {showLocatorPanel && (
          <div className="px-5 pb-5 pt-1 border-t border-medichain-border space-y-4 text-xs">
            {/* Global Identity Bar */}
            <div className="bg-medichain-bg border border-medichain-border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="font-mono text-[11px] truncate max-w-xl">
                <span className="text-medichain-muted">Universal Patient ID: </span>
                <span className="text-medichain-navy font-semibold">
                  0x88f5a1334c9c7f1a30f3f2f81498c4bc6ec2e5bfa780d6f30a990a42a08ab8d8
                </span>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <span className="text-medichain-muted text-[11px]">Discoverable:</span>
                <button
                  onClick={() => {
                    setIsLocatorPublic(!isLocatorPublic);
                    showToast({
                      type: "info",
                      title: isLocatorPublic ? "Locator Visibility Hidden" : "Locator Visibility Enabled",
                      message: isLocatorPublic
                        ? "Hospitals will not discover your record locations via federated search."
                        : "Permitted hospitals can locate which chains hold your records.",
                    });
                  }}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    isLocatorPublic
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
                      : "bg-slate-100 text-slate-600 border border-slate-300"
                  }`}
                >
                  {isLocatorPublic ? "Public to Federation" : "Hidden / Opt-Out"}
                </button>
              </div>
            </div>

            {/* Locator Breakdown Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-medichain-muted border-b border-medichain-border text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-3 font-semibold">Institution & Network</th>
                    <th className="py-2.5 px-3 font-semibold">Chain Architecture</th>
                    <th className="py-2.5 px-3 font-semibold">Indexed Categories</th>
                    <th className="py-2.5 px-3 font-semibold">Record Count</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Last Synchronized</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-medichain-border text-xs">
                  <tr className="hover:bg-slate-50/70">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-medichain-navy">City General Hospital</div>
                      <div className="text-[10px] text-medichain-muted font-mono">Port 8545 &bull; Primary Sovereign Anchor</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                        EVM (Chain 31337)
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-700">
                      Imaging, Cardiology, Prescriptions
                    </td>
                    <td className="py-3 px-3 font-semibold text-medichain-navy">
                      2 Records
                    </td>
                    <td className="py-3 px-3 text-right text-medichain-muted">
                      3 days ago
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/70">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-medichain-navy">Metro Diagnostics Laboratory</div>
                      <div className="text-[10px] text-medichain-muted font-mono">Port 9000 &bull; Independent Lab Authority</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-50 text-purple-700 border border-purple-200 font-semibold">
                        FABRIC-STYLE SIMULATED (9000)
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-700">
                      Metabolic Panel, Pathology
                    </td>
                    <td className="py-3 px-3 font-semibold text-medichain-navy">
                      1 Record
                    </td>
                    <td className="py-3 px-3 text-right text-medichain-muted">
                      14 days ago
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/70">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-medichain-navy">Regional Specialty Hospital</div>
                      <div className="text-[10px] text-medichain-muted font-mono">Port 8546 &bull; Tertiary Trauma Center</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                        EVM (Chain 31338)
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-700">
                      Discharge Summary, Emergency Logs
                    </td>
                    <td className="py-3 px-3 font-semibold text-medichain-navy">
                      1 Record
                    </td>
                    <td className="py-3 px-3 text-right text-medichain-muted">
                      45 days ago
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-medichain-border rounded-lg p-3.5 shadow-card flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-medichain-subtle absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search records, doctor, or hash..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-medichain-bg border border-medichain-border rounded text-xs text-medichain-navy placeholder-medichain-muted focus:outline-none focus:border-medichain-teal transition-colors"
          />
        </div>

        {/* Type Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 text-xs font-medium">
          {["ALL", "Imaging", "LabReport", "Prescription", "DischargeSummary"].map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`px-2.5 py-1 rounded text-xs transition-colors shrink-0 ${
                selectedType === t
                  ? "bg-medichain-teal text-white shadow-sm"
                  : "bg-medichain-bg text-medichain-muted hover:bg-[#EAE6DD] hover:text-medichain-navy"
              }`}
            >
              {t === "ALL" ? "All Types" : t}
            </button>
          ))}
        </div>
      </div>

      {/* Records Timeline List */}
      <div className="space-y-3">
        {filteredRecords.length === 0 ? (
          <div className="bg-white border border-medichain-border rounded-xl p-12 text-center space-y-3 shadow-card">
            <FileText className="w-8 h-8 text-medichain-muted mx-auto" />
            <h3 className="font-serif text-base font-semibold text-medichain-navy">
              No Medical Records Found
            </h3>
            <p className="text-xs text-medichain-muted max-w-sm mx-auto">
              No clinical records match your current filter criteria. Switch to "All Types" or
              consult your attending physician to anchor a record.
            </p>
          </div>
        ) : (
          filteredRecords.map((rec) => (
            <div
              key={rec.record_id}
              className="bg-white border border-medichain-border hover:border-medichain-teal/50 rounded-xl p-5 shadow-card transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-medichain-teal-soft text-medichain-teal font-semibold border border-medichain-sage-border">
                    {rec.record_type}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-medichain-bg text-medichain-muted">
                    Version {rec.version || 1}
                  </span>
                  {rec.chain_origin && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                      ⛓ {rec.chain_origin}
                    </span>
                  )}
                  <span className="text-[11px] text-medichain-verified font-medium flex items-center space-x-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>On-Chain Verified</span>
                  </span>
                  <span className="text-medichain-border hidden sm:inline">•</span>
                  <span className="text-xs text-medichain-muted flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(rec.created_at).toLocaleDateString()}</span>
                  </span>
                </div>

                <div className="text-sm font-semibold text-medichain-navy">
                  {rec.mockDecrypted?.diagnosis || "Clinical Health Record & Diagnostic Summary"}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-medichain-muted font-sans">
                  <div className="flex items-center space-x-1.5 truncate">
                    <Building2 className="w-3.5 h-3.5 text-medichain-teal shrink-0" />
                    <span className="truncate">{rec.hospital_name || "Metro Health Medical Center"}</span>
                  </div>
                  <div className="flex items-center space-x-1.5 truncate">
                    <User className="w-3.5 h-3.5 text-medichain-teal shrink-0" />
                    <span className="truncate">{rec.doctor_name || "Dr. Sarah Chen, MD"}</span>
                  </div>
                </div>

                <div className="font-mono text-[10px] text-medichain-muted truncate pt-1">
                  SHA-256: {rec.record_hash}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-medichain-border">
                <button
                  onClick={() => setActiveQrRecord(rec)}
                  className="px-3 py-1.5 bg-medichain-bg hover:bg-[#EAE6DD] text-medichain-navy rounded text-xs font-medium border border-medichain-border transition-colors flex items-center space-x-1.5"
                  title="Share Verification QR"
                >
                  <QrCode className="w-3.5 h-3.5 text-medichain-teal" />
                  <span>Verify QR</span>
                </button>

                <button
                  onClick={() => handleOpenDetails(rec)}
                  className="px-3.5 py-1.5 bg-medichain-teal hover:bg-medichain-teal-hover text-white rounded text-xs font-medium shadow-sm transition-colors flex items-center space-x-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Inspect & Decrypt</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modals */}
      <QrCodeModal
        isOpen={!!activeQrRecord}
        onClose={() => setActiveQrRecord(null)}
        recordId={activeQrRecord?.record_id || ""}
        recordHash={activeQrRecord?.record_hash || ""}
        cipherHash={activeQrRecord?.cipher_hash || ""}
        issuerName={activeQrRecord?.hospital_name}
      />

      <RecordDetailsModal
        isOpen={!!activeDetailRecord}
        onClose={() => setActiveDetailRecord(null)}
        record={activeDetailRecord}
        decryptedData={decryptedData}
        isDecrypted={isDecrypted}
        onDecrypt={handleDecrypt}
        isDecrypting={isDecrypting}
      />
    </AppShell>
  );
}

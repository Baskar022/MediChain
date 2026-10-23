"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { useWeb3, DEMO_ACCOUNTS } from "@/context/Web3Context";
import { getContractInstance, CONTRACT_ADDRESSES } from "@/lib/contracts/config";
import { derivePatientPseudonym } from "@/lib/crypto/hash";
import { ethers } from "ethers";
import {
  AlertOctagon,
  ShieldAlert,
  Flame,
  Clock,
  UserCheck,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowRight,
  ExternalLink,
  Search,
  History,
  Info,
} from "lucide-react";

interface EmergencyEvent {
  accessId: string;
  patientIdHash: string;
  recordId: string;
  doctor: string;
  hospital: string;
  justification: string;
  accessedAt: number;
  validUntil: number;
  acknowledged: boolean;
}

const JUSTIFICATION_PRESETS = [
  "Acute polytrauma with Glasgow Coma Scale (GCS) < 8; patient unresponsive.",
  "Sudden out-of-hospital cardiac arrest undergoing active ACLS resuscitation.",
  "Emergency exploratory laparotomy required for suspected acute hemorrhage.",
  "Severe anaphylactic shock; patient intubated and incapable of communicating.",
  "Acute ischemic stroke within therapeutic thrombolysis window (< 4.5 hours).",
];

const FALLBACK_EMERGENCY_EVENTS: EmergencyEvent[] = [
  {
    accessId: "0x89ab12cd45ef67890123456789abcdef0123456789abcdef0123456789abcdef",
    patientIdHash: "0x88f5a1334c9c7f1a30f3f2f81498c4bc6ec2e5bfa780d6f30a990a42a08ab8d8",
    recordId: "0x0000000000000000000000000000000000000000000000000000000000000000",
    doctor: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // Dr. Sarah Chen
    hospital: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Metro Health
    justification: "Acute polytrauma with Glasgow Coma Scale (GCS) < 8; emergency cranial CT and surgical consult.",
    accessedAt: Math.floor(Date.now() / 1000) - 3600 * 4,
    validUntil: Math.floor(Date.now() / 1000) + 3600 * 20,
    acknowledged: false,
  },
];

export default function DoctorEmergencyPage() {
  const { account, signer, provider, role, selectDemoAccount, notify } = useWeb3();

  const [patientIdInput, setPatientIdInput] = useState("");
  const [patientPseudonym, setPatientPseudonym] = useState("");
  const [recordIdInput, setRecordIdInput] = useState("0x0000000000000000000000000000000000000000000000000000000000000000");
  const [selectedPreset, setSelectedPreset] = useState(JUSTIFICATION_PRESETS[0]);
  const [customNotes, setCustomNotes] = useState("");
  const [confirmedLegal, setConfirmedLegal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [emergencyEvents, setEmergencyEvents] = useState<EmergencyEvent[]>(FALLBACK_EMERGENCY_EVENTS);
  const [activeSession, setActiveSession] = useState<EmergencyEvent | null>(null);

  // Time remaining countdown in seconds
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  const isDoctor =
    role === "DOCTOR" ||
    (account && account.toLowerCase() === DEMO_ACCOUNTS[2].address.toLowerCase());

  // Derive pseudonym when raw ID entered
  const handlePatientIdChange = (val: string) => {
    setPatientIdInput(val);
    if (val.trim()) {
      if (val.startsWith("0x") && val.length === 66) {
        setPatientPseudonym(val);
      } else {
        const derived = derivePatientPseudonym(val.trim());
        setPatientPseudonym(derived);
      }
    } else {
      setPatientPseudonym("");
    }
  };

  // Pre-fill Alice Vance demo patient
  const handleUseAliceDemo = () => {
    setPatientIdInput("ALICE-VANCE-SSN-9021");
    const derived = derivePatientPseudonym("ALICE-VANCE-SSN-9021");
    setPatientPseudonym(derived);
  };

  // Fetch emergency access history from smart contract
  const fetchEmergencyLogs = useCallback(async () => {
    if (!provider) return;
    try {
      const consentContract = getContractInstance("ConsentManager", provider);
      const accessIds: string[] = await consentContract.getAllEmergencyAccessIds().catch(() => []);
      if (accessIds.length === 0) return;

      const events: EmergencyEvent[] = [];
      for (const id of accessIds.slice(-10).reverse()) {
        try {
          const ea = await consentContract.getEmergencyAccess(id);
          events.push({
            accessId: ea.accessId,
            patientIdHash: ea.patientIdHash,
            recordId: ea.recordId,
            doctor: ea.doctor,
            hospital: ea.hospital,
            justification: ea.justification,
            accessedAt: Number(ea.accessedAt),
            validUntil: Number(ea.validUntil),
            acknowledged: ea.acknowledged,
          });
        } catch {
          // Skip individual error
        }
      }

      if (events.length > 0) {
        setEmergencyEvents(events);

        // Check if doctor has an active ongoing session
        const now = Math.floor(Date.now() / 1000);
        const active = events.find(
          (e) =>
            account &&
            e.doctor.toLowerCase() === account.toLowerCase() &&
            e.validUntil > now
        );
        if (active) {
          setActiveSession(active);
          setSecondsRemaining(active.validUntil - now);
        }
      }
    } catch {
      // Keep fallbacks
    }
  }, [provider, account]);

  useEffect(() => {
    fetchEmergencyLogs();
  }, [fetchEmergencyLogs]);

  // Countdown timer loop
  useEffect(() => {
    if (!secondsRemaining || secondsRemaining <= 0) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => (prev && prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsRemaining]);

  // Execute Break Glass
  const handleExecuteBreakGlass = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Support gateway-sponsored local doctor signer when MetaMask is not connected
    let effectiveSigner = signer;
    if (!effectiveSigner) {
      try {
        const localProvider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
        // Authorized Doctor key (Dr. Sarah Chen / Local Gateway sponsored)
        effectiveSigner = new ethers.Wallet("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", localProvider);
      } catch (e) {
        notify("error", "Signer Missing", "Connect an authorized doctor wallet or start local node.");
        return;
      }
    }
    if (!patientPseudonym.startsWith("0x") || patientPseudonym.length !== 66) {
      notify("error", "Invalid Patient Pseudonym", "Please specify a valid 32-byte hex patient pseudonym hash.");
      return;
    }
    if (!confirmedLegal) {
      notify("error", "Legal Affirmation Required", "You must affirm medical necessity before proceeding.");
      return;
    }

    setSubmitting(true);
    notify(
      "pending",
      "Executing Break-Glass Override...",
      "Anchoring emergency trauma access to the immutable blockchain audit log."
    );

    const justification = customNotes
      ? `${selectedPreset} - Additional Clinical Details: ${customNotes}`
      : selectedPreset;

    try {
      const consentContract = getContractInstance("ConsentManager", effectiveSigner);

      const targetRecordId =
        recordIdInput.trim() ||
        "0x0000000000000000000000000000000000000000000000000000000000000000";

      const tx = await consentContract.requestEmergencyAccess(
        patientPseudonym,
        targetRecordId,
        justification
      );

      const receipt = await tx.wait();

      notify(
        "success",
        "EMERGENCY OVERRIDE ACTIVE",
        "24-Hour Emergency Access has been anchored on-chain. Patient records unlocked.",
        receipt.hash
      );

      // Create local active event
      const now = Math.floor(Date.now() / 1000);
      const newEvent: EmergencyEvent = {
        accessId: ethers.keccak256(ethers.toUtf8Bytes(justification + now)),
        patientIdHash: patientPseudonym,
        recordId: targetRecordId,
        doctor: account || "",
        hospital: DEMO_ACCOUNTS[1].address,
        justification,
        accessedAt: now,
        validUntil: now + 86400,
        acknowledged: false,
      };

      setActiveSession(newEvent);
      setSecondsRemaining(86400);
      setEmergencyEvents((prev) => [newEvent, ...prev]);

      // Reset form
      setCustomNotes("");
      setConfirmedLegal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      notify("error", "Break-Glass Reverted", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const formatCountdown = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Top Emergency Header */}
        <div className="border-b border-red-200 bg-red-50/60 -mx-6 -mt-6 p-6 pb-6 rounded-b-2xl border-x">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="p-3 bg-red-600 rounded-xl text-white shadow-md animate-pulse">
                <AlertOctagon className="w-7 h-7" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-red-950 tracking-tight">
                    Emergency "Break-Glass" Access
                  </h1>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-200 text-red-900 uppercase">
                    Level 1 Trauma Override
                  </span>
                </div>
                <p className="text-sm text-red-800/80 mt-1 max-w-2xl">
                  Bypasses standard patient consent in life-threatening trauma situations when the patient is incapacitated. 
                  Every invocation is cryptographically signed and permanently flagged on the public audit log.
                </p>
              </div>
            </div>

            {!isDoctor && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => selectDemoAccount(DEMO_ACCOUNTS[2])}
                  className="px-3.5 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-semibold shadow-xs transition"
                >
                  Switch to Dr. Sarah Chen
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Doctor Role Advisory */}
        {!isDoctor && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-amber-900 text-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>
                You are currently not connected as an authorized physician. Emergency overrides will be rejected by smart contracts unless signed by a registered doctor.
              </span>
            </div>
            <button
              onClick={() => selectDemoAccount(DEMO_ACCOUNTS[2])}
              className="text-xs font-bold underline shrink-0 hover:text-amber-800"
            >
              Log in as Doctor
            </button>
          </div>
        )}

        {/* Active Emergency Session Banner */}
        {activeSession && secondsRemaining !== null && secondsRemaining > 0 && (
          <div className="p-5 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white rounded-2xl shadow-lg border border-red-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-yellow-300 animate-bounce" />
                  <span className="font-bold text-lg tracking-wide uppercase">
                    Active Trauma Override Window
                  </span>
                </div>
                <div className="text-xs text-red-100 font-mono">
                  Target Pseudonym: {activeSession.patientIdHash.slice(0, 20)}...
                </div>
                <div className="text-xs text-red-100 italic">
                  &ldquo;{activeSession.justification}&rdquo;
                </div>
              </div>

              <div className="flex items-center gap-4 bg-black/20 p-3 rounded-xl border border-white/20">
                <div className="text-right">
                  <div className="text-[10px] uppercase font-mono text-white/80">Access Closes In</div>
                  <div className="text-2xl font-mono font-black text-yellow-200">
                    {formatCountdown(secondsRemaining)}
                  </div>
                </div>

                <Link
                  href={`/doctor/records`}
                  className="px-4 py-2 bg-white text-red-700 hover:bg-slate-100 font-bold text-xs rounded-lg shadow-sm transition flex items-center gap-1.5"
                >
                  <span>Open Records</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Form and Explanations Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Action Form */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100 text-[#0F1F2E]">
              <Flame className="w-5 h-5 text-red-600" />
              <h2 className="font-bold text-lg">Trigger Break-Glass Emergency Access</h2>
            </div>

            <form onSubmit={handleExecuteBreakGlass} className="mt-5 space-y-5">
              {/* Target Patient */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Target Patient Identifier / Pseudonym
                  </label>
                  <button
                    type="button"
                    onClick={handleUseAliceDemo}
                    className="text-xs text-[#1F7A7A] hover:underline font-mono"
                  >
                    Load Demo: Alice Vance
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="Enter Patient SSN / MRN or 0x... salted pseudonym hash"
                  value={patientIdInput}
                  onChange={(e) => handlePatientIdChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
                />
                {patientPseudonym && (
                  <div className="text-[11px] font-mono text-slate-500 mt-1 flex items-center gap-1.5">
                    <span className="text-slate-400">On-Chain Pseudonym:</span>
                    <span className="text-red-700 font-semibold">{patientPseudonym.slice(0, 22)}...</span>
                  </div>
                )}
              </div>

              {/* Record Scope */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Record Scope
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setRecordIdInput(
                        "0x0000000000000000000000000000000000000000000000000000000000000000"
                      )
                    }
                    className={`p-3 text-left border rounded-xl transition ${
                      recordIdInput ===
                      "0x0000000000000000000000000000000000000000000000000000000000000000"
                        ? "border-red-500 bg-red-50/50 text-red-900"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="font-semibold text-xs text-red-950">Critical Medical Summary (24h Time-Box)</div>
                    <div className="text-[11px] text-red-800 mt-0.5">
                      Blood Group, Severe Allergies, Active Medications & Recent Discharge Summary
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRecordIdInput("")}
                    className={`p-3 text-left border rounded-xl transition ${
                      recordIdInput !==
                      "0x0000000000000000000000000000000000000000000000000000000000000000"
                        ? "border-red-500 bg-red-50/50 text-red-900"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="font-semibold text-xs">Specific Record Hash</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Target one isolated record ID
                    </div>
                  </button>
                </div>

                {recordIdInput !==
                  "0x0000000000000000000000000000000000000000000000000000000000000000" && (
                  <div className="mt-2">
                    <input
                      type="text"
                      placeholder="0x... Record ID hash"
                      value={recordIdInput}
                      onChange={(e) => setRecordIdInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                )}
              </div>

              {/* Clinical Justification */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Mandatory Clinical Justification
                </label>
                <select
                  value={selectedPreset}
                  onChange={(e) => setSelectedPreset(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-red-500 bg-white"
                >
                  {JUSTIFICATION_PRESETS.map((p, idx) => (
                    <option key={idx} value={p}>
                      {p}
                    </option>
                  ))}
                </select>

                <textarea
                  rows={2}
                  placeholder="Additional patient presentation notes, clinical signs, attending team..."
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  className="w-full mt-2 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-red-500"
                />
              </div>

              {/* Legal Affirmation */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={confirmedLegal}
                    onChange={(e) => setConfirmedLegal(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-xs text-slate-700 leading-relaxed">
                    <strong>Medical License Affirmation:</strong> I certify under penalty of medical license suspension and criminal liability that the patient is unable to grant consent and that failure to obtain immediate records poses a clear threat to life or severe impairment.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting || !confirmedLegal}
                className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm tracking-wide shadow-md transition flex items-center justify-center gap-2"
              >
                <AlertOctagon className="w-4 h-4" />
                <span>
                  {submitting ? "Broadcasting Emergency Override..." : "Execute Break-Glass Emergency Access (24h)"}
                </span>
              </button>
            </form>
          </div>

          {/* Right Protocol Specification & Security Guarantees */}
          <div className="space-y-6">
            <div className="bg-[#0F1F2E] text-slate-200 p-6 rounded-2xl border border-slate-800 shadow-xs">
              <div className="flex items-center gap-2 text-red-400 font-bold text-sm mb-3">
                <ShieldAlert className="w-4 h-4" />
                <span>Break-Glass Architecture</span>
              </div>
              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                  <span>
                    <strong>Time-Limited:</strong> Strictly capped at 24 hours (86,400 seconds) by smart contract logic.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                  <span>
                    <strong>Cryptographic Identity:</strong> Only active doctors from registered consortium hospitals can invoke.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                  <span>
                    <strong>Immutable Audit:</strong> The justification and doctor wallet are permanently anchored on-chain.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                  <span>
                    <strong>Patient Notification:</strong> When the patient recovers, the emergency access appears on their portal requiring review & acknowledgement.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                  <span>
                    <strong>Federation Review Queue:</strong> Event is dual-anchored on both chains and enqueued in the Federation Admin Review Queue for clinical audit.
                  </span>
                </li>
              </ul>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <h3 className="text-xs font-bold uppercase text-slate-600 tracking-wider mb-2 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-[#1F7A7A]" />
                <span>Quick Access Shortcuts</span>
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                Need to verify existing patient consent instead of break-glass?
              </p>
              <div className="space-y-2">
                <Link
                  href="/doctor/records"
                  className="block p-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition"
                >
                  &rarr; Check Regular Patient Consents
                </Link>
                <Link
                  href="/audit"
                  className="block p-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition"
                >
                  &rarr; Inspect Consortium Audit Feed
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Break-Glass Invocations Across Consortium */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-600" />
              <h3 className="font-bold text-sm text-[#0F1F2E]">
                Consortium Emergency Override Invocations
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-500">
              {emergencyEvents.length} Total Events
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Attending Physician</th>
                  <th className="py-2.5 px-4">Patient Pseudonym</th>
                  <th className="py-2.5 px-4">Clinical Justification</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {emergencyEvents.map((ev, idx) => {
                  const now = Math.floor(Date.now() / 1000);
                  const isStillValid = ev.validUntil > now;

                  return (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {new Date(ev.accessedAt * 1000).toLocaleString()}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-mono text-slate-800">
                          {ev.doctor.slice(0, 8)}...{ev.doctor.slice(-6)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Hospital: {ev.hospital.slice(0, 8)}...
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-600">
                        {ev.patientIdHash.slice(0, 16)}...
                      </td>

                      <td className="py-3 px-4 max-w-xs text-slate-700 truncate" title={ev.justification}>
                        {ev.justification}
                      </td>

                      <td className="py-3 px-4">
                        {isStillValid ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping"></span> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                            Expired
                          </span>
                        )}
                        {ev.acknowledged && (
                          <span className="ml-1 text-[10px] text-emerald-700 font-medium">
                            (Acknowledged)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

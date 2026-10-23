"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { useWeb3, DEMO_ACCOUNTS } from "@/context/Web3Context";
import {
  Network,
  ShieldCheck,
  ShieldAlert,
  Building2,
  Activity,
  AlertOctagon,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Search,
  ExternalLink,
  Plus,
  ArrowRight,
  Pause,
  Play,
  Lock,
  Layers,
  FileText,
  AlertTriangle,
  Server,
  Zap,
} from "lucide-react";

interface FederationMember {
  id: string;
  name: string;
  institutionType: "HOSPITAL" | "LAB" | "CLINIC";
  chainType: "EVM" | "CUSTOM_LEDGER";
  chainId?: number;
  rpcPort: number;
  gatewayPublicKey: string;
  trustLevel: number;
  status: "ACTIVE" | "SUSPENDED";
  recordsAnchored: number;
  joinedAt: string;
}

interface InteropEnvelopeLog {
  messageId: string;
  type: "REQUEST_RECORDS" | "CONSENT_PROOF" | "RECORD_PACKAGE" | "REVOKE" | "EMERGENCY_ACCESS" | "LAB_RESULT_PUSH";
  from: string;
  to: string;
  fromChain: string;
  toChain: string;
  patientIdHash: string;
  timestamp: string;
  status: "DELIVERED" | "QUEUED_OFFLINE" | "ACKNOWLEDGED" | "REJECTED";
  phiInspectionStatus: "ZERO_PHI_VERIFIED";
}

interface EmergencyReviewItem {
  id: string;
  accessId: string;
  requestingDoctor: string;
  requestingHospital: string;
  sourceHospital: string;
  patientGlobalId: string;
  justification: string;
  scope: string[];
  accessedAt: string;
  validUntil: string;
  status: "PENDING_REVIEW" | "JUSTIFICATION_VALIDATED" | "FLAGGED_FOR_INQUIRY";
  adminNotes?: string;
}

const INITIAL_MEMBERS: FederationMember[] = [
  {
    id: "INST-A-CGH",
    name: "City General Hospital",
    institutionType: "HOSPITAL",
    chainType: "EVM",
    chainId: 31337,
    rpcPort: 8545,
    gatewayPublicKey: "0x04a298bfd4695e6c7104b901bc3d45ef88912ba091c784...b198c25f4",
    trustLevel: 3,
    status: "ACTIVE",
    recordsAnchored: 142,
    joinedAt: "2026-08-15",
  },
  {
    id: "INST-B-RSH",
    name: "Regional Specialty Hospital",
    institutionType: "HOSPITAL",
    chainType: "EVM",
    chainId: 31338,
    rpcPort: 8546,
    gatewayPublicKey: "0x04df987aa810c92138e9c402ad7799b329c011e4f9...f9812bb01",
    trustLevel: 3,
    status: "ACTIVE",
    recordsAnchored: 98,
    joinedAt: "2026-09-01",
  },
  {
    id: "INST-C-MDL",
    name: "Metro Diagnostics Laboratory",
    institutionType: "LAB",
    chainType: "CUSTOM_LEDGER",
    rpcPort: 9000,
    gatewayPublicKey: "0x04889c104e76a084ef7a3c713b192804c771a39d89...ee204bb87",
    trustLevel: 2,
    status: "ACTIVE",
    recordsAnchored: 315,
    joinedAt: "2026-09-20",
  },
  {
    id: "INST-D-VCC",
    name: "Valley Community Clinic",
    institutionType: "CLINIC",
    chainType: "EVM",
    chainId: 31339,
    rpcPort: 8548,
    gatewayPublicKey: "0x0471bf44a198de71...cc1098ef32",
    trustLevel: 1,
    status: "SUSPENDED",
    recordsAnchored: 12,
    joinedAt: "2026-10-02",
  },
];

const INITIAL_TRANSIT_LOGS: InteropEnvelopeLog[] = [
  {
    messageId: "ENV-2026-9041",
    type: "RECORD_PACKAGE",
    from: "City General Hospital",
    to: "Regional Specialty Hospital",
    fromChain: "Network A (EVM 31337)",
    toChain: "Network B (EVM 31338)",
    patientIdHash: "0x88f5...b8d8",
    timestamp: "10 mins ago",
    status: "DELIVERED",
    phiInspectionStatus: "ZERO_PHI_VERIFIED",
  },
  {
    messageId: "ENV-2026-9040",
    type: "CONSENT_PROOF",
    from: "City General Hospital",
    to: "Regional Specialty Hospital",
    fromChain: "Network A (EVM 31337)",
    toChain: "Network B (EVM 31338)",
    patientIdHash: "0x88f5...b8d8",
    timestamp: "12 mins ago",
    status: "DELIVERED",
    phiInspectionStatus: "ZERO_PHI_VERIFIED",
  },
  {
    messageId: "ENV-2026-9039",
    type: "REQUEST_RECORDS",
    from: "Regional Specialty Hospital",
    to: "City General Hospital",
    fromChain: "Network B (EVM 31338)",
    toChain: "Network A (EVM 31337)",
    patientIdHash: "0x88f5...b8d8",
    timestamp: "15 mins ago",
    status: "DELIVERED",
    phiInspectionStatus: "ZERO_PHI_VERIFIED",
  },
  {
    messageId: "ENV-2026-9038",
    type: "LAB_RESULT_PUSH",
    from: "Metro Diagnostics Laboratory",
    to: "Regional Specialty Hospital",
    fromChain: "Network C (Fabric-Style Simulated 9000)",
    toChain: "Network B (EVM 31338)",
    patientIdHash: "0x88f5...b8d8",
    timestamp: "45 mins ago",
    status: "ACKNOWLEDGED",
    phiInspectionStatus: "ZERO_PHI_VERIFIED",
  },
  {
    messageId: "ENV-2026-9037",
    type: "EMERGENCY_ACCESS",
    from: "Regional Specialty Hospital",
    to: "City General Hospital",
    fromChain: "Network B (EVM 31338)",
    toChain: "Network A (EVM 31337)",
    patientIdHash: "0x88f5...b8d8",
    timestamp: "2 hours ago",
    status: "DELIVERED",
    phiInspectionStatus: "ZERO_PHI_VERIFIED",
  },
];

const INITIAL_EMERGENCY_REVIEWS: EmergencyReviewItem[] = [
  {
    id: "REV-2026-001",
    accessId: "0x9812ba44...c812",
    requestingDoctor: "Dr. Sarah Chen, MD (Lic: MED-CA-89211)",
    requestingHospital: "Regional Specialty Hospital (Network B)",
    sourceHospital: "City General Hospital (Network A)",
    patientGlobalId: "0x88f5a1334c9c7f1a30f3f2f81498c4bc6ec2e5bfa780d6f30a990a42a08ab8d8",
    justification: "Acute polytrauma with Glasgow Coma Scale (GCS) < 8; unconscious patient admitted via EMS after vehicular accident. Immediate access required for allergy profiling and cardiac history before emergency surgery.",
    scope: ["BLOOD_GROUP", "ALLERGIES", "ACTIVE_MEDICATIONS", "RECENT_DISCHARGE_SUMMARY"],
    accessedAt: "2 hours ago",
    validUntil: "In 22 hours (24h time-box)",
    status: "PENDING_REVIEW",
  },
  {
    id: "REV-2026-000",
    accessId: "0x44cd12aa...7781",
    requestingDoctor: "Dr. Robert Miller, DO (Lic: MED-NY-44120)",
    requestingHospital: "City General Hospital (Network A)",
    sourceHospital: "Regional Specialty Hospital (Network B)",
    patientGlobalId: "0x33b8a19280cdfa1199321481b238f902ac7819ef01aa7219c01289feea1109dc",
    justification: "Severe refractory anaphylactic reaction unresponsive to primary epinephrine dose; needed prior immunotherapy and steroid sensitivity records.",
    scope: ["ALLERGIES", "ACTIVE_MEDICATIONS"],
    accessedAt: "Yesterday at 14:30",
    validUntil: "Expired",
    status: "JUSTIFICATION_VALIDATED",
    adminNotes: "Clinically justified under Level-1 Anaphylaxis Protocol. Validated by Chief Consortium Officer.",
  },
];

export default function FederationAdminPage() {
  const { account, role, notify } = useWeb3();

  const [activeTab, setActiveTab] = useState<"members" | "monitor" | "emergency">("members");
  const [members, setMembers] = useState<FederationMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [transitLogs, setTransitLogs] = useState<InteropEnvelopeLog[]>(INITIAL_TRANSIT_LOGS);
  const [reviews, setReviews] = useState<EmergencyReviewItem[]>(INITIAL_EMERGENCY_REVIEWS);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal for onboarding new institution
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [newInstName, setNewInstName] = useState("");
  const [newInstType, setNewInstType] = useState<"HOSPITAL" | "LAB" | "CLINIC">("HOSPITAL");
  const [newChainType, setNewChainType] = useState<"EVM" | "CUSTOM_LEDGER">("EVM");
  const [newPort, setNewPort] = useState(8549);
  const [newTrustLevel, setNewTrustLevel] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Review modal / action state
  const [selectedReview, setSelectedReview] = useState<EmergencyReviewItem | null>(null);
  const [adminNoteInput, setAdminNoteInput] = useState("");

  const loadInstitutions = async () => {
    try {
      setLoadingMembers(true);
      const res = await fetch("/api/federation/institutions");
      if (res.ok) {
        const data = await res.json();
        if (data.institutions && data.institutions.length > 0) {
          const formatted: FederationMember[] = data.institutions.map((inst: any) => ({
            id: inst.id,
            name: inst.name,
            institutionType: inst.institution_type,
            chainType: inst.chain_type === "PERMISSIONED_LEDGER" ? "CUSTOM_LEDGER" : "EVM",
            chainId: inst.chain_type === "EVM" ? Number(inst.chain_id || 31337) : undefined,
            rpcPort: inst.rpc_port || 8545,
            gatewayPublicKey: inst.gateway_public_key,
            trustLevel: inst.trust_level || 3,
            status: inst.status || "ACTIVE",
            recordsAnchored: 0,
            joinedAt: new Date(inst.created_at || Date.now()).toISOString().split("T")[0],
          }));
          setMembers(formatted);
          return;
        }
      }
      // If DB is empty, set empty array so clean start is truly clean!
      setMembers([]);
    } catch {
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    loadInstitutions();
  }, []);

  const toggleMemberStatus = async (id: string) => {
    const current = members.find((m) => m.id === id);
    if (!current) return;
    const nextStatus = current.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";

    try {
      await fetch("/api/federation/institutions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: nextStatus }),
      });
      setMembers((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: nextStatus } : m))
      );
      notify("info", `Institution status updated: ${current.name} is now ${nextStatus} in Federation Registry.`);
    } catch (e: any) {
      notify("error", "Status update failed", e.message);
    }
  };

  const handleOnboardMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstName.trim()) return;

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/federation/institutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newInstName.trim(),
          institutionType: newInstType,
          chainType: newChainType === "CUSTOM_LEDGER" ? "PERMISSIONED_LEDGER" : "EVM",
          chainId: newChainType === "EVM" ? (31340 + members.length).toString() : "FABRIC_LEDGER",
          rpcPort: Number(newPort),
          trustLevel: Number(newTrustLevel),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Onboarding failed");
      }

      await loadInstitutions();
      setShowOnboardModal(false);
      setNewInstName("");
      notify("success", `Institution onboarded: ${newInstName} registered on Federation Registry with auto-generated gateway keypair!`);
    } catch (err: any) {
      notify("error", "Onboarding Failed", err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleValidateReview = (reviewId: string) => {
    setReviews((prev) =>
      prev.map((r) => {
        if (r.id === reviewId) {
          notify("success", "Break-glass justification approved and notarized in consortium audit log.");
          return {
            ...r,
            status: "JUSTIFICATION_VALIDATED",
            adminNotes: adminNoteInput || "Clinically justified under Consortium Emergency Protocols. Validated by Federation Admin.",
          };
        }
        return r;
      })
    );
    setSelectedReview(null);
    setAdminNoteInput("");
  };

  const handleFlagReview = (reviewId: string) => {
    setReviews((prev) =>
      prev.map((r) => {
        if (r.id === reviewId) {
          notify("info", "Break-glass event flagged for formal clinical inquiry. Hospital compliance notified.");
          return {
            ...r,
            status: "FLAGGED_FOR_INQUIRY",
            adminNotes: adminNoteInput || "Flagged for peer review: Clinical justification warrants secondary hospital inquiry.",
          };
        }
        return r;
      })
    );
    setSelectedReview(null);
    setAdminNoteInput("");
  };

  const pendingEmergencyCount = reviews.filter((r) => r.status === "PENDING_REVIEW").length;
  const activeMembersCount = members.filter((m) => m.status === "ACTIVE").length;

  return (
    <AppShell>
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-medichain-border">
        <div>
          <div className="flex items-center space-x-3">
            <span className="p-2 bg-medichain-navy text-white rounded-lg">
              <Network className="w-5 h-5 text-medichain-teal" />
            </span>
            <div>
              <h1 className="font-serif text-2xl font-bold text-medichain-navy">
                Federation Registry & Interop Portal
              </h1>
              <p className="text-sm text-medichain-muted mt-0.5">
                Neutral cross-chain governance on Federation Chain (31340). Zero PHI stored; attestation, trust directory, and emergency review.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowOnboardModal(true)}
            className="flex items-center space-x-2 bg-medichain-teal hover:bg-[#186363] text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Onboard Institution</span>
          </button>
        </div>
      </div>

      {/* Telemetry Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-medichain-border rounded-lg p-5">
          <div className="flex items-center justify-between text-xs text-medichain-muted mb-2">
            <span className="font-medium uppercase tracking-wider">Federation Members</span>
            <Building2 className="w-4 h-4 text-medichain-teal" />
          </div>
          <div className="text-2xl font-serif font-bold text-medichain-navy">
            {activeMembersCount} <span className="text-sm font-sans font-normal text-medichain-muted">/ {members.length} Active</span>
          </div>
          <div className="mt-2 text-xs text-emerald-700 flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>2 EVM Chains, 1 Fabric-Style Simulated Ledger</span>
          </div>
        </div>

        <div className="bg-white border border-medichain-border rounded-lg p-5">
          <div className="flex items-center justify-between text-xs text-medichain-muted mb-2">
            <span className="font-medium uppercase tracking-wider">Interop Messages</span>
            <Activity className="w-4 h-4 text-medichain-teal" />
          </div>
          <div className="text-2xl font-serif font-bold text-medichain-navy">
            1,284
          </div>
          <div className="mt-2 text-xs text-emerald-700 flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>100% Zero-PHI Envelopes</span>
          </div>
        </div>

        <div className="bg-white border border-medichain-border rounded-lg p-5">
          <div className="flex items-center justify-between text-xs text-medichain-muted mb-2">
            <span className="font-medium uppercase tracking-wider">Replay Protection</span>
            <ShieldCheck className="w-4 h-4 text-medichain-teal" />
          </div>
          <div className="text-2xl font-serif font-bold text-medichain-navy">
            Zero Replays
          </div>
          <div className="mt-2 text-xs text-medichain-muted flex items-center space-x-1">
            <span>Nonce + MessageId Cache Active</span>
          </div>
        </div>

        <div className="bg-white border border-medichain-border rounded-lg p-5">
          <div className="flex items-center justify-between text-xs text-medichain-muted mb-2">
            <span className="font-medium uppercase tracking-wider">Emergency Review Queue</span>
            <AlertOctagon className="w-4 h-4 text-medichain-tampered" />
          </div>
          <div className="text-2xl font-serif font-bold text-medichain-tampered">
            {pendingEmergencyCount}{" "}
            <span className="text-xs font-sans font-normal text-medichain-muted">
              {pendingEmergencyCount === 1 ? "Action required" : "Actions required"}
            </span>
          </div>
          <div className="mt-2 text-xs text-amber-800 flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Post-hoc break-glass auditing</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-medichain-border gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab("members")}
          className={`pb-3 relative transition-colors ${
            activeTab === "members"
              ? "text-medichain-navy border-b-2 border-medichain-teal font-semibold"
              : "text-medichain-muted hover:text-medichain-navy"
          }`}
        >
          <span>Member Institutions Directory ({members.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("monitor")}
          className={`pb-3 relative transition-colors ${
            activeTab === "monitor"
              ? "text-medichain-navy border-b-2 border-medichain-teal font-semibold"
              : "text-medichain-muted hover:text-medichain-navy"
          }`}
        >
          <span>Live Interop Hub Monitor ({transitLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("emergency")}
          className={`pb-3 relative flex items-center space-x-2 transition-colors ${
            activeTab === "emergency"
              ? "text-medichain-tampered border-b-2 border-medichain-tampered font-semibold"
              : "text-medichain-muted hover:text-medichain-navy"
          }`}
        >
          <span>Emergency Review Queue</span>
          {pendingEmergencyCount > 0 && (
            <span className="px-1.5 py-0.5 bg-red-100 text-red-800 rounded-full text-[10px] font-bold">
              {pendingEmergencyCount}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: Member Institutions */}
      {activeTab === "members" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-lg border border-medichain-border">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-medichain-muted absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search member, chain, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-medichain-bg border border-medichain-border rounded-md text-medichain-navy focus:outline-none focus:border-medichain-teal"
              />
            </div>
            <div className="text-xs text-medichain-muted">
              Federation Registry Contract: <span className="font-mono text-medichain-navy">0x5FbDB...31340</span> (Federation Chain)
            </div>
          </div>

          <div className="bg-white border border-medichain-border rounded-lg overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-medichain-bg text-medichain-muted border-b border-medichain-border uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 font-semibold">Institution</th>
                    <th className="py-3 px-4 font-semibold">Chain Architecture</th>
                    <th className="py-3 px-4 font-semibold">RPC / API</th>
                    <th className="py-3 px-4 font-semibold">Trust Tier</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-medichain-border">
                  {members.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <div className="font-medium text-slate-700">No institutions onboarded yet.</div>
                        <div className="text-xs text-slate-400 mt-1">
                          Click "+ Onboard Institution" above to register your first sovereign hospital or diagnostic lab.
                        </div>
                      </td>
                    </tr>
                  ) : members
                    .filter(
                      (m) =>
                        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        m.chainType.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        m.id.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((member) => (
                      <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-medichain-navy">{member.name}</div>
                          <div className="text-[11px] text-medichain-muted font-mono">{member.id} &bull; Joined {member.joinedAt}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-1.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider ${
                                member.chainType === "EVM"
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : "bg-purple-50 text-purple-700 border border-purple-200"
                              }`}
                            >
                              {member.chainType === "EVM" ? `EVM (Chain ${member.chainId})` : "PERMISSIONED LEDGER"}
                            </span>
                          </div>
                          <div className="text-[10px] text-medichain-muted mt-0.5 truncate max-w-xs font-mono">
                            Gateway: {member.gatewayPublicKey.slice(0, 18)}...
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-medichain-navy">
                          localhost:{member.rpcPort}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-1">
                            {Array.from({ length: 3 }).map((_, i) => (
                              <span
                                key={i}
                                className={`w-2 h-2 rounded-full ${
                                  i < member.trustLevel ? "bg-medichain-teal" : "bg-slate-200"
                                }`}
                              />
                            ))}
                            <span className="text-[11px] text-medichain-muted ml-1">
                              Tier {member.trustLevel}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {member.status === "ACTIVE" ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span>Active</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-50 text-red-700 border border-red-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                              <span>Suspended</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => toggleMemberStatus(member.id)}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                              member.status === "ACTIVE"
                                ? "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200"
                                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                            }`}
                          >
                            {member.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Live Interop Hub Monitor */}
      {activeTab === "monitor" && (
        <div className="space-y-4">
          <div className="bg-medichain-bg border border-medichain-border rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-medichain-teal text-white rounded-md">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-sm text-medichain-navy">
                  Interop Hub Message Router Status: OPERATIONAL
                </div>
                <div className="text-xs text-medichain-muted">
                  Enforces envelope schemas, anti-replay nonces, gateway signatures, and zero PHI transit.
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4 text-xs font-mono">
              <div className="bg-white px-3 py-1.5 rounded border border-medichain-border">
                <span className="text-medichain-muted">Hub Port: </span>
                <span className="text-medichain-navy font-semibold">9050</span>
              </div>
              <div className="bg-white px-3 py-1.5 rounded border border-medichain-border">
                <span className="text-medichain-muted">Backoff: </span>
                <span className="text-medichain-navy font-semibold">2s &rarr; 16s</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-medichain-border rounded-lg overflow-hidden shadow-sm">
            <div className="p-4 border-b border-medichain-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-medichain-navy font-serif">
                Cross-Chain Envelope Transit Log
              </h2>
              <span className="text-xs text-medichain-muted flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Socket Stream</span>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-medichain-bg text-medichain-muted border-b border-medichain-border uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 font-semibold">Envelope ID</th>
                    <th className="py-3 px-4 font-semibold">Message Type</th>
                    <th className="py-3 px-4 font-semibold">Source & Destination</th>
                    <th className="py-3 px-4 font-semibold">Patient Salted Hash</th>
                    <th className="py-3 px-4 font-semibold">PHI Inspection</th>
                    <th className="py-3 px-4 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-medichain-border font-mono">
                  {transitLogs.map((log) => (
                    <tr key={log.messageId} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-medichain-navy">{log.messageId}</span>
                        <div className="text-[10px] text-medichain-muted">{log.timestamp}</div>
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide ${
                            log.type === "EMERGENCY_ACCESS"
                              ? "bg-red-50 text-red-700 border border-red-200"
                              : log.type === "REVOKE"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-medichain-sage text-medichain-teal"
                          }`}
                        >
                          {log.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <div className="text-medichain-navy font-medium text-xs">{log.from} &rarr; {log.to}</div>
                        <div className="text-[10px] text-medichain-muted font-mono">{log.fromChain} &rarr; {log.toChain}</div>
                      </td>
                      <td className="py-3.5 px-4 text-medichain-muted">
                        {log.patientIdHash}
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <span className="inline-flex items-center space-x-1 text-[11px] text-emerald-700 font-medium">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Zero PHI Verified</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-sans">
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>{log.status}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Emergency Break-Glass Review Queue */}
      {activeTab === "emergency" && (
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3 text-red-900">
            <AlertOctagon className="w-5 h-5 text-medichain-tampered shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-semibold text-sm block">Consortium Break-Glass Governance Policy</span>
              <p>
                In Level-1 trauma emergencies, attending doctors may execute time-boxed (24-hour) emergency retrieval
                for life-saving records across sovereign chains without prior patient interaction.
                All events are dual-anchored on both chains, and the Federation Administrator is legally required to review clinical justifications.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {reviews.map((rev) => (
              <div
                key={rev.id}
                className="bg-white border border-medichain-border rounded-lg p-5 shadow-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-medichain-border">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-medichain-navy">{rev.id}</span>
                    <span className="text-medichain-muted text-xs">&bull;</span>
                    <span className="text-xs text-medichain-muted">Access ID: <code className="font-mono">{rev.accessId}</code></span>
                  </div>

                  <div>
                    {rev.status === "PENDING_REVIEW" && (
                      <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Pending Admin Review</span>
                      </span>
                    )}
                    {rev.status === "JUSTIFICATION_VALIDATED" && (
                      <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Justification Validated</span>
                      </span>
                    )}
                    {rev.status === "FLAGGED_FOR_INQUIRY" && (
                      <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-800 border border-red-300">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                        <span>Flagged for Peer Review</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-medichain-muted block mb-1">Attending Clinician & Requesting Hospital:</span>
                    <div className="font-medium text-medichain-navy">{rev.requestingDoctor}</div>
                    <div className="text-medichain-muted">{rev.requestingHospital}</div>
                  </div>

                  <div>
                    <span className="text-medichain-muted block mb-1">Source Hospital & Validity Window:</span>
                    <div className="font-medium text-medichain-navy">{rev.sourceHospital}</div>
                    <div className="text-amber-800 font-mono font-medium">{rev.validUntil}</div>
                  </div>
                </div>

                {/* Stated Justification */}
                <div className="bg-medichain-bg border border-medichain-border rounded p-3 text-xs">
                  <div className="font-semibold text-medichain-navy mb-1 flex items-center space-x-1.5">
                    <FileText className="w-3.5 h-3.5 text-medichain-teal" />
                    <span>Attending Doctor's Sworn Justification:</span>
                  </div>
                  <p className="text-slate-700 italic">
                    "{rev.justification}"
                  </p>
                </div>

                {/* Scope granted */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="text-medichain-muted">Released Scope:</span>
                  {rev.scope.map((cat) => (
                    <span
                      key={cat}
                      className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] border border-slate-200"
                    >
                      {cat}
                    </span>
                  ))}
                </div>

                {/* Admin notes if existing */}
                {rev.adminNotes && (
                  <div className="bg-slate-50 border border-slate-200 rounded p-2.5 text-xs text-slate-800">
                    <span className="font-semibold">Review Outcome Note: </span>
                    <span>{rev.adminNotes}</span>
                  </div>
                )}

                {/* Actions */}
                {rev.status === "PENDING_REVIEW" && (
                  <div className="pt-2 flex items-center justify-end space-x-3 border-t border-medichain-border">
                    <button
                      onClick={() => handleFlagReview(rev.id)}
                      className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition-colors"
                    >
                      Flag for Inquiry
                    </button>
                    <button
                      onClick={() => handleValidateReview(rev.id)}
                      className="px-4 py-1.5 text-xs font-medium text-white bg-medichain-teal hover:bg-[#186363] rounded transition-colors shadow-sm"
                    >
                      Validate Justification
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: Onboard New Institution */}
      {showOnboardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg border border-medichain-border shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-medichain-border pb-3">
              <h2 className="font-serif text-lg font-bold text-medichain-navy">
                Onboard Institution to Federation
              </h2>
              <button
                onClick={() => setShowOnboardModal(false)}
                className="text-medichain-muted hover:text-medichain-navy text-sm"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleOnboardMember} className="space-y-4 text-xs">
              <div>
                <label className="block text-medichain-navy font-medium mb-1">
                  Institution Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. St. Luke's Academic Health Center"
                  value={newInstName}
                  onChange={(e) => setNewInstName(e.target.value)}
                  className="w-full px-3 py-2 border border-medichain-border rounded text-xs focus:outline-none focus:border-medichain-teal"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-medichain-navy font-medium mb-1">
                    Institution Type
                  </label>
                  <select
                    value={newInstType}
                    onChange={(e) => setNewInstType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-medichain-border rounded text-xs bg-white focus:outline-none focus:border-medichain-teal"
                  >
                    <option value="HOSPITAL">Hospital</option>
                    <option value="LAB">Diagnostics Lab</option>
                    <option value="CLINIC">Outpatient Clinic</option>
                  </select>
                </div>

                <div>
                  <label className="block text-medichain-navy font-medium mb-1">
                    Chain Architecture
                  </label>
                  <select
                    value={newChainType}
                    onChange={(e) => setNewChainType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-medichain-border rounded text-xs bg-white focus:outline-none focus:border-medichain-teal"
                  >
                    <option value="EVM">EVM (Ethereum-Compatible)</option>
                    <option value="CUSTOM_LEDGER">Non-EVM Permissioned Ledger</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-medichain-navy font-medium mb-1">
                    RPC / Node Port
                  </label>
                  <input
                    type="number"
                    value={newPort}
                    onChange={(e) => setNewPort(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-medichain-border rounded text-xs focus:outline-none focus:border-medichain-teal font-mono"
                  />
                </div>

                <div>
                  <label className="block text-medichain-navy font-medium mb-1">
                    Trust Tier Level
                  </label>
                  <select
                    value={newTrustLevel}
                    onChange={(e) => setNewTrustLevel(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-medichain-border rounded text-xs bg-white focus:outline-none focus:border-medichain-teal"
                  >
                    <option value={1}>Tier 1 - Standard Member</option>
                    <option value={2}>Tier 2 - Certified Lab / Specialty</option>
                    <option value={3}>Tier 3 - Sovereign Tertiary Anchor</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-medichain-bg border border-medichain-border rounded text-[11px] text-medichain-muted space-y-1">
                <span className="font-semibold text-medichain-navy block">Neutral Registry Guarantee</span>
                <p>
                  Registering an institution issues a cryptographic attestation on Federation Chain 31340 and stores the gateway public key. No medical content or patient records are ever held in the Federation registry.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-medichain-border">
                <button
                  type="button"
                  onClick={() => setShowOnboardModal(false)}
                  className="px-3 py-1.5 text-medichain-muted hover:text-medichain-navy"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-medichain-teal hover:bg-[#186363] text-white rounded font-medium shadow-sm transition-colors"
                >
                  Register on Federation Chain
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

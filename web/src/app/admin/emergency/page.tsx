"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  ShieldAlert,
  AlertOctagon,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  Building2,
  FileText,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Check,
  X,
  Phone,
  HeartPulse,
} from "lucide-react";

interface EmergencyReviewItem {
  reviewId: string;
  accessId: string;
  patientIdHash: string;
  doctorName: string;
  doctorWallet: string;
  hospitalId: string;
  clinicalJustification: string;
  emergencyLevel: string;
  triggeredAt: number;
  expiresAt: number;
  status: "PENDING_REVIEW" | "JUSTIFICATION_VALIDATED" | "FLAGGED_FOR_INQUIRY";
  adminNotes?: string;
  reviewedAt?: number;
  reviewedBy?: string;
  emergencyContactPhone?: string;
  criticalSummary?: any;
}

export default function AdminEmergencyReviewPage() {
  const [reviews, setReviews] = useState<EmergencyReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReview, setSelectedReview] = useState<EmergencyReviewItem | null>(null);
  const [actionModal, setActionModal] = useState<"VALIDATE" | "FLAG" | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/emergency/reviews");
      if (res.ok) {
        const json = await res.json();
        setReviews(json.reviews || []);
      }
    } catch (err) {
      console.error("Failed to load emergency review queue:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleDecision = async (status: "JUSTIFICATION_VALIDATED" | "FLAGGED_FOR_INQUIRY") => {
    if (!selectedReview) return;
    setSubmittingAction(true);
    try {
      const res = await fetch("/api/emergency/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId: selectedReview.reviewId,
          status,
          adminNotes: reviewNote || (status === "JUSTIFICATION_VALIDATED" ? "Justification validated by consortium compliance." : "Flagged for formal compliance inquiry."),
          reviewerWallet: "0xConsortiumComplianceAdmin",
        }),
      });

      if (res.ok) {
        setActionModal(null);
        setSelectedReview(null);
        setReviewNote("");
        fetchReviews();
      }
    } catch (err) {
      console.error("Failed to submit review decision:", err);
    } finally {
      setSubmittingAction(false);
    }
  };

  const pendingCount = reviews.filter((r) => r.status === "PENDING_REVIEW").length;
  const validatedCount = reviews.filter((r) => r.status === "JUSTIFICATION_VALIDATED").length;
  const flaggedCount = reviews.filter((r) => r.status === "FLAGGED_FOR_INQUIRY").length;

  const filteredReviews = reviews.filter((r) => {
    const matchesFilter = filterStatus === "ALL" || r.status === filterStatus;
    const matchesSearch =
      !searchQuery ||
      r.doctorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.clinicalJustification.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.patientIdHash.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.hospitalId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-rose-100 text-rose-800 rounded-lg">
                <AlertOctagon className="w-5 h-5" />
              </span>
              <h1 className="text-2xl font-bold text-[#0F1F2E]">Federation Emergency Review Queue</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Independent multi-institution compliance review for all Level-1 emergency break-glass overrides.
            </p>
          </div>
          <button
            onClick={fetchReviews}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh Queue</span>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Total Break-Glass Events</div>
            <div className="text-2xl font-bold text-[#0F1F2E] mt-1">{reviews.length}</div>
          </div>
          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 shadow-xs">
            <div className="text-amber-800 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Pending Audit
            </div>
            <div className="text-2xl font-bold text-amber-900 mt-1">{pendingCount}</div>
          </div>
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 shadow-xs">
            <div className="text-emerald-800 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Validated Justifications
            </div>
            <div className="text-2xl font-bold text-emerald-900 mt-1">{validatedCount}</div>
          </div>
          <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 shadow-xs">
            <div className="text-rose-800 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Flagged For Inquiry
            </div>
            <div className="text-2xl font-bold text-rose-900 mt-1">{flaggedCount}</div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center space-x-1.5 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            {(["ALL", "PENDING_REVIEW", "JUSTIFICATION_VALIDATED", "FLAGGED_FOR_INQUIRY"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  filterStatus === st
                    ? "bg-[#1F7A7A] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {st === "ALL"
                  ? "All"
                  : st === "PENDING_REVIEW"
                  ? `Pending (${pendingCount})`
                  : st === "JUSTIFICATION_VALIDATED"
                  ? "Validated"
                  : "Flagged"}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search doctor, hospital, reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:ring-1 focus:ring-[#1F7A7A]"
            />
          </div>
        </div>

        {/* Reviews List */}
        {loading ? (
          <div className="bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-500 text-xs">
            Loading emergency review queue...
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-500 text-xs">
            No emergency break-glass records found matching the current filter.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReviews.map((r) => {
              const now = Math.floor(Date.now() / 1000);
              const isTimeBoxActive = r.expiresAt > now;
              const hoursLeft = Math.max(0, Math.round((r.expiresAt - now) / 3600));

              return (
                <div
                  key={r.reviewId}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center space-x-3">
                      <span
                        className={`p-2.5 rounded-lg text-white font-bold text-xs uppercase ${
                          r.status === "JUSTIFICATION_VALIDATED"
                            ? "bg-emerald-600"
                            : r.status === "FLAGGED_FOR_INQUIRY"
                            ? "bg-rose-600"
                            : "bg-amber-600"
                        }`}
                      >
                        {r.emergencyLevel.replace(/_/g, " ")}
                      </span>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-bold text-sm text-[#0F1F2E]">{r.doctorName}</h3>
                          <span className="text-xs text-slate-400 font-mono">({r.hospitalId})</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Invoked: {new Date(r.triggeredAt * 1000).toLocaleString()} • Patient Pseudonym:{" "}
                          <span className="font-mono text-slate-700">{r.patientIdHash.slice(0, 16)}...</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-[11px] font-mono px-2.5 py-1 rounded-full font-bold uppercase ${
                          r.status === "JUSTIFICATION_VALIDATED"
                            ? "bg-emerald-100 text-emerald-800"
                            : r.status === "FLAGGED_FOR_INQUIRY"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {r.status.replace(/_/g, " ")}
                      </span>
                      <span
                        className={`text-[11px] font-mono px-2 py-0.5 rounded text-xs ${
                          isTimeBoxActive
                            ? "bg-sky-100 text-sky-800 font-semibold"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {isTimeBoxActive ? `Window: ${hoursLeft}h left` : "Window Expired"}
                      </span>
                    </div>
                  </div>

                  {/* Justification quote */}
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Clinical Justification Provided by Physician:
                    </div>
                    <p className="text-xs text-slate-800 italic">"{r.clinicalJustification}"</p>
                  </div>

                  {/* Scoped Summary Preview */}
                  {r.criticalSummary && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div>
                        <span className="text-slate-500 font-medium">Blood Group:</span>{" "}
                        <span className="font-bold text-rose-700">{r.criticalSummary.bloodGroup}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium">Severe Allergies:</span>{" "}
                        <span className="font-semibold text-slate-800">
                          {r.criticalSummary.severeAllergies?.join(", ") || "None documented"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium">Emergency Proxy:</span>{" "}
                        <span className="font-semibold text-slate-800">
                          {r.criticalSummary.emergencyContact?.name} ({r.criticalSummary.emergencyContact?.phone})
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Compliance Notes if already reviewed */}
                  {r.adminNotes && (
                    <div className="text-xs bg-slate-50 p-2.5 rounded border border-slate-200">
                      <span className="font-semibold text-slate-700">Compliance Audit Note:</span>{" "}
                      <span className="text-slate-600">{r.adminNotes}</span>{" "}
                      <span className="text-slate-400 font-mono text-[10px]">({r.reviewedBy})</span>
                    </div>
                  )}

                  {/* Action Buttons for Pending Items */}
                  {r.status === "PENDING_REVIEW" && (
                    <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setSelectedReview(r);
                          setActionModal("FLAG");
                        }}
                        className="px-3 py-1.5 border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-semibold transition"
                      >
                        Flag for Formal Inquiry
                      </button>
                      <button
                        onClick={() => {
                          setSelectedReview(r);
                          setActionModal("VALIDATE");
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
                      >
                        Validate Clinical Justification
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Action Modal */}
        {actionModal && selectedReview && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-base text-[#0F1F2E]">
                  {actionModal === "VALIDATE"
                    ? "Validate Emergency Clinical Justification"
                    : "Flag Break-Glass Event for Formal Inquiry"}
                </h3>
                <button
                  onClick={() => setActionModal(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="text-xs text-slate-600 space-y-2">
                <p>
                  Reviewing event for <span className="font-bold">{selectedReview.doctorName}</span> at{" "}
                  <span className="font-bold">{selectedReview.hospitalId}</span>.
                </p>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 italic">
                  "{selectedReview.clinicalJustification}"
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Compliance Auditor Notes</label>
                <textarea
                  rows={3}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder={
                    actionModal === "VALIDATE"
                      ? "e.g., Confirmed trauma registry match; Level-1 protocol criteria satisfied."
                      : "e.g., Clinical notes lack corroborating vitals; requesting attending physician statement."
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-[#1F7A7A] focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setActionModal(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    handleDecision(
                      actionModal === "VALIDATE"
                        ? "JUSTIFICATION_VALIDATED"
                        : "FLAGGED_FOR_INQUIRY"
                    )
                  }
                  disabled={submittingAction}
                  className={`px-4 py-2 text-xs font-semibold text-white rounded-lg shadow-xs transition ${
                    actionModal === "VALIDATE"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {submittingAction
                    ? "Submitting..."
                    : actionModal === "VALIDATE"
                    ? "Confirm Validation"
                    : "Confirm Flagging"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

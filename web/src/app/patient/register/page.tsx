"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useWeb3 } from "@/context/Web3Context";
import {
  UserPlus,
  Shield,
  KeyRound,
  CheckCircle2,
  Copy,
  ExternalLink,
  Lock,
  ArrowRight,
  Sparkles,
  Building2,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";

export default function PatientRegisterPage() {
  const { notify, setRole } = useWeb3();

  const [name, setName] = useState("");
  const [idSecret, setIdSecret] = useState("");
  const [hospitalId, setHospitalId] = useState("HOSPITAL-CITY-GENERAL");
  const [password, setPassword] = useState("Password123!");
  const [showPassword, setShowPassword] = useState(false);
  const [institutions, setInstitutions] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [registeredResult, setRegisteredResult] = useState<any | null>(null);

  // Load existing institutions for dropdown
  useEffect(() => {
    fetch("/api/federation/institutions")
      .then((r) => r.json())
      .then((d) => {
        if (d.institutions && d.institutions.length > 0) {
          setInstitutions(d.institutions);
          setHospitalId(d.institutions[0].id);
        } else {
          // Default fallbacks if clean start
          setInstitutions([
            { id: "HOSPITAL-CITY-GENERAL", name: "City General Hospital" },
            { id: "HOSPITAL-REGIONAL-SPECIALTY", name: "Regional Specialty Hospital" },
          ]);
        }
      })
      .catch(() => {});
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !idSecret.trim()) {
      notify("error", "Validation Error", "Name and Identity Secret are required.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/patients/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          idSecret: idSecret.trim(),
          hospitalId,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }

      setRegisteredResult(data.patient);
      notify(
        "success",
        "Patient Registered Successfully",
        `Created identity with sponsored wallet ${data.patient.walletAddress.slice(0, 8)}...`
      );
    } catch (err: any) {
      notify("error", "Registration Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginAsPatient = () => {
    if (!registeredResult) return;
    localStorage.setItem("medichain_account", registeredResult.walletAddress);
    localStorage.setItem("medichain_role", "PATIENT");
    setRole("PATIENT");
    window.location.href = "/patient/records";
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center space-x-3 pb-6 border-b border-slate-200">
        <div className="p-2.5 rounded bg-medichain-teal/10 text-medichain-teal">
          <UserPlus className="w-6 h-6 stroke-[2.2]" />
        </div>
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-900 tracking-tight">
            Register New Patient Identity
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Generates a Zero-PHI Global Pseudonymous ID, Sovereign Wallet, and Password-Protected Keystore
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Registration Form */}
        <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Patient Legal Name or Clinical Alias
              </label>
              <input
                type="text"
                placeholder="e.g. John Doe, Emily Watson"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-medichain-teal"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Never stored unhashed on any blockchain.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Identity Secret (National ID, Passport, SSN)
              </label>
              <input
                type="text"
                placeholder="e.g. SSN-9821, PASSPORT-GB-10294"
                value={idSecret}
                onChange={(e) => setIdSecret(e.target.value)}
                required
                className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-medichain-teal"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Used to derive the immutable Global Pseudonymous Patient ID via HMAC-SHA256.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Enrolling Sovereign Hospital
              </label>
              <select
                value={hospitalId}
                onChange={(e) => setHospitalId(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-medichain-teal"
              >
                {institutions.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name} ({inst.chain_type || "EVM"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                In-Browser Wallet Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-medichain-teal pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Encrypts patient keystore in-browser so evaluators need not use MetaMask.
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-medichain-teal hover:bg-[#186262] text-white rounded-lg text-sm font-semibold shadow-sm transition disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>{loading ? "Generating Identity & Keystore..." : "Register & Provision Wallet"}</span>
            </button>
          </form>
        </div>

        {/* Security & Zero-PHI Notice */}
        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center space-x-2 text-slate-800 font-semibold text-xs uppercase tracking-wider">
              <Shield className="w-4 h-4 text-medichain-teal" />
              <span>Sovereign Identity Guarantees</span>
            </div>
            <ul className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <li>
                <strong>1. Zero PHI:</strong> Names and identity secrets are salted and hashed into a 256-bit pseudonym.
              </li>
              <li>
                <strong>2. Unlinkability:</strong> Each hospital sees a different local pseudonym derived from the global ID.
              </li>
              <li>
                <strong>3. Sponsored Gas:</strong> 1.0 ETH is automatically credited to the new wallet on the local EVM node.
              </li>
              <li>
                <strong>4. No MetaMask Required:</strong> Built-in keystore signs consent authorizations directly.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Registration Success Result Card */}
      {registeredResult && (
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-emerald-900 font-serif font-bold text-lg">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              <span>Patient Registered Successfully!</span>
            </div>
            <button
              onClick={handleLoginAsPatient}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center space-x-1.5 transition"
            >
              <span>Log in as {registeredResult.name}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="bg-white p-3.5 rounded-lg border border-emerald-100 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">
                Global Pseudonymous ID (Consortium Locator)
              </span>
              <div className="text-slate-800 truncate select-all">{registeredResult.globalPatientId}</div>
            </div>

            <div className="bg-white p-3.5 rounded-lg border border-emerald-100 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">
                Local Hospital Pseudonym
              </span>
              <div className="text-slate-800 truncate select-all">{registeredResult.localPseudonym}</div>
            </div>

            <div className="bg-white p-3.5 rounded-lg border border-emerald-100 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">
                Generated Patient Wallet (1.0 ETH Sponsored)
              </span>
              <div className="text-slate-800 truncate select-all">{registeredResult.walletAddress}</div>
            </div>

            <div className="bg-white p-3.5 rounded-lg border border-emerald-100 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">
                Private Key (In-Browser Keystore)
              </span>
              <div className="text-slate-800 truncate select-all">{registeredResult.privateKey}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useWeb3, DEMO_ACCOUNTS } from "@/context/Web3Context";
import { getContractInstance, CONTRACT_ADDRESSES } from "@/lib/contracts/config";
import { generateHospitalEncryptionKeyPair } from "@/lib/crypto/ecies";
import { ethers } from "ethers";
import {
  Building2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Plus,
  AlertTriangle,
  Play,
  Pause,
  KeyRound,
  ExternalLink,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Search,
  UserPlus,
  Lock,
} from "lucide-react";

interface HospitalItem {
  wallet: string;
  name: string;
  nameHash: string;
  publicKey: string;
  status: number; // 0: Inactive, 1: Active, 2: Suspended, 3: Revoked
  registeredAt: number;
  doctorCount: number;
  doctors: {
    wallet: string;
    name: string;
    license: string;
    isActive: boolean;
  }[];
}

const FALLBACK_HOSPITALS: HospitalItem[] = [
  {
    wallet: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    name: "Metro Health Hospital",
    nameHash: ethers.keccak256(ethers.toUtf8Bytes("Metro Health Hospital")),
    publicKey: "0x04a298bfd4695e...b198c25f4",
    status: 1,
    registeredAt: Math.floor(Date.now() / 1000) - 86400 * 30,
    doctorCount: 2,
    doctors: [
      {
        wallet: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        name: "Dr. Sarah Chen, MD",
        license: "MED-CA-89211",
        isActive: true,
      },
    ],
  },
  {
    wallet: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    name: "St. Jude Hospital",
    nameHash: ethers.keccak256(ethers.toUtf8Bytes("St. Jude Hospital")),
    publicKey: "0x04df987aa810c9...f9812bb01",
    status: 1,
    registeredAt: Math.floor(Date.now() / 1000) - 86400 * 14,
    doctorCount: 1,
    doctors: [
      {
        wallet: "0x976EA74026E72CD55542b2494463435b3dA39125",
        name: "Dr. Robert Miller, DO",
        license: "MED-NY-44120",
        isActive: true,
      },
    ],
  },
  {
    wallet: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f",
    name: "Central Children's Clinic",
    nameHash: ethers.keccak256(ethers.toUtf8Bytes("Central Children's Clinic")),
    publicKey: "0x04889c104e76a0...ee204bb87",
    status: 2, // Suspended
    registeredAt: Math.floor(Date.now() / 1000) - 86400 * 60,
    doctorCount: 0,
    doctors: [],
  },
];

export default function AdminHospitalsPage() {
  const { account, signer, provider, role, selectDemoAccount, notify } = useWeb3();

  const [hospitals, setHospitals] = useState<HospitalItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showDoctorModal, setShowDoctorModal] = useState<string | null>(null); // hospital address
  const [actionReasonModal, setActionReasonModal] = useState<{
    hospital: HospitalItem;
    action: "suspend" | "revoke";
  } | null>(null);

  // Form states
  const [regName, setRegName] = useState("");
  const [regWallet, setRegWallet] = useState("");
  const [regPubKey, setRegPubKey] = useState("");
  const [docWallet, setDocWallet] = useState("");
  const [docName, setDocName] = useState("");
  const [docLicense, setDocLicense] = useState("");
  const [reasonInput, setReasonInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isAdmin =
    role === "ADMIN" ||
    (account && account.toLowerCase() === DEMO_ACCOUNTS[0].address.toLowerCase());

  // Load contracts state
  const fetchHospitals = useCallback(async () => {
    if (!provider) return;
    setLoading(true);
    try {
      const hospitalContract = getContractInstance("HospitalRegistry", provider);
      const pausedStatus = await hospitalContract.paused().catch(() => false);
      setIsPaused(pausedStatus);

      const hospitalAddrs: string[] = await hospitalContract.getAllHospitals().catch(() => []);
      if (hospitalAddrs.length === 0) {
        setHospitals(FALLBACK_HOSPITALS);
        return;
      }

      const list: HospitalItem[] = [];
      for (const addr of hospitalAddrs) {
        try {
          const h = await hospitalContract.getHospital(addr);
          const docAddrs: string[] = await hospitalContract.getDoctorsByHospital(addr).catch(() => []);
          const doctors = [];
          for (const dAddr of docAddrs) {
            try {
              const d = await hospitalContract.getDoctor(dAddr);
              doctors.push({
                wallet: d.wallet,
                name: d.name,
                license: d.licenseNumber,
                isActive: d.isActive,
              });
            } catch {
              // Ignore individual doctor read failure
            }
          }

          list.push({
            wallet: h.wallet,
            name: h.name,
            nameHash: h.nameHash,
            publicKey: ethers.hexlify(h.publicKey),
            status: Number(h.status),
            registeredAt: Number(h.registeredAt),
            doctorCount: doctors.length,
            doctors,
          });
        } catch {
          // Ignore
        }
      }

      setHospitals(list);
    } catch {
      // In clean mode, keep whatever is retrieved or empty
      setHospitals([]);
    } finally {
      setLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    fetchHospitals();
  }, [fetchHospitals]);

  // Generate Secp256k1 Keypair helper
  const handleGenerateKey = () => {
    const pair = generateHospitalEncryptionKeyPair();
    setRegPubKey(pair.publicKeyHex);
    notify("info", "ECIES Public Key Generated", "Secp256k1 uncompressed public key generated.");
  };

  // Pre-fill demo wallet
  const handleUseDemoWallet = (addr: string, name: string) => {
    setRegWallet(addr);
    setRegName(name);
    handleGenerateKey();
  };

  // Register Hospital
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signer) {
      notify("error", "Signer Missing", "Please connect an Admin wallet or switch to Consortium Admin.");
      return;
    }
    if (!ethers.isAddress(regWallet)) {
      notify("error", "Invalid Address", "Please provide a valid Ethereum wallet address.");
      return;
    }
    if (!regPubKey.startsWith("0x") || regPubKey.length < 66) {
      notify("error", "Invalid Public Key", "Please provide a valid hex-encoded ECIES public key.");
      return;
    }

    setSubmitting(true);
    notify("pending", "Registering Hospital On-Chain...", "Broadcasting registerHospital transaction.");

    try {
      const contract = getContractInstance("HospitalRegistry", signer);
      const tx = await contract.registerHospital(
        regWallet,
        regName,
        ethers.getBytes(regPubKey)
      );
      await tx.wait();

      notify("success", "Hospital Onboarded", `${regName} has been officially registered in the consortium.`, tx.hash);

      setShowRegisterModal(false);
      setRegName("");
      setRegWallet("");
      setRegPubKey("");
      await fetchHospitals();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      notify("error", "Onboarding Failed", msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Pause / Unpause Network
  const handleTogglePause = async () => {
    if (!signer) return;
    setSubmitting(true);
    const action = isPaused ? "Unpausing" : "Pausing";
    notify("pending", `${action} Consortium Contracts...`, "Broadcasting emergency circuit-breaker state.");

    try {
      const hospitalContract = getContractInstance("HospitalRegistry", signer);
      const consentContract = getContractInstance("ConsentManager", signer);

      if (isPaused) {
        const tx1 = await hospitalContract.unpause();
        await tx1.wait();
        const tx2 = await consentContract.unpause().catch(() => null);
        if (tx2) await tx2.wait();
        setIsPaused(false);
        notify("success", "Consortium Resumed", "Medical record operations are now normal.");
      } else {
        const tx1 = await hospitalContract.pause();
        await tx1.wait();
        const tx2 = await consentContract.pause().catch(() => null);
        if (tx2) await tx2.wait();
        setIsPaused(true);
        notify("success", "Consortium Paused", "Emergency pause engaged. Record additions and consents halted.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      notify("error", "Circuit Breaker Error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Suspend / Revoke
  const handleConfirmAction = async () => {
    if (!signer || !actionReasonModal) return;
    setSubmitting(true);
    const { hospital, action } = actionReasonModal;

    notify("pending", `Submitting ${action}...`, `Updating on-chain status for ${hospital.name}`);
    try {
      const contract = getContractInstance("HospitalRegistry", signer);
      let tx;
      if (action === "suspend") {
        tx = await contract.suspendHospital(hospital.wallet, reasonInput || "Administrative suspension");
      } else {
        tx = await contract.revokeHospital(hospital.wallet, reasonInput || "Permanent consortium revocation");
      }
      await tx.wait();
      notify("success", `Hospital ${action === "suspend" ? "Suspended" : "Revoked"}`, `Status updated on-chain for ${hospital.name}.`, tx.hash);
      setActionReasonModal(null);
      setReasonInput("");
      await fetchHospitals();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      notify("error", "Action Failed", msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Reactivate
  const handleReactivate = async (h: HospitalItem) => {
    if (!signer) return;
    setSubmitting(true);
    notify("pending", "Reactivating Hospital...", `Restoring active status for ${h.name}`);
    try {
      const contract = getContractInstance("HospitalRegistry", signer);
      const tx = await contract.reactivateHospital(h.wallet);
      await tx.wait();
      notify("success", "Hospital Reactivated", `${h.name} is now back to full consortium standing.`, tx.hash);
      await fetchHospitals();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      notify("error", "Reactivation Failed", msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Add Doctor
  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signer || !showDoctorModal) return;
    setSubmitting(true);
    notify("pending", "Registering Doctor...", `Adding ${docName} under hospital`);
    try {
      const contract = getContractInstance("HospitalRegistry", signer);
      const tx = await contract.registerDoctor(docWallet, docName, docLicense);
      await tx.wait();

      // Mirror to local staff database
      await fetch("/api/hospitals/doctors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hospitalWallet: showDoctorModal,
          name: docName,
          specialty: docLicense || "General Medicine",
          walletAddress: docWallet,
          role: "DOCTOR",
        }),
      }).catch(() => {});

      notify("success", "Doctor Registered", `${docName} (${docLicense}) registered successfully.`, tx.hash);
      setShowDoctorModal(null);
      setDocName("");
      setDocWallet("");
      setDocLicense("");
      await fetchHospitals();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      notify("error", "Doctor Registration Failed", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredHospitals = hospitals.filter(
    (h) =>
      h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.wallet.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalActive = hospitals.filter((h) => h.status === 1).length;
  const totalSuspended = hospitals.filter((h) => h.status === 2).length;
  const totalRevoked = hospitals.filter((h) => h.status === 3).length;
  const totalDoctors = hospitals.reduce((acc, h) => acc + h.doctorCount, 0);

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2 bg-slate-100 rounded-lg text-slate-800">
                <Building2 className="w-6 h-6 text-[#1F7A7A]" />
              </span>
              <div>
                <h1 className="text-2xl font-bold text-[#0F1F2E] tracking-tight">
                  Consortium Hospital Registry
                </h1>
                <p className="text-sm text-slate-500">
                  Onboard participating healthcare institutions, manage cryptographic public keys, and oversee network status.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchHospitals}
              disabled={loading}
              className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 transition flex items-center gap-2 text-sm"
              title="Refresh Registry"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#1F7A7A]" : ""}`} />
              <span className="hidden sm:inline">Sync</span>
            </button>

            {isAdmin && (
              <>
                <button
                  onClick={handleTogglePause}
                  disabled={submitting}
                  className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition ${
                    isPaused
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300"
                  }`}
                >
                  {isPaused ? (
                    <>
                      <Play className="w-4 h-4 fill-current" /> Resume Network
                    </>
                  ) : (
                    <>
                      <Pause className="w-4 h-4 fill-current text-amber-600" /> Emergency Pause
                    </>
                  )}
                </button>

                <button
                  onClick={() => setShowRegisterModal(true)}
                  className="px-4 py-2 bg-[#1F7A7A] hover:bg-[#196363] text-white rounded-lg font-medium text-sm flex items-center gap-2 shadow-sm transition"
                >
                  <Plus className="w-4 h-4" /> Onboard Hospital
                </button>
              </>
            )}
          </div>
        </div>

        {/* Admin Role Guard Advisory */}
        {!isAdmin && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-amber-900">Admin Privileges Required for Onboarding</h3>
                <p className="text-xs text-amber-700 mt-0.5">
                  You are currently viewing the Consortium Hospital Registry in read-only mode. To onboard or suspend hospitals, switch to the Consortium Admin account.
                </p>
              </div>
            </div>
            <button
              onClick={() => selectDemoAccount(DEMO_ACCOUNTS[0])}
              className="px-3 py-1.5 bg-amber-700 text-white rounded-lg text-xs font-medium hover:bg-amber-800 transition shrink-0"
            >
              Switch to Admin
            </button>
          </div>
        )}

        {/* Emergency Pause Active Notice */}
        {isPaused && (
          <div className="p-4 bg-red-50 border border-red-300 rounded-xl flex items-center gap-3 text-red-900 animate-pulse">
            <ShieldAlert className="w-6 h-6 text-red-600 shrink-0" />
            <div>
              <span className="font-bold text-sm block">NETWORK CIRCUIT BREAKER ENGAGED</span>
              <span className="text-xs text-red-700">
                Consortium contracts are paused. New record registration and consent management transactions are temporarily suspended.
              </span>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Hospitals</span>
              <span className="p-1.5 bg-emerald-50 text-emerald-700 rounded-md">
                <CheckCircle2 className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-900">{totalActive}</span>
              <span className="text-xs text-slate-400">/ {hospitals.length} registered</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Suspended</span>
              <span className="p-1.5 bg-amber-50 text-amber-700 rounded-md">
                <Clock className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-amber-700">{totalSuspended}</span>
              <span className="text-xs text-slate-400">{totalRevoked} permanently revoked</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Licensed Doctors</span>
              <span className="p-1.5 bg-sky-50 text-sky-700 rounded-md">
                <Users className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-900">{totalDoctors}</span>
              <span className="text-xs text-slate-400">authorized signers</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Network Circuit Breaker</span>
              <span className={`p-1.5 rounded-md ${isPaused ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                <Shield className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className={`text-sm font-bold font-mono uppercase ${isPaused ? "text-red-700" : "text-emerald-700"}`}>
                {isPaused ? "Circuit Open (Paused)" : "Operational (Active)"}
              </span>
            </div>
          </div>
        </div>

        {/* Search & Directory Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search hospital name or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F7A7A]"
              />
            </div>
            <div className="text-xs text-slate-500 font-mono">
              Consortium Registry: <span className="font-semibold text-slate-700">{CONTRACT_ADDRESSES.HospitalRegistry.slice(0, 10)}...</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Hospital Name & Identity</th>
                  <th className="py-3 px-4">Public Encryption Key (ECIES)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Authorized Doctors</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHospitals.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No hospitals match your search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredHospitals.map((h) => {
                    const isHospitalActive = h.status === 1;
                    const isHospitalSuspended = h.status === 2;
                    const isHospitalRevoked = h.status === 3;

                    return (
                      <tr key={h.wallet} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-[#0F1F2E]">{h.name}</div>
                          <div className="text-xs font-mono text-slate-500 mt-0.5 flex items-center gap-1.5">
                            <span>{h.wallet.slice(0, 10)}...{h.wallet.slice(-8)}</span>
                            <span className="text-[10px] text-slate-400">
                              (Joined {new Date(h.registeredAt * 1000).toLocaleDateString()})
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                          <div className="flex items-center gap-1.5" title={h.publicKey}>
                            <KeyRound className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[160px]">{h.publicKey}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {isHospitalActive && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                            </span>
                          )}
                          {isHospitalSuspended && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Suspended
                            </span>
                          )}
                          {isHospitalRevoked && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Revoked
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-mono text-slate-700">
                              {h.doctorCount} Doctors
                            </span>
                            {isAdmin && isHospitalActive && (
                              <button
                                onClick={() => setShowDoctorModal(h.wallet)}
                                className="p-1 text-slate-400 hover:text-[#1F7A7A] hover:bg-slate-100 rounded transition"
                                title="Register Doctor under Hospital"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          {h.doctors.length > 0 && (
                            <div className="text-[11px] text-slate-500 mt-1 truncate max-w-[200px]">
                              {h.doctors.map((d) => d.name).join(", ")}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          {isAdmin ? (
                            <div className="flex items-center justify-end gap-2">
                              {isHospitalActive && (
                                <button
                                  onClick={() =>
                                    setActionReasonModal({ hospital: h, action: "suspend" })
                                  }
                                  disabled={submitting}
                                  className="px-2.5 py-1 text-xs font-medium border border-amber-300 text-amber-800 hover:bg-amber-50 rounded transition"
                                >
                                  Suspend
                                </button>
                              )}

                              {isHospitalSuspended && (
                                <button
                                  onClick={() => handleReactivate(h)}
                                  disabled={submitting}
                                  className="px-2.5 py-1 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded transition"
                                >
                                  Reactivate
                                </button>
                              )}

                              {!isHospitalRevoked && (
                                <button
                                  onClick={() =>
                                    setActionReasonModal({ hospital: h, action: "revoke" })
                                  }
                                  disabled={submitting}
                                  className="px-2.5 py-1 text-xs font-medium border border-red-200 text-red-700 hover:bg-red-50 rounded transition"
                                >
                                  Revoke
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Read-only</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Onboard New Hospital */}
        {showRegisterModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2 text-[#0F1F2E] font-bold text-lg">
                  <Building2 className="w-5 h-5 text-[#1F7A7A]" />
                  <span>Onboard New Consortium Hospital</span>
                </div>
                <button
                  onClick={() => setShowRegisterModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleRegister} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Hospital Legal Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Regional Medical Center"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F7A7A]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Ethereum Wallet Address
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        handleUseDemoWallet(
                          DEMO_ACCOUNTS[4].address,
                          DEMO_ACCOUNTS[4].name
                        )
                      }
                      className="text-[11px] text-[#1F7A7A] hover:underline font-mono"
                    >
                      Fill Demo: St. Jude
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="0x..."
                    value={regWallet}
                    onChange={(e) => setRegWallet(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F7A7A]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      ECIES Public Key (Hex)
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateKey}
                      className="text-[11px] text-[#1F7A7A] hover:underline flex items-center gap-1"
                    >
                      <KeyRound className="w-3 h-3" /> Generate Keypair
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    required
                    placeholder="0x04..."
                    value={regPubKey}
                    onChange={(e) => setRegPubKey(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F7A7A]"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Uncompressed 65-byte Secp256k1 public key used for re-wrapping AES symmetric record keys.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowRegisterModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-[#1F7A7A] hover:bg-[#196363] text-white rounded-lg text-sm font-semibold shadow-xs"
                  >
                    {submitting ? "Broadcasting..." : "Register Hospital"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Add Doctor */}
        {showDoctorModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-[#0F1F2E] font-bold">
                  <UserPlus className="w-5 h-5 text-[#1F7A7A]" />
                  <span>Register Doctor Affiliation</span>
                </div>
                <button
                  onClick={() => setShowDoctorModal(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddDoctor} className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Doctor Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Marcus Vance, MD"
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1F7A7A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    State / Medical License No.
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. LIC-NY-2024-8891"
                    value={docLicense}
                    onChange={(e) => setDocLicense(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1F7A7A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Doctor Wallet Address
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="0x..."
                    value={docWallet}
                    onChange={(e) => setDocWallet(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1F7A7A]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowDoctorModal(null)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-[#1F7A7A] hover:bg-[#196363] text-white rounded-lg text-sm font-semibold"
                  >
                    {submitting ? "Registering..." : "Add Doctor"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Suspend / Revoke Confirmation */}
        {actionReasonModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
              <div className="flex items-center gap-2 text-red-700 font-bold text-lg mb-2">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>
                  {actionReasonModal.action === "suspend"
                    ? "Suspend Hospital"
                    : "Permanently Revoke Hospital"}
                </span>
              </div>
              <p className="text-xs text-slate-600 mb-4">
                {actionReasonModal.action === "suspend"
                  ? `Suspending ${actionReasonModal.hospital.name} temporarily disallows its doctors from issuing or requesting records until reactivated.`
                  : `Revoking ${actionReasonModal.hospital.name} permanently removes its authority in the consortium. This cannot be undone.`}
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Reason for {actionReasonModal.action}
                </label>
                <input
                  type="text"
                  placeholder="e.g. Failure to comply with consortium cryptographic protocols"
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 mt-5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActionReasonModal(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAction}
                  disabled={submitting}
                  className={`px-4 py-2 text-white rounded-lg text-sm font-semibold transition ${
                    actionReasonModal.action === "suspend"
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {submitting ? "Processing..." : `Confirm ${actionReasonModal.action}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import {
  Layers,
  Activity,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  Shield,
  Clock,
  Database,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Cpu,
  Info,
  KeyRound,
  FileText,
  AlertTriangle,
} from "lucide-react";

interface NetworkMeta {
  id: string;
  name: string;
  type: "EVM" | "FABRIC_SIMULATED";
  badge: string;
  technology: string;
  consensus: string;
  rpcOrApiUrl: string;
  chainId?: number;
  description: string;
  honestNotice?: string;
}

interface BlockItem {
  number: number;
  hash: string;
  parentHash?: string;
  merkleRoot?: string;
  timestamp: number;
  txCount: number;
  gasUsed?: string;
  miner?: string;
}

interface TransactionItem {
  hash: string;
  blockNumber: number;
  from: string;
  to: string;
  value: string;
  data: string;
  fullData?: string;
  type?: string;
  timestamp?: number;
}

interface NetworkTelemetry {
  online: boolean;
  blockHeight: number;
  totalBlocks: number;
  blocks: BlockItem[];
  transactions: TransactionItem[];
  error?: string | null;
}

interface NetworkData {
  meta: NetworkMeta;
  telemetry: NetworkTelemetry;
}

export default function ChainExplorerPage() {
  const [data, setData] = useState<Record<string, NetworkData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNetwork, setSelectedNetwork] = useState<string>("all");
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [expandedBlock, setExpandedBlock] = useState<number | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/explorer");
      if (res.ok) {
        const json = await res.json();
        setData(json.networks);
      }
    } catch (e) {
      console.error("Failed to load explorer telemetry", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const networkKeys = data ? Object.keys(data) : [];

  const getPlainLanguageTxDescription = (tx: TransactionItem) => {
    if (tx.type) {
      if (tx.type === "TX_RECORD_REGISTER") return "Clinical Record Anchor Registered & Merkle Leaf Added";
      if (tx.type === "TX_CONSENT_GRANT") return "Patient Granted Medical Data Access to External Hospital";
      if (tx.type === "TX_CONSENT_REVOKE") return "Patient Immediately Revoked External Access Consent";
      if (tx.type === "TX_AUDIT_LOG") return "Immutable Audit Log Written (Break-Glass or Query)";
      return tx.type;
    }
    if (tx.data && tx.data.startsWith("0x")) {
      if (tx.data.startsWith("0x5608") || tx.data.includes("123")) return "Hospital Registry Onboarding Transaction";
      if (tx.data.length > 200) return "Sovereign Contract Interaction / Medical Anchor Event";
    }
    return "Standard Sovereign State Transaction";
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded bg-medichain-teal/10 text-medichain-teal">
              <Layers className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold text-slate-900 tracking-tight">
                Multi-Chain Sovereign Explorer
              </h1>
              <p className="text-sm text-slate-600 mt-0.5">
                Live inspection tool for heterogeneous sovereign hospital chains & consortium federation
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <label className="flex items-center space-x-2 text-xs text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-50 transition">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded text-medichain-teal focus:ring-medichain-teal"
            />
            <span className="font-medium">Auto-poll (4s)</span>
          </label>

          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center space-x-2 px-3.5 py-2 bg-medichain-teal hover:bg-[#186262] text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh Explorer</span>
          </button>
        </div>
      </div>

      {/* Honest Technological Disclosure Banner */}
      <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 flex items-start space-x-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 leading-relaxed">
          <span className="font-bold">Honest Technology Status:</span> Networks A & B are independent Ethereum Virtual Machine (EVM) chains run locally on Hardhat nodes (Chain IDs 31337 and 31338). Network C is a <span className="font-semibold">Fabric-style permissioned ledger (simulated)</span> operating with SHA-256 Merkle proofs and deterministic block production. Real Hyperledger Fabric chaincode is in <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-950 font-mono">/fabric</code>, ready to deploy to official Fabric Docker test-networks.
        </div>
      </div>

      {/* Network Switcher Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setSelectedNetwork("all")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
            selectedNetwork === "all"
              ? "bg-[#0F1F2E] text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          All Networks ({networkKeys.length})
        </button>
        {networkKeys.map((key) => {
          const item = data![key];
          const isSelected = selectedNetwork === key;
          const isOnline = item.telemetry?.online;
          return (
            <button
              key={key}
              onClick={() => setSelectedNetwork(key)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                isSelected
                  ? "bg-[#0F1F2E] text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isOnline ? "bg-emerald-400" : "bg-rose-400"
                }`}
              />
              <span>{item.meta.name}</span>
              <span className="text-[10px] opacity-75 font-mono">
                {item.meta.type === "EVM" ? "EVM" : "Fabric-Sim"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Network Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {networkKeys
          .filter((k) => selectedNetwork === "all" || selectedNetwork === k)
          .map((k) => {
            const item = data![k];
            const meta = item.meta;
            const tele = item.telemetry;
            return (
              <div
                key={k}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 hover:border-slate-300 transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span
                      className={`inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                        meta.type === "EVM"
                          ? "bg-sky-100 text-sky-800 border border-sky-200"
                          : "bg-purple-100 text-purple-800 border border-purple-200"
                      }`}
                    >
                      {meta.badge}
                    </span>
                    <h3 className="font-serif font-bold text-slate-900 text-base mt-1.5">
                      {meta.name}
                    </h3>
                  </div>
                  <div
                    className={`flex items-center space-x-1.5 text-xs font-medium px-2 py-1 rounded-full ${
                      tele.online
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-rose-50 text-rose-700 border border-rose-200"
                    }`}
                  >
                    {tele.online ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                    )}
                    <span>{tele.online ? "Online" : "Offline"}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed min-h-[36px]">
                  {meta.description}
                </p>

                <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                      Block Height
                    </span>
                    <span className="text-base font-bold font-mono text-slate-800">
                      #{tele.blockHeight}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                      Node / Port
                    </span>
                    <span className="text-xs font-mono text-slate-700 truncate block">
                      {meta.rpcOrApiUrl.replace("http://", "").replace("127.0.0.1:", ":")}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 font-mono">
                  Consensus: <span className="text-slate-700 font-sans">{meta.consensus}</span>
                </div>
              </div>
            );
          })}
      </div>

      {/* Detailed Chain Inspector View */}
      {networkKeys
        .filter((k) => selectedNetwork === "all" || selectedNetwork === k)
        .map((k) => {
          const item = data![k];
          const meta = item.meta;
          const tele = item.telemetry;

          return (
            <div
              key={`detail-${k}`}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm"
            >
              {/* Header */}
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 rounded-full bg-medichain-teal" />
                  <div>
                    <h2 className="font-serif font-bold text-slate-900 text-lg">
                      {meta.name}
                    </h2>
                    <div className="flex items-center space-x-2 text-xs text-slate-500">
                      <span>{meta.technology}</span>
                      <span>•</span>
                      <span className="font-mono">{meta.rpcOrApiUrl}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs bg-slate-200 text-slate-700 font-semibold px-2.5 py-1 rounded">
                    Total Blocks: {tele.totalBlocks}
                  </span>
                </div>
              </div>

              {meta.honestNotice && (
                <div className="bg-amber-50/60 border-b border-amber-200/80 px-6 py-2.5 text-xs text-amber-900 flex items-center space-x-2">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{meta.honestNotice}</span>
                </div>
              )}

              {/* Offline Warning */}
              {!tele.online && (
                <div className="p-8 text-center space-y-3">
                  <XCircle className="w-10 h-10 text-rose-500 mx-auto" />
                  <div className="font-semibold text-slate-800">Chain Node Unreachable</div>
                  <div className="text-xs text-slate-500 max-w-md mx-auto">
                    {tele.error || "Please ensure the local node/service is running."}
                  </div>
                </div>
              )}

              {/* Online Blocks & Transactions Tables */}
              {tele.online && (
                <div className="p-6 space-y-6">
                  {/* Latest Blocks Table */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-serif font-bold text-slate-800 text-sm flex items-center space-x-2">
                        <Database className="w-4 h-4 text-medichain-teal" />
                        <span>Recent Confirmed Blocks</span>
                      </h3>
                      <span className="text-xs text-slate-500">Showing last {tele.blocks.length} blocks</span>
                    </div>

                    <div className="border border-slate-200 rounded-lg overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                          <tr>
                            <th className="py-2.5 px-3">Height</th>
                            <th className="py-2.5 px-3">Block Hash</th>
                            <th className="py-2.5 px-3">Txs</th>
                            <th className="py-2.5 px-3">Validator / Miner</th>
                            <th className="py-2.5 px-3">Time</th>
                            <th className="py-2.5 px-3 text-right">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {tele.blocks.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-4 text-center text-slate-400 font-sans">
                                Genesis block pending or awaiting transactions.
                              </td>
                            </tr>
                          ) : (
                            tele.blocks.map((blk) => {
                              const isBlockExp = expandedBlock === blk.number;
                              return (
                                <React.Fragment key={blk.number}>
                                  <tr className="hover:bg-slate-50/80 transition">
                                    <td className="py-2.5 px-3 font-bold text-medichain-teal">
                                      #{blk.number}
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-700">
                                      {blk.hash ? `${blk.hash.substring(0, 14)}...${blk.hash.substring(blk.hash.length - 8)}` : "0x000"}
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-sans font-medium text-[11px]">
                                        {blk.txCount} tx{blk.txCount === 1 ? "" : "s"}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                                      {blk.miner ? `${blk.miner.substring(0, 10)}...` : "Network Consensus"}
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-500 font-sans text-[11px]">
                                      {blk.timestamp ? new Date(blk.timestamp * 1000).toLocaleTimeString() : "N/A"}
                                    </td>
                                    <td className="py-2.5 px-3 text-right">
                                      <button
                                        onClick={() => setExpandedBlock(isBlockExp ? null : blk.number)}
                                        className="text-xs text-medichain-teal hover:underline font-sans font-medium inline-flex items-center space-x-1"
                                      >
                                        <span>{isBlockExp ? "Hide Raw" : "Inspect"}</span>
                                        {isBlockExp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                      </button>
                                    </td>
                                  </tr>
                                  {isBlockExp && (
                                    <tr>
                                      <td colSpan={6} className="bg-slate-900 text-slate-200 p-4 font-mono text-[11px]">
                                        <div className="font-sans font-semibold text-teal-400 mb-2">
                                          Technical Block Header Details:
                                        </div>
                                        <pre className="overflow-x-auto whitespace-pre-wrap">
                                          {JSON.stringify(blk, null, 2)}
                                        </pre>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Transactions Table with Plain-Language Summaries */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-serif font-bold text-slate-800 text-sm flex items-center space-x-2">
                        <Activity className="w-4 h-4 text-medichain-teal" />
                        <span>Recent Transactions & Smart Contract Invocations</span>
                      </h3>
                      <span className="text-xs text-slate-500">
                        {tele.transactions.length} record transactions logged
                      </span>
                    </div>

                    <div className="border border-slate-200 rounded-lg overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                          <tr>
                            <th className="py-2.5 px-3">Tx Hash</th>
                            <th className="py-2.5 px-3">Plain-Language Clinical Purpose</th>
                            <th className="py-2.5 px-3">From / Invoker</th>
                            <th className="py-2.5 px-3">Block</th>
                            <th className="py-2.5 px-3 text-right">Technical Payload</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {tele.transactions.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-4 text-center text-slate-400">
                                No transactions recorded on this sovereign chain yet. Create records or run scenarios to observe state growth.
                              </td>
                            </tr>
                          ) : (
                            tele.transactions.map((tx) => {
                              const isExp = expandedTx === tx.hash;
                              const plainDesc = getPlainLanguageTxDescription(tx);
                              return (
                                <React.Fragment key={tx.hash}>
                                  <tr className="hover:bg-slate-50/80 transition">
                                    <td className="py-2.5 px-3 font-mono text-slate-800">
                                      {tx.hash.substring(0, 12)}...
                                    </td>
                                    <td className="py-2.5 px-3 font-medium text-slate-900">
                                      <div className="flex items-center space-x-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                        <span>{plainDesc}</span>
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                                      {tx.from ? `${tx.from.substring(0, 10)}...` : "System"}
                                    </td>
                                    <td className="py-2.5 px-3 font-mono text-medichain-teal font-semibold">
                                      #{tx.blockNumber}
                                    </td>
                                    <td className="py-2.5 px-3 text-right">
                                      <button
                                        onClick={() => setExpandedTx(isExp ? null : tx.hash)}
                                        className="text-xs text-medichain-teal hover:underline font-medium inline-flex items-center space-x-1"
                                      >
                                        <span>{isExp ? "Hide Raw" : "Technical Hex / JSON"}</span>
                                        {isExp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                      </button>
                                    </td>
                                  </tr>
                                  {isExp && (
                                    <tr>
                                      <td colSpan={5} className="bg-slate-900 text-slate-200 p-4 font-mono text-[11px]">
                                        <div className="font-sans font-semibold text-teal-400 mb-2">
                                          Raw On-Chain Transaction & Call Payload:
                                        </div>
                                        <pre className="overflow-x-auto whitespace-pre-wrap">
                                          {tx.fullData || JSON.stringify(tx, null, 2)}
                                        </pre>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}

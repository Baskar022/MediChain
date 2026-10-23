"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  FileText,
  UploadCloud,
  Users,
  ShieldCheck,
  Building2,
  Database,
  Network,
  Activity,
  History,
  X,
  ExternalLink,
  CornerDownLeft,
} from "lucide-react";

interface ActionItem {
  id: string;
  title: string;
  category: "Navigation" | "Action" | "Registry" | "Audit";
  path: string;
  icon: React.ElementType;
  shortcut?: string;
}

const DEFAULT_ACTIONS: ActionItem[] = [
  { id: "dash", title: "Consortium Dashboard & Telemetry", category: "Navigation", path: "/dashboard", icon: Activity },
  { id: "upload", title: "Upload & Sign Clinical Record (AES-256-GCM)", category: "Action", path: "/doctor/upload", icon: UploadCloud },
  { id: "patients", title: "Patient Directory & Clinical Encounters", category: "Navigation", path: "/doctor/records", icon: Users },
  { id: "register-pt", title: "Register New Sovereign Patient Identity", category: "Action", path: "/patient/register", icon: Users },
  { id: "my-records", title: "Patient Sovereign Records Vault", category: "Navigation", path: "/patient/records", icon: FileText },
  { id: "consents", title: "Active Patient Access Consents", category: "Navigation", path: "/patient/consents", icon: ShieldCheck },
  { id: "verifier", title: "Public Cryptographic Proof Verifier", category: "Audit", path: "/verify", icon: ShieldCheck },
  { id: "explorer", title: "Multi-Chain Block & Ledger Explorer", category: "Registry", path: "/explorer", icon: Network },
  { id: "federation", title: "Federation Registry & Interop Portal", category: "Registry", path: "/admin/federation", icon: Network },
  { id: "hospitals", title: "Hospital Consortium Member Registry", category: "Registry", path: "/admin/hospitals", icon: Building2 },
  { id: "inspector", title: "Zero-PHI Off-Chain Storage Inspector", category: "Audit", path: "/admin/inspector", icon: Database },
  { id: "audit", title: "Consortium Immutable Audit Trail", category: "Audit", path: "/audit", icon: History },
];

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  const filtered = DEFAULT_ACTIONS.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase()) ||
    item.path.toLowerCase().includes(query.toLowerCase())
  );

  const isHashOrId = query.startsWith("0x") || query.startsWith("PID-") || query.startsWith("REC-");

  const executeItem = (item: ActionItem) => {
    setIsOpen(false);
    router.push(item.path);
  };

  const handleVerifyDirect = () => {
    setIsOpen(false);
    router.push(`/verify?query=${encodeURIComponent(query.trim())}`);
  };

  const handleKeyDownInInput = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        executeItem(filtered[selectedIndex]);
      } else if (isHashOrId) {
        handleVerifyDirect();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0F1F2E]/60 backdrop-blur-none flex items-start justify-center pt-24 px-4">
      <div
        className="w-full max-w-2xl bg-white border border-[#E4DFD5] shadow-dialog rounded-sm overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-[#E4DFD5] bg-[#F6F4EF]/40">
          <Search className="w-4 h-4 text-[#6B7A88] shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDownInInput}
            placeholder="Search commands, pages, or jump to Record / Hash (e.g. REC-..., PID-..., 0x...)"
            className="w-full bg-transparent text-sm text-[#0F1F2E] placeholder-[#9BA6B0] focus:outline-none font-sans"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 text-[#6B7A88] hover:text-[#0F1F2E] mr-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-[#6B7A88] bg-[#F6F4EF] border border-[#E4DFD5] rounded-sm">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-[#F6F4EF]">
          {isHashOrId && (
            <div
              onClick={handleVerifyDirect}
              className="p-3 mb-2 bg-[#EAF3F3] border border-[#1F7A7A]/30 rounded-sm cursor-pointer hover:bg-[#DCE8E3] transition-colors flex items-center justify-between"
            >
              <div className="flex items-center space-x-2.5">
                <ShieldCheck className="w-4 h-4 text-[#1F7A7A]" />
                <div>
                  <div className="text-xs font-semibold text-[#0F1F2E]">
                    Verify Identifier / Cryptographic Hash
                  </div>
                  <div className="text-[11px] font-mono text-[#1F7A7A] truncate max-w-md">
                    {query}
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-mono font-medium text-[#1F7A7A] flex items-center">
                Press Enter <CornerDownLeft className="w-3 h-3 ml-1" />
              </span>
            </div>
          )}

          {filtered.length === 0 && !isHashOrId ? (
            <div className="p-8 text-center text-xs text-[#6B7A88]">
              No system commands or routes match &ldquo;<span className="font-mono text-[#0F1F2E]">{query}</span>&rdquo;
            </div>
          ) : (
            filtered.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => executeItem(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`px-3 py-2.5 rounded-sm flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected ? "bg-[#1F7A7A] text-white" : "hover:bg-[#F6F4EF] text-[#0F1F2E]"
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isSelected ? "text-white" : "text-[#1F7A7A]"}`} />
                    <span className="text-xs font-medium truncate">{item.title}</span>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded-sm uppercase tracking-wider ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-[#F6F4EF] text-[#6B7A88] border border-[#E4DFD5]"
                      }`}
                    >
                      {item.category}
                    </span>
                    {isSelected && <CornerDownLeft className="w-3 h-3 text-white" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="border-t border-[#E4DFD5] px-4 py-2 bg-[#F6F4EF] flex items-center justify-between text-[11px] text-[#6B7A88] font-mono">
          <div className="flex items-center space-x-3">
            <span>↑↓ to navigate</span>
            <span>↵ to select</span>
            <span>ESC to close</span>
          </div>
          <span className="text-[#0F1F2E] font-medium">MediChain Sovereign OS</span>
        </div>
      </div>
    </div>
  );
}

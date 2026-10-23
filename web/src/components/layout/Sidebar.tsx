"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWeb3, DEMO_ACCOUNTS, UserRole } from "@/context/Web3Context";
import { BrandLogo } from "@/components/ui/BrandLogo";
import {
  FileText,
  KeyRound,
  History,
  AlertOctagon,
  Building2,
  ShieldCheck,
  Zap,
  UploadCloud,
  ChevronDown,
  UserPlus,
  Users,
  Activity,
  Network,
  Database,
  ExternalLink,
} from "lucide-react";

interface NavGroup {
  group: string;
  items: {
    label: string;
    href: string;
    icon: React.ElementType;
    badge?: string;
  }[];
}

export function Sidebar() {
  const pathname = usePathname();
  const { account, role, setRole, selectDemoAccount, isAuthenticated } = useWeb3();

  const navGroups: NavGroup[] = [
    {
      group: "Core",
      items: [
        { label: "Consortium Overview", href: "/dashboard", icon: Activity },
      ],
    },
    {
      group: "Clinical Operations",
      items: [
        { label: "Upload & Sign Record", href: "/doctor/upload", icon: UploadCloud },
        { label: "Patient Directory", href: "/doctor/records", icon: Users },
        { label: "Emergency Break-Glass", href: "/doctor/emergency", icon: AlertOctagon },
      ],
    },
    {
      group: "Patient Sovereign Portal",
      items: [
        { label: "My Medical Records", href: "/patient/records", icon: FileText },
        { label: "Access Consents", href: "/patient/consents", icon: KeyRound },
        { label: "Register Sovereign Patient", href: "/patient/register", icon: UserPlus },
      ],
    },
    {
      group: "Consortium & Networks",
      items: [
        { label: "Federation Registry", href: "/admin/federation", icon: Network, badge: "Hub" },
        { label: "Hospital Consortium", href: "/admin/hospitals", icon: Building2 },
        { label: "Multi-Chain Explorer", href: "/explorer", icon: Network, badge: "Live" },
        { label: "Zero-PHI Inspector", href: "/admin/inspector", icon: Database },
      ],
    },
    {
      group: "Verification & Audit",
      items: [
        { label: "Public Verifier", href: "/verify", icon: ShieldCheck },
        { label: "Consortium Audit Trail", href: "/audit", icon: History },
        { label: "Live Tamper Demo", href: "/demo/tamper", icon: Zap },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-white border-r border-[#E4DFD5] flex flex-col justify-between shrink-0 select-none">
      {/* Top Header with Geometric Brand Logo */}
      <div className="h-16 px-5 border-b border-[#E4DFD5] flex items-center bg-[#F6F4EF]/30">
        <BrandLogo size="md" showWordmark={true} showSubtitle={true} asLink={true} />
      </div>

      {/* Nav List with Clean Section Grouping */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {navGroups.map((grp) => (
          <div key={grp.group} className="space-y-1">
            <div className="px-2.5 pb-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-[#6B7A88]">
              {grp.group}
            </div>
            {grp.items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-sm text-xs transition-colors ${
                    isActive
                      ? "bg-[#1F7A7A] text-white font-medium shadow-card"
                      : "text-[#0F1F2E] hover:bg-[#F6F4EF] hover:text-[#0F1F2E]"
                  }`}
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-white" : "text-[#1F7A7A]"}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[9px] font-mono font-semibold px-1 py-0.2 rounded-sm uppercase tracking-wider ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-[#F6F4EF] text-[#1F7A7A] border border-[#E4DFD5]"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Active Role & Quick Session Switcher Footer */}
      <div className="p-3 border-t border-[#E4DFD5] bg-[#F6F4EF]/50 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-mono text-[#6B7A88] uppercase tracking-wider">
            Active Role
          </div>
          <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-sm bg-white border border-[#E4DFD5] text-[#0F1F2E]">
            {role}
          </span>
        </div>

        {/* Quick Role Switcher */}
        <div className="grid grid-cols-4 gap-1">
          {(["PATIENT", "DOCTOR", "HOSPITAL", "ADMIN"] as UserRole[]).map((r) => (
            <button
              key={r}
              onClick={() => {
                setRole(r);
                const match = DEMO_ACCOUNTS.find((acc) => acc.role === r);
                if (match) {
                  selectDemoAccount(match);
                }
              }}
              className={`py-1 text-[10px] font-mono rounded-sm border transition-colors ${
                role === r
                  ? "bg-[#0F1F2E] text-white border-[#0F1F2E] font-bold"
                  : "bg-white text-[#6B7A88] border-[#E4DFD5] hover:bg-[#F6F4EF]"
              }`}
              title={`Switch role to ${r}`}
            >
              {r.slice(0, 3)}
            </button>
          ))}
        </div>

        <div className="pt-1 flex items-center justify-between text-[10px] font-mono text-[#6B7A88]">
          <span>Consortium v1.0</span>
          <span className="flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D5B]" />
            <span>Local Sovereign</span>
          </span>
        </div>
      </div>
    </aside>
  );
}

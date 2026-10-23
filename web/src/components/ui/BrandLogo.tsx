"use client";

import React from "react";
import Link from "next/link";
import { PROJECT_INFO } from "@/config/project-info";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showWordmark?: boolean;
  showSubtitle?: boolean;
  className?: string;
  asLink?: boolean;
}

export function GeometricMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-label="MediChain Geometric Sovereign Mark"
    >
      {/* Precision Frame */}
      <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="3.25" stroke="#E4DFD5" strokeWidth="1" fill="#FFFFFF" />

      {/* Orthogonal Sovereign Quadrants (Geometric Cross Nexus) */}
      {/* Top North-West: Ink Navy Polygon */}
      <path d="M7 7H14V14H7V7Z" fill="#0F1F2E" />
      {/* Top North-East: Teal Polygon */}
      <path d="M18 7H25V14H18V7Z" fill="#1F7A7A" />
      {/* Bottom South-West: Warm Amber Polygon */}
      <path d="M7 18H14V25H7V18Z" fill="#D98E04" />
      {/* Bottom South-East: Ink Navy-Light Polygon */}
      <path d="M18 18H25V25H18V18Z" fill="#1A2E40" />

      {/* Central Interlocking Consensus Core */}
      <rect x="13.5" y="13.5" width="5" height="5" fill="#FFFFFF" stroke="#0F1F2E" strokeWidth="1" />
      <circle cx="16" cy="16" r="1.25" fill="#1F7A7A" />

      {/* Perimeter Verification Ticks */}
      <line x1="16" y1="2" x2="16" y2="4.5" stroke="#1F7A7A" strokeWidth="1.2" strokeLinecap="square" />
      <line x1="16" y1="27.5" x2="16" y2="30" stroke="#1F7A7A" strokeWidth="1.2" strokeLinecap="square" />
      <line x1="2" y1="16" x2="4.5" y2="16" stroke="#1F7A7A" strokeWidth="1.2" strokeLinecap="square" />
      <line x1="27.5" y1="16" x2="30" y2="16" stroke="#1F7A7A" strokeWidth="1.2" strokeLinecap="square" />
    </svg>
  );
}

export function BrandLogo({
  size = "md",
  showWordmark = true,
  showSubtitle = true,
  className = "",
  asLink = true,
}: BrandLogoProps) {
  const sizeMap = {
    sm: { icon: 22, title: "text-sm", subtitle: "text-[9px]" },
    md: { icon: 28, title: "text-base", subtitle: "text-[10px]" },
    lg: { icon: 34, title: "text-lg", subtitle: "text-[11px]" },
    xl: { icon: 42, title: "text-xl", subtitle: "text-xs" },
  };

  const current = sizeMap[size];

  const content = (
    <div className={`inline-flex items-center space-x-2.5 select-none ${className}`}>
      <GeometricMark size={current.icon} />
      {showWordmark && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center space-x-1.5">
            <span className={`font-serif font-bold tracking-tight text-[#0F1F2E] ${current.title}`}>
              {PROJECT_INFO.productName}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#1F7A7A]" />
          </div>
          {showSubtitle && (
            <span className={`font-mono uppercase tracking-wider text-[#6B7A88] font-medium mt-0.5 ${current.subtitle}`}>
              {PROJECT_INFO.productSubtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (asLink) {
    return (
      <Link href="/" className="hover:opacity-95 transition-opacity" title="MediChain Homepage">
        {content}
      </Link>
    );
  }

  return content;
}

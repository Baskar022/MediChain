"use client";

import React from "react";
import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-[#1F7A7A]/10 border border-[#1F7A7A]/20 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-[#1F7A7A] animate-spin" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-[#0F1F2E]">Loading MediChain Portal...</p>
          <p className="text-xs text-gray-500 font-mono mt-0.5">Verifying sovereign state & cryptographic context</p>
        </div>
      </div>
    </div>
  );
}

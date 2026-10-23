"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home, ShieldAlert } from "lucide-react";

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected client error
    console.error("MediChain Uncaught UI Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#F6F4EF] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-[#DCE8E3] rounded-2xl shadow-sm p-8 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
          <AlertTriangle className="w-7 h-7" />
        </div>
        
        <h1 className="text-xl font-bold text-[#0F1F2E] mb-2 font-serif">
          Application Error Detected
        </h1>
        
        <p className="text-sm text-gray-600 mb-6 leading-relaxed">
          An unexpected error occurred while rendering the clinical interface. Medical cryptography state and local keys remain secure.
        </p>

        <div className="p-3 bg-gray-50 rounded-lg text-left mb-6 border border-gray-200 overflow-x-auto">
          <span className="text-[11px] font-mono text-gray-500 uppercase block mb-1">
            Diagnostic Message
          </span>
          <p className="text-xs font-mono text-red-700 break-words">
            {error?.message || "Unknown client execution error"}
          </p>
          {error?.digest && (
            <span className="text-[10px] font-mono text-gray-400 mt-1 block">
              Digest: {error.digest}
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="flex items-center justify-center px-4 py-2.5 rounded-lg bg-[#1F7A7A] hover:bg-[#186464] text-white text-sm font-medium transition-colors shadow-sm"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Try Again
          </button>
          
          <Link
            href="/dashboard"
            className="flex items-center justify-center px-4 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-[#0F1F2E] text-sm font-medium transition-colors"
          >
            <Home className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

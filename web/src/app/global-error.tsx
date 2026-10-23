"use client";

import React from "react";
import Link from "next/link";
import { ShieldAlert, RotateCcw } from "lucide-react";

export default function RootGlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-[#F6F4EF] text-[#0F1F2E] min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-[#DCE8E3] rounded-2xl shadow-sm p-8 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <h1 className="text-xl font-bold text-[#0F1F2E] mb-2 font-serif">
            System Level Error
          </h1>

          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            A root-level layout error occurred. You can reset the application state safely without losing local encrypted records.
          </p>

          <button
            onClick={() => reset()}
            className="w-full flex items-center justify-center px-4 py-2.5 rounded-lg bg-[#1F7A7A] hover:bg-[#186464] text-white text-sm font-medium transition-colors shadow-sm"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reload MediChain Application
          </button>
        </div>
      </body>
    </html>
  );
}

"use client";

import React from "react";
import { useWeb3 } from "@/context/Web3Context";
import { CheckCircle2, AlertTriangle, AlertCircle, Loader2, X, ExternalLink } from "lucide-react";

export function ToastContainer() {
  const { toasts, dismissToast } = useWeb3();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2 max-w-md w-full pointer-events-none">
      {toasts.map((toast) => {
        let borderClass = "border-medichain-border";
        let icon = <CheckCircle2 className="w-4 h-4 text-medichain-verified shrink-0" />;

        if (toast.type === "pending") {
          borderClass = "border-medichain-teal";
          icon = <Loader2 className="w-4 h-4 text-medichain-teal animate-spin shrink-0" />;
        } else if (toast.type === "error") {
          borderClass = "border-medichain-tampered";
          icon = <AlertCircle className="w-4 h-4 text-medichain-tampered shrink-0" />;
        } else if (toast.type === "info") {
          borderClass = "border-medichain-sage-border";
          icon = <AlertTriangle className="w-4 h-4 text-medichain-amber shrink-0" />;
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto bg-white border ${borderClass} shadow-dropdown rounded-lg p-3.5 flex items-start justify-between space-x-3 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2`}
          >
            <div className="flex items-start space-x-3">
              <div className="mt-0.5">{icon}</div>
              <div className="text-sm">
                <div className="font-medium text-medichain-navy">{toast.title}</div>
                {toast.message && (
                  <div className="text-medichain-muted text-xs mt-0.5 leading-relaxed">
                    {toast.message}
                  </div>
                )}
                {toast.txHash && (
                  <div className="mt-1 flex items-center space-x-1 text-xs text-medichain-teal font-mono">
                    <span>Tx: {toast.txHash.slice(0, 10)}...{toast.txHash.slice(-8)}</span>
                    <ExternalLink className="w-3 h-3" />
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              className="text-medichain-subtle hover:text-medichain-navy transition-colors shrink-0 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

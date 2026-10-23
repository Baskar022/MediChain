"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { X, Copy, Check, ExternalLink, ShieldCheck } from "lucide-react";

interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordId: string;
  recordHash: string;
  cipherHash: string;
  issuerName?: string;
}

export function QrCodeModal({
  isOpen,
  onClose,
  recordId,
  recordHash,
  cipherHash,
  issuerName = "Metro Health Medical Center",
}: QrCodeModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const verifyUrl = typeof window !== "undefined"
    ? `${window.location.origin}/verify?recordId=${encodeURIComponent(recordId)}&recordHash=${encodeURIComponent(recordHash)}`
    : `http://localhost:3000/verify?recordId=${recordId}`;

  useEffect(() => {
    if (isOpen) {
      QRCode.toDataURL(verifyUrl, {
        width: 240,
        margin: 1,
        color: {
          dark: "#0F1F2E",
          light: "#FFFFFF",
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch(console.error);
    }
  }, [isOpen, verifyUrl]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white border border-medichain-border rounded-xl max-w-md w-full p-6 shadow-dropdown space-y-5">
        <div className="flex items-center justify-between border-b border-medichain-border pb-3">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-medichain-teal" />
            <h3 className="font-serif text-base font-semibold text-medichain-navy">
              Record Verification QR
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-medichain-muted hover:text-medichain-navy transition-colors p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-center space-y-3">
          <div className="p-3 bg-white border border-medichain-border rounded-lg inline-block shadow-card">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Record Verification QR Code" className="w-48 h-48 mx-auto" />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-xs text-medichain-muted">
                Generating QR...
              </div>
            )}
          </div>
          <p className="text-xs text-medichain-muted max-w-xs mx-auto">
            Scan this QR code with any mobile device to view and mathematically verify the
            authenticity of this record directly on the blockchain.
          </p>
        </div>

        <div className="space-y-2.5 bg-medichain-bg border border-medichain-border rounded-lg p-3 text-xs font-mono">
          <div>
            <div className="text-[10px] text-medichain-muted uppercase font-sans font-semibold">
              Record Identifier
            </div>
            <div className="flex items-center justify-between mt-0.5 text-medichain-navy truncate">
              <span className="truncate">{recordId}</span>
              <button
                onClick={() => copyToClipboard(recordId, "recordId")}
                className="ml-2 text-medichain-teal hover:underline flex items-center shrink-0"
              >
                {copiedField === "recordId" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <div className="text-[10px] text-medichain-muted uppercase font-sans font-semibold">
              Plaintext SHA-256 Hash
            </div>
            <div className="flex items-center justify-between mt-0.5 text-medichain-navy truncate">
              <span className="truncate">{recordHash}</span>
              <button
                onClick={() => copyToClipboard(recordHash, "recordHash")}
                className="ml-2 text-medichain-teal hover:underline flex items-center shrink-0"
              >
                {copiedField === "recordHash" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-medichain-border">
          <button
            onClick={() => copyToClipboard(verifyUrl, "verifyUrl")}
            className="px-3 py-1.5 border border-medichain-border hover:bg-medichain-bg rounded text-xs font-medium text-medichain-navy transition-colors flex items-center space-x-1.5"
          >
            {copiedField === "verifyUrl" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedField === "verifyUrl" ? "Copied Link" : "Copy Verification URL"}</span>
          </button>
          <a
            href={verifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-medichain-teal hover:bg-medichain-teal-hover text-white px-3.5 py-1.5 rounded text-xs font-medium transition-colors shadow-sm flex items-center space-x-1.5"
          >
            <span>Open Verifier</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

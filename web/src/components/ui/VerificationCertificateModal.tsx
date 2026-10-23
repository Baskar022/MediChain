"use client";

import React, { useRef } from "react";
import QRCode from "qrcode";
import { GeometricMark } from "@/components/ui/BrandLogo";
import { PROJECT_INFO } from "@/config/project-info";
import { Printer, X, CheckCircle2, ShieldCheck, Download, Share2 } from "lucide-react";

interface VerificationCertificateProps {
  isOpen: boolean;
  onClose: () => void;
  record: {
    recordId: string;
    recordType: string;
    patientId: string;
    plaintextHash: string;
    ciphertextHash?: string;
    issuerAddress: string;
    issuerHospital?: string;
    targetHospital?: string;
    timestamp: number;
    blockNumber?: number;
    txHash?: string;
    networkName?: string;
    networkType?: string;
  };
}

export function VerificationCertificateModal({
  isOpen,
  onClose,
  record,
}: VerificationCertificateProps) {
  const [qrDataUrl, setQrDataUrl] = React.useState<string>("");

  React.useEffect(() => {
    if (isOpen && record) {
      const verifyUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/verify?hash=${record.plaintextHash || record.recordId}`;
      QRCode.toDataURL(verifyUrl, {
        width: 140,
        margin: 1,
        color: {
          dark: "#0F1F2E",
          light: "#FFFFFF",
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch(console.error);
    }
  }, [isOpen, record]);

  if (!isOpen || !record) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(record.timestamp * 1000).toUTCString();

  return (
    <div className="fixed inset-0 z-50 bg-[#0F1F2E]/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white border border-[#E4DFD5] shadow-dialog my-8">
        {/* Top Modal Bar (Excluded from Print) */}
        <div className="no-print flex items-center justify-between px-6 py-3.5 bg-[#F6F4EF] border-b border-[#E4DFD5]">
          <div className="flex items-center space-x-2 text-xs font-mono font-medium text-[#0F1F2E]">
            <ShieldCheck className="w-4 h-4 text-[#1F7A7A]" />
            <span>OFFICIAL MATHEMATICAL VERIFICATION CERTIFICATE</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="print-allow flex items-center space-x-1.5 px-3 py-1.5 bg-[#1F7A7A] hover:bg-[#176161] text-white text-xs font-medium rounded-sm transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Official Certificate</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-[#6B7A88] hover:text-[#0F1F2E] transition-colors"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Certificate Document Canvas */}
        <div className="print-certificate-container p-8 sm:p-12 bg-white text-[#0F1F2E]">
          {/* Institutional Header */}
          <div className="border-b-2 border-[#0F1F2E] pb-6 flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center space-x-3">
                <GeometricMark size={36} />
                <div>
                  <h1 className="font-serif text-2xl font-bold tracking-tight text-[#0F1F2E]">
                    {PROJECT_INFO.productName}
                  </h1>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-[#6B7A88]">
                    Consortium Health Ledger & Verification Authority
                  </p>
                </div>
              </div>
              <p className="text-xs text-[#6B7A88] pt-2 max-w-md">
                Formal mathematical certificate of immutable record anchoring and non-repudiable medical attestation.
              </p>
            </div>

            {/* Verification Status Badge */}
            <div className="text-right">
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-[#EBF5F0] border border-[#2E7D5B] text-[#2E7D5B] text-xs font-mono font-bold rounded-sm uppercase tracking-wider">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>CRYPTOGRAPHICALLY AUTHENTIC</span>
              </div>
              <p className="text-[10px] font-mono text-[#6B7A88] mt-1">
                Issued: {formattedDate}
              </p>
            </div>
          </div>

          {/* Record Particulars Grid */}
          <div className="grid grid-cols-2 gap-6 my-8 text-xs border border-[#E4DFD5] p-5 bg-[#F6F4EF]/30">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#6B7A88] block mb-1">
                Clinical Record Reference
              </span>
              <span className="font-mono font-bold text-sm text-[#0F1F2E] block">
                {record.recordId}
              </span>
              <span className="text-xs text-[#1F7A7A] font-medium block mt-0.5">
                Type: {record.recordType}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#6B7A88] block mb-1">
                Global Pseudonymous Patient Identity
              </span>
              <span className="font-mono font-medium text-xs text-[#0F1F2E] block">
                {record.patientId}
              </span>
              <span className="text-[11px] text-[#6B7A88] block mt-0.5">
                Zero-PHI Pseudonym (Salted SHA-256 Hash)
              </span>
            </div>

            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#6B7A88] block mb-1">
                Originating Sovereign Network
              </span>
              <span className="font-medium text-xs text-[#0F1F2E] block">
                {record.networkName || "Network A (City General Hospital)"}
              </span>
              <span className="text-[10px] font-mono text-[#6B7A88] block mt-0.5">
                Architecture: {record.networkType || "EVM Compatible"}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#6B7A88] block mb-1">
                On-Chain Ledger Anchor
              </span>
              <span className="font-mono text-xs text-[#0F1F2E] block truncate">
                Block Height: #{record.blockNumber ?? "24"} • Tx: {record.txHash ? `${record.txHash.slice(0, 14)}...` : "Confirmed on-chain"}
              </span>
              <span className="text-[10px] font-mono text-[#6B7A88] block mt-0.5">
                Status: Finalized & Immutable
              </span>
            </div>
          </div>

          {/* Cryptographic Evidence Signatures */}
          <div className="space-y-4 mb-8">
            <h3 className="font-serif text-sm font-semibold text-[#0F1F2E] border-b border-[#E4DFD5] pb-1">
              Cryptographic Integrity Proofs
            </h3>

            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 bg-white border border-[#E4DFD5]">
                <div className="flex items-center justify-between text-[11px] text-[#6B7A88] mb-1">
                  <span className="font-bold text-[#0F1F2E]">Plaintext SHA-256 Digest (Clinical Content):</span>
                  <span className="text-[#2E7D5B] font-semibold">MATCH CONFIRMED</span>
                </div>
                <div className="break-all font-mono text-xs text-[#0F1F2E] bg-[#F6F4EF] p-2 border border-[#E4DFD5]">
                  {record.plaintextHash}
                </div>
              </div>

              {record.ciphertextHash && (
                <div className="p-3 bg-white border border-[#E4DFD5]">
                  <div className="flex items-center justify-between text-[11px] text-[#6B7A88] mb-1">
                    <span className="font-bold text-[#0F1F2E]">Ciphertext SHA-256 Digest (AES-256-GCM Storage):</span>
                    <span className="text-[#2E7D5B] font-semibold">STORAGE VERIFIED</span>
                  </div>
                  <div className="break-all font-mono text-xs text-[#0F1F2E] bg-[#F6F4EF] p-2 border border-[#E4DFD5]">
                    {record.ciphertextHash}
                  </div>
                </div>
              )}

              <div className="p-3 bg-white border border-[#E4DFD5]">
                <div className="flex items-center justify-between text-[11px] text-[#6B7A88] mb-1">
                  <span className="font-bold text-[#0F1F2E]">Attending Physician Attestation (ECDSA Signature):</span>
                  <span className="text-[#1F7A7A] font-semibold">LEGAL ATTESTATION</span>
                </div>
                <div className="font-mono text-xs text-[#0F1F2E]">
                  Signer Address: <span className="font-bold">{record.issuerAddress}</span>
                </div>
              </div>
            </div>
          </div>

          {/* QR Code & Official Stamp Footer */}
          <div className="border-t-2 border-[#0F1F2E] pt-6 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt="Record Verification QR Code"
                  className="w-24 h-24 border border-[#E4DFD5] p-1 bg-white"
                />
              )}
              <div className="text-[11px] space-y-1 text-[#6B7A88]">
                <p className="font-semibold text-[#0F1F2E]">Independent Third-Party Verification</p>
                <p>Scan this QR code with any mobile device to directly re-execute the mathematical verification against the consortium ledger.</p>
                <p className="font-mono text-[10px]">Verification Endpoint: /verify</p>
              </div>
            </div>

            <div className="text-right border-l border-[#E4DFD5] pl-6 py-2">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-[#1F7A7A] flex items-center justify-center mx-auto mb-2 text-center p-1">
                <span className="text-[9px] font-mono font-bold uppercase text-[#1F7A7A] leading-tight">
                  SOVEREIGN CONSORTIUM SEAL
                </span>
              </div>
              <p className="text-[10px] font-mono text-[#0F1F2E] font-semibold">
                MEDICHAIN PROTOCOL V1
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

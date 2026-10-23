/**
 * MediChain Project Configuration
 * 
 * Edit this file to update institution details, faculty guides,
 * and team member attributions for presentations and reports.
 */

export interface TeamMember {
  name: string;
  role: string;
  prnOrId?: string;
}

export interface ProjectInfo {
  productName: string;
  productSubtitle: string;
  tagline: string;
  institutionName: string;
  department: string;
  university: string;
  academicYear: string;
  guide: {
    name: string;
    designation: string;
    department: string;
  };
  team: TeamMember[];
  license: string;
  version: string;
  repositoryUrl: string;
}

export const PROJECT_INFO: ProjectInfo = {
  productName: "MediChain",
  productSubtitle: "Sovereign Health Ledger",
  tagline: "Cryptographic Cross-Chain Interoperability Network for Sovereign Medical Records",
  institutionName: "Department of Computer Science & Engineering",
  department: "Faculty of Engineering & Technology",
  university: "Affiliated Technical University",
  academicYear: "2025 – 2026",
  guide: {
    name: "Faculty Guide / Advisor",
    designation: "Assistant Professor",
    department: "Department of Computer Science & Engineering",
  },
  team: [
    {
      name: "Student Lead",
      role: "Cross-Chain Architecture, Relayer & Smart Contracts",
      prnOrId: "Lead Developer",
    },
    {
      name: "Project Partner",
      role: "Client-Side Cryptography, Key Management & Full-Stack UI",
      prnOrId: "Core Developer",
    },
  ],
  license: "MIT Open Source — Local Academic Evaluation",
  version: "1.0.0-production-h5",
  repositoryUrl: "https://github.com/medichain/interop",
};

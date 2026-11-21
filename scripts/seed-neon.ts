import { PrismaClient } from "@prisma/client";
import { ethers } from "ethers";

const prisma = new PrismaClient();

async function main() {
  console.log("=================================================");
  console.log(" Seeding Neon PostgreSQL Database with Consortium");
  console.log("=================================================");

  const instA_Id = ethers.keccak256(ethers.toUtf8Bytes("HOSPITAL-CITY-GENERAL"));
  const instB_Id = ethers.keccak256(ethers.toUtf8Bytes("HOSPITAL-REGIONAL-SPECIALTY"));
  const instC_Id = ethers.keccak256(ethers.toUtf8Bytes("LAB-METRO-DIAGNOSTICS"));

  const institutions = [
    {
      id: instA_Id,
      name: "City General Hospital",
      institutionType: "HOSPITAL" as const,
      chainType: "EVM" as const,
      chainId: "11155111",
      rpcPort: 8545,
      gatewayPublicKey: "0x04a298bf681c620be676a0d6ab6e62eb74f3780373e3a5ab66dc8b087a32f746b1",
      gatewayEndpoint: "https://gateway-a.medichain.network",
      status: "ACTIVE" as const,
      trustLevel: 5,
    },
    {
      id: instB_Id,
      name: "Regional Specialty Hospital",
      institutionType: "HOSPITAL" as const,
      chainType: "EVM" as const,
      chainId: "80002",
      rpcPort: 8546,
      gatewayPublicKey: "0x04b898bf681c620be676a0d6ab6e62eb74f3780373e3a5ab66dc8b087a32f746b2",
      gatewayEndpoint: "https://gateway-b.medichain.network",
      status: "ACTIVE" as const,
      trustLevel: 4,
    },
    {
      id: instC_Id,
      name: "Metro Diagnostics Laboratory",
      institutionType: "LAB" as const,
      chainType: "ALGORAND" as const,
      chainId: "algorand-testnet",
      rpcPort: 4001,
      gatewayPublicKey: "0x04c598bf681c620be676a0d6ab6e62eb74f3780373e3a5ab66dc8b087a32f746b3",
      gatewayEndpoint: "https://gateway-c.medichain.network",
      status: "ACTIVE" as const,
      trustLevel: 5,
    },
  ];

  for (const inst of institutions) {
    await prisma.institution.upsert({
      where: { id: inst.id },
      update: inst,
      create: inst,
    });
    console.log(`  ✔ Seeded Institution: ${inst.name} (${inst.chainType})`);
  }

  // Seed sample staff
  const staff = [
    {
      id: "staff_dr_sarah_chen",
      hospitalWallet: "0x37Eb4068f010De307430f6eF444f45a989fE6f84",
      name: "Dr. Sarah Chen, MD",
      specialty: "Cardiology",
      role: "DOCTOR" as const,
      walletAddress: "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
      licenseNumber: "MD-LIC-2024-9981",
      institutionId: instA_Id,
    },
    {
      id: "staff_dr_marcus_vance",
      hospitalWallet: "0x37Eb4068f010De307430f6eF444f45a989fE6f84",
      name: "Dr. Marcus Vance, MD",
      specialty: "Hematology & Oncology",
      role: "DOCTOR" as const,
      walletAddress: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
      licenseNumber: "MD-LIC-2023-4412",
      institutionId: instB_Id,
    },
  ];

  for (const s of staff) {
    await prisma.staffMember.upsert({
      where: { walletAddress: s.walletAddress },
      update: s,
      create: s,
    });
    console.log(`  ✔ Seeded Staff: ${s.name} (${s.specialty})`);
  }

  console.log("\nDatabase successfully populated!");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

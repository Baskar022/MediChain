import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

interface NetworkDefinition {
  id: string;
  name: string;
  type: "EVM" | "FABRIC_SIMULATED";
  badge: string;
  technology: string;
  consensus: string;
  rpcOrApiUrl: string;
  chainId?: number;
  description: string;
  honestNotice?: string;
}

const NETWORKS: NetworkDefinition[] = [
  {
    id: "networkA",
    name: "City General Hospital",
    type: "EVM",
    badge: "EVM (Hardhat)",
    technology: "Ethereum Virtual Machine (EVM) / Solidity Smart Contracts",
    consensus: "Proof of Authority / Local Dev Consensus",
    rpcOrApiUrl: process.env.NEXT_PUBLIC_NETWORK_A_RPC || "http://127.0.0.1:8545",
    chainId: 31337,
    description: "Sovereign EVM blockchain node managing clinical records and local consent for City General.",
  },
  {
    id: "networkB",
    name: "Regional Specialty Hospital",
    type: "EVM",
    badge: "EVM (Hardhat)",
    technology: "Ethereum Virtual Machine (EVM) / Independent Node",
    consensus: "Proof of Authority / Local Dev Consensus",
    rpcOrApiUrl: process.env.NEXT_PUBLIC_NETWORK_B_RPC || "http://127.0.0.1:8546",
    chainId: 31338,
    description: "Independent sovereign EVM chain hosted by Regional Specialty Hospital.",
  },
  {
    id: "networkC",
    name: "Metro Diagnostics Lab",
    type: "FABRIC_SIMULATED",
    badge: "Fabric-style (Simulated)",
    technology: "Non-EVM Permissioned Ledger (Simulated Hyperledger Fabric Architecture)",
    consensus: "Raft-style Deterministic Leader Ordering",
    rpcOrApiUrl: process.env.NEXT_PUBLIC_LEDGER_REST_URL || "http://127.0.0.1:9000",
    description: "Append-only SHA-256 Merkle-tree permissioned ledger simulating Hyperledger Fabric state channel.",
    honestNotice: "Runs via Node.js/TypeScript simulated ledger service on port 9000 because Docker is not running on host. Full Fabric chaincode is available in /fabric.",
  },
  {
    id: "federation",
    name: "Federation Neutral Trust Anchor",
    type: "EVM",
    badge: "EVM Trust Layer",
    technology: "Ethereum Virtual Machine (EVM) Federation Registry",
    consensus: "Consortium Governance / Federation Multi-sig",
    rpcOrApiUrl: process.env.NEXT_PUBLIC_FEDERATION_RPC || "http://127.0.0.1:8547",
    chainId: 31340,
    description: "Consortium federation registry anchoring member institutions, public keys, and patient record locators.",
  },
];

async function fetchEvmExplorerData(net: NetworkDefinition) {
  try {
    const provider = new ethers.JsonRpcProvider(net.rpcOrApiUrl);
    // Timeout safeguard
    const blockNumberPromise = provider.getBlockNumber();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("RPC Timeout")), 1500)
    );
    const blockNumber = (await Promise.race([blockNumberPromise, timeoutPromise])) as number;

    const blockFetchCount = Math.min(blockNumber + 1, 8);
    const blocks: any[] = [];
    const transactions: any[] = [];

    for (let i = 0; i < blockFetchCount; i++) {
      const bNum = blockNumber - i;
      try {
        const blk = await provider.getBlock(bNum, true);
        if (blk) {
          blocks.push({
            number: blk.number,
            hash: blk.hash,
            parentHash: blk.parentHash,
            timestamp: blk.timestamp,
            txCount: blk.transactions.length,
            gasUsed: blk.gasUsed.toString(),
            miner: blk.miner,
          });

          // Extract transactions
          for (const tx of blk.prefetchedTransactions || []) {
            transactions.push({
              hash: tx.hash,
              blockNumber: blk.number,
              from: tx.from,
              to: tx.to,
              value: ethers.formatEther(tx.value || 0n) + " ETH",
              data: tx.data ? tx.data.substring(0, 34) + "..." : "0x",
              fullData: tx.data,
              nonce: tx.nonce,
            });
          }
        }
      } catch {
        // Continue loop
      }
    }

    return {
      online: true,
      blockHeight: blockNumber,
      totalBlocks: blockNumber + 1,
      blocks,
      transactions: transactions.slice(0, 15),
      error: null,
    };
  } catch (err: any) {
    return {
      online: false,
      blockHeight: 0,
      totalBlocks: 0,
      blocks: [],
      transactions: [],
      error: `Network offline or unreachable at ${net.rpcOrApiUrl} (${err.message})`,
    };
  }
}

async function fetchLedgerExplorerData(net: NetworkDefinition) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);

    const [infoRes, blocksRes] = await Promise.all([
      fetch(`${net.rpcOrApiUrl}/api/chain/info`, { signal: controller.signal }),
      fetch(`${net.rpcOrApiUrl}/api/blocks?limit=10`, { signal: controller.signal }),
    ]);
    clearTimeout(timer);

    if (!infoRes.ok) {
      throw new Error(`HTTP ${infoRes.status} from ledger info`);
    }

    const info = await infoRes.json();
    const blocksData = blocksRes.ok ? await blocksRes.json() : { blocks: [] };

    const formattedBlocks = (blocksData.blocks || []).map((b: any) => ({
      number: b.blockNumber,
      hash: b.hash,
      parentHash: b.previousHash,
      merkleRoot: b.merkleRoot,
      timestamp: b.timestamp,
      txCount: (b.transactions || []).length,
      miner: b.validator || "Node_Metro_Diagnostics",
    }));

    const transactions: any[] = [];
    for (const b of blocksData.blocks || []) {
      for (const tx of b.transactions || []) {
        transactions.push({
          hash: tx.txId,
          blockNumber: b.blockNumber,
          from: tx.actor || "Metro Diagnostics Gateway",
          to: tx.type || "Ledger Core",
          value: "N/A (Permissioned Tokenless)",
          data: JSON.stringify(tx.payload || {}).substring(0, 40) + "...",
          fullData: JSON.stringify(tx, null, 2),
          type: tx.type,
          timestamp: tx.timestamp,
        });
      }
    }

    return {
      online: true,
      blockHeight: info.height || formattedBlocks.length,
      totalBlocks: info.height || formattedBlocks.length,
      blocks: formattedBlocks,
      transactions: transactions.slice(0, 15),
      error: null,
    };
  } catch (err: any) {
    return {
      online: false,
      blockHeight: 0,
      totalBlocks: 0,
      blocks: [],
      transactions: [],
      error: `Permissioned ledger offline at ${net.rpcOrApiUrl} (${err.message})`,
    };
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetNet = searchParams.get("network");

  const results: Record<string, any> = {};

  const networksToQuery = targetNet
    ? NETWORKS.filter((n) => n.id === targetNet)
    : NETWORKS;

  for (const net of networksToQuery) {
    let telemetry;
    if (net.type === "EVM") {
      telemetry = await fetchEvmExplorerData(net);
    } else {
      telemetry = await fetchLedgerExplorerData(net);
    }

    results[net.id] = {
      meta: net,
      telemetry,
    };
  }

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    networks: results,
  });
}

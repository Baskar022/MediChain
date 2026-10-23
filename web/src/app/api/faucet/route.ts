import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

const DEFAULT_DEV_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const RPCS: Record<string, string> = {
  networkA: process.env.NEXT_PUBLIC_NETWORK_A_RPC || "http://127.0.0.1:8545",
  networkB: process.env.NEXT_PUBLIC_NETWORK_B_RPC || "http://127.0.0.1:8546",
  federation: process.env.NEXT_PUBLIC_FEDERATION_RPC || "http://127.0.0.1:8547",
};

export async function POST(request: NextRequest) {
  try {
    const { address, network = "networkA", amount = "1.0" } = await request.json();

    if (!address || !ethers.isAddress(address)) {
      return NextResponse.json({ error: "Invalid recipient address" }, { status: 400 });
    }

    const rpcUrl = RPCS[network] || RPCS.networkA;
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const faucetWallet = new ethers.Wallet(DEFAULT_DEV_KEY, provider);

    const tx = await faucetWallet.sendTransaction({
      to: address,
      value: ethers.parseEther(amount),
    });
    await tx.wait(1);

    return NextResponse.json({
      success: true,
      sponsoredAddress: address,
      txHash: tx.hash,
      network,
      amount: `${amount} ETH`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Gas sponsorship failed: ${err.message}` },
      { status: 500 }
    );
  }
}

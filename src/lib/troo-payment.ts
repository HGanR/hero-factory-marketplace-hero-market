/**
 * TROO token payment utility for Polygon
 * Contract: 0xa7927231898293377Ce676CFC9bbD551Cb845695
 * Decimals: 18
 */
import { TROO_TOKEN_ADDRESS, TROO_TREASURY_WALLET, TROO_DECIMALS, POLYGON_CHAIN_ID } from "./troo-token-config";

export async function transferTrooToTreasury(
  amount: number,
  decimals: number = TROO_DECIMALS
): Promise<{ hash: string; buyerWallet: string; chainId: number }> {
  if (!TROO_TREASURY_WALLET) {
    throw new Error("TROO treasury wallet not configured. Set NEXT_PUBLIC_TROO_TREASURY_WALLET.");
  }

  const eth = (typeof window !== "undefined" && (window as any).ethereum) || null;
  if (!eth) throw new Error("No wallet detected. Please install MetaMask and connect.");

  const { ethers } = await import("ethers");
  const provider = new ethers.BrowserProvider(eth);
  await provider.send("eth_requestAccounts", []);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== POLYGON_CHAIN_ID) {
    throw new Error("Please switch to Polygon network before purchasing.");
  }

  const signer = await provider.getSigner();
  const buyerWallet = await signer.getAddress();
  const erc20 = new ethers.Contract(
    TROO_TOKEN_ADDRESS,
    [
      "function decimals() view returns (uint8)",
      "function transfer(address to, uint256 amount) returns (bool)",
    ],
    signer
  );
  const dec = await erc20.decimals().catch(() => decimals);
  const value = ethers.parseUnits(String(amount), dec);
  const tx = await erc20.transfer(TROO_TREASURY_WALLET, value);
  await tx.wait();
  return { hash: tx.hash as string, buyerWallet, chainId: Number(network.chainId) };
}

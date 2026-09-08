import "dotenv/config";
import { ethers } from "ethers";

const CONTRACT_ADDRESS = "0x7C004222BcB68Ef61B0fbdF2B70dD361eE9740da";

const ABI = [
  "function recordAudit(string applicationId, bytes32 auditHash) public",
  "function getAudit(string applicationId) public view returns (bytes32 auditHash, uint256 timestamp, address recordedBy)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(
    process.env.SEPOLIA_RPC_URL
  );

  const wallet = new ethers.Wallet(
    process.env.SEPOLIA_PRIVATE_KEY!,
    provider
  );

  console.log("Wallet:", wallet.address);

  const balance = await provider.getBalance(wallet.address);

  console.log(
    "Balance:",
    ethers.formatEther(balance),
    "Sepolia ETH"
  );

  const contract = new ethers.Contract(
    CONTRACT_ADDRESS,
    ABI,
    wallet
  );

  const applicationId = "APP001";

  const auditHash = ethers.keccak256(
    ethers.toUtf8Bytes("AegisAI audit APP001")
  );

  console.log("Application ID:", applicationId);
  console.log("Audit Hash:", auditHash);

  console.log("Recording audit on blockchain...");

  const tx = await contract.recordAudit(
    applicationId,
    auditHash
  );

  console.log("Transaction Hash:", tx.hash);

  await tx.wait();

  console.log("✅ Audit recorded successfully!");

  const result = await contract.getAudit(applicationId);

  console.log("\nBlockchain Audit Record:");
  console.log("Hash:", result[0]);
  console.log("Timestamp:", result[1].toString());
  console.log("Recorded By:", result[2]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
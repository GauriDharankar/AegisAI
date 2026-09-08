import "dotenv/config";
import express from "express";
import { ethers } from "ethers";
import fs from "fs";
import crypto from "crypto";

const app = express();

app.use(express.json());

const PORT = 3000;


// =====================================================
// BLOCKCHAIN CONFIGURATION
// =====================================================

const CONTRACT_ADDRESS = "0xCCfCf16DEa4FA356E373282619fec68537a3669c";


const ABI = [

  "function recordAudit(string applicationId, bytes32 auditHash) public",

  "function getAuditCount(string applicationId) public view returns (uint256)",

  "function getAudit(string applicationId, uint256 auditIndex) public view returns (bytes32 auditHash, uint256 timestamp, address recordedBy)"

];


const provider =
  new ethers.JsonRpcProvider(
    process.env.SEPOLIA_RPC_URL
  );


const wallet =
  new ethers.Wallet(
    process.env.SEPOLIA_PRIVATE_KEY!,
    provider
  );


const contract =
  new ethers.Contract(
    CONTRACT_ADDRESS,
    ABI,
    wallet
  );


// =====================================================
// LOCAL AUDIT STORAGE
// =====================================================

const AUDIT_FILE =
  "./data/auditStore.json";


// =====================================================
// GENERATE SHA-256 HASH
// =====================================================

function generateHash(data: object): string {

  const canonicalData =
    JSON.stringify(data);

  return (
    "0x" +
    crypto
      .createHash("sha256")
      .update(canonicalData)
      .digest("hex")
  );
}


// =====================================================
// SAVE AUDIT LOCALLY
// =====================================================

function saveAudit(auditRecord: any) {

  let audits: any[] = [];

  if (fs.existsSync(AUDIT_FILE)) {

    const existingData =
      fs.readFileSync(
        AUDIT_FILE,
        "utf8"
      );

    if (existingData.trim()) {

      audits =
        JSON.parse(existingData);

    }

  }

  audits.push(auditRecord);

  fs.writeFileSync(
    AUDIT_FILE,
    JSON.stringify(
      audits,
      null,
      2
    )
  );

}


// =====================================================
// GET LOCAL AUDITS FOR APPLICATION
// =====================================================

function getLocalAudits(
  applicationId: string
) {

  if (!fs.existsSync(AUDIT_FILE)) {
    return [];
  }

  const data =
    fs.readFileSync(
      AUDIT_FILE,
      "utf8"
    );

  if (!data.trim()) {
    return [];
  }

  const audits =
    JSON.parse(data);

  return audits.filter(
    (audit: any) =>
      audit.application_id === applicationId
  );

}


// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/", (req, res) => {

  res.json({

    service:
      "AegisAI Blockchain Audit Service",

    status:
      "running"

  });

});


// =====================================================
// POST /api/audit
//
// Receives audit information from AegisAI
// =====================================================

app.post(
  "/api/audit",
  async (req, res) => {

    try {

      const auditData =
        req.body;


      console.log(
        "\n=============================="
      );

      console.log(
        "New AegisAI Audit Received"
      );

      console.log(
        "=============================="
      );


      console.log(auditData);


      // ---------------------------------------------
      // Validate application ID
      // ---------------------------------------------

      if (
        !auditData ||
        !auditData.application_id
      ) {

        return res.status(400).json({

          success: false,

          message:
            "application_id is required"

        });

      }


      // ---------------------------------------------
      // Generate SHA-256 hash
      // ---------------------------------------------

      const auditHash =
        generateHash(auditData);


      console.log(
        "\nGenerated SHA-256 Hash:"
      );

      console.log(
        auditHash
      );


      // ---------------------------------------------
      // Create local audit record
      // ---------------------------------------------

      const storedAudit = {

        ...auditData,

        audit_hash:
          auditHash,

        recorded_at:
          new Date().toISOString()

      };


      // ---------------------------------------------
      // Save locally
      // ---------------------------------------------

      saveAudit(
        storedAudit
      );


      console.log(
        "✅ Audit saved locally"
      );


      // ---------------------------------------------
      // Record hash on blockchain
      // ---------------------------------------------

      console.log(
        "\nRecording hash on blockchain..."
      );


      const tx =
        await contract.recordAudit(
          auditData.application_id,
          auditHash
        );


      console.log(
        "Transaction:"
      );

      console.log(
        tx.hash
      );


      // Wait for confirmation
      await tx.wait();


      console.log(
        "✅ Blockchain transaction confirmed"
      );


      // ---------------------------------------------
      // Get current audit count
      // ---------------------------------------------

      const auditCount =
        await contract.getAuditCount(
          auditData.application_id
        );


      const auditIndex =
        auditCount - 1n;


      // ---------------------------------------------
      // Return response
      // ---------------------------------------------

      res.json({

        success: true,

        application_id:
          auditData.application_id,

        audit_index:
          auditIndex.toString(),

        audit_hash:
          auditHash,

        transaction_hash:
          tx.hash,

        status:
          "RECORDED"

      });

    }

    catch (error) {

      console.error(
        "\n❌ Audit recording failed:"
      );

      console.error(error);


      res.status(500).json({

        success: false,

        message:
          "Failed to record audit",

        error:
          error instanceof Error
            ? error.message
            : String(error)

      });

    }

  }
);

app.get("/api/audit/:applicationId/verify/:auditIndex", async (req, res) => {
  try {
    const { applicationId, auditIndex } = req.params;
    const index = parseInt(auditIndex);

    if (isNaN(index) || index < 0)
      return res.status(400).json({ success: false, message: "Invalid audit index" });

    const localAudits = getLocalAudits(applicationId);

    if (index >= localAudits.length)
      return res.status(404).json({ success: false, message: "Local audit not found" });

    const { audit_hash, recorded_at, ...originalData } = localAudits[index];

    const calculatedHash = generateHash(originalData);

    const count = await contract.getAuditCount(applicationId);

    if (BigInt(index) >= count)
      return res.status(404).json({
        success: false,
        message: "Audit not found on blockchain"
      });

    const record = await contract.getAudit(applicationId, BigInt(index));
    const blockchainHash = record[0];

    const verified =
      calculatedHash.toLowerCase() === blockchainHash.toLowerCase();

    res.json({
      success: true,
      application_id: applicationId,
      audit_index: index,
      status: verified ? "VERIFIED" : "TAMPER_DETECTED",
      blockchain_hash: blockchainHash,
      calculated_hash: calculatedHash
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Verification failed",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});
// =====================================================
// GET /api/audit/:applicationId/verify
//
// Verifies the latest audit
// =====================================================

app.get(
  "/api/audit/:applicationId/verify",
  async (req, res) => {

    try {

      const applicationId =
        req.params.applicationId;


      // ---------------------------------------------
      // Get local audits
      // ---------------------------------------------

      const localAudits =
        getLocalAudits(
          applicationId
        );


      if (
        localAudits.length === 0
      ) {

        return res.status(404).json({

          success: false,

          message:
            "Audit not found locally"

        });

      }


      // ---------------------------------------------
      // Get latest local audit
      // ---------------------------------------------

      const latestAudit =
        localAudits[
          localAudits.length - 1
        ];


      // ---------------------------------------------
      // Remove generated fields
      // before recalculating hash
      // ---------------------------------------------

      const {

        audit_hash,

        recorded_at,

        ...originalData

      } = latestAudit;


      // ---------------------------------------------
      // Recalculate hash
      // ---------------------------------------------

      const recalculatedHash =
        generateHash(
          originalData
        );


      console.log(
        "\nRecalculated Hash:"
      );

      console.log(
        recalculatedHash
      );


      // ---------------------------------------------
      // Get blockchain audit count
      // ---------------------------------------------

      const auditCount =
        await contract.getAuditCount(
          applicationId
        );


      if (
        auditCount === 0n
      ) {

        return res.status(404).json({

          success: false,

          message:
            "No blockchain audit found"

        });

      }


      // ---------------------------------------------
      // Get latest blockchain audit
      // ---------------------------------------------

      const latestIndex =
        auditCount - 1n;


      const blockchainRecord =
        await contract.getAudit(
          applicationId,
          latestIndex
        );


      const blockchainHash =
        blockchainRecord[0];


      console.log(
        "\nBlockchain Hash:"
      );

      console.log(
        blockchainHash
      );


      // ---------------------------------------------
      // Compare hashes
      // ---------------------------------------------

      const verified =
        recalculatedHash.toLowerCase() ===
        blockchainHash.toLowerCase();


      if (verified) {

        return res.json({

          success: true,

          application_id:
            applicationId,

          audit_index:
            latestIndex.toString(),

          status:
            "VERIFIED",

          message:
            "Audit integrity verified",

          blockchain_hash:
            blockchainHash,

          calculated_hash:
            recalculatedHash

        });

      }


      // ---------------------------------------------
      // Tampering detected
      // ---------------------------------------------

      return res.json({

        success: true,

        application_id:
          applicationId,

        audit_index:
          latestIndex.toString(),

        status:
          "TAMPER_DETECTED",

        message:
          "Audit data does not match blockchain",

        blockchain_hash:
          blockchainHash,

        calculated_hash:
          recalculatedHash

      });

    }

    catch (error) {

      console.error(error);


      res.status(500).json({

        success: false,

        message:
          "Verification failed",

        error:
          error instanceof Error
            ? error.message
            : String(error)

      });

    }

  }
);


// =====================================================
// GET /api/audit/:applicationId/history
//
// Shows all audit records for an application
// =====================================================

app.get(
  "/api/audit/:applicationId/history",
  async (req, res) => {

    try {

      const applicationId =
        req.params.applicationId;


      // ---------------------------------------------
      // Local audit records
      // ---------------------------------------------

      const localAudits =
        getLocalAudits(
          applicationId
        );


      // ---------------------------------------------
      // Blockchain audit count
      // ---------------------------------------------

      const auditCount =
        await contract.getAuditCount(
          applicationId
        );


      const blockchainAudits = [];


      // ---------------------------------------------
      // Read every blockchain record
      // ---------------------------------------------

      for (
        let i = 0;
        i < auditCount;
        i++
      ) {

        const record =
          await contract.getAudit(
            applicationId,
            BigInt(i)
          );


        blockchainAudits.push({

          audit_index:
            i,

          audit_hash:
            record[0],

          timestamp:
            record[1].toString(),

          recorded_by:
            record[2]

        });

      }


      res.json({

        success: true,

        application_id:
          applicationId,

        local_audit_count:
          localAudits.length,

        blockchain_audit_count:
          auditCount.toString(),

        local_audits:
          localAudits,

        blockchain_audits:
          blockchainAudits

      });

    }

    catch (error) {

      console.error(error);


      res.status(500).json({

        success: false,

        message:
          "Failed to retrieve audit history",

        error:
          error instanceof Error
            ? error.message
            : String(error)

      });

    }

  }
);


// =====================================================
// START SERVER
// =====================================================

app.listen(
  PORT,
  () => {

    console.log(
      "\n======================================"
    );

    console.log(
      "🚀 AegisAI Blockchain Audit Service"
    );

    console.log(
      "======================================"
    );

    console.log(
      `Server: http://localhost:${PORT}`
    );

    console.log(
      "Wallet:",
      wallet.address
    );

    console.log(
      "Contract:",
      CONTRACT_ADDRESS
    );

    console.log(
      "======================================\n"
    );

  }
);
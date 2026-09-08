# 🛡️ AegisAI Blockchain Audit

### Blockchain-based Tamper-Evident Audit Layer for AI Governance

AegisAI Blockchain Audit is an audit integrity service that records cryptographic hashes of AI governance decisions on the **Ethereum Sepolia Testnet**.

It allows the system to detect whether an audit record has been modified after it was recorded.

---

## 🏗️ Architecture

```text
AegisAI
   │
   │ Audit JSON
   ▼
Node.js Audit Service
   │
   ├── SHA-256 Hash
   │
   ├── Local JSON Storage
   │
   └── Blockchain Transaction
              │
              ▼
      Ethereum Sepolia
              │
              ▼
       AuditRegistry
              │
              ▼
       Hash Verification
          │         │
          ▼         ▼
      VERIFIED   TAMPERED
```

> **Blockchain stores the hash, not sensitive application data.**

---

## ✨ Features

* 🔐 SHA-256 audit hashing
* ⛓️ Blockchain-based integrity anchoring
* 📜 Append-only audit records
* 🔎 Individual audit verification
* 🚨 Tamper detection
* 🧑‍⚖️ AI + Human governance audit support
* 📚 Audit history
* 🔒 Owner-only blockchain writing
* 🔌 REST API for AegisAI integration

---

## 🛠️ Tech Stack

| Layer          | Technology        |
| -------------- | ----------------- |
| Backend        | Node.js + Express |
| Language       | TypeScript        |
| Blockchain     | Ethereum Sepolia  |
| Smart Contract | Solidity          |
| Framework      | Hardhat           |
| Blockchain API | Ethers.js         |
| Hashing        | SHA-256           |
| Storage        | JSON              |
| Testing        | Postman           |

---

## 📁 Project Structure

```text
aegisai-blockchain-audit/
│
├── contracts/
│   └── AuditRegistry.sol
│
├── ignition/
│   └── modules/
│       └── AuditRegistry.ts
│
├── scripts/
│   └── audit-service.ts
│
├── data/
│   └── auditStore.json
│
├── .env
├── .gitignore
├── hardhat.config.ts
├── package.json
└── README.md
```

---

# 🚀 Setup

## 1. Clone / Create Project

```bash
cd /d D:\govaudit\aegisai-blockchain-audit
```

## 2. Install Packages

```bash
npm install express ethers dotenv
```

Check:

```bash
npm list --depth=0
```

---

## 3. Environment Variables

Create `.env`:

```env
SEPOLIA_RPC_URL=YOUR_SEPOLIA_RPC_URL
SEPOLIA_PRIVATE_KEY=YOUR_PRIVATE_KEY
```

⚠️ Never commit `.env` to GitHub.

---

# ⚙️ Compile & Deploy

## Compile

```bash
npx hardhat compile
```

## Deploy to Sepolia

```bash
npx hardhat ignition deploy ignition/modules/AuditRegistry.ts --network sepolia
```

Copy the deployed contract address and put it in:

```text
scripts/audit-service.ts
```

```ts
const CONTRACT_ADDRESS = "YOUR_NEW_CONTRACT_ADDRESS";
```

---

## 🔄 Fresh Deployment

If Hardhat Ignition keeps using the previous deployment:

```bash
rmdir /s /q ignition\deployments\chain-11155111
```

Then:

```bash
npx hardhat ignition deploy ignition/modules/AuditRegistry.ts --network sepolia
```

---

# ▶️ Run Audit Service

```bash
npx hardhat run scripts/audit-service.ts
```

Server:

```text
http://localhost:3000
```

Expected:

```text
🚀 AegisAI Blockchain Audit Service
Server: http://localhost:3000
Wallet: 0x...
Contract: 0x...
```

---

# 🔌 API Documentation

| Method | Endpoint                       | Purpose               |
| ------ | ------------------------------ | --------------------- |
| GET    | `/`                            | Health check          |
| POST   | `/api/audit`                   | Record audit          |
| GET    | `/api/audit/:id/verify`        | Verify latest audit   |
| GET    | `/api/audit/:id/verify/:index` | Verify specific audit |
| GET    | `/api/audit/:id/history`       | View audit history    |

---

# 🧪 Postman Testing

## 1. Health Check

```http
GET http://localhost:3000/
```

Response:

```json
{
  "service": "AegisAI Blockchain Audit Service",
  "status": "running"
}
```

---

## 2. Record Audit

```http
POST http://localhost:3000/api/audit
```

Body → `raw` → `JSON`

```json
{
  "application_id": "APP1006",
  "ai_decision": "APPROVED",
  "ai_score": 0.98,
  "human_review": false,
  "final_decision": "APPROVED",
  "model_version": "V1"
}
```

Expected:

```json
{
  "success": true,
  "application_id": "APP1006",
  "audit_index": "0",
  "audit_hash": "0x...",
  "transaction_hash": "0x...",
  "status": "RECORDED"
}
```

---

## 3. Verify Latest Audit

```http
GET http://localhost:3000/api/audit/APP1006/verify
```

Expected:

```json
{
  "success": true,
  "application_id": "APP1006",
  "audit_index": "0",
  "status": "VERIFIED",
  "blockchain_hash": "0x...",
  "calculated_hash": "0x..."
}
```

---

## 4. Human Escalation Audit

```http
POST http://localhost:3000/api/audit
```

```json
{
  "application_id": "APP1007",
  "ai_decision": "ESCALATE",
  "ai_score": 0.62,
  "human_review": true,
  "reviewer_role": "Compliance Officer",
  "human_decision": "APPROVED",
  "reviewer_remarks": "Additional verification completed",
  "final_decision": "APPROVED",
  "model_version": "V1"
}
```

Flow:

```text
AI ESCALATE
     ↓
Human Review
     ↓
Compliance Officer
     ↓
APPROVED
     ↓
Blockchain Audit
```

---

# 📜 Append-Only Test

Send the same application ID again:

```json
{
  "application_id": "APP1006",
  "ai_decision": "APPROVED",
  "ai_score": 0.99,
  "human_review": false,
  "final_decision": "APPROVED",
  "model_version": "V2"
}
```

Result:

```text
Audit 0 → Original record
Audit 1 → New record
```

Previous audit is not overwritten.

---

# 🚨 Tamper Detection Test

Suppose Audit `0` originally contained:

```json
"ai_score": 0.98
```

Change the local JSON to:

```json
"ai_score": 0.78
```

Then verify:

```http
GET http://localhost:3000/api/audit/APP1005/verify/0
```

Result:

```json
{
  "success": true,
  "application_id": "APP1005",
  "audit_index": 0,
  "status": "TAMPER_DETECTED",
  "blockchain_hash": "0x...",
  "calculated_hash": "0x..."
}
```

Why?

```text
Original Data
     ↓
Original Hash
     ↓
Blockchain
     │
     │
Modified Local Data
     ↓
New Hash
     ↓
Hash Mismatch
     ↓
🚨 TAMPER_DETECTED
```

---

# 🔎 Verify Individual Audit

Audit 0:

```http
GET http://localhost:3000/api/audit/APP1005/verify/0
```

Audit 1:

```http
GET http://localhost:3000/api/audit/APP1005/verify/1
```

This allows historical audits to be verified independently.

---

# 📚 Audit History

```http
GET http://localhost:3000/api/audit/APP1006/history
```

Returns:

```text
Local Audit Count
Blockchain Audit Count
Local Audits
Blockchain Audits
```

---

# 🔐 Smart Contract Concept

Each application can have multiple audit records:

```text
APP1006
 ├── Audit 0
 ├── Audit 1
 ├── Audit 2
 └── Audit 3
```

Each record contains:

```text
auditHash
timestamp
recordedBy
```

The contract is **append-only** and uses owner-only writing.

---

# 🧠 Governance Use Case

AegisAI supports:

```text
AI APPROVED
     ↓
Auto Approval
```

```text
AI REJECTED
     ↓
Auto Rejection
```

```text
AI ESCALATE
     ↓
Human Review
     ↓
Human APPROVE / REJECT
     ↓
Final Decision
```

Every final governance decision can be sent to the blockchain audit service.

---

# 🔒 Security Model

```text
AI Decision
     ↓
Audit Record
     ↓
SHA-256
     ↓
Blockchain Hash
     ↓
Immutable Reference
     ↓
Future Verification
```

The blockchain provides **tamper evidence**, not prevention of changes to the off-chain data.

---

# 🎯 Why This Module?

Traditional AI systems can generate decisions, but an organization may also need to prove that an audit record was not changed later.

AegisAI uses blockchain to provide:

* Decision integrity
* Historical auditability
* Tamper detection
* Immutable timestamping
* Accountability

### Core Statement

> **AegisAI uses blockchain as a tamper-evident audit layer for AI governance decisions by storing cryptographic hashes of audit records on Ethereum and comparing them during verification.**

---

# 🔮 Future Improvements

* MongoDB/PostgreSQL instead of JSON
* Canonical JSON hashing
* Role-based blockchain access
* Individual audit IDs
* Auditor dashboard
* Authentication/RBAC
* Production blockchain/private network
* Merkle-tree batch anchoring
* Automated verification before final decision
* Integration with the main AegisAI backend

---

# 📌 Quick Command Reference

```bash
# Project
cd /d D:\govaudit\aegisai-blockchain-audit

# Install
npm install express ethers dotenv

# Compile
npx hardhat compile

# Deploy
npx hardhat ignition deploy ignition/modules/AuditRegistry.ts --network sepolia

# Start API
npx hardhat run scripts/audit-service.ts
```

### Postman

```text
GET  http://localhost:3000/

POST http://localhost:3000/api/audit

GET  http://localhost:3000/api/audit/APP1006/verify

GET  http://localhost:3000/api/audit/APP1005/verify/0

GET  http://localhost:3000/api/audit/APP1005/verify/1

GET  http://localhost:3000/api/audit/APP1006/history
```

---

## 🏁 Status

```text
✅ Hardhat Setup
✅ Solidity Contract
✅ Sepolia Deployment
✅ Ethers.js Integration
✅ Express API
✅ SHA-256 Hashing
✅ Local Audit Storage
✅ Blockchain Hash Storage
✅ Append-Only Audits
✅ Individual Verification
✅ Tamper Detection
✅ Postman Testing
```

**AegisAI Blockchain Audit — Immutable Evidence for AI Governance.**

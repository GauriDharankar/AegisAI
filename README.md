# AegisAI

> AI Governance Platform for Explainable, Auditable and Policy-Compliant FinTech Lending Decisions

## Overview

AegisAI is an AI governance platform being developed as a final-year engineering project to improve transparency, explainability, accountability, and policy compliance in AI-assisted lending systems.

Rather than replacing machine learning models, AegisAI acts as a governance layer between AI predictions and final lending decisions.

---

## Problem Statement

Financial institutions increasingly rely on AI models for credit assessment. While these models improve efficiency, they often operate as black boxes, making regulatory compliance and decision explainability difficult.

AegisAI addresses these challenges through governance, policy validation, explainability, audit logging, and human review workflows.

---

## Objectives

- Improve AI transparency
- Support explainable lending decisions
- Enforce policy-based validation
- Maintain audit trails
- Enable human-in-the-loop review

---

## Planned Features

- Explainability Engine
- Policy Validation Engine
- Audit Logging
- Decision Dashboard
- Human Review Workflow
- Governance Reports
- REST API

---

## Technology Stack

**Backend**
- Python
- FastAPI

**Machine Learning**
- Scikit-learn
- Pandas

**Database**
- PostgreSQL

**Frontend**
- React

---

## Repository Status

This repository currently contains the design and architecture phase of the project. Implementation is under active development.

---

## Development Roadmap

- [x] Problem Definition
- [x] Literature Survey
- [x] System Design
- [ ] Backend Development
- [ ] Explainability Module
- [ ] Policy Engine
- [ ] Dashboard
- [ ] Deployment

## Local development Platform Super Admin provisioning

The first Platform Super Admin can be provisioned only by a trusted local
maintainer using the one-shot CLI. It is not an API endpoint and does not
assign a Tenant Admin or Reviewer role. The command requires explicit
development opt-in, an existing absolute SQLite database path, and typing the
exact displayed path before it proceeds. It refuses a production environment
or an already-authorized Platform Super Admin.

After reviewing `app/provision_platform_admin.py` and taking a backup of the
intended database, run from the repository root in PowerShell:

```powershell
$env:AEGISAI_ENV = "development"
$env:AEGISAI_ALLOW_LOCAL_PLATFORM_ADMIN_PROVISIONING = "I_ACKNOWLEDGE_LOCAL_DEVELOPMENT_ONLY"
$env:AEGISAI_DB_PATH = (Resolve-Path ".\aegisai.db").Path
.\.venv\Scripts\python.exe -m app.provision_platform_admin
```

The CLI prompts for the maintainer name, account email, and password (hidden
input); it never accepts the password as a command-line argument. User,
platform-admin marker, and an audit event with a null authenticated actor are
written in one transaction. The event identifies the local CLI and local
operator account, not an authenticated application user. Clear the opt-in
environment variable after the command exits:

```powershell
Remove-Item Env:AEGISAI_ALLOW_LOCAL_PLATFORM_ADMIN_PROVISIONING
```

## 🏗️ System Architecture

### AI Decision Governance Workflow

![Workflow](docs/workflow.jpeg)

---

### Platform Architecture

![Platform Architecture](docs/system-architecture.jpeg)

---

### SaaS Architecture

![SaaS Architecture](docs/saas-architecture.jpeg)

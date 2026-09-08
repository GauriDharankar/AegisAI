import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const AuditRegistryModule = buildModule(
  "AuditRegistryModule",
  (m) => {

    const auditRegistry =
      m.contract("AuditRegistry");

    return {
      auditRegistry
    };
  }
);

export default AuditRegistryModule;
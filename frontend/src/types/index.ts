export type FinalDecision =
  | "AUTO_APPROVE"
  | "HUMAN_REVIEW"
  | "REJECT";

export type RiskLevel =
  | "LOW"
  | "MEDIUM"
  | "HIGH";

export type GovernanceStage =
  | "MODEL"
  | "SHAP"
  | "FAIRNESS"
  | "POLICY"
  | "RISK"
  | "ROUTING"
  | "FINAL";

export interface LoanApplication {
  id: string;
  applicantId: string;
  applicantName: string;

  amount: number;
  creditScore: number;
  income: number;

  aiDecision: string;
  probability: number;

  riskLevel: RiskLevel;

  finalDecision: FinalDecision;

  reason?: string;
  reasonCode?: string;

  status: string;

  submittedAt: string;
}

export interface ShapFeature {
  feature: string;
  value: number;
  displayValue?: string;
  contribution: number;
}

export interface FairnessGroup {
  group: string;
  approvalRate: number;
  sampleSize: number;
}

export interface FairnessResult {
  enabled: boolean;
  metric: string;
  threshold: number;
  minimumGroupSize: number;

  disparity: number;

  passed: boolean;

  groups: FairnessGroup[];
}

export interface PolicyResult {
  policyId: string;
  name: string;
  field: string;
  operator: string;

  requiredValue: string | number;
  actualValue: string | number;

  action: string;
  severity: string;

  enabled: boolean;

  passed: boolean;

  description?: string;
}

export interface RiskAssessment {
  level: RiskLevel;
  reasons: string[];
}

export interface AutoApprovalConfig {
  enabled: boolean;
  minimumProbability: number;
  maximumRisk: RiskLevel;
  requirePolicyCompliance: boolean;
  requireFairnessPass: boolean;
}

export interface AutoApprovalResult {
  eligible: boolean;
  reasons: string[];
}

export interface GovernanceTrace {
  stage: GovernanceStage;
  status: "PASS" | "FAIL" | "WARNING" | "PENDING";
  title: string;
  description: string;
}

export interface GovernanceDecision {
  applicationId: string;

  prediction: {
    label: string;
    probability: number;
  };

  shap: ShapFeature[];

  fairness: FairnessResult;

  policies: PolicyResult[];

  risk: RiskAssessment;

  autoApproval: AutoApprovalResult;

  routing: {
    decision: FinalDecision;
    reason: string;
    reasonCode?: string;
  };

  finalDecision: FinalDecision;

  trace: GovernanceTrace[];
}
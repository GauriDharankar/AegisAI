export type ReviewStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "OVERRIDDEN";

export type Decision = "APPROVE" | "REJECT" | "REVIEW";

export interface LoanApplication {
  id: string;
  applicantId: string;
  applicantName: string;
  amount: number;
  creditScore: number;
  income: number;
  aiDecision: Decision;
  confidence: number;
  status: ReviewStatus;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  submittedAt: string;
  assignedTo?: string;
}

export interface Explanation {
  feature: string;
  value: string;
  impact: number;
  direction: "POSITIVE" | "NEGATIVE";
}

export interface FairnessReport {
  protectedAttribute: string;
  demographicParity: number;
  equalOpportunity: number;
  disparateImpact: number;
  status: "PASS" | "WARNING" | "FAIL";
}

export interface PolicyViolation {
  id: string;
  policy: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  description: string;
}

export interface BiasAlert {
  id: string;
  title: string;
  description: string;
  overrideRate: number;
  threshold: number;
  severity: "LOW" | "MEDIUM" | "HIGH";
  createdAt: string;
  status: "OPEN" | "RESOLVED";
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "REVIEW" | "BIAS" | "REMINDER" | "SYSTEM";
  read: boolean;
  createdAt: string;
}
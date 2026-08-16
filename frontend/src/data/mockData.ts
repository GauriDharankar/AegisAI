import type {
  LoanApplication,
  Explanation,
  FairnessReport,
  PolicyViolation,
  BiasAlert,
  Notification,
} from "../types";

export const applications: LoanApplication[] = [
  {
    id: "APP-1001",
    applicantId: "CUS-001",
    applicantName: "Rahul Sharma",
    amount: 500000,
    creditScore: 742,
    income: 850000,
    aiDecision: "APPROVE",
    confidence: 94,
    status: "PENDING",
    riskLevel: "LOW",
    submittedAt: "2026-08-16 09:30",
  },
  {
    id: "APP-1002",
    applicantId: "CUS-002",
    applicantName: "Priya Patel",
    amount: 750000,
    creditScore: 681,
    income: 620000,
    aiDecision: "REVIEW",
    confidence: 72,
    status: "PENDING",
    riskLevel: "MEDIUM",
    submittedAt: "2026-08-16 08:45",
  },
  {
    id: "APP-1003",
    applicantId: "CUS-003",
    applicantName: "Amit Joshi",
    amount: 1000000,
    creditScore: 598,
    income: 450000,
    aiDecision: "REJECT",
    confidence: 91,
    status: "PENDING",
    riskLevel: "HIGH",
    submittedAt: "2026-08-16 08:10",
  },
  {
    id: "APP-1004",
    applicantId: "CUS-004",
    applicantName: "Sneha Kulkarni",
    amount: 350000,
    creditScore: 781,
    income: 920000,
    aiDecision: "APPROVE",
    confidence: 97,
    status: "APPROVED",
    riskLevel: "LOW",
    submittedAt: "2026-08-15 17:20",
  },
];

export const explanations: Explanation[] = [
  {
    feature: "Credit Score",
    value: "742",
    impact: 0.42,
    direction: "POSITIVE",
  },
  {
    feature: "Annual Income",
    value: "₹8.5 Lakh",
    impact: 0.31,
    direction: "POSITIVE",
  },
  {
    feature: "Debt-to-Income Ratio",
    value: "38%",
    impact: -0.18,
    direction: "NEGATIVE",
  },
  {
    feature: "Loan Amount",
    value: "₹5 Lakh",
    impact: -0.08,
    direction: "NEGATIVE",
  },
];

export const fairnessReport: FairnessReport[] = [
  {
    protectedAttribute: "Gender",
    demographicParity: 0.91,
    equalOpportunity: 0.94,
    disparateImpact: 0.89,
    status: "PASS",
  },
  {
    protectedAttribute: "Age Group",
    demographicParity: 0.82,
    equalOpportunity: 0.87,
    disparateImpact: 0.78,
    status: "WARNING",
  },
];

export const policyViolations: PolicyViolation[] = [
  {
    id: "POL-001",
    policy: "Maximum Debt-to-Income Ratio",
    severity: "MEDIUM",
    description: "Applicant exceeds the recommended DTI threshold.",
  },
];

export const biasAlerts: BiasAlert[] = [
  {
    id: "ALT-001",
    title: "High Override Rate Detected",
    description:
      "Override rate for Age Group 18-25 has exceeded the configured threshold.",
    overrideRate: 18,
    threshold: 15,
    severity: "HIGH",
    createdAt: "2026-08-16 09:10",
    status: "OPEN",
  },
  {
    id: "ALT-002",
    title: "Fairness Metric Warning",
    description:
      "Disparate impact has fallen below the configured monitoring level.",
    overrideRate: 11,
    threshold: 15,
    severity: "MEDIUM",
    createdAt: "2026-08-15 15:30",
    status: "OPEN",
  },
];

export const notifications: Notification[] = [
  {
    id: "N-001",
    title: "New Review Assigned",
    message: "Application APP-1001 requires human review.",
    type: "REVIEW",
    read: false,
    createdAt: "10 minutes ago",
  },
  {
    id: "N-002",
    title: "Bias Alert",
    message: "Override threshold exceeded for Age Group.",
    type: "BIAS",
    read: false,
    createdAt: "35 minutes ago",
  },
  {
    id: "N-003",
    title: "Review Reminder",
    message: "3 applications are waiting for review.",
    type: "REMINDER",
    read: true,
    createdAt: "1 hour ago",
  },
];
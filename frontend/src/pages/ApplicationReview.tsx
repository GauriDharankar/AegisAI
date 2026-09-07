import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
} from "lucide-react";

import { applications } from "../data/mockData";
import ExplanationCard from "../components/ExplanationCard";
import FairnessCard from "../components/FairnessCard";
import PolicyViolationCard from "../components/PolicyViolationCard";
import OverrideModal from "../components/OverrideModal";

export default function ApplicationReview() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [showModal, setShowModal] = useState(false);

  const application = applications.find(
    (item) => item.id === id
  );

  if (!application) {
    return <div>Application not found.</div>;
  }

  const handleOverride = (
    decision: string,
    reason: string
  ) => {
    console.log({
      applicationId: id,
      decision,
      reason,
    });

    setShowModal(false);

    alert("Decision override recorded.");
  };

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate("/reviews")}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={18} />
        Back to Review Queue
      </button>

      <div className="rounded-xl border bg-white p-6">
        <div className="flex flex-col justify-between gap-5 md:flex-row">
          <div>
            <p className="text-sm text-slate-500">
              Application
            </p>

            <h1 className="text-2xl font-bold">
              {application.id}
            </h1>

            <p className="mt-1 text-slate-500">
              {application.applicantName}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-full bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700">
              AI: {application.aiDecision}
            </span>

            <span className="rounded-full bg-yellow-100 px-4 py-2 text-sm font-medium text-yellow-700">
              {application.probability}% confidence
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs text-slate-500">
              Loan Amount
            </p>
            <p className="mt-1 font-semibold">
              ₹{application.amount.toLocaleString()}
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs text-slate-500">
              Credit Score
            </p>
            <p className="mt-1 font-semibold">
              {application.creditScore}
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs text-slate-500">
              Annual Income
            </p>
            <p className="mt-1 font-semibold">
              ₹{application.income.toLocaleString()}
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs text-slate-500">
              Risk Level
            </p>
            <p className="mt-1 font-semibold">
              {application.riskLevel}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
          <ExplanationCard />
          <FairnessCard
    enabled={true}
    metric="Demographic Parity"
    threshold={0.10}
    disparity={0.042}
    minimumGroupSize={2}
    passed={true}
    groups={[
      {
        group: "Group A",
        approvalRate: 0.962,
        sampleSize: 50,
      },
      {
        group: "Group B",
        approvalRate: 0.920,
        sampleSize: 48,
      },
    ]}
  />
      </div>
      

      <PolicyViolationCard />

      <div className="rounded-xl border bg-white p-6">
        <h2 className="text-lg font-semibold">
          Human Decision
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Review the AI recommendation before making a final
          decision.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-white hover:bg-blue-700"
          >
            <CheckCircle size={18} />
            Override Decision
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-lg border border-red-200 px-5 py-3 text-red-600 hover:bg-red-50"
          >
            <XCircle size={18} />
            Reject / Override
          </button>
        </div>
      </div>

      <OverrideModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleOverride}
      />
    </div>
  );
}
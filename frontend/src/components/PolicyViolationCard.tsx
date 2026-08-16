import { AlertTriangle } from "lucide-react";
import { policyViolations } from "../data/mockData";

export default function PolicyViolationCard() {
  return (
    <div className="rounded-xl border bg-white p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-lg bg-red-50 p-2 text-red-600">
          <AlertTriangle size={20} />
        </div>

        <div>
          <h2 className="font-semibold">
            Policy Violations
          </h2>

          <p className="text-sm text-slate-500">
            Rules triggered by this application
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {policyViolations.map((violation) => (
          <div
            key={violation.id}
            className="rounded-lg border border-red-100 bg-red-50 p-4"
          >
            <div className="flex justify-between">
              <p className="font-medium text-red-800">
                {violation.policy}
              </p>

              <span className="text-xs font-semibold text-red-600">
                {violation.severity}
              </span>
            </div>

            <p className="mt-2 text-sm text-red-700">
              {violation.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
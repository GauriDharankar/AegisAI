import { fairnessReport } from "../data/mockData";

export default function FairnessCard() {
  return (
    <div className="rounded-xl border bg-white p-6">
      <h2 className="text-lg font-semibold">
        Fairness Report
      </h2>

      <p className="mb-5 mt-1 text-sm text-slate-500">
        Model fairness metrics for protected attributes.
      </p>

      <div className="space-y-4">
        {fairnessReport.map((report) => (
          <div
            key={report.protectedAttribute}
            className="rounded-lg border p-4"
          >
            <div className="mb-3 flex justify-between">
              <h3 className="font-medium">
                {report.protectedAttribute}
              </h3>

              <span
                className={`rounded-full px-3 py-1 text-xs ${
                  report.status === "PASS"
                    ? "bg-green-100 text-green-700"
                    : report.status === "WARNING"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {report.status}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded bg-slate-50 p-3">
                <p className="text-xs text-slate-500">
                  Demographic Parity
                </p>

                <p className="mt-1 font-semibold">
                  {report.demographicParity}
                </p>
              </div>

              <div className="rounded bg-slate-50 p-3">
                <p className="text-xs text-slate-500">
                  Equal Opportunity
                </p>

                <p className="mt-1 font-semibold">
                  {report.equalOpportunity}
                </p>
              </div>

              <div className="rounded bg-slate-50 p-3">
                <p className="text-xs text-slate-500">
                  Disparate Impact
                </p>

                <p className="mt-1 font-semibold">
                  {report.disparateImpact}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
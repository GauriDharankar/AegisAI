import { CheckCircle2, AlertTriangle } from "lucide-react";

interface Group {
  group: string;
  approvalRate: number;
  sampleSize: number;
}

interface Props {
  enabled: boolean;
  metric: string;
  threshold: number;
  disparity: number;
  minimumGroupSize: number;
  passed: boolean;
  groups: Group[];
}

export default function FairnessCard({
  enabled,
  metric,
  threshold,
  disparity,
  minimumGroupSize,
  passed,
  groups,
}: Props) {
  return (
    <div className="rounded-xl border bg-white p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            Fairness Analysis
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Demographic fairness evaluation
          </p>
        </div>

        {passed ? (
          <div className="flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
            <CheckCircle2 size={16} />
            PASSED
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
            <AlertTriangle size={16} />
            FAILED
          </div>
        )}
      </div>

      {!enabled ? (
        <div className="mt-6 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
          Fairness analysis is disabled for this tenant.
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs text-slate-500">
                Metric
              </p>

              <p className="mt-1 font-semibold">
                {metric}
              </p>
            </div>

            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs text-slate-500">
                Threshold
              </p>

              <p className="mt-1 font-semibold">
                {(threshold * 100).toFixed(1)}%
              </p>
            </div>

            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs text-slate-500">
                Calculated Difference
              </p>

              <p
                className={`mt-1 font-semibold ${
                  passed
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {(disparity * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="mb-3 font-medium">
              Group Approval Rates
            </h3>

            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group.group}>
                  <div className="mb-2 flex justify-between text-sm">
                    <span>{group.group}</span>

                    <span className="font-semibold">
                      {(group.approvalRate * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-blue-500"
                      style={{
                        width: `${group.approvalRate * 100}%`,
                      }}
                    />
                  </div>

                  <p className="mt-1 text-xs text-slate-400">
                    Sample size: {group.sampleSize}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 text-xs text-slate-500">
            Minimum group size: {minimumGroupSize}
          </div>
        </>
      )}
    </div>
  );
}
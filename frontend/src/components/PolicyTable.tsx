interface Policy {
  policyId: string;
  name: string;
  field: string;
  operator: string;
  requiredValue: string | number;
  actualValue: string | number;
  action: string;
  severity: string;
  passed: boolean;
}

interface Props {
  policies: Policy[];
}

export default function PolicyTable({
  policies,
}: Props) {
  const passed = policies.filter(
    (policy) => policy.passed
  ).length;

  return (
    <div className="rounded-xl border bg-white p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            Policy Compliance
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Tenant-configured governance policies
          </p>
        </div>

        <div className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
          {passed} / {policies.length} Passed
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-slate-400">
              <th className="px-3 py-3">Policy</th>
              <th className="px-3 py-3">Requirement</th>
              <th className="px-3 py-3">Actual</th>
              <th className="px-3 py-3">Result</th>
              <th className="px-3 py-3">Severity</th>
            </tr>
          </thead>

          <tbody>
            {policies.map((policy) => (
              <tr
                key={policy.policyId}
                className="border-b last:border-0"
              >
                <td className="px-3 py-4">
                  <p className="font-medium">
                    {policy.name}
                  </p>

                  <p className="text-xs text-slate-400">
                    {policy.policyId}
                  </p>
                </td>

                <td className="px-3 py-4 font-mono text-sm">
                  {policy.operator} {policy.requiredValue}
                </td>

                <td className="px-3 py-4">
                  {policy.actualValue}
                </td>

                <td className="px-3 py-4">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      policy.passed
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {policy.passed
                      ? "PASS"
                      : "FAILED"}
                  </span>
                </td>

                <td className="px-3 py-4">
                  {policy.severity}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
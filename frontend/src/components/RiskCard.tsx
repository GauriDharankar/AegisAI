interface Props {
  level: "LOW" | "MEDIUM" | "HIGH";
  reasons: string[];
}

export default function RiskCard({
  level,
  reasons,
}: Props) {
  const styles = {
    LOW: "bg-green-100 text-green-700",
    MEDIUM: "bg-yellow-100 text-yellow-700",
    HIGH: "bg-red-100 text-red-700",
  };

  return (
    <div className="rounded-xl border bg-white p-6">
      <h2 className="text-lg font-semibold">
        Risk Assessment
      </h2>

      <div className="mt-5 flex items-center gap-4">
        <div
          className={`rounded-xl px-5 py-3 text-lg font-bold ${styles[level]}`}
        >
          {level}
        </div>

        <p className="text-sm text-slate-500">
          Governance risk classification
        </p>
      </div>

      {reasons.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-sm font-medium">
            Risk factors
          </p>

          <ul className="space-y-2">
            {reasons.map((reason, index) => (
              <li
                key={index}
                className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600"
              >
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
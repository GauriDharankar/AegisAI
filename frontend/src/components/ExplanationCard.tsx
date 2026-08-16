import { explanations } from "../data/mockData";

export default function ExplanationCard() {
  return (
    <div className="rounded-xl border bg-white p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold">
          AI Decision Explanation
        </h2>

        <p className="text-sm text-slate-500">
          Factors contributing to the AI decision
        </p>
      </div>

      <div className="space-y-5">
        {explanations.map((item) => (
          <div key={item.feature}>
            <div className="mb-2 flex justify-between">
              <div>
                <p className="font-medium">{item.feature}</p>

                <p className="text-xs text-slate-500">
                  Value: {item.value}
                </p>
              </div>

              <span
                className={
                  item.direction === "POSITIVE"
                    ? "text-green-600"
                    : "text-red-600"
                }
              >
                {item.direction}
              </span>
            </div>

            <div className="h-2 rounded-full bg-slate-100">
              <div
                className={`h-2 rounded-full ${
                  item.direction === "POSITIVE"
                    ? "bg-green-500"
                    : "bg-red-500"
                }`}
                style={{
                  width: `${Math.abs(item.impact) * 100}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
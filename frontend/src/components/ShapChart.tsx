interface ShapFeature {
  feature: string;
  contribution: number;
  displayValue?: string;
}

interface Props {
  features: ShapFeature[];
}

export default function ShapChart({ features }: Props) {
  const maxValue = Math.max(
    ...features.map((item) =>
      Math.abs(item.contribution)
    ),
    0.01
  );

  return (
    <div className="rounded-xl border bg-white p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">
          Why did the AI make this prediction?
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          SHAP feature contributions to the model prediction
        </p>
      </div>

      <div className="space-y-5">
        {features.map((item) => {
          const positive = item.contribution >= 0;

          const width =
            (Math.abs(item.contribution) / maxValue) *
            100;

          return (
            <div key={item.feature}>
              <div className="mb-2 flex justify-between">
                <div>
                  <p className="font-medium text-slate-700">
                    {item.feature}
                  </p>

                  {item.displayValue && (
                    <p className="text-xs text-slate-400">
                      Value: {item.displayValue}
                    </p>
                  )}
                </div>

                <span
                  className={
                    positive
                      ? "font-semibold text-green-600"
                      : "font-semibold text-red-600"
                  }
                >
                  {positive ? "+" : ""}
                  {item.contribution.toFixed(3)}
                </span>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${
                    positive
                      ? "bg-green-500"
                      : "bg-red-500"
                  }`}
                  style={{
                    width: `${width}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex gap-5 text-xs text-slate-500">
        <span>Positive contribution</span>
        <span>Negative contribution</span>
      </div>
    </div>
  );
}
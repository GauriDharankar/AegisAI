import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
} from "lucide-react";

interface TraceItem {
  stage: string;
  status: "PASS" | "FAIL" | "WARNING" | "PENDING";
  title: string;
  description: string;
}

interface Props {
  trace: TraceItem[];
}

export default function GovernanceTrace({ trace }: Props) {
  const getIcon = (status: TraceItem["status"]) => {
    if (status === "PASS") {
      return <CheckCircle2 size={20} />;
    }

    if (status === "FAIL") {
      return <XCircle size={20} />;
    }

    if (status === "WARNING") {
      return <AlertTriangle size={20} />;
    }

    return <Clock size={20} />;
  };

  return (
    <div className="rounded-xl border bg-white p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">
          Governance Decision Trace
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Complete lifecycle of the AI lending decision
        </p>
      </div>

      <div className="space-y-0">
        {trace.map((item, index) => (
          <div key={`${item.stage}-${index}`}>
            <div className="flex gap-4">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  item.status === "PASS"
                    ? "bg-green-100 text-green-600"
                    : item.status === "FAIL"
                    ? "bg-red-100 text-red-600"
                    : item.status === "WARNING"
                    ? "bg-yellow-100 text-yellow-600"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {getIcon(item.status)}
              </div>

              <div className="pb-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {item.stage}
                </p>

                <h3 className="mt-1 font-semibold text-slate-800">
                  {item.title}
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  {item.description}
                </p>
              </div>
            </div>

            {index < trace.length - 1 && (
              <div className="ml-5 h-6 border-l border-dashed border-slate-300" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
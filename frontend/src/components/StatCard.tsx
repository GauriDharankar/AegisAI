interface Props {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
}

export default function StatCard({
  title,
  value,
  description,
  icon,
}: Props) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>

          <h3 className="mt-2 text-3xl font-bold text-slate-800">
            {value}
          </h3>
        </div>

        <div className="rounded-lg bg-blue-50 p-3 text-blue-600">
          {icon}
        </div>
      </div>

      <p className="text-sm text-slate-500">
        {description}
      </p>
    </div>
  );
}
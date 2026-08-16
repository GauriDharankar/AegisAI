import { useState } from "react";

export default function Reminders() {
  const [enabled, setEnabled] = useState(true);
  const [interval, setInterval] = useState("30");

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Reminder Scheduler
        </h1>

        <p className="mt-1 text-slate-500">
          Configure reminders for pending application reviews.
        </p>
      </div>

      <div className="rounded-xl border bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">
              Review Reminders
            </h2>

            <p className="text-sm text-slate-500">
              Notify reviewers about pending applications.
            </p>
          </div>

          <button
            onClick={() => setEnabled(!enabled)}
            className={`relative h-7 w-12 rounded-full ${
              enabled ? "bg-blue-600" : "bg-slate-300"
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                enabled ? "left-6" : "left-1"
              }`}
            />
          </button>
        </div>

        <div className="mt-8">
          <label className="mb-2 block text-sm font-medium">
            Reminder Interval
          </label>

          <select
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
            className="w-full rounded-lg border px-4 py-3"
          >
            <option value="15">
              Every 15 minutes
            </option>

            <option value="30">
              Every 30 minutes
            </option>

            <option value="60">
              Every hour
            </option>

            <option value="120">
              Every 2 hours
            </option>
          </select>
        </div>

        <button
          onClick={() =>
            alert(`Reminder interval: ${interval} minutes`)
          }
          className="mt-6 rounded-lg bg-blue-600 px-5 py-3 text-white"
        >
          Save Configuration
        </button>
      </div>
    </div>
  );
}
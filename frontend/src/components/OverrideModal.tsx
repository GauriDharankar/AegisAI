import { useState } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (decision: string, reason: string) => void;
}

export default function OverrideModal({
  isOpen,
  onClose,
  onSubmit,
}: Props) {
  const [decision, setDecision] = useState("APPROVE");
  const [reason, setReason] = useState("");

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!reason.trim()) {
      alert("Please provide a reason.");
      return;
    }

    onSubmit(decision, reason);
    setReason("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-semibold">
          Override AI Decision
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Your override will be recorded in the audit trail.
        </p>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-medium">
            New Decision
          </label>

          <select
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
            className="w-full rounded-lg border px-4 py-3"
          >
            <option value="APPROVE">Approve</option>
            <option value="REJECT">Reject</option>
          </select>
        </div>

        <div className="mt-5">
          <label className="mb-2 block text-sm font-medium">
            Reason for Override
          </label>

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={5}
            placeholder="Explain why you are overriding the AI decision..."
            className="w-full rounded-lg border p-3 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border px-5 py-2"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            className="rounded-lg bg-blue-600 px-5 py-2 text-white hover:bg-blue-700"
          >
            Confirm Override
          </button>
        </div>
      </div>
    </div>
  );
}
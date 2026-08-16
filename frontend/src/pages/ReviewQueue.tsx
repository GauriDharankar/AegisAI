import { useState } from "react";
import { Eye, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { applications } from "../data/mockData";

export default function ReviewQueue() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");

  const filteredApplications = applications.filter((application) => {
    const matchesSearch =
      application.applicantName
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      application.id.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      status === "ALL" ||
      application.status === status;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Review Queue
        </h1>

        <p className="mt-1 text-slate-500">
          Applications requiring human intervention.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border bg-white p-4 md:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-lg bg-slate-100 px-4 py-2">
          <Search size={18} className="text-slate-400" />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search applicant or application ID..."
            className="w-full bg-transparent outline-none"
          />
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border px-4 py-2"
        >
          <option value="ALL">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="OVERRIDDEN">Overridden</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr className="text-left text-sm text-slate-500">
                <th className="px-6 py-4">Application</th>
                <th className="px-6 py-4">Applicant</th>
                <th className="px-6 py-4">AI Decision</th>
                <th className="px-6 py-4">Confidence</th>
                <th className="px-6 py-4">Risk</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredApplications.map((application) => (
                <tr
                  key={application.id}
                  className="border-t hover:bg-slate-50"
                >
                  <td className="px-6 py-4 font-medium">
                    {application.id}
                  </td>

                  <td className="px-6 py-4">
                    {application.applicantName}
                  </td>

                  <td className="px-6 py-4">
                    {application.aiDecision}
                  </td>

                  <td className="px-6 py-4">
                    {application.confidence}%
                  </td>

                  <td className="px-6 py-4">
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-xs text-orange-700">
                      {application.riskLevel}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    {application.status}
                  </td>

                  <td className="px-6 py-4">
                    <button
                      onClick={() =>
                        navigate(
                          `/reviews/${application.id}`
                        )
                      }
                      className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
                    >
                      <Eye size={16} />
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
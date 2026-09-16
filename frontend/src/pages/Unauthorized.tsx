import { ShieldX } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Unauthorized() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">

      <div className="w-full max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">

        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
          <ShieldX size={28} />
        </div>

        <h1 className="mt-5 text-2xl font-bold text-slate-800">
          Access Restricted
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          You do not have permission to access this
          section of AegisAI.
        </p>

        <button
          onClick={() => navigate("/dashboard")}
          className="mt-6 rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
        >
          Return to Dashboard
        </button>

      </div>

    </div>
  );
}
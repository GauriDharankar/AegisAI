import { Bell, Check } from "lucide-react";
import { notifications } from "../data/mockData";

export default function Notifications() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Notifications
        </h1>

        <p className="mt-1 text-slate-500">
          Review system alerts and assigned tasks.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`flex gap-4 border-b p-6 ${
              !notification.read
                ? "bg-blue-50/50"
                : ""
            }`}
          >
            <div className="rounded-full bg-blue-100 p-3 text-blue-600">
              <Bell size={18} />
            </div>

            <div className="flex-1">
              <div className="flex justify-between">
                <h2 className="font-semibold">
                  {notification.title}
                </h2>

                {!notification.read && (
                  <span className="h-2 w-2 rounded-full bg-blue-600" />
                )}
              </div>

              <p className="mt-1 text-sm text-slate-600">
                {notification.message}
              </p>

              <p className="mt-2 text-xs text-slate-400">
                {notification.createdAt}
              </p>
            </div>

            {!notification.read && (
              <button className="text-slate-400 hover:text-blue-600">
                <Check size={18} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
// components/UserCard.jsx
import { Phone, Mail, Calendar, Clock, Wrench, Trash2, Printer, Pencil } from "lucide-react";

export default function UserCard() {
  return (
    <div className="flex w-full items-start gap-6 rounded-xl border bg-card p-6 shadow-sm">
      
      {/* Avatar */}
      <div className="w-24 h-24 rounded-lg overflow-hidden bg-pink-200 shrink-0">
        <img
          src="/assets/user.jpg" // replace with real image
          alt="user"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Content */}
      <div className="flex-1">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Matt Clark
            </h2>

            {/* Meta Info */}
            <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Wrench size={16} /> Plumbing
              </span>

              <span className="flex items-center gap-1">
                <Calendar size={16} /> 2 June, 2025
              </span>

              <span className="flex items-center gap-1">
                <Clock size={16} /> 10:30 AM
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-muted">
              <Trash2 size={16} /> Delete
            </button>

            <button className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-muted">
              <Printer size={16} /> Print
            </button>

            <button className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-muted">
              <Pencil size={16} /> Edit
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t my-4" />

        {/* Status Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          
          {/* Status */}
          <div>
            <p className="mb-1 text-muted-foreground">Status</p>
            <select className="rounded-md border bg-blue-50 px-3 py-1.5 text-blue-600 dark:bg-blue-500/10 dark:text-blue-200">
              <option>Ongoing</option>
              <option>Completed</option>
              <option>Pending</option>
            </select>
          </div>

          {/* Tags */}
          <div>
            <p className="mb-1 text-muted-foreground">Tags</p>
            <select className="rounded-md border bg-red-50 px-3 py-1.5 text-red-600 dark:bg-red-500/10 dark:text-red-200">
              <option>Callback</option>
              <option>Urgent</option>
              <option>Follow Up</option>
            </select>
          </div>

          {/* Assigned Member */}
          <div>
            <p className="mb-1 text-muted-foreground">Assigned Member</p>

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold">
                J
              </div>
              <span className="text-foreground">
                Jacqueline Gayle
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

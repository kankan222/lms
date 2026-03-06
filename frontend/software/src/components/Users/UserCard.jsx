// components/UserCard.jsx
import { Phone, Mail, Calendar, Clock, Wrench, Trash2, Printer, Pencil } from "lucide-react";

export default function UserCard() {
  return (
    <div className="w-full bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex gap-6 items-start">
      
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
            <h2 className="text-xl font-semibold text-gray-900">
              Matt Clark
            </h2>

            {/* Meta Info */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mt-1">
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
            <button className="flex items-center gap-2 px-3 py-1.5 border rounded-md text-sm hover:bg-gray-50">
              <Trash2 size={16} /> Delete
            </button>

            <button className="flex items-center gap-2 px-3 py-1.5 border rounded-md text-sm hover:bg-gray-50">
              <Printer size={16} /> Print
            </button>

            <button className="flex items-center gap-2 px-3 py-1.5 border rounded-md text-sm hover:bg-gray-50">
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
            <p className="text-gray-500 mb-1">Status</p>
            <select className="px-3 py-1.5 border rounded-md text-blue-600 bg-blue-50">
              <option>Ongoing</option>
              <option>Completed</option>
              <option>Pending</option>
            </select>
          </div>

          {/* Tags */}
          <div>
            <p className="text-gray-500 mb-1">Tags</p>
            <select className="px-3 py-1.5 border rounded-md text-red-600 bg-red-50">
              <option>Callback</option>
              <option>Urgent</option>
              <option>Follow Up</option>
            </select>
          </div>

          {/* Assigned Member */}
          <div>
            <p className="text-gray-500 mb-1">Assigned Member</p>

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold">
                J
              </div>
              <span className="text-gray-800">
                Jacqueline Gayle
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
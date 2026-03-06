import { useState, useEffect, useCallback, useRef } from "react";

// ─── Mock API ────────────────────────────────────────────────────────────────
const SECTION_TYPES = ["Cover page", "Table of contents", "Narrative", "Technical content"];
const STATUSES = ["Done", "In Process", "Draft", "Review"];
const REVIEWERS = ["Eddie Lake", "Jamik Tashpulatov", "Sarah Chen", "Marcus Webb", "Unassigned"];

function generateRows(total = 68) {
  const headers = [
    "Cover page","Table of contents","Executive summary","Technical approach","Design",
    "Capabilities","Integration with existing systems","Innovation and Advantages",
    "Overview of EMR's Innovative Solutions","Advanced Algorithms and Machine Learning",
    "Risk Assessment","Budget Overview","Timeline","Deliverables","Quality Assurance",
    "Compliance & Standards","Data Security","User Training","Support & Maintenance","Appendix",
  ];
  return Array.from({ length: total }, (_, i) => ({
    id: i + 1,
    header: headers[i % headers.length] + (i >= headers.length ? ` ${Math.floor(i / headers.length) + 1}` : ""),
    sectionType: SECTION_TYPES[i % SECTION_TYPES.length],
    status: STATUSES[i % STATUSES.length],
    target: Math.floor(Math.random() * 35) + 2,
    limit: Math.floor(Math.random() * 30) + 2,
    reviewer: REVIEWERS[i % REVIEWERS.length],
  }));
}

const ALL_ROWS = generateRows(68);

async function fetchRows({ page, pageSize, sortKey, sortDir, search }) {
  await new Promise((r) => setTimeout(r, 300));
  let data = [...ALL_ROWS];
  if (search) {
    const q = search.toLowerCase();
    data = data.filter(
      (r) =>
        r.header.toLowerCase().includes(q) ||
        r.sectionType.toLowerCase().includes(q) ||
        r.reviewer.toLowerCase().includes(q)
    );
  }
  if (sortKey) {
    data.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }
  const total = data.length;
  const start = (page - 1) * pageSize;
  return { rows: data.slice(start, start + pageSize), total };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    Done: { dot: "bg-emerald-400", text: "text-emerald-300", label: "Done" },
    "In Process": { dot: "bg-amber-400 animate-pulse", text: "text-amber-300", label: "In Process" },
    Draft: { dot: "bg-slate-400", text: "text-slate-300", label: "Draft" },
    Review: { dot: "bg-violet-400", text: "text-violet-300", label: "Review" },
  };
  const s = map[status] || map["Draft"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/10 ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function SectionTypeBadge({ type }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-white/5 border border-white/10 text-slate-300">
      {type}
    </span>
  );
}

function SortIcon({ active, dir }) {
  return (
    <span className="inline-flex flex-col ml-1 opacity-60">
      <svg width="8" height="5" viewBox="0 0 8 5" className={active && dir === "asc" ? "opacity-100" : "opacity-30"}>
        <path d="M4 0L8 5H0L4 0Z" fill="currentColor" />
      </svg>
      <svg width="8" height="5" viewBox="0 0 8 5" className={`mt-0.5 ${active && dir === "desc" ? "opacity-100" : "opacity-30"}`}>
        <path d="M4 5L0 0H8L4 5Z" fill="currentColor" />
      </svg>
    </span>
  );
}

function DropdownActions({ rowId, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.5" /><circle cx="8" cy="8" r="1.5" /><circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-40 rounded-xl border border-white/10 bg-[#1a1d27] shadow-2xl shadow-black/60 overflow-hidden">
          {[
            { label: "Edit", icon: "✏️", action: () => { onEdit(rowId); setOpen(false); } },
            { label: "Make a copy", icon: "📋", action: () => setOpen(false) },
            { label: "Favorite", icon: "⭐", action: () => setOpen(false) },
          ].map(({ label, icon, action }) => (
            <button key={label} onClick={action}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/8 hover:text-white transition-colors text-left">
              <span className="text-base leading-none">{icon}</span>{label}
            </button>
          ))}
          <div className="h-px bg-white/10 mx-2" />
          <button onClick={() => { onDelete(rowId); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors text-left">
            <span className="text-base leading-none">🗑️</span>Delete
          </button>
        </div>
      )}
    </div>
  );
}

function Pagination({ page, totalPages, pageSize, total, onPageChange, onPageSizeChange }) {
  const pages = [];
  const delta = 2;
  for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) pages.push(i);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-white/8">
      <span className="text-sm text-slate-400">
        Rows per page{" "}
        <select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="ml-1 bg-white/5 border border-white/10 rounded-md px-2 py-0.5 text-slate-200 text-sm focus:outline-none focus:border-violet-500">
          {[5, 10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </span>
      <span className="text-sm text-slate-500">Page {page} of {totalPages} · {total} rows</span>
      <div className="flex items-center gap-1">
        {[
          { label: "«", go: 1 }, { label: "‹", go: page - 1 },
          ...pages.map((p) => ({ label: String(p), go: p, active: p === page })),
          { label: "›", go: page + 1 }, { label: "»", go: totalPages },
        ].map(({ label, go, active }, i) => (
          <button key={i} onClick={() => onPageChange(go)}
            disabled={go < 1 || go > totalPages}
            className={`min-w-[32px] h-8 px-2 rounded-md text-sm font-medium transition-colors disabled:opacity-20 disabled:cursor-not-allowed
              ${active ? "bg-violet-600 text-white" : "text-slate-400 hover:bg-white/8 hover:text-white"}`}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Table Component ─────────────────────────────────────────────────────

const COLUMNS = [
  { key: "header", label: "Header", sortable: true, width: "flex-1 min-w-[200px]" },
  { key: "sectionType", label: "Section Type", sortable: true, width: "w-44" },
  { key: "status", label: "Status", sortable: true, width: "w-36" },
  { key: "target", label: "Target", sortable: true, width: "w-20 text-center" },
  { key: "limit", label: "Limit", sortable: true, width: "w-20 text-center" },
  { key: "reviewer", label: "Reviewer", sortable: true, width: "w-44" },
];

export default function DataTable() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [toast, setToast] = useState(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchRows({ page, pageSize, sortKey, sortDir, search });
      setRows(res.rows);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sortKey, sortDir, search]);

  useEffect(() => { load(); }, [load]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const showToast = (msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  const toggleAll = () => {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  };

  const toggleRow = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleEdit = (id) => showToast(`Editing row #${id}`, "edit");
  const handleDelete = (id) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setTotal((t) => t - 1);
    showToast(`Row #${id} deleted`, "delete");
  };
  const handleBulkDelete = () => {
    const count = selected.size;
    setRows((prev) => prev.filter((r) => !selected.has(r.id)));
    setTotal((t) => t - count);
    setSelected(new Set());
    showToast(`${count} row(s) deleted`, "delete");
  };

  return (
    <div className="min-h-screen bg-[#0e1018] text-white p-6 font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
        * { font-family: 'DM Sans', sans-serif; box-sizing: border-box; }
        .mono { font-family: 'DM Mono', monospace; }
        .hover\\:bg-white\\/8:hover { background-color: rgba(255,255,255,0.08); }
        .bg-white\\/8 { background-color: rgba(255,255,255,0.08); }
        .border-white\\/8 { border-color: rgba(255,255,255,0.08); }
        ::-webkit-scrollbar { height: 4px; width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
        tr.selected-row { background: rgba(124,58,237,0.08); }
        tr.selected-row:hover { background: rgba(124,58,237,0.14) !important; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-xl border transition-all
          ${toast.type === "delete" ? "bg-red-950 border-red-800 text-red-200" : toast.type === "edit" ? "bg-violet-950 border-violet-700 text-violet-200" : "bg-slate-800 border-slate-600 text-slate-200"}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Document Sections</h1>
        <p className="text-slate-500 text-sm mt-1">Manage and track all proposal sections</p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-3">
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search sections…"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:bg-white/8 transition-all" />
        </div>
        {selected.size > 0 && (
          <button onClick={handleBulkDelete}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors">
            🗑️ Delete {selected.size} selected
          </button>
        )}
        <button onClick={load} className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors">
          <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/8 overflow-hidden bg-[#12151f] shadow-2xl shadow-black/40">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-white/8 bg-white/3">
                <th className="w-12 px-4 py-3">
                  <input type="checkbox" checked={rows.length > 0 && selected.size === rows.length}
                    onChange={toggleAll} className="accent-violet-500 w-4 h-4 cursor-pointer" />
                </th>
                {COLUMNS.map((col) => (
                  <th key={col.key} className={`px-3 py-3 text-left font-medium text-slate-400 text-xs uppercase tracking-wider ${col.width}`}>
                    {col.sortable ? (
                      <button onClick={() => handleSort(col.key)}
                        className="inline-flex items-center gap-1 hover:text-white transition-colors">
                        {col.label}
                        <SortIcon active={sortKey === col.key} dir={sortDir} />
                      </button>
                    ) : col.label}
                  </th>
                ))}
                <th className="w-12 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: pageSize }).map((_, i) => (
                  <tr key={i} className="border-b border-white/5">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-3 py-3.5">
                        <div className="h-4 rounded-md bg-white/5 animate-pulse" style={{ width: j === 0 ? "32px" : j === 1 ? "80%" : "60%" }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500">
                    No results found
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const isSelected = selected.has(row.id);
                  return (
                    <tr key={row.id}
                      className={`border-b border-white/5 transition-colors ${isSelected ? "selected-row" : "hover:bg-white/3"}`}>
                      <td className="w-12 px-4 py-3">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleRow(row.id)}
                          className="accent-violet-500 w-4 h-4 cursor-pointer" />
                      </td>
                      <td className="px-3 py-3.5 font-medium text-slate-200 flex-1 min-w-[200px]">{row.header}</td>
                      <td className="px-3 py-3.5 w-44"><SectionTypeBadge type={row.sectionType} /></td>
                      <td className="px-3 py-3.5 w-36"><StatusBadge status={row.status} /></td>
                      <td className="px-3 py-3.5 w-20 text-center mono text-slate-300">{row.target}</td>
                      <td className="px-3 py-3.5 w-20 text-center mono text-slate-300">{row.limit}</td>
                      <td className="px-3 py-3.5 w-44 text-slate-400 truncate max-w-[160px]">{row.reviewer}</td>
                      <td className="w-12 px-2 py-3">
                        <DropdownActions rowId={row.id} onEdit={handleEdit} onDelete={handleDelete} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page} totalPages={totalPages} pageSize={pageSize} total={total}
          onPageChange={(p) => setPage(Math.max(1, Math.min(p, totalPages)))}
          onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
        />
      </div>

      <p className="mt-3 text-xs text-slate-600 text-center">
        {selected.size > 0 ? `${selected.size} of ${total} row(s) selected` : `0 of ${total} row(s) selected`}
      </p>
    </div>
  );
}
import { useState, useMemo } from "react";
import { Button } from "./ui/button";
import { TrashIcon } from "lucide-react";

export default function DataTable({
  columns,
  data,
  tableClassName = "",
  tableWrapperClassName = "",
  rowsPerPageOptions = [5, 10, 20],
  paginationMode = "client",
  page = 1,
  totalPages: serverTotalPages = 1,
  totalRows = 0,
  rowsPerPage: serverRowsPerPage = 5,
  onPageChange,
  onRowsPerPageChange,
  onEdit,
  onDelete,
  onRowClick,
  renderActions
}) {
  const [search] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(rowsPerPageOptions[0]);
  const [selectedRows, setSelectedRows] = useState([]);
  const showActions = onEdit || onDelete || renderActions;
  const isServerPagination = paginationMode === "server";
  const effectiveCurrentPage = isServerPagination ? page : currentPage;
  const effectiveRowsPerPage = isServerPagination ? serverRowsPerPage : rowsPerPage;

  // Filtering
  const filteredData = useMemo(() => {
    if (isServerPagination) return data;
    return data.filter((row) =>
      Object.values(row).join(" ").toLowerCase().includes(search.toLowerCase()),
    );
  }, [search, data, isServerPagination]);

  // Pagination
  const totalPages = isServerPagination
    ? serverTotalPages
    : Math.ceil(filteredData.length / rowsPerPage);
  const paginatedData = isServerPagination
    ? filteredData
    : filteredData.slice(
        (currentPage - 1) * rowsPerPage,
        currentPage * rowsPerPage,
      );
  const totalRowsCount = isServerPagination ? totalRows : filteredData.length;

  // Selection
  const toggleRow = (id) => {
    setSelectedRows((prev) =>
      prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id],
    );
  };

  const toggleAll = () => {
    if (selectedRows.length === paginatedData.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(paginatedData.map((row) => row.id));
    }
  };

  const statusColor = (status) => {
    const value = String(status || "").trim().toLowerCase();

    if (value === "paid" || value === "active" || value === "present") {
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
    }
    if (value === "partial") {
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
    }
    if (
      value === "pending" ||
      value === "inactive" ||
      value === "deactive" ||
      value === "suspended" ||
      value === "absent"
    ) {
      return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200";
    }
    if (value === "primary") {
      return "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200";
    }
    return "bg-muted text-muted-foreground";
  };

  const isReactNode = (value) =>
    typeof value === "object" && value !== null;

  return (
    <div className="w-full  rounded-sm border border-border overflow-hidden">
      {/* Top Controls */}
      {/* <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
        <input
          type="text"
          placeholder="Search..."
          className="px-4 py-2 border rounded-lg w-full md:w-64"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div> */}

      {/* Table */}
      <div className={tableWrapperClassName || "overflow-x-auto"}>
        <table className={`w-full text-sm text-left ${tableClassName}`}>
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="w-10 px-2 py-3 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={
                    selectedRows.length === paginatedData.length &&
                    paginatedData.length > 0
                  }
                  onClick={(e) => e.stopPropagation()}
                  onChange={toggleAll}
                />
              </th>

              {columns.map((col) => (
                <th
                  key={col.accessor}
                  className={`px-2 py-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground ${col.headerClassName || ""}`}
                >
                  {col.header}
                </th>
              ))}
              {showActions && (
                <th className="px-2 py-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Actions
                </th>
              )}
              
            </tr>
          </thead>

          <tbody>
            {paginatedData.map((row) => (
              <tr
                key={row.id}
                className="border-b transition-colors hover:bg-muted/35"
                onClick={() => onRowClick?.(row)}
              >
                <td className="w-10 px-2 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={selectedRows.includes(row.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleRow(row.id)}
                  />
                </td>

                {columns.map((col) => {
                  const cellValue = row[col.accessor];
                  const renderedValue = typeof col.cell === "function"
                    ? col.cell(row)
                    : cellValue;
                  const title =
                    typeof cellValue === "string" || typeof cellValue === "number"
                      ? String(cellValue)
                      : undefined;

                  return (
                    <td
                      key={col.accessor}
                      className={`px-2 py-3 text-base text-foreground ${col.className || ""}`}
                      title={title}
                    >
                      {col.accessor === "status" || col.accessor === "display_status" ? (
                        <span
                          className={`px-3 py-1 text-xs rounded-full font-medium ${statusColor(
                            row[col.accessor],
                          )}`}
                        >
                          {row[col.accessor]}
                        </span>
                      ) : isReactNode(renderedValue) ? (
                        renderedValue
                      ) : (
                        <span className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                          {renderedValue}
                        </span>
                      )}
                    </td>
                  );
                })}

                {showActions && (
                  <td className="px-2 py-3">
                    <div className="flex gap-2">
                      {onEdit && (
                        <Button onClick={(e) => { e.stopPropagation(); onEdit(row); }} variant="secondary">
                          Edit
                        </Button>
                      )}
                      {onDelete && (
                        <Button onClick={(e) => { e.stopPropagation(); onDelete(row); }} variant="destructive">
                         <TrashIcon />
                        </Button>
                      )}
                      {renderActions?.(row)}
                    </div>
                  </td>
                )}
              </tr>
            ))}

            {paginatedData.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 2}
                  className="p-5 text-center text-muted-foreground"
                >
                  No data found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
        <div className="flex items-center mt-4">
          <p className="text-sm text-muted-foreground">
            {selectedRows.length} of {totalRowsCount} row(s) selected
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <p>Rows per page</p>
            <select
              className="border rounded-lg"
              value={effectiveRowsPerPage}
              onChange={(e) => {
                const nextValue = Number(e.target.value);
                if (isServerPagination) {
                  onRowsPerPageChange?.(nextValue);
                } else {
                  setRowsPerPage(nextValue);
                  setCurrentPage(1);
                }
              }}
            >
              {rowsPerPageOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <span className="text-sm text-muted-foreground">
            Page {effectiveCurrentPage} of {totalPages || 1}
          </span>
          <div className="flex gap-2 items-center">
            <button
              disabled={effectiveCurrentPage === 1}
              onClick={() => {
                if (isServerPagination) {
                  onPageChange?.(Math.max(effectiveCurrentPage - 1, 1));
                } else {
                  setCurrentPage((prev) => prev - 1);
                }
              }}
              className="rounded-lg border px-3 py-1 transition-colors disabled:opacity-50 hover:bg-muted"
            >
              Prev
            </button>

            <button
              disabled={effectiveCurrentPage >= (totalPages || 1)}
              onClick={() => {
                if (isServerPagination) {
                  onPageChange?.(Math.min(effectiveCurrentPage + 1, totalPages || 1));
                } else {
                  setCurrentPage((prev) => prev + 1);
                }
              }}
              className="rounded-lg border px-3 py-1 transition-colors disabled:opacity-50 hover:bg-muted"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useMemo } from "react";
import { Button } from "./ui/button";

export default function DataTable({
  columns,
  data,
  rowsPerPageOptions = [5, 10, 20],
  onEdit,
  onDelete,
}) {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(rowsPerPageOptions[0]);
  const [selectedRows, setSelectedRows] = useState([]);

  // Filtering
  const filteredData = useMemo(() => {
    return data.filter((row) =>
      Object.values(row).join(" ").toLowerCase().includes(search.toLowerCase()),
    );
  }, [search, data]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

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
    if (status === "active") return "bg-green-100 text-green-700";
    if (status === "primary") return "bg-blue-100 text-blue-700";
    return "bg-gray-100 text-gray-700";
  };

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
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="border-b bg-secondary">
            <tr>
              <th className="p-3">
                <input
                  type="checkbox"
                  checked={
                    selectedRows.length === paginatedData.length &&
                    paginatedData.length > 0
                  }
                  onChange={toggleAll}
                />
              </th>

              {columns.map((col) => (
                <th
                  key={col.accessor}
                  className="p-3 font-medium text-gray-600"
                >
                  {col.header}
                </th>
              ))}

              <th className="p-3">Actions</th>
            </tr>
          </thead>

          <tbody>
            {paginatedData.map((row) => (
              <tr key={row.id} className="border-b hover:bg-gray-50 transition">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selectedRows.includes(row.id)}
                    onChange={() => toggleRow(row.id)}
                  />
                </td>

                {columns.map((col) => (
                  <td key={col.accessor} className="p-3 text-base text-primary">
                    {col.accessor === "status" ? (
                      <span
                        className={`px-3 py-1 text-xs rounded-full font-medium ${statusColor(
                          row[col.accessor],
                        )}`}
                      >
                        {row[col.accessor]}
                      </span>
                    ) : (
                      row[col.accessor]
                    )}
                  </td>
                ))}

                <td className="p-3 flex gap-2">
                  <Button onClick={() => onEdit(row)} variant="secondary">
                    Edit
                  </Button>

                  <Button onClick={() => onDelete(row)} variant="destructive">
                    Delete
                  </Button>
                </td>
              </tr>
            ))}

            {paginatedData.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 2}
                  className="text-center p-5 text-gray-400"
                >
                  No data found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between px-4 py-2">
        <div className="flex justify-between items-center mt-4">
          <p className="text-sm text-muted-foreground">
            {selectedRows.length} of {filteredData.length} row(s) selected
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            <p>Rows per page</p>
            <select
              className=" border rounded-lg"
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
            >
              {rowsPerPageOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <span className="text-sm text-gray-500">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-2 items-center">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => prev - 1)}
              className="px-3 py-1 border rounded-lg disabled:opacity-50"
            >
              Prev
            </button>

            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((prev) => prev + 1)}
              className="px-3 py-1 border rounded-lg disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

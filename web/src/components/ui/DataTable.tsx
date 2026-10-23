"use client";

import React, { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, ChevronLeft, ChevronRight } from "lucide-react";

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  render?: (row: T, index: number) => React.ReactNode;
  accessor?: (row: T) => any;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  pageSize?: number;
  searchPlaceholder?: string;
  searchKey?: (row: T) => string;
  emptyState?: React.ReactNode;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  pageSize = 10,
  searchPlaceholder = "Filter records...",
  searchKey,
  emptyState,
  rowKey,
  onRowClick,
  className = "",
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);

  // Filter data
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const lower = searchTerm.toLowerCase();
    return data.filter((item) => {
      if (searchKey) {
        return searchKey(item).toLowerCase().includes(lower);
      }
      return Object.values(item as any).some((val) =>
        String(val).toLowerCase().includes(lower)
      );
    });
  }, [data, searchTerm, searchKey]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    const col = columns.find((c) => c.key === sortKey);
    return [...filteredData].sort((a, b) => {
      let aVal = col?.accessor ? col.accessor(a) : (a as any)[sortKey];
      let bVal = col?.accessor ? col.accessor(b) : (b as any)[sortKey];

      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortKey, sortDirection, columns]);

  // Paginate data
  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortKey(null);
      }
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  return (
    <div className={`border border-[#E4DFD5] bg-white rounded-sm shadow-card overflow-hidden ${className}`}>
      {/* Table Toolbar */}
      <div className="p-3 border-b border-[#E4DFD5] bg-[#F6F4EF]/50 flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-[#6B7A88] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={searchPlaceholder}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#E4DFD5] rounded-sm focus:outline-none focus:border-[#1F7A7A] text-[#0F1F2E]"
          />
        </div>
        <div className="text-[11px] font-mono text-[#6B7A88] tabular-nums">
          Showing {sortedData.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}–
          {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} entries
        </div>
      </div>

      {/* Table Canvas with Sticky Header */}
      <div className="overflow-x-auto max-h-[560px]">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-[#F6F4EF] z-10 border-b border-[#E4DFD5]">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  className={`px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-[#6B7A88] select-none ${
                    col.sortable !== false ? "cursor-pointer hover:text-[#0F1F2E]" : ""
                  } ${col.className || ""}`}
                >
                  <div className="flex items-center space-x-1.5">
                    <span>{col.header}</span>
                    {col.sortable !== false && (
                      <span className="text-[#9BA6B0]">
                        {sortKey === col.key ? (
                          sortDirection === "asc" ? (
                            <ChevronUp className="w-3.5 h-3.5 text-[#1F7A7A]" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-[#1F7A7A]" />
                          )
                        ) : (
                          <ChevronsUpDown className="w-3 h-3 opacity-60" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4DFD5] bg-white">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-8 text-center text-xs text-[#6B7A88]">
                  {emptyState || "No records found matching your filter criteria."}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => (
                <tr
                  key={rowKey(row)}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`transition-colors ${
                    onRowClick ? "cursor-pointer hover:bg-[#F6F4EF]" : "hover:bg-[#FAF9F5]"
                  }`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-2.5 text-xs text-[#0F1F2E] ${col.className || ""}`}>
                      {col.render
                        ? col.render(row, (currentPage - 1) * pageSize + idx)
                        : (row as any)[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="px-4 py-2.5 border-t border-[#E4DFD5] bg-[#F6F4EF]/40 flex items-center justify-between text-xs">
          <span className="text-[11px] font-mono text-[#6B7A88] tabular-nums">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="p-1 rounded-sm border border-[#E4DFD5] bg-white text-[#0F1F2E] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F6F4EF]"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1 rounded-sm border border-[#E4DFD5] bg-white text-[#0F1F2E] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F6F4EF]"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

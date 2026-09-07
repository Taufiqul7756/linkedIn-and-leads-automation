import { LuChevronLeft, LuChevronRight } from "react-icons/lu";

interface PaginationProps {
  page: number;
  totalCount: number;
  pageSize: number;
  pageSizeOptions: number[];
  hasPrev: boolean;
  hasNext: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export default function Pagination({
  page,
  totalCount,
  pageSize,
  pageSizeOptions,
  hasPrev,
  hasNext,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const totalPages = Math.ceil(totalCount / pageSize);

  if (totalCount === 0) return null;

  return (
    <div className="mt-4 flex items-center justify-between gap-4">
      {/* Per-page selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Rows per page</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-600 focus:border-blue-500 focus:outline-none"
        >
          {pageSizeOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Page info + prev/next */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">
          Page {page} of {totalPages}
          <span className="ml-1.5 text-gray-300">·</span>
          <span className="ml-1.5">{totalCount} total</span>
        </span>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev}
          className="flex items-center rounded-lg border border-gray-200 p-1.5 text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-40"
        >
          <LuChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
          className="flex items-center rounded-lg border border-gray-200 p-1.5 text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-40"
        >
          <LuChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

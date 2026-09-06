'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface PaginationControlProps {
  currentPage: number;
  pageSize: number;
  totalCount?: number;
  hasMore: boolean;
  onNextPage: () => void;
  onPrevPage: () => void;
  loading?: boolean;
  itemLabel?: string;
  theme?: 'light' | 'dark';
}

export function PaginationControl({
  currentPage,
  pageSize,
  totalCount,
  hasMore,
  onNextPage,
  onPrevPage,
  loading = false,
  itemLabel = 'রেকর্ড',
  theme = 'light',
}: PaginationControlProps) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = totalCount ? Math.min(currentPage * pageSize, totalCount) : currentPage * pageSize;

  const isDark = theme === 'dark';

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t rounded-b-3xl ${
        isDark
          ? 'bg-slate-900 border-slate-800 text-slate-300'
          : 'bg-white border-slate-200/90 text-slate-600'
      }`}
    >
      {/* Information text */}
      <div className="text-xs font-medium">
        {totalCount !== undefined ? (
          <span>
            দেখাচ্ছে <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{startItem}</span> -{' '}
            <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{endItem}</span> (মোট{' '}
            <span className="font-black text-indigo-500">{totalCount}</span> টি {itemLabel})
          </span>
        ) : (
          <span>
            পৃষ্ঠা <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{currentPage}</span>
          </span>
        )}
      </div>

      {/* Pagination Action Controls */}
      <div className="flex items-center gap-2">
        {/* Previous Button */}
        <button
          type="button"
          onClick={onPrevPage}
          disabled={currentPage <= 1 || loading}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all ${
            currentPage <= 1 || loading
              ? isDark
                ? 'bg-slate-800/40 border-slate-800 text-slate-600 cursor-not-allowed'
                : 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed'
              : isDark
              ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 active:scale-95'
              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm active:scale-95'
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
          <span>পূর্ববর্তী (Prev)</span>
        </button>

        {/* Current Page Badge */}
        <div
          className={`px-3 py-1.5 rounded-xl text-xs font-black min-w-[2.2rem] text-center border ${
            isDark
              ? 'bg-slate-800 text-indigo-400 border-slate-700'
              : 'bg-indigo-50 text-indigo-600 border-indigo-100'
          }`}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto text-indigo-500" /> : currentPage}
        </div>

        {/* Next Button */}
        <button
          type="button"
          onClick={onNextPage}
          disabled={!hasMore || loading}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all ${
            !hasMore || loading
              ? isDark
                ? 'bg-slate-800/40 border-slate-800 text-slate-600 cursor-not-allowed'
                : 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed'
              : 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 active:scale-95'
          }`}
        >
          <span>পরবর্তী (Next)</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default PaginationControl;

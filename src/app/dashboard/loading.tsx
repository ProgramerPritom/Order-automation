import React from 'react';

export default function DashboardLoading() {
  return (
    <div className="space-y-6 w-full animate-pulse">
      
      {/* Top Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="w-32 h-5 rounded-full bg-slate-200" />
          <div className="w-64 h-8 rounded-xl bg-slate-300" />
          <div className="w-80 h-4 rounded-lg bg-slate-200" />
        </div>
        <div className="flex gap-3">
          <div className="w-28 h-10 rounded-xl bg-slate-200" />
          <div className="w-36 h-10 rounded-xl bg-indigo-200" />
        </div>
      </div>

      {/* 4 Stats Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4 relative overflow-hidden">
            <div className="flex justify-between items-center">
              <div className="w-24 h-4 rounded bg-slate-200" />
              <div className="w-9 h-9 rounded-xl bg-slate-100" />
            </div>
            <div className="w-32 h-9 rounded-xl bg-slate-300" />
            <div className="w-20 h-3 rounded bg-slate-200" />
          </div>
        ))}
      </div>

      {/* Main Content / Table Skeleton */}
      <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
          <div className="w-48 h-6 rounded-lg bg-slate-200" />
          <div className="w-24 h-6 rounded-full bg-slate-100" />
        </div>

        {/* Shimmering Table Rows */}
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="flex items-center justify-between py-3 border-b border-slate-100 gap-4">
              <div className="w-20 h-4 rounded bg-slate-200" />
              <div className="w-40 h-4 rounded bg-slate-300" />
              <div className="w-32 h-4 rounded bg-slate-200" />
              <div className="w-24 h-4 rounded bg-slate-200" />
              <div className="w-16 h-6 rounded-full bg-slate-100" />
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

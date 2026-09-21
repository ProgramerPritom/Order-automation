import React from 'react';

export default function DashboardSkeleton() {
  return (
    <div className="space-y-5 w-full animate-in fade-in duration-300">
      
      {/* 1. Welcome Banner Skeleton */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-indigo-950 via-indigo-900 to-slate-900 text-white shadow-lg relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-2.5 max-w-xl w-full">
          {/* Badge */}
          <div className="w-32 h-5 rounded-full bg-indigo-500/20 border border-indigo-400/20 animate-pulse" />
          
          {/* Heading */}
          <div className="space-y-1.5">
            <div className="h-6 sm:h-7 w-3/4 rounded-xl bg-white/15 animate-pulse" />
          </div>
          
          {/* Subtitle */}
          <div className="pt-0.5">
            <div className="h-3 w-4/5 rounded-md bg-indigo-200/20 animate-pulse" />
          </div>
        </div>

        {/* Action Buttons Skeleton */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-32 h-8 rounded-xl bg-white/20 animate-pulse" />
          <div className="w-32 h-8 rounded-xl bg-indigo-500/30 animate-pulse" />
        </div>

        {/* Shimmer sweep */}
        <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
      </div>

      {/* 2. Metrics 4-Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs relative overflow-hidden space-y-2.5"
          >
            {/* Top row: Title + Icon placeholder */}
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 rounded-md bg-slate-200 animate-pulse" />
              <div className="w-8 h-8 rounded-lg bg-slate-100 animate-pulse" />
            </div>

            {/* Metric Value */}
            <div className="space-y-1">
              <div className="h-6 w-28 rounded-lg bg-slate-200 animate-pulse" />
              <div className="h-2.5 w-24 rounded-md bg-slate-100 animate-pulse" />
            </div>

            {/* Shimmer effect */}
            <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-slate-100/50 to-transparent pointer-events-none" />
          </div>
        ))}
      </div>

      {/* 3. Recent Orders Table Skeleton */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden relative">
        {/* Table Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-5 w-44 rounded-lg bg-slate-200 animate-pulse" />
            <div className="h-3 w-64 rounded-md bg-slate-100 animate-pulse" />
          </div>
          <div className="h-4 w-24 rounded bg-slate-100 animate-pulse" />
        </div>

        {/* Table Body Rows */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-400 font-bold uppercase tracking-wider">
                <th className="py-3.5 px-6">অর্ডার আইডি</th>
                <th className="py-3.5 px-6">গ্রাহকের বিবরণ</th>
                <th className="py-3.5 px-6">পণ্য</th>
                <th className="py-3.5 px-6">চ্যানেল</th>
                <th className="py-3.5 px-6">মোট বিল</th>
                <th className="py-3.5 px-6">স্ট্যাটাস</th>
                <th className="py-3.5 px-6">সময়</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {[1, 2, 3, 4, 5].map((row) => (
                <tr key={row} className="animate-pulse">
                  {/* Order ID */}
                  <td className="py-4 px-6">
                    <div className="h-4 w-20 rounded bg-indigo-100/70" />
                  </td>
                  
                  {/* Customer details */}
                  <td className="py-4 px-6 space-y-1.5">
                    <div className="h-3.5 w-32 rounded bg-slate-200" />
                    <div className="h-2.5 w-24 rounded bg-slate-100" />
                  </td>

                  {/* Product */}
                  <td className="py-4 px-6">
                    <div className="h-3.5 w-36 rounded bg-slate-200" />
                  </td>

                  {/* Channel */}
                  <td className="py-4 px-6">
                    <div className="h-5 w-16 rounded-md bg-slate-100" />
                  </td>

                  {/* Amount */}
                  <td className="py-4 px-6">
                    <div className="h-4 w-16 rounded bg-slate-200" />
                  </td>

                  {/* Status pill */}
                  <td className="py-4 px-6">
                    <div className="h-5 w-20 rounded-full bg-slate-100" />
                  </td>

                  {/* Time */}
                  <td className="py-4 px-6">
                    <div className="h-3 w-16 rounded bg-slate-100" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Shimmer sweep */}
        <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-slate-50/60 to-transparent pointer-events-none" />
      </div>

    </div>
  );
}

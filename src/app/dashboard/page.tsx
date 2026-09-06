'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  ShoppingBag,
  Share2,
  Activity,
  Bot,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  MessageSquare,
} from 'lucide-react';
import { useAppSelector } from '@/lib/store/hooks';
import { getSessionToken } from '@/lib/session';

export default function DashboardOverviewPage() {
  const auth = useAppSelector((state) => state.auth);
  const isSuperAdmin = auth.user?.role === 'superadmin';

  const [stats, setStats] = useState({
    todaySales: 0,
    totalOrders: 0,
    autonomousRate: 100,
    activeChannels: 0,
  });

  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = getSessionToken();
      const res = await fetch('/api/dashboard/stats', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.stats) {
        setStats(data.stats);
      }
      if (data.recentOrders) {
        setRecentOrders(data.recentOrders);
      }
    } catch (e) {
      console.error('Fetch dashboard stats error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 w-full">
      
      {/* Welcome Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-400/30 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>AI Sales Executive v2.0</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">
            স্বাগতম! আপনার অটোমেশন সম্পূর্ণ সচল রয়েছে
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-indigo-200/90 max-w-xl">
            ফেসবুক, ইনস্টাগ্রাম ও হোয়াটসঅ্যাপে কোনো কাস্টমার নক দিলে এআই স্বয়ংক্রিয়ভাবে স্টক চেক করে অর্ডার নিশ্চিত করছে।
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/dashboard/channels"
            className="px-4 py-2.5 rounded-xl bg-white text-slate-900 font-bold text-xs hover:bg-slate-100 transition-colors shadow-sm"
          >
            চ্যানেল কনফিগার করুন
          </Link>
          {isSuperAdmin ? (
            <Link
              href="/dashboard/automation"
              className="px-4 py-2.5 rounded-xl bg-indigo-600/60 hover:bg-indigo-600 text-white font-bold text-xs border border-indigo-400/40 transition-colors flex items-center gap-1.5"
            >
              <Activity className="w-4 h-4" />
              <span>n8n মনিটর</span>
            </Link>
          ) : (
            <Link
              href="/dashboard/inbox"
              className="px-4 py-2.5 rounded-xl bg-indigo-600/60 hover:bg-indigo-600 text-white font-bold text-xs border border-indigo-400/40 transition-colors flex items-center gap-1.5"
            >
              <MessageSquare className="w-4 h-4" />
              <span>লাইভ কাস্টমার ইনবক্স</span>
            </Link>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm animate-pulse space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-3.5 bg-slate-200 rounded w-24" />
                <div className="w-9 h-9 rounded-xl bg-slate-100" />
              </div>
              <div className="h-7 bg-slate-200 rounded w-16" />
              <div className="h-3 bg-slate-100 rounded w-28" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">আজকের মোট বিক্রয়</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-black text-slate-900">৳ {stats.todaySales.toLocaleString()}</p>
            <p className="mt-1 text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>গতকাল থেকে +২২% বৃদ্ধি</span>
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">আজকের অর্ডার সংখ্যা</span>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-black text-slate-900">{stats.totalOrders} টি</p>
            <p className="mt-1 text-[11px] text-slate-500">সবগুলোই এআই দ্বারা স্বয়ংক্রিয়</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">এআই স্বয়ংক্রিয় রেট</span>
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-black text-slate-900">{stats.autonomousRate}%</p>
            <p className="mt-1 text-[11px] text-purple-600 font-semibold">কোনো হিউম্যান ইন্টারভেনশন ছাড়াই</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">সক্রিয় সোশ্যাল পেজ</span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Share2 className="w-5 h-5" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-black text-slate-900">{stats.activeChannels} টি চ্যানেল</p>
            <p className="mt-1 text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>সবগুলো কানেক্টেড</span>
            </p>
          </div>

        </div>
      )}

      {/* Recent Automated Orders Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-base text-slate-900">সাম্প্রতিক সংগৃহীত অর্ডার</h3>
            <p className="text-xs text-slate-500">এআই যে অর্ডারগুলো কাস্টমারের সাথে কথা বলে নিশ্চিত করেছে</p>
          </div>
          <Link
            href="/dashboard/orders"
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            <span>সবগুলো দেখুন</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider">
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
              {loading ? (
                [1, 2, 3].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-6"><div className="h-4 bg-slate-200 rounded w-16" /></td>
                    <td className="py-4 px-6 space-y-1.5"><div className="h-3.5 bg-slate-200 rounded w-28" /><div className="h-2.5 bg-slate-100 rounded w-20" /></td>
                    <td className="py-4 px-6"><div className="h-3.5 bg-slate-200 rounded w-24" /></td>
                    <td className="py-4 px-6"><div className="h-5 bg-slate-100 rounded w-16" /></td>
                    <td className="py-4 px-6"><div className="h-4 bg-slate-200 rounded w-14" /></td>
                    <td className="py-4 px-6"><div className="h-5 bg-slate-100 rounded-full w-20" /></td>
                    <td className="py-4 px-6"><div className="h-3 bg-slate-200 rounded w-16" /></td>
                  </tr>
                ))
              ) : (
                recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6 font-mono font-bold text-indigo-600">{order.id}</td>
                    <td className="py-4 px-6">
                      <p className="font-bold text-slate-900">{order.customer}</p>
                      <p className="text-[11px] text-slate-500">{order.phone}</p>
                    </td>
                    <td className="py-4 px-6 font-medium text-slate-800">{order.product}</td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                        {order.channel}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-black text-slate-900">{order.amount}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                        order.status === 'confirmed'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{order.status}</span>
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{order.time}</span>
                    </td>
                  </tr>
                ))
              )}
              {recentOrders.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                    <p className="font-bold text-slate-700 text-sm">এখনো কোনো সাম্প্রতিক অর্ডার নেই</p>
                    <p className="text-slate-400 mt-1">ফেসবুক পেজে মেসেজ আসলে এআই স্বয়ংক্রিয়ভাবে অর্ডার সংগ্রহ করে এখানে দেখাবে।</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

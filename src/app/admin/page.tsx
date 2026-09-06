'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Users,
  ShoppingBag,
  TrendingUp,
  Activity,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  Phone,
  Store,
  ExternalLink,
} from 'lucide-react';

interface TenantRecord {
  id: string;
  store_name: string;
  slug: string;
  store_phone: string;
  store_email: string;
  plan: string;
  subscription_status: string;
  trial_ends_at: string;
  current_period_ends_at: string;
  owner_name: string;
  owner_phone: string;
  owner_email: string;
  orders_count: string;
  revenue_generated: string;
  created_at: string;
}

export default function SuperAdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState({
    totalTenants: 0,
    totalOrders: 0,
    totalRevenue: 0,
    activeSubscriptions: 0,
    trialingStores: 0,
  });
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const fetchAdminData = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      window.location.href = '/login';
      return;
    }

    try {
      const res = await fetch('/api/admin/tenants', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 403) {
        setError('আপনার এই পেইজে প্রবেশের অনুমতি নেই (Super Admin Required)।');
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch admin data');

      setStats(data.stats);
      setTenants(data.tenants);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleAction = async (action: string, tenantId: string, plan?: string) => {
    const token = localStorage.getItem('accessToken');
    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, tenantId, plan }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');

      setActionMsg(data.message || 'অ্যাকশন সফল হয়েছে!');
      setTimeout(() => setActionMsg(null), 4000);
      fetchAdminData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 rounded-2xl bg-purple-600 flex items-center justify-center animate-bounce shadow-lg shadow-purple-600/30">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <p className="mt-4 text-xs font-bold text-slate-400 animate-pulse">
          সুপার এডমিন ডাটা লোড হচ্ছে...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Super Admin Top Navbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-purple-600/25">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-white tracking-tight">
                  KothaShop <span className="text-purple-400">Super Admin</span>
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  Master Control
                </span>
              </div>
              <p className="text-xs text-slate-400">প্ল্যাটফর্মের সকল মার্চেন্ট, সাবস্ক্রিপশন ও সার্বিক এনালাইসিস প্যানেল</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              <Store className="w-4 h-4" />
              <span>মার্চেন্ট ড্যাশবোর্ড দেখুন</span>
            </Link>
          </div>
        </div>

        {actionMsg && (
          <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-xs font-bold text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{actionMsg}</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-xs font-bold text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Global KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">মোট নিবন্ধিত শপ</span>
              <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <p className="mt-4 text-3xl font-black text-white">{stats.totalTenants} টি</p>
            <p className="mt-1 text-[11px] text-slate-400">সকল সক্রিয় মার্চেন্ট একাউন্ট</p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">পেইড সাবস্ক্রিপশন</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <p className="mt-4 text-3xl font-black text-emerald-400">{stats.activeSubscriptions} টি</p>
            <p className="mt-1 text-[11px] text-amber-400 font-semibold">{stats.trialingStores} টি স্টোর ট্রায়ালে আছে</p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">মোট এআই অর্ডার প্রসেসড</span>
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5" />
              </div>
            </div>
            <p className="mt-4 text-3xl font-black text-white">{stats.totalOrders} টি</p>
            <p className="mt-1 text-[11px] text-slate-400">সকল শপের যৌথ অর্ডার সংখ্যা</p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">মোট প্ল্যাটফর্ম GMV</span>
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>
            <p className="mt-4 text-3xl font-black text-cyan-300">৳ {stats.totalRevenue.toLocaleString()}</p>
            <p className="mt-1 text-[11px] text-slate-400">মোট বিক্রিত পণ্যের আর্থিক মূল্য</p>
          </div>

        </div>

        {/* Engine Telemetry Card (Admin Only) */}
        <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">n8n ও ব্যাকগ্রাউন্ড ওয়ার্কার হেলথ</h3>
              <p className="text-xs text-slate-400">মেটা ওয়েব গেটওয়ে এবং আপস্ট্যাশ রেডিস কিউ মনিটর</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>n8n Engine: 100% Online</span>
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-indigo-400">Redis Buffer: 0 Pending</span>
            <span className="text-slate-400">|</span>
            <span className="text-cyan-400">Webhook Latency: 18ms</span>
          </div>
        </div>

        {/* All Registered Merchants Table */}
        <div className="rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-base text-white">সকল নিবন্ধিত মার্চেন্ট ও স্টোরের তালিকা</h2>
              <p className="text-xs text-slate-400">মার্চেন্টদের তথ্য, বর্তমান প্যাকেজ, ট্রায়াল স্ট্যাটাস এবং অ্যাকশন</p>
            </div>
            <span className="text-xs font-bold text-purple-300 bg-purple-500/20 px-3 py-1 rounded-full border border-purple-500/30">
              মোট রেকর্ড: {tenants.length} টি
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-4 px-6">দোকানের নাম</th>
                  <th className="py-4 px-6">মালিকের নাম ও ফোন</th>
                  <th className="py-4 px-6">প্ল্যান ও মেয়াদ</th>
                  <th className="py-4 px-6">অর্ডার ও সেলস</th>
                  <th className="py-4 px-6">রেজিস্ট্রেশন তারিখ</th>
                  <th className="py-4 px-6 text-right">এডমিন একশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                    
                    <td className="py-4 px-6">
                      <p className="font-bold text-white text-sm">{t.store_name}</p>
                      <p className="text-[11px] text-slate-500 font-mono">slug: {t.slug}</p>
                    </td>

                    <td className="py-4 px-6">
                      <p className="font-semibold text-slate-200">{t.owner_name || 'Store Owner'}</p>
                      <p className="text-[11px] text-indigo-400 font-mono flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        <span>{t.owner_phone || t.store_phone || 'N/A'}</span>
                      </p>
                    </td>

                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`px-2 py-0.5 rounded font-black text-[10px] uppercase ${
                          t.plan === 'pro' 
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : t.plan === 'business'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}>
                          {t.plan}
                        </span>
                        {t.subscription_status === 'active' ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                            Active Paid
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-[10px]">
                            7-Day Trial
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <p className="font-bold text-white">{t.orders_count} টি অর্ডার</p>
                      <p className="text-[11px] text-emerald-400 font-semibold">৳ {parseFloat(t.revenue_generated || '0').toLocaleString()}</p>
                    </td>

                    <td className="py-4 px-6 text-slate-400 text-[11px]">
                      {t.created_at ? new Date(t.created_at).toLocaleDateString('bn-BD') : 'N/A'}
                    </td>

                    <td className="py-4 px-6 text-right space-x-2">
                      <button
                        onClick={() => handleAction('upgrade_plan', t.id, 'pro')}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                        title="Activate 30-Day Pro Plan"
                      >
                        প্রো প্ল্যান অ্যাক্টিভ করুন
                      </button>
                      <button
                        onClick={() => handleAction('extend_trial', t.id)}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                        title="Extend 7 Days"
                      >
                        +৭ দিন ট্রায়াল
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Users,
  ShoppingBag,
  TrendingUp,
  Sparkles,
  Search,
  AlertCircle,
  Phone,
  Store,
  Calendar,
  Edit3,
  X,
  RefreshCw,
  Check,
  Trash2,
  AlertTriangle,
  CreditCard,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

import { getSessionToken } from '@/lib/session';
import { PaginationControl } from '@/components/ui/PaginationControl';

interface TenantRecord {
  id: string;
  store_name: string;
  slug: string;
  store_phone: string;
  store_email: string;
  plan: 'starter' | 'pro' | 'business';
  subscription_status: 'trialing' | 'active' | 'past_due' | 'expired';
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
  order_quota_monthly: number;
  orders_count_current_month: number;
  max_channels: number;
  channels_count: string;
  total_staff_count: string;
  owner_id: string;
  owner_name: string;
  owner_phone: string;
  owner_email: string;
  owner_role: string;
  orders_count: string;
  revenue_generated: string;
  created_at: string;
  updated_at: string;
}

export default function SuperAdminPage() {
  const [stats, setStats] = useState({
    totalTenants: 0,
    totalUsers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    activeSubscriptions: 0,
    trialingStores: 0,
  });
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Keyset Cursor Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [isPaginating, setIsPaginating] = useState(false);

  // Edit Modal State
  const [selectedTenant, setSelectedTenant] = useState<TenantRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Delete Confirmation Modal State
  const [deleteConfirmTenant, setDeleteConfirmTenant] = useState<TenantRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal Form State
  const [editPlan, setEditPlan] = useState<'starter' | 'pro' | 'business'>('starter');
  const [editStatus, setEditStatus] = useState<'trialing' | 'active' | 'past_due' | 'expired'>('active');
  const [editValidationDate, setEditValidationDate] = useState('');
  const [editOrderQuota, setEditOrderQuota] = useState('500');
  const [editMaxChannels, setEditMaxChannels] = useState('1');

  const fetchAdminData = async (
    cursor?: string | null,
    isPageNav: boolean = false,
    query: string = searchQuery,
    plan: string = planFilter,
    status: string = statusFilter
  ) => {
    const token = getSessionToken();
    if (!token) {
      window.location.href = '/admin/login';
      return;
    }

    if (isPageNav) setIsPaginating(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams({ limit: '15' });
      if (cursor) params.append('cursor', cursor);
      if (query.trim()) params.append('q', query.trim());
      if (plan) params.append('plan', plan);
      if (status) params.append('status', status);

      const url = `/api/admin/tenants?${params.toString()}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        window.location.href = '/admin/login';
        return;
      }

      if (res.status === 403) {
        setError('আপনার এই পেইজে প্রবেশের অনুমতি নেই (Super Admin Required)।');
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch admin data');

      setStats(data.stats || {
        totalTenants: 0,
        totalUsers: 0,
        totalOrders: 0,
        totalRevenue: 0,
        activeSubscriptions: 0,
        trialingStores: 0,
      });
      setTenants(data.tenants || []);
      setNextCursor(data.pagination?.nextCursor || null);
      setHasMore(Boolean(data.pagination?.hasMore));
      setTotalCount(data.pagination?.totalCount || 0);
      setError(null);

      // Fetch pending invoice submissions
      fetchPendingInvoices();
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message || 'ডাটা লোড করা যায়নি');
    } finally {
      setLoading(false);
      setIsPaginating(false);
    }
  };

  const [pendingInvoices, setPendingInvoices] = useState<any[]>([]);
  const [approvingInvId, setApprovingInvId] = useState<string | null>(null);

  const fetchPendingInvoices = async () => {
    const token = getSessionToken();
    try {
      const res = await fetch('/api/admin/invoices', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.invoices) {
        setPendingInvoices(data.invoices.filter((i: any) => i.status === 'pending_approval'));
      }
    } catch (e) {}
  };

  const handleInvoiceApproval = async (invoiceId: string, action: 'approve' | 'reject') => {
    setApprovingInvId(invoiceId);
    const token = getSessionToken();
    try {
      const res = await fetch('/api/admin/invoices/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ invoiceId, action }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message);
        fetchPendingInvoices();
        const currentCursor = cursorStack[currentPage - 1] ?? null;
        fetchAdminData(currentCursor, true);
      } else {
        toast.error(data.error || 'অ্যাকশন সম্পন্ন করা যায়নি');
      }
    } catch (e: any) {
      toast.error('অনুমোদনে ত্রুটি');
    } finally {
      setApprovingInvId(null);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    setCursorStack([null]);
    fetchAdminData(null, false, searchQuery, planFilter, statusFilter);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setPlanFilter('');
    setStatusFilter('');
    setCurrentPage(1);
    setCursorStack([null]);
    fetchAdminData(null, false, '', '', '');
  };

  const handleNextPage = () => {
    if (!nextCursor || !hasMore) return;
    setCursorStack((prev) => [...prev, nextCursor]);
    setCurrentPage((prev) => prev + 1);
    fetchAdminData(nextCursor, true);
  };

  const handlePrevPage = () => {
    if (currentPage <= 1) return;
    const targetIdx = currentPage - 2;
    const targetCursor = cursorStack[targetIdx] ?? null;
    setCursorStack((prev) => prev.slice(0, currentPage - 1));
    setCurrentPage((prev) => prev - 1);
    fetchAdminData(targetCursor, true);
  };

  // Quick Action execution (Extend days, plan change, etc.)
  const handleQuickAction = async (action: string, tenantId: string, extraParams: any = {}) => {
    const token = getSessionToken();
    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, tenantId, ...extraParams }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');

      toast.success(data.message || 'অ্যাকশন সফলভাবে সম্পন্ন হয়েছে!');
      const currentCursor = cursorStack[currentPage - 1] ?? null;
      fetchAdminData(currentCursor, true);
    } catch (err: any) {
      toast.error(err.message || 'অ্যাকশন সম্পন্ন করা যায়নি');
    }
  };

  // Open Full Edit Modal
  const openManageModal = (tenant: TenantRecord) => {
    setSelectedTenant(tenant);
    setEditPlan(tenant.plan || 'starter');
    setEditStatus(tenant.subscription_status || 'trialing');

    const activeEndDate = tenant.current_period_ends_at
      ? new Date(tenant.current_period_ends_at).toISOString().split('T')[0]
      : tenant.trial_ends_at
      ? new Date(tenant.trial_ends_at).toISOString().split('T')[0]
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    setEditValidationDate(activeEndDate);
    setEditOrderQuota(String(tenant.order_quota_monthly ?? 500));
    setEditMaxChannels(String(tenant.max_channels ?? 1));
    setIsModalOpen(true);
  };

  // Save Modal Form Changes
  const handleSaveModal = async () => {
    if (!selectedTenant) return;
    setIsSaving(true);
    const token = getSessionToken();

    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'update_full_config',
          tenantId: selectedTenant.id,
          plan: editPlan,
          status: editStatus,
          validationDate: editValidationDate,
          orderQuotaMonthly: parseInt(editOrderQuota, 10),
          maxChannels: parseInt(editMaxChannels, 10),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'আপডেট করা সম্ভব হয়নি');

      toast.success(data.message || 'মার্চেন্ট সেটিংস সফলভাবে আপডেট হয়েছে!');
      setIsModalOpen(false);
      const currentCursor = cursorStack[currentPage - 1] ?? null;
      fetchAdminData(currentCursor, true);
    } catch (err: any) {
      toast.error(err.message || 'সেভ করতে ব্যর্থ হয়েছে');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Tenant & User Permanently
  const handleDeleteTenant = async () => {
    if (!deleteConfirmTenant) return;
    setIsDeleting(true);
    const token = getSessionToken();

    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'delete_tenant',
          tenantId: deleteConfirmTenant.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'মার্চেন্ট মুছে ফেলা যায়নি');

      toast.success(data.message || 'মার্চেন্ট সফলভাবে মুছে ফেলা হয়েছে!');
      setDeleteConfirmTenant(null);
      if (isModalOpen && selectedTenant?.id === deleteConfirmTenant.id) {
        setIsModalOpen(false);
      }
      const currentCursor = cursorStack[currentPage - 1] ?? null;
      fetchAdminData(currentCursor, true);
    } catch (err: any) {
      toast.error(err.message || 'ডিলিট করতে ব্যর্থ হয়েছে');
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper function to calculate remaining days & message
  const getValidationDetails = (tenant: TenantRecord) => {
    const now = new Date().getTime();
    if (tenant.subscription_status === 'active') {
      if (!tenant.current_period_ends_at) {
        return { days: 0, text: 'মেয়াদ অনির্ধারিত', isExpired: true, date: 'N/A' };
      }
      const exp = new Date(tenant.current_period_ends_at).getTime();
      const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
      return {
        days: Math.max(0, diffDays),
        text: diffDays > 0 ? `${diffDays} দিন বাকি` : 'মেয়াদ শেষ',
        isExpired: diffDays <= 0,
        date: new Date(tenant.current_period_ends_at).toLocaleDateString('bn-BD'),
      };
    } else {
      if (!tenant.trial_ends_at) {
        return { days: 0, text: 'ট্রায়াল শেষ', isExpired: true, date: 'N/A' };
      }
      const exp = new Date(tenant.trial_ends_at).getTime();
      const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
      return {
        days: Math.max(0, diffDays),
        text: diffDays > 0 ? `${diffDays} দিন ট্রায়াল বাকি` : 'ট্রায়াল শেষ',
        isExpired: diffDays <= 0,
        date: new Date(tenant.trial_ends_at).toLocaleDateString('bn-BD'),
      };
    }
  };

  const applyPresetDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setEditValidationDate(d.toISOString().split('T')[0]);
    setEditStatus('active');
  };

  if (loading && !isPaginating) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center animate-pulse shadow-xl shadow-purple-600/30">
          <RefreshCw className="w-6 h-6 text-white animate-spin" />
        </div>
        <p className="mt-4 text-xs font-bold text-slate-400 animate-pulse">
          সুপার এডমিন ডাটা লোড হচ্ছে...
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <span>মার্চেন্ট ও সাবস্ক্রিপশন কন্ট্রোল প্যানেল</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40">
              Live Master Sync
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            প্ল্যাটফর্মের সকল মার্চেন্ট, ইউজার একাউন্ট, ভ্যালিডেশন ডেট এবং কোটা নিয়ন্ত্রণ
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchAdminData(cursorStack[currentPage - 1] ?? null, true)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>রিফ্রেশ</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-xs font-bold text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Global KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">মোট শপ</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-white">{stats.totalTenants} টি</p>
          <p className="mt-0.5 text-[11px] text-slate-400">মোট ইউজার: {stats.totalUsers} জন</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">পেইড সাবস্ক্রিপশন</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-emerald-400">{stats.activeSubscriptions} টি</p>
          <p className="mt-0.5 text-[11px] text-amber-400 font-semibold">{stats.trialingStores} টি ফ্রি ট্রায়ালে</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">মোট এআই অর্ডার</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-white">{stats.totalOrders} টি</p>
          <p className="mt-0.5 text-[11px] text-slate-400">সকল শপের যৌথ সফল সেলস</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">মোট প্ল্যাটফর্ম GMV</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-cyan-300">৳ {stats.totalRevenue.toLocaleString()}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">মোট বিক্রিত পণ্যের আর্থিক মূল্য</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
        <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="মোবাইল নম্বর (017...), শপের নাম বা ইমেইল দিয়ে সার্চ করুন..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors font-mono"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-colors shadow-sm"
          >
            সার্চ
          </button>
        </form>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={planFilter}
            onChange={(e) => {
              setPlanFilter(e.target.value);
              setCurrentPage(1);
              setCursorStack([null]);
              fetchAdminData(null, false, searchQuery, e.target.value, statusFilter);
            }}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-purple-500"
          >
            <option value="">সকল প্ল্যান</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="business">Business</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
              setCursorStack([null]);
              fetchAdminData(null, false, searchQuery, planFilter, e.target.value);
            }}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-purple-500"
          >
            <option value="">সকল স্ট্যাটাস</option>
            <option value="active">Active (পেইড)</option>
            <option value="trialing">Trialing (ট্রায়াল)</option>
            <option value="past_due">Past Due (মেয়াদোত্তীর্ণ)</option>
            <option value="expired">Expired (বাতিল)</option>
          </select>

          {(searchQuery || planFilter || statusFilter) && (
            <button
              onClick={handleResetFilters}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
            >
              রিসেট
            </button>
          )}
        </div>
      </div>

      {/* Pending MFS / Manual Payment Submissions Section */}
      {pendingInvoices.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 border-2 border-indigo-500/50 shadow-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-indigo-500/20 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              <h3 className="font-black text-sm text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-400" />
                <span>পেন্ডিং পেমেন্ট অনুমোদন (Pending MFS Verification)</span>
              </h3>
            </div>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {pendingInvoices.length}টি পেন্ডিং রিকোয়েস্ট
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingInvoices.map((inv) => (
              <div
                key={inv.id}
                className="p-4 rounded-xl bg-slate-900/90 border border-slate-700 space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-extrabold text-white text-sm">{inv.tenant_name || 'Merchant Shop'}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{inv.invoice_number}</p>
                    </div>
                    <span className="font-black text-indigo-400 text-sm">
                      ৳{Number(inv.amount).toLocaleString('bn-BD')}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-800 space-y-1 text-[11px]">
                    <p className="text-slate-300 flex justify-between">
                      <span className="text-slate-500">প্যাকেজ:</span>
                      <span className="font-bold text-white uppercase">{inv.plan} Plan</span>
                    </p>
                    <p className="text-slate-300 flex justify-between">
                      <span className="text-slate-500">মেথড / প্রেরক:</span>
                      <span className="font-mono font-bold text-amber-400">
                        {inv.payment_method} ({inv.sender_number || 'N/A'})
                      </span>
                    </p>
                    <p className="text-slate-300 flex justify-between">
                      <span className="text-slate-500">TrxID:</span>
                      <span className="font-mono font-black text-emerald-400 select-all">
                        {inv.transaction_id || 'N/A'}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex gap-2">
                  <button
                    onClick={() => handleInvoiceApproval(inv.id, 'approve')}
                    disabled={approvingInvId === inv.id}
                    className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{approvingInvId === inv.id ? 'এপ্রুভ হচ্ছে...' : 'এপ্রুভ ও অ্যাক্টিভ'}</span>
                  </button>

                  <button
                    onClick={() => handleInvoiceApproval(inv.id, 'reject')}
                    disabled={approvingInvId === inv.id}
                    className="px-3 py-2 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 font-bold text-xs border border-rose-500/30 transition-all"
                  >
                    রিজেক্ট
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Merchants Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-bold text-sm text-white flex items-center gap-2">
            <span>নিবন্ধিত মার্চেন্ট তালিকা</span>
            <span className="text-[11px] font-normal text-slate-400">
              ({totalCount} টি মোট রেকর্ড)
            </span>
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-bold uppercase tracking-wider">
                <th className="py-3.5 px-5">দোকান ও ইউজার</th>
                <th className="py-3.5 px-5">মোবাইল ও যোগাযোগ</th>
                <th className="py-3.5 px-5">প্ল্যান ও স্ট্যাটাস</th>
                <th className="py-3.5 px-5">ভ্যালিডেশন মেয়াদ</th>
                <th className="py-3.5 px-5">অর্ডার কোটা</th>
                <th className="py-3.5 px-5 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {tenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    কোনো রেকর্ড খুঁজে পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                tenants.map((t) => {
                  const validation = getValidationDetails(t);
                  const isMasterSuperAdmin = t.slug === 'platform-superadmin';
                  return (
                    <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                      
                      {/* Store & Owner */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white text-sm">{t.store_name}</p>
                          {isMasterSuperAdmin && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              Master
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-slate-400">
                            {t.owner_name || 'Owner'}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono bg-slate-950 px-1.5 py-0.2 rounded border border-slate-800">
                            {t.slug}
                          </span>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-3.5 px-5">
                        <p className="font-bold text-indigo-300 font-mono flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{t.owner_phone || t.store_phone || 'N/A'}</span>
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {t.owner_email || t.store_email || 'N/A'}
                        </p>
                      </td>

                      {/* Plan & Status */}
                      <td className="py-3.5 px-5">
                        <div className="flex flex-col gap-1">
                          <span className={`w-fit px-2 py-0.5 rounded font-black text-[10px] uppercase ${
                            t.plan === 'pro' 
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : t.plan === 'business'
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}>
                            {t.plan} প্ল্যান
                          </span>
                          {t.subscription_status === 'active' ? (
                            <span className="w-fit px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-[10px] flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Active Paid
                            </span>
                          ) : t.subscription_status === 'trialing' ? (
                            <span className="w-fit px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold text-[10px] flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              7-Day Trial
                            </span>
                          ) : t.subscription_status === 'past_due' ? (
                            <span className="w-fit px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 font-bold text-[10px]">
                              Past Due
                            </span>
                          ) : (
                            <span className="w-fit px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-[10px]">
                              Expired
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Expiry */}
                      <td className="py-3.5 px-5">
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{validation.date}</span>
                          </p>
                          <p className={`text-[11px] font-bold ${
                            validation.isExpired 
                              ? 'text-rose-400' 
                              : validation.days <= 5 
                              ? 'text-amber-400' 
                              : 'text-emerald-400'
                          }`}>
                            {validation.text}
                          </p>
                        </div>
                      </td>

                      {/* Quotas */}
                      <td className="py-3.5 px-5">
                        <p className="font-semibold text-white">
                          {t.order_quota_monthly === -1 ? 'Unlimited' : `${t.order_quota_monthly} Orders`}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          চ্যানেল: {t.max_channels} টি
                        </p>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleQuickAction('extend_days', t.id, { days: 30, targetField: 'current_period_ends_at' })}
                            className="px-2 py-1 rounded-lg text-[10px] font-bold bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                            title="+৩০ দিন মেয়াদ বাড়িয়ে পেইড করুন"
                          >
                            +৩০ দিন
                          </button>
                          <button
                            onClick={() => handleQuickAction('extend_days', t.id, { days: 7, targetField: 'trial_ends_at' })}
                            className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 transition-colors"
                            title="+৭ দিন ট্রায়াল বাড়ান"
                          >
                            +৭ দিন
                          </button>
                          <button
                            onClick={() => openManageModal(t)}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1"
                            title="বিস্তারিত সেটিংস এডিট করুন"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>ম্যানেজ</span>
                          </button>

                          {/* Delete Button */}
                          {!isMasterSuperAdmin && (
                            <button
                              onClick={() => setDeleteConfirmTenant(t)}
                              className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors border border-transparent hover:border-rose-500/30"
                              title="ইউজার ও মার্চেন্ট স্থায়ীভাবে ডিলিট করুন"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <PaginationControl
          currentPage={currentPage}
          pageSize={15}
          totalCount={totalCount}
          hasMore={hasMore}
          onNextPage={handleNextPage}
          onPrevPage={handlePrevPage}
          loading={isPaginating}
          itemLabel="মার্চেন্ট শপ"
          theme="dark"
        />
      </div>

      {/* Comprehensive Manage Modal */}
      {isModalOpen && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">মার্চেন্ট ভ্যালিডেশন ও ফিচার কন্ট্রোল</h3>
                  <p className="text-xs text-slate-400">
                    {selectedTenant.store_name} ({selectedTenant.owner_phone || selectedTenant.store_phone})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <div className="space-y-4 text-xs">
              
              {/* Row 1: Plan & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-300 mb-1.5">সাবস্ক্রিপশন প্ল্যান</label>
                  <select
                    value={editPlan}
                    onChange={(e: any) => setEditPlan(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="starter">Starter Plan</option>
                    <option value="pro">Pro Plan</option>
                    <option value="business">Business Plan</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1.5">সাবস্ক্রিপশন স্ট্যাটাস</label>
                  <select
                    value={editStatus}
                    onChange={(e: any) => setEditStatus(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="active">Active (সক্রিয়)</option>
                    <option value="trialing">Trialing (৭ দিন ফ্রি ট্রায়াল)</option>
                    <option value="past_due">Past Due (মেয়াদোত্তীর্ণ/বকেয়া)</option>
                    <option value="expired">Expired (বাতিল)</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Validation Date (Calendar Picker + Quick Presets) */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-purple-400" />
                    <span>ভ্যালিডেশন শেষ হওয়ার তারিখ (Expiry Date)</span>
                  </label>
                  <span className="text-[11px] text-slate-400">ক্যালেন্ডার থেকে নির্বাচন করুন</span>
                </div>

                <input
                  type="date"
                  value={editValidationDate}
                  onChange={(e) => setEditValidationDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono focus:outline-none focus:border-purple-500"
                />

                {/* Quick Presets */}
                <div>
                  <p className="text-[11px] text-slate-400 mb-1.5 font-medium">কুইক দিন যোগ করুন:</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => applyPresetDays(7)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition-colors"
                    >
                      +৭ দিন
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetDays(30)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 text-[11px] font-semibold transition-colors"
                    >
                      +৩০ দিন (১ মাস)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetDays(90)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[11px] font-semibold transition-colors"
                    >
                      +৯০ দিন (৩ মাস)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetDays(365)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[11px] font-semibold transition-colors"
                    >
                      +৩৬৫ দিন (১ বছর)
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 3: Quotas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-300 mb-1.5">
                    মাসিক অর্ডার লিমিট (-1 লিখলে Unlimited)
                  </label>
                  <input
                    type="number"
                    value={editOrderQuota}
                    onChange={(e) => setEditOrderQuota(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1.5">
                    সর্বোচ্চ সোশ্যাল চ্যানেল লিমিট
                  </label>
                  <input
                    type="number"
                    value={editMaxChannels}
                    onChange={(e) => setEditMaxChannels(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-800">
              {selectedTenant.slug !== 'platform-superadmin' ? (
                <button
                  type="button"
                  onClick={() => setDeleteConfirmTenant(selectedTenant)}
                  className="px-3 py-2 rounded-xl text-rose-400 hover:text-white hover:bg-rose-600/90 text-xs font-bold transition-colors flex items-center gap-1.5 border border-rose-500/20"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>মার্চেন্ট ডিলিট</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={handleSaveModal}
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-colors shadow-md flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>সেভ হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>পরিবর্তন সেভ করুন</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-rose-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 relative">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-white">মার্চেন্ট স্থায়ীভাবে মুছে ফেলবেন?</h3>
                <p className="text-[11px] text-rose-300 font-medium">স্থায়ী ডাটাবেজ ডিলিট অ্যাকশন</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
              <p className="text-slate-300">
                আপনি কি নিশ্চিতভাবে <span className="font-bold text-white">"{deleteConfirmTenant.store_name}"</span> এবং এর মালিক <span className="font-bold text-indigo-300">{deleteConfirmTenant.owner_name} ({deleteConfirmTenant.owner_phone})</span> কে মুছে ফেলতে চান?
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                ⚠️ এই মার্চেন্টের সমস্ত ইউজার একাউন্ট, ফেসবুক/হোয়াটসঅ্যাপ চ্যানেল, প্রোডাক্ট ও অর্ডার ডাটাবেজ থেকে চিরতরে মুছে যাবে। এই অ্যাকশন আনডু করা যাবে না।
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmTenant(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={handleDeleteTenant}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors shadow-lg shadow-rose-600/25 flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>মুছে ফেলা হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>হ্যাঁ, স্থায়ীভাবে ডিলিট করুন</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

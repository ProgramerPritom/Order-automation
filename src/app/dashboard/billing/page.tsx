'use client';

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Download,
  Clock,
  Zap,
  RefreshCw,
  FileText,
  Building2,
  ChevronRight,
  Store,
  Copy,
  Check,
  Send,
  HelpCircle,
  PhoneCall,
} from 'lucide-react';
import { toast } from 'sonner';

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  plan: string;
  status: 'paid' | 'unpaid' | 'pending_approval' | 'rejected' | 'failed';
  gateway: string;
  payment_method?: string;
  sender_number?: string;
  transaction_id?: string;
  rejection_reason?: string;
  period_start?: string;
  period_end?: string;
  due_date?: string;
  paid_at?: string;
  created_at: string;
}

interface SubscriptionInfo {
  isAllowed: boolean;
  status: 'trialing' | 'active' | 'past_due' | 'suspended' | 'expired';
  plan: 'starter' | 'pro' | 'business';
  daysRemaining: number;
  inGracePeriod?: boolean;
  graceDaysRemaining?: number;
  orderQuota: number;
  ordersUsed: number;
  maxChannels: number;
  message: string;
}

export default function BillingPage() {
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [userRole, setUserRole] = useState<string>('merchant');
  const [plans, setPlans] = useState<any>({
    starter: { priceBdt: 990, name: 'বেসিক প্ল্যান (Starter)', features: [] },
    pro: { priceBdt: 1990, name: 'প্রো প্ল্যান (Pro)', features: [] },
    business: { priceBdt: 3490, name: 'বিজনেস প্ল্যান (Business)', features: [] },
  });
  const [paymentAccounts, setPaymentAccounts] = useState<any>({
    bkash: { number: '01712-345678', type: 'Personal (Send Money)' },
    nagad: { number: '01812-345678', type: 'Personal (Send Money)' },
    rocket: { number: '01912-345678-9', type: 'Personal' },
    bank: { bankName: 'City Bank Ltd', accountNumber: '1102938475001' },
  });

  // Modal states
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<'starter' | 'pro' | 'business'>('pro');
  const [paymentMethod, setPaymentMethod] = useState<'bkash' | 'nagad' | 'rocket' | 'bank'>('bkash');
  const [senderNumber, setSenderNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [approvingInvoiceId, setApprovingInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/billing/invoices', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setSubscription(data.subscription);
        setInvoices(data.invoices || []);
        if (data.plans) setPlans(data.plans);
        if (data.paymentAccounts) setPaymentAccounts(data.paymentAccounts);
        if (data.userRole) setUserRole(data.userRole);
      } else {
        toast.error(data.error || 'বিলিং তথ্য লোড করতে সমস্যা হয়েছে');
      }
    } catch (e: any) {
      toast.error('নেটওয়ার্ক সমস্যার কারণে বিলিং লোড হয়নি');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`${text} কপি করা হয়েছে!`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const openPaymentModal = (plan: 'starter' | 'pro' | 'business') => {
    setSelectedPlanForPayment(plan);
    setSenderNumber('');
    setTransactionId('');
    setPaymentNotes('');
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderNumber.trim()) {
      toast.error('প্রেরক মোবাইল নম্বর প্রদান করুন');
      return;
    }
    if (!transactionId.trim()) {
      toast.error('ট্রানজ্যাকশন আইডি (TrxID) প্রদান করুন');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/billing/submit-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan: selectedPlanForPayment,
          paymentMethod,
          senderNumber,
          transactionId,
          notes: paymentNotes,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'পেমেন্ট রিকোয়েস্ট জমা হয়েছে!');
        setIsPaymentModalOpen(false);
        await fetchBillingData();
      } else {
        toast.error(data.error || 'পেমেন্ট সাবমিট করা যায়নি');
      }
    } catch (err: any) {
      toast.error(err.message || 'নেটওয়ার্ক এরর');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Super Admin: Instant Approve
  const handleAdminApprove = async (invoiceId: string) => {
    setApprovingInvoiceId(invoiceId);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/admin/invoices/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ invoiceId, action: 'approve' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message);
        await fetchBillingData();
      } else {
        toast.error(data.error || 'অনুমোদন ব্যর্থ হয়েছে');
      }
    } catch (e: any) {
      toast.error('অপ্রত্যাশিত ত্রুটি');
    } finally {
      setApprovingInvoiceId(null);
    }
  };

  const isSuperAdmin = userRole === 'superadmin';

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold mb-2">
            <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
            <span>SaaS অটোমেটেড রেভেনিউ ও সাবস্ক্রিপশন হাব</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            বিলিং, প্রাইসিং ও সাবস্ক্রিপশন
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            আপনার শপের লাইভ প্যাকেজ, ইনভয়েস হিস্টোরি এবং বিকাশ ও নগদ ভেরিফিকেশনের মাধ্যমে প্যাকেজ রিনিউ করুন।
          </p>
        </div>

        <button
          onClick={fetchBillingData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-sm transition-all self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          <span>রিফ্রেশ স্ট্যাটাস</span>
        </button>
      </div>

      {/* 1. Live Active Subscription Status Card */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 border border-slate-800 shadow-xl shadow-indigo-950/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-xs font-bold text-indigo-200">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>
                স্ট্যাটাস:{' '}
                {subscription?.status === 'active'
                  ? 'সক্রিয় পেইড প্ল্যান (Active)'
                  : subscription?.status === 'past_due'
                  ? '⚠️ গ্রেস পিরিয়ড চলছে (Past Due)'
                  : subscription?.status === 'suspended'
                  ? '⛔ সাময়িক স্থগিত (Suspended)'
                  : '৭ দিনের ফ্রি ট্রায়াল (Trial)'}
              </span>
            </div>

            <div>
              <h2 className="text-3xl font-black text-white capitalize tracking-tight flex items-center gap-3">
                <span>{subscription?.plan ? `${subscription.plan} Plan` : 'Pro Plan'}</span>
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {subscription?.orderQuota === -1 ? 'আনলিমিটেড অর্ডার' : `${subscription?.orderQuota || 500} অর্ডার/মাস`}
                </span>
              </h2>
              <p className="text-sm text-indigo-200 mt-1 max-w-xl">
                {subscription?.message || 'আপনার এআই সেলস ও অটোমেশন সার্ভিস সম্পূর্ণ সচল রয়েছে।'}
              </p>
            </div>

            {/* Quota & Usage Meter */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] uppercase font-bold text-slate-400">কানেক্টেড চ্যানেল</span>
                <p className="text-base font-black text-white mt-0.5">
                  সর্বোচ্চ {subscription?.maxChannels || 3}টি পেজ
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] uppercase font-bold text-slate-400">মাসিক অর্ডার কোটা</span>
                <p className="text-base font-black text-emerald-400 mt-0.5">
                  {subscription?.orderQuota === -1 ? 'আনলিমিটেড' : `${subscription?.ordersUsed || 0} / ${subscription?.orderQuota} টি`}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 col-span-2 sm:col-span-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">এআই রেসপন্স ইঞ্জিন</span>
                <p className="text-base font-black text-indigo-300 mt-0.5">২৪/৭ স্বয়ংক্রিয়</p>
              </div>
            </div>
          </div>

          {/* Remaining Days & Quick Renew Action */}
          <div className="lg:border-l lg:border-slate-800 lg:pl-8 flex flex-col justify-between space-y-4 shrink-0">
            <div>
              <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400">
                অবশিষ্ট মেয়াদ
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-5xl font-black text-amber-400 tracking-tight">
                  {subscription?.daysRemaining ?? 7}
                </span>
                <span className="text-base font-bold text-slate-300">দিন বাকি</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {subscription?.status === 'active' ? 'চলতি বিলিং সাইকেল সক্রিয়' : 'রিনিউ করতে নিচে প্যাকেজ পছন্দ করুন'}
              </p>
            </div>

            <button
              onClick={() => openPaymentModal(subscription?.plan || 'pro')}
              className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-black text-xs shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>প্যাকেজ রিনিউ বা আপগ্রেড করুন 💳</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. SaaS Pricing Plans Matrix (Matches Homepage Exact ৳990, ৳1990, ৳3490) */}
      <div>
        <div className="text-center max-w-2xl mx-auto mb-8">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            আপনার ব্যবসার জন্য সঠিক প্ল্যান বেছে নিন
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            হোমপেজের অফিসিয়াল প্যাকেজ অনুযায়ী বিকাশ, নগদ বা রকেটে পেমেন্ট করে সার্ভিস সচল রাখুন।
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Plan 1: Starter */}
          <div
            className={`rounded-3xl p-6 sm:p-7 border transition-all flex flex-col justify-between ${
              subscription?.plan === 'starter'
                ? 'border-indigo-600 bg-white ring-2 ring-indigo-600/20 shadow-xl'
                : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
            }`}
          >
            <div>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-black text-slate-900">বেসিক প্ল্যান (Starter)</h3>
                  <p className="text-xs text-slate-500 mt-0.5">নতুন শুরু করা একক ফেসবুক পেজের জন্য</p>
                </div>
                <span className="p-2 rounded-xl bg-slate-100 text-slate-600">
                  <Store className="w-5 h-5" />
                </span>
              </div>

              <div className="mt-5 pb-5 border-b border-slate-100">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-900">৳৯৯০</span>
                  <span className="text-xs font-bold text-slate-500">/প্রতি মাস</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">১টি ফেসবুক পেজ ও ৫০০ নিশ্চিত অর্ডার</p>
              </div>

              <ul className="mt-5 space-y-3 text-xs text-slate-700">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>১টি ফেসবুক পেজ কানেকশন</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>মাসে ৫০০টি পর্যন্ত নিশ্চিত অর্ডার গ্রহণ</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>২৪/৭ ইনস্ট্যান্ট অটো রিপ্লাই ও প্রডাক্ট শোকেস</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>সঠিক ফোন নম্বর (১১ ডিজিট) ও ঠিকানা যাচাই</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>ঢাকার ভেতরে ৮০ ও বাইরে ১৫০ টাকা চার্জ অটো যোগ</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>রিয়েল-টাইম অর্ডার ম্যানেজমেন্ট ড্যাশবোর্ড</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => openPaymentModal('starter')}
              className={`mt-6 w-full py-3 rounded-xl font-bold text-xs transition-all text-center ${
                subscription?.plan === 'starter'
                  ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-md'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
              }`}
            >
              {subscription?.plan === 'starter' ? 'বেসিক প্ল্যান রিনিউ করুন (৳৯৯০)' : 'বেসিক প্ল্যান কিনুন (৳৯৯০)'}
            </button>
          </div>

          {/* Plan 2: Pro (Featured) */}
          <div className="rounded-3xl p-6 sm:p-7 border-2 border-indigo-600 bg-gradient-to-b from-indigo-50/60 via-white to-white ring-4 ring-indigo-600/10 shadow-2xl flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-black px-4 py-1 rounded-bl-xl uppercase tracking-wider shadow-sm">
              👑 সবচেয়ে জনপ্রিয়
            </div>

            <div>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-black text-slate-900">প্রো প্ল্যান (Pro)</h3>
                  <p className="text-xs text-indigo-700 font-semibold mt-0.5">গ্রোয়িং শপের জন্য সম্পূর্ণ স্বয়ংক্রিয় এআই</p>
                </div>
                <span className="p-2 rounded-xl bg-indigo-100 text-indigo-600">
                  <Sparkles className="w-5 h-5" />
                </span>
              </div>

              <div className="mt-5 pb-5 border-b border-indigo-100">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-indigo-600">৳১,৯৯০</span>
                  <span className="text-xs font-bold text-slate-500">/প্রতি মাস</span>
                </div>
                <p className="text-[11px] text-indigo-950 font-bold mt-1">সব চ্যানেলে আনলিমিটেড মেসেজ ও অর্ডার</p>
              </div>

              <ul className="mt-5 space-y-3 text-xs text-slate-800">
                <li className="flex items-start gap-2.5 font-bold text-slate-900">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>ফেসবুক + হোয়াটসঅ্যাপ + ইনস্টাগ্রাম ৩টি চ্যানেল</span>
                </li>
                <li className="flex items-start gap-2.5 font-bold text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>আনলিমিটেড মেসেজ ও আনলিমিটেড অর্ডার (নো লিমিট)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>সাইজ (M, L, XL), কালার ও স্টক রিয়েল-টাইম যাচাই</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>১-ক্লিকে নিজে কথা বলার সুবিধা (হিউম্যান টেকওভার)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>দৈনিক ও মাসিক সেলস রিপোর্ট ডাউনলোড (Excel / CSV)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>২৪/৭ ভিআইপি প্রায়োরিটি সাপোর্ট</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => openPaymentModal('pro')}
              className="mt-6 w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-lg shadow-indigo-600/30 transition-all text-center"
            >
              {subscription?.plan === 'pro' ? 'প্রো প্ল্যান রিনিউ করুন (৳১,৯৯০)' : 'প্রো প্ল্যান অ্যাক্টিভ করুন (৳১,৯৯০)'}
            </button>
          </div>

          {/* Plan 3: Enterprise / Business */}
          <div
            className={`rounded-3xl p-6 sm:p-7 border transition-all flex flex-col justify-between ${
              subscription?.plan === 'business'
                ? 'border-indigo-600 bg-white ring-2 ring-indigo-600/20 shadow-xl'
                : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
            }`}
          >
            <div>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-black text-slate-900">বিজনেস প্ল্যান (Business)</h3>
                  <p className="text-xs text-slate-500 mt-0.5">বড় ব্র্যান্ড ও মাল্টিপল পেজ পরিচালনাকারী উদ্যোক্তা</p>
                </div>
                <span className="p-2 rounded-xl bg-slate-100 text-slate-600">
                  <Building2 className="w-5 h-5" />
                </span>
              </div>

              <div className="mt-5 pb-5 border-b border-slate-100">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-900">৳৩,৪৯০</span>
                  <span className="text-xs font-bold text-slate-500">/প্রতি মাস</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">সর্বোচ্চ ৫টি সোশ্যাল পেজ ও হোয়াটসঅ্যাপ কানেক্ট</p>
              </div>

              <ul className="mt-5 space-y-3 text-xs text-slate-700">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>সর্বোচ্চ ৫টি সোশ্যাল পেজ ও হোয়াটসঅ্যাপ কানেক্ট</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>আনলিমিটেড প্রোডাক্ট ক্যাটালগ ও আনলিমিটেড অর্ডার</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>কুরিয়ার অটো বুকিং রেডি (Steadfast ও Pathao)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>টিম মেম্বারদের জন্য আলাদা স্টাফ অ্যাকাউন্ট</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>কাস্টম ব্র্যান্ড টোন ও শপ পলিসি ইন্টিগ্রেশন</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>ডেডিকেটেড অ্যাকাউন্ট ম্যানেজার সাপোর্ট</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => openPaymentModal('business')}
              className={`mt-6 w-full py-3 rounded-xl font-bold text-xs transition-all text-center ${
                subscription?.plan === 'business'
                  ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-md'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
              }`}
            >
              {subscription?.plan === 'business' ? 'বিজনেস প্ল্যান রিনিউ করুন (৳৩,৪৯০)' : 'বিজনেস প্ল্যান কিনুন (৳৩,৪৯০)'}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Invoices & Billing History Table */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-indigo-600" />
              <span>পেমেন্ট রিকোয়েস্ট ও ইনভয়েস হিস্টোরি (Invoices)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              আপনার সাবমিট করা বিকাশ/নগদ TrxID, ভেরিফিকেশন স্ট্যাটাস ও অফিশিয়াল ইনভয়েস তালিকা
            </p>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-200 self-start sm:self-auto">
            মোট {invoices.length}টি ইনভয়েস
          </span>
        </div>

        {invoices.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p>এখনও কোনো পেমেন্ট রিকোয়েস্ট বা ইনভয়েস জমা হয়নি। ওপরের যেকোনো প্যাকেজ পছন্দ করে সাবমিট করুন।</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                  <th className="py-3 px-4">ইনভয়েস নং</th>
                  <th className="py-3 px-4">প্যাকেজ</th>
                  <th className="py-3 px-4">পরিমাণ</th>
                  <th className="py-3 px-4">মেথড / প্রেরক নম্বর</th>
                  <th className="py-3 px-4">TrxID</th>
                  <th className="py-3 px-4">স্ট্যাটাস</th>
                  <th className="py-3 px-4">তারিখ</th>
                  <th className="py-3 px-4 text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {inv.invoice_number}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-700 capitalize">
                      {inv.plan} Plan
                    </td>
                    <td className="py-3.5 px-4 font-black text-slate-900">
                      ৳{Number(inv.amount).toLocaleString('bn-BD')}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <span className="font-bold text-slate-800 uppercase">{inv.payment_method || 'MFS'}</span>
                      {inv.sender_number && (
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">{inv.sender_number}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                      {inv.transaction_id || 'N/A'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                          inv.status === 'paid'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : inv.status === 'pending_approval'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                            : inv.status === 'rejected'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-50 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {inv.status === 'paid'
                          ? '✅ অনুমোদিত ও পেইড'
                          : inv.status === 'pending_approval'
                          ? '⏳ ভেরিফিকেশন পেন্ডিং'
                          : inv.status === 'rejected'
                          ? '❌ প্রত্যাখ্যাত (Rejected)'
                          : 'অপেক্ষমাণ'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {new Date(inv.created_at).toLocaleDateString('bn-BD', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      {/* Super Admin Quick Approve */}
                      {isSuperAdmin && inv.status === 'pending_approval' && (
                        <button
                          onClick={() => handleAdminApprove(inv.id)}
                          disabled={approvingInvoiceId === inv.id}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] shadow-sm transition-colors"
                        >
                          {approvingInvoiceId === inv.id ? 'এপ্রুভ হচ্ছে...' : '👑 এপ্রুভ করুন'}
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-bold"
                      >
                        <span>রিসিট</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Manual Payment Verification Modal (bKash / Nagad / Rocket / Bank) */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                  ম্যানুয়াল পেমেন্ট ভেরিফিকেশন
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-0.5">
                  {plans[selectedPlanForPayment]?.nameBn || selectedPlanForPayment} সাবস্ক্রিপশন
                </h3>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            {/* Step 1: Receiver Numbers Box */}
            <div className="space-y-3">
              <label className="block text-xs font-black text-slate-800">
                ১. নিচের নম্বরে নির্ধারিত ৳{plans[selectedPlanForPayment]?.priceBdt?.toLocaleString('bn-BD')} টাকা সেন্ড মানি করুন:
              </label>

              {/* Method Selector Tabs */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('bkash')}
                  className={`py-2 px-3 rounded-xl font-black text-xs border transition-all flex items-center justify-center gap-1.5 ${
                    paymentMethod === 'bkash'
                      ? 'bg-pink-600 text-white border-pink-600 shadow-md shadow-pink-600/20'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>বিকাশ (bKash)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('nagad')}
                  className={`py-2 px-3 rounded-xl font-black text-xs border transition-all flex items-center justify-center gap-1.5 ${
                    paymentMethod === 'nagad'
                      ? 'bg-orange-600 text-white border-orange-600 shadow-md shadow-orange-600/20'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>নগদ (Nagad)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('rocket')}
                  className={`py-2 px-3 rounded-xl font-black text-xs border transition-all flex items-center justify-center gap-1.5 ${
                    paymentMethod === 'rocket'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/20'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>রকেট (Rocket)</span>
                </button>
              </div>

              {/* Account Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    {paymentMethod.toUpperCase()} অ্যাকাউন্ট নম্বর
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-emerald-400 font-bold text-[10px]">
                    {paymentAccounts[paymentMethod]?.type || 'Personal (Send Money)'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xl font-black tracking-wider text-amber-400">
                    {paymentAccounts[paymentMethod]?.number || '01712-345678'}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        paymentAccounts[paymentMethod]?.number || '01712345678',
                        paymentMethod
                      )
                    }
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center gap-1 text-xs font-bold transition-all"
                  >
                    {copiedKey === paymentMethod ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === paymentMethod ? 'কপি হয়েছে' : 'কপি করুন'}</span>
                  </button>
                </div>

                <p className="text-[11px] text-indigo-200 pt-1 border-t border-white/10">
                  💡 {paymentAccounts[paymentMethod]?.instructions || 'টাকা পাঠানোর পর প্রাপ্ত ট্রানজ্যাকশন আইডি (TrxID) নিচের বক্সে দিন।'}
                </p>
              </div>
            </div>

            {/* Step 2: Form for Sender Number & TrxID */}
            <form onSubmit={handlePaymentSubmit} className="space-y-4 text-xs">
              <label className="block text-xs font-black text-slate-800">
                ২. টাকা পাঠানোর তথ্য পূরণ করুন:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    প্রেরক মোবাইল নম্বর (Sender Number) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: 01712345678"
                    value={senderNumber}
                    onChange={(e) => setSenderNumber(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">যে নম্বর থেকে টাকা পাঠিয়েছেন</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    ট্রানজ্যাকশন আইডি (TrxID) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: BLA892K109"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono font-black text-slate-900 uppercase focus:outline-none focus:border-indigo-600"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">মেসেজে আসা ৮-১০ অক্ষরের TrxID</p>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  পরিশোধিত টাকার পরিমাণ (Amount BDT)
                </label>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-black text-slate-900 flex justify-between items-center">
                  <span>৳{plans[selectedPlanForPayment]?.priceBdt?.toLocaleString('bn-BD')} টাকা (৩০ দিনের জন্য)</span>
                  <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-bold">
                    সঠিক মূল্য
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  অতিরিক্ত নোট / রেফারেন্স (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  placeholder="যেমন: শপের নাম বা রেফারেন্স"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  বাতিল
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 flex items-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmittingPayment ? 'সাবমিট হচ্ছে...' : 'পেমেন্ট তথ্য নিশ্চিত করুন'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Invoice Receipt Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                  ShopPilot.ai Official Receipt
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-0.5">
                  ইনভয়েস #{selectedInvoice.invoice_number}
                </h3>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">প্যাকেজ</span>
                  <p className="font-extrabold text-slate-900 mt-0.5 capitalize">{selectedInvoice.plan} Plan</p>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">পেমেন্ট অবস্থা</span>
                  <p className="font-extrabold text-indigo-600 mt-0.5 capitalize">{selectedInvoice.status}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">মেথড / প্রেরক</span>
                  <p className="font-bold text-slate-800 mt-0.5">{selectedInvoice.payment_method || 'MFS'} ({selectedInvoice.sender_number || 'N/A'})</p>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">ট্রানজ্যাকশন আইডি</span>
                  <p className="font-mono font-bold text-slate-800 mt-0.5">{selectedInvoice.transaction_id || 'N/A'}</p>
                </div>
              </div>

              <div className="flex justify-between items-center py-2 border-t border-b border-slate-100 font-bold">
                <span className="text-slate-600">মোট পরিশোধিত পরিমাণ (BDT):</span>
                <span className="text-lg font-black text-slate-900">৳{Number(selectedInvoice.amount).toLocaleString('bn-BD')}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>প্রিন্ট / ডাউনলোড</span>
              </button>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

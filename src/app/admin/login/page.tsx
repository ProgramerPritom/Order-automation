'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  Lock,
  Phone,
  ArrowRight,
  AlertCircle,
  KeyRound,
  Store,
} from 'lucide-react';
import { saveSession } from '@/lib/session';

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/admin';

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'এডমিন লগইন ব্যর্থ হয়েছে');
      }

      // Persist across localStorage, sessionStorage, and browser cookies
      if (data.accessToken) {
        saveSession(data.accessToken, data.user, data.tenant);
      }

      setSuccess('সুপার এডমিন ভেরিফিকেশন সফল! মাস্টার প্যানেলে প্রবেশ করা হচ্ছে...');

      setTimeout(() => {
        window.location.href = redirectPath;
      }, 400);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-gradient-to-tr from-purple-600/20 to-indigo-600/10 blur-[130px] pointer-events-none rounded-full" />

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-xl shadow-purple-600/30 mb-4 ring-4 ring-purple-500/20">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-xs font-black uppercase tracking-widest text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/30">
            Master Control Portal
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          ShopPilot <span className="text-purple-400">Super Admin</span>
        </h1>
        <p className="mt-2 text-xs text-slate-400 max-w-sm mx-auto">
          সেন্ট্রাল ডাটাবেজ, মার্চেন্ট সাবস্ক্রিপশন ও প্ল্যাটফর্ম এনালাইসিস সিস্টেম
        </p>
      </div>

      {/* Form Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0 relative z-10">
        <div className="bg-slate-900/95 backdrop-blur-xl py-8 px-6 sm:px-10 shadow-2xl rounded-3xl border border-slate-800 ring-1 ring-white/5">

          {/* Security Notice */}
          <div className="mb-6 p-3 rounded-xl bg-purple-950/40 border border-purple-800/40 text-[11px] text-purple-300 flex items-center gap-2 font-medium">
            <Lock className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span>এই পোর্টালটি শুধুমাত্র অনুমোদিত সিস্টেম সুপার এডমিনদের জন্য নির্ধারিত।</span>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-300 flex items-start gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span className="font-semibold leading-relaxed">{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-xs text-emerald-300 flex items-center gap-2.5 font-bold animate-pulse">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">

            {/* Phone/Email Field */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                এডমিন মোবাইল নম্বর অথবা ইমেইল
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="যেমন: 0176******"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                মাস্টার পাসওয়ার্ড
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !!success}
              className="w-full mt-2 py-3.5 px-4 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-600/25 active:scale-[0.99] transition-all disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>তথ্য যাচাই করা হচ্ছে...</span>
                </div>
              ) : success ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>প্যানেলে প্রবেশ করা হচ্ছে...</span>
                </div>
              ) : (
                <>
                  <span>সুপার এডমিন লগইন করুন</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Navigation to Standard User Login */}
          <div className="mt-6 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
            <span>সাধারণ মার্চেন্ট অ্যাকাউন্ট?</span>
            <Link
              href="/login"
              className="font-bold text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 transition-colors"
            >
              <Store className="w-3.5 h-3.5" />
              <span>মার্চেন্ট লগইনে যান</span>
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}

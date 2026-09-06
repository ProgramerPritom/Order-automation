'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles, ShieldCheck, Zap, ArrowRight, MessageSquare, CheckCircle2, Clock } from 'lucide-react';

export default function Hero() {
  return (
    <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-32">
      {/* Soft Ambient Background Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[520px] bg-gradient-to-tr from-indigo-300/30 via-cyan-200/25 to-purple-300/30 blur-3xl -z-10 pointer-events-none rounded-full animate-pulse-slow" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        
        {/* Top Benefit Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 backdrop-blur-md border border-indigo-200/80 shadow-sm text-xs font-semibold text-slate-800 mb-8 hover:bg-white transition-all cursor-default">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="font-bold text-indigo-700 uppercase tracking-wider text-[11px]">স্মার্ট সেলস অ্যাসিস্ট্যান্ট:</span>
          <span className="text-slate-600">রাত ৩টা হোক বা দিন ১২টা — ১ সেকেন্ডেই রিপ্লাই ও অর্ডার রিসিভ</span>
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
        </div>

        {/* Catchy & High-Converting Primary Headline */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-normal max-w-5xl mx-auto leading-[1.3] lg:leading-[1.26]">
          কাস্টমার নক করলেই ১ সেকেন্ডে অর্ডার কনফার্ম — <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 bg-clip-text text-transparent inline-block pb-1">
            আপনি যখন গভীর ঘুমে, আপনার পেজে তখন নন-স্টপ সেলস!
          </span>
        </h1>

        {/* Business-Centric Subtitle (No Tech Jargon) */}
        <p className="mt-6 text-base sm:text-lg lg:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed font-normal">
          ফেসবুক ও হোয়াটসঅ্যাপে ইনবক্স সামলানোর দুশ্চিন্তা চিরতরে শেষ। পণ্যের ছবি ও দাম দেখানো থেকে শুরু করে সাইজ-কালার মিলিয়ে নাম, ঠিকানা ও সঠিক মোবাইল নম্বর সংগ্রহ করে ডেলিভারি-রেডি অর্ডার নেওয়া—সবকিছু করবে আপনার ব্যক্তিগত এআই সেলস ম্যানেজার।
        </p>

        {/* Action CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-2xl mx-auto">
          <Link
            href="/register"
            className="w-full sm:w-auto inline-flex items-center justify-center whitespace-nowrap min-w-[240px] px-8 py-4 rounded-2xl font-bold text-base text-white bg-gradient-to-r from-indigo-600 via-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 shadow-xl shadow-indigo-600/25 hover:shadow-indigo-600/35 hover:-translate-y-0.5 transition-all group"
          >
            <span>৭ দিনের ফ্রি ট্রায়াল শুরু করুন</span>
            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Link>

          <a
            href="#live-demo"
            className="w-full sm:w-auto inline-flex items-center justify-center whitespace-nowrap min-w-[210px] px-8 py-4 rounded-2xl font-bold text-base text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 shadow-sm hover:shadow hover:-translate-y-0.5 transition-all"
          >
            <MessageSquare className="w-5 h-5 mr-2.5 text-indigo-600" />
            <span>১ মিনিটে লাইভ ডেমো দেখুন</span>
          </a>
        </div>

        {/* Trust Badges - Non-Technical */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs font-semibold text-slate-500">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>কোনো ক্রেডিট কার্ড লাগবে না</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>১ ক্লিকে ফেসবুক ও হোয়াটসঅ্যাপ কানেক্ট</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <span>১ সেকেন্ডে ইনস্ট্যান্ট কাস্টমার রিপ্লাই</span>
          </div>
        </div>

        {/* Live Counters Banner */}
        <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto p-4 rounded-3xl bg-white/90 backdrop-blur-md border border-slate-200/80 shadow-lg shadow-slate-200/40">
          <div className="p-3.5">
            <p className="text-2xl sm:text-3xl font-black text-indigo-600 tracking-tight">৳৪.৫ কোটি+</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">অটোমেটেড সেলস প্রসেসড</p>
          </div>
          <div className="p-3.5 border-l border-slate-100">
            <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">&lt; ১ সেকেন্ড</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">গড় রেসপন্স টাইম</p>
          </div>
          <div className="p-3.5 border-l border-slate-100">
            <p className="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tight">১০০%</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">সঠিক বাংলাদেশি ফোন নম্বর</p>
          </div>
          <div className="p-3.5 border-l border-slate-100">
            <p className="text-2xl sm:text-3xl font-black text-purple-600 tracking-tight">২৪ / ৭</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">দিন-রাত নিরবচ্ছিন্ন সক্রিয়</p>
          </div>
        </div>

      </div>
    </section>
  );
}

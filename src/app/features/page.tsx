'use client';

import React from 'react';
import Link from 'next/link';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import {
  Sparkles,
  Bot,
  ShoppingBag,
  ShieldCheck,
  TrendingUp,
  Mic,
  Image as ImageIcon,
  MessageSquare,
  Truck,
  Flame,
  UserCheck,
  Brain,
  Users,
  CheckCircle2,
  ArrowRight,
  Zap,
} from 'lucide-react';

export default function FeaturesPage() {
  const allFeatures = [
    {
      icon: <Bot className="w-6 h-6 text-indigo-600" />,
      badge: '২৪/৭ সক্রিয়',
      title: 'মানুষের মতো বাংলা ও বাংলিশ অটো-রিপ্লাই',
      desc: 'কাস্টমার যেভাবে প্রশ্ন করুক — শুদ্ধ বাংলা, বাংলিশ বা আঞ্চলিক ভাষা — এআই ঠিক মানুষের মতো সম্মান দিয়ে বাস্তবসম্মত উত্তর দেবে। দিন হোক বা রাত ৩টা, একটা মেসেজও আনরিড থাকবে না।',
      benefit: 'রেসপন্স রেট ১০০% • নো কাস্টমার ড্রপ',
    },
    {
      icon: <ShoppingBag className="w-6 h-6 text-indigo-600" />,
      badge: 'স্বয়ংক্রিয় সেলস',
      title: 'নিজে থেকেই অর্ডার তৈরি ও ঠিকানা সংগ্রহ',
      desc: 'কাস্টমার মেসেঞ্জারে পছন্দ জানালেই এআই সাইজ, কালার, পূর্ণ ডেলিভারি ঠিকানা ও মোবাইল নম্বর চেয়ে নিয়ে স্বয়ংক্রিয়ভাবে নির্ভুল অর্ডার তৈরি করে ডাটাবেজে এন্ট্রি করে ফেলে।',
      benefit: 'অর্ডার মিস হওয়ার সুযোগ শূন্য',
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-rose-600" />,
      badge: 'টাকা বাঁচান',
      title: 'কুরিয়ার ফ্রড ও ফেক অর্ডার প্রতিরোধ',
      desc: 'পাঠাও ও স্টেডফাস্টের পূর্বের ডেলিভারি পার্সেন্টেজ চেক করে ঝুঁকিপূর্ণ বা ফেক কাস্টমার শনাক্ত করে। রিটার্ন হিস্ট্রি খারাপ হলে অর্ডার পাঠানোর আগেই এআই বিকাশ ডেলিভারি চার্জ অগ্রিম চেয়ে নেয়।',
      benefit: 'কুরিয়ার রিটার্ন লস ৮০% কমে',
    },
    {
      icon: <TrendingUp className="w-6 h-6 text-emerald-600" />,
      badge: 'বাস্তব লাভ',
      title: 'ডেলিভারড অর্ডারে আসল নিট লাভের হিসাব',
      desc: 'শুধু মোট বিক্রির ফিগার দেখে লাভ বোঝা যায় না। KothaShop প্রতিটি সফল ডেলিভারির পর পণ্যের কেনা দাম ও কুরিয়ার ফি বাদ দিয়ে আপনার পকেটে আসল লাভ কত থাকল তা পরিষ্কার দেখায়।',
      benefit: 'রিয়েলটাইম ফাইন্যান্সিয়াল স্বচ্ছতা',
    },
    {
      icon: <Mic className="w-6 h-6 text-amber-600" />,
      badge: 'মাল্টিমোডাল এআই',
      title: 'ছবি ও বাংলা অডিও ভয়েস নোট ট্রান্সক্রিপশন',
      desc: 'কাস্টমার টাইপ না করে মুখে বলে অডিও পাঠালে এআই তা নিখুঁত বাংলায় ট্রান্সক্রাইব করে অর্ডার নেয়। এছাড়া জামা বা পণ্যের ছবি আপলোড করলে ভিশন এআই ছবি চিনে দাম ও স্টক জানিয়ে দেয়।',
      benefit: 'টাইপ না করা ৬০% অডিও কাস্টমার কনভার্ট হয়',
    },
    {
      icon: <Zap className="w-6 h-6 text-indigo-600" />,
      badge: 'স্মার্ট নেগোসিয়েশন',
      title: 'স্মার্ট দামাদামি ও দরাদরি (Smart Bargaining)',
      desc: 'কাস্টমার দাম কমাতে চাইলে এআই কখনোই সরাসরি না বলে না, বরং আপনার বেঁধে দেওয়া নির্দিষ্ট মার্জিনের মধ্যে ভদ্রভাবে ২০-৫০ টাকা ছাড় দিয়ে সেল নিশ্চিত করে।',
      benefit: 'দামাদামির কারণে কাস্টমার অন্য পেজে যায় না',
    },
    {
      icon: <MessageSquare className="w-6 h-6 text-blue-600" />,
      badge: 'ওমনিচ্যানেল',
      title: 'সব সোশ্যাল পেজ এক ইনবক্সে (Unified Inbox)',
      desc: 'একাধিক ফেসবুক পেজ, ইনস্টাগ্রাম ডিএম ও হোয়াটসঅ্যাপ অ্যাকাউন্ট একই মেসেঞ্জার-স্টাইল ইনবক্সে ম্যানেজ করুন। চাইলে যেকোনো সময় এআই অফ করে নিজে চ্যাটে টেকওভার করতে পারবেন।',
      benefit: 'বারবার পেজ সুইচ করার ঝামেলা নেই',
    },
    {
      icon: <Truck className="w-6 h-6 text-indigo-600" />,
      badge: '১-ক্লিক শিপিং',
      title: 'পাঠাও ও স্টেডফাস্ট কুরিয়ার সিঙ্ক ও লেবেল প্রিন্ট',
      desc: 'অর্ডার কনফার্ম হওয়ামাত্র ১-ক্লিকে পাঠাও বা স্টেডফাস্টে পার্সেল বুকিং হয়ে যায়। সাথে সাথে ট্র্যাকিং আইডি জেনারেট হয় এবং পার্সেলের সাথে লাগানোর বারকোডযুক্ত মেমো প্রিন্ট করা যায়।',
      benefit: 'ম্যানুয়াল বুকিংয়ের সময় বাঁচে ৯০%',
    },
    {
      icon: <Flame className="w-6 h-6 text-rose-600" />,
      badge: 'অ্যাড অপটিমাইজেশন',
      title: 'মেটা কনভার্শন এপিআই (Meta CAPI Fire)',
      desc: 'প্রতিটি সফল অর্ডার হওয়ামাত্র মেটা কনভার্শন এপিআই-তে ইভেন্ট পুশ হয়। ফলে ফেসবুক অ্যাড অ্যালগরিদম ঠিক বুঝতে পারে কোন অডিয়েন্স আসল ক্রেতা এবং বিজ্ঞাপনের আরও বেশি আরওআই (ROAS) পাওয়া যায়।',
      benefit: 'বিজ্ঞাপনের খরচ কমে, সেলস দ্বিগুণ হয়',
    },
    {
      icon: <UserCheck className="w-6 h-6 text-teal-600" />,
      badge: 'কাস্টমার রিটেনশন',
      title: 'কাস্টমার হিস্ট্রি ও মেমোরি সংরক্ষণ',
      desc: 'একজন কাস্টমার অতীতে কী কিনেছিল এবং কী অপছন্দ করেছিল এআই তা মনে রাখে। পরেরবার সে নক দিলেই তাকে ভিআইপি সম্মান দিয়ে আগের হিস্ট্রি অনুযায়ী ব্যক্তিগত পরামর্শ দেয়।',
      benefit: 'রিপিট কাস্টমার সংখ্যা বাড়ে',
    },
    {
      icon: <Brain className="w-6 h-6 text-indigo-600" />,
      badge: 'কাস্টম আরএজি',
      title: 'শপ প্রোফাইল ও বিস্তারিত নলেজ বেস (RAG Engine)',
      desc: 'আপনার শপের নিজস্ব নিয়মকানুন, রিটার্ন পলিসি, ডেলিভারি চার্জের নিয়ম ও শপের ইতিহাস একবার লিখে রাখুন — এআই কোনো তথ্য বানিয়ে বলবে না, শুধু আপনার দেওয়া নীতি অনুযায়ীই কথা বলবে।',
      benefit: '১০০% বিশ্বস্ত ও নির্ভুল তথ্য প্রদান',
    },
    {
      icon: <Users className="w-6 h-6 text-slate-700" />,
      badge: 'টিম ম্যানেজমেন্ট',
      title: 'টিম ও রোল পারমিশন কন্ট্রোল',
      desc: 'আপনার দোকানের কর্মচারীদের স্টাফ আইডি দিয়ে যুক্ত করুন। কে শুধু অর্ডার প্যাক করবে, কে কাস্টমার চ্যাট দেখবে এবং কে অ্যাডমিন থাকবে তা সম্পূর্ণ আপনার নিয়ন্ত্রণে থাকবে।',
      benefit: 'ব্যবসার গোপন তথ্য সুরক্ষিত থাকে',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <Navbar />

      <main className="py-16 sm:py-24">
        
        {/* Page Hero Header */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold mb-5">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>KothaShop.ai পূর্ণাঙ্গ ফিচার তালিকা</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            একটা এআই সেলস এজেন্ট, <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-indigo-600 to-cyan-500 bg-clip-text text-transparent">
              আপনার পুরো সোশ্যাল শপ সামলায়
            </span>
          </h1>
          <p className="mt-4 text-sm sm:text-base text-slate-600 max-w-3xl mx-auto leading-relaxed">
            KothaShop শুধু সাধারণ রোবট নয় — মেসেঞ্জারে মানুষের মতো কথা বলে, ছবি ও অডিও বোঝে, নিজে অর্ডার নেয়, কুরিয়ার ফ্রড চেক করে এবং প্রতিটি অর্ডারের লাভ-লোকসান হিসাব রাখে।
          </p>
        </div>

        {/* 12 Features Bento Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {allFeatures.map((feat, idx) => (
              <div
                key={idx}
                className="p-8 rounded-3xl bg-white border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                      {feat.icon}
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      {feat.badge}
                    </span>
                  </div>

                  <h3 className="text-base font-extrabold text-slate-900 mb-2.5 leading-snug">
                    {feat.title}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {feat.desc}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-bold text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{feat.benefit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-20">
          <div className="p-10 rounded-3xl bg-slate-900 text-white text-center relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/20 blur-[100px] rounded-full pointer-events-none" />
            <h2 className="text-2xl sm:text-3xl font-black mb-3">
              আপনার ফেসবুক পেজে আজই এআই সহকারী চালু করবেন?
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto mb-8 leading-relaxed">
              ৭ দিনের ফ্রি ট্রায়াল নিন। কোনো কার্ড লাগবে না। মাত্র ৩ মিনিটেই আপনার ফেসবুক পেজের সাথে যুক্ত হয়ে অটোমেটেড সেলস শুরু হবে।
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
              >
                <span>ফ্রি ট্রায়াল শুরু করুন</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition-colors"
              >
                লগইন করুন
              </Link>
            </div>
          </div>
        </div>

      </main>

      <Footer />
    </div>
  );
}

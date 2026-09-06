'use client';

import React from 'react';
import { Database, Zap, Share2, UserCheck, Truck, Sparkles, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function FeaturesBento() {
  const features = [
    {
      icon: <Database className="w-6 h-6 text-indigo-600" />,
      title: 'সঠিক স্টক ও সাইজ যাচাই',
      badge: '১০০% বিশ্বস্ত তথ্য',
      desc: 'এআই কখনো মনগড়া দাম বা সাইজ বলবে না। আপনার পেজের বর্তমান স্টক দেখে সঠিক দাম ও সাইজ (M, L, XL) জানিয়ে অর্ডার গ্রহণ করবে।',
      cols: 'col-span-1 md:col-span-2 lg:col-span-2',
    },
    {
      icon: <Share2 className="w-6 h-6 text-cyan-600" />,
      title: 'ফেসবুক ও হোয়াটসঅ্যাপ এক সাথে',
      badge: 'সব মেসেজ এক জায়গায়',
      desc: 'ফেসবুক মেসেঞ্জার, ইনস্টাগ্রাম এবং হোয়াটসঅ্যাপ সব ইনবক্স একই ড্যাশবোর্ড থেকে সহজে পরিচালনা করুন।',
      cols: 'col-span-1 md:col-span-1 lg:col-span-1',
    },
    {
      icon: <CheckCircle2 className="w-6 h-6 text-emerald-600" />,
      title: 'স্বয়ংক্রিয় ডেলিভারি স্লিপ তৈরি',
      badge: 'অটোমেটেড ইনভয়েস',
      desc: 'কাস্টমার মেসেজ দিলেই নাম, সঠিক মোবাইল নম্বর এবং সম্পূর্ণ ঠিকানা যাচাই করে রেডিমেড ডেলিভারি শিট তৈরি হয়ে যায়।',
      cols: 'col-span-1 md:col-span-1 lg:col-span-1',
    },
    {
      icon: <UserCheck className="w-6 h-6 text-amber-600" />,
      title: '১-ক্লিকে নিজে কথা বলুন',
      badge: 'সহজ কন্ট্রোল',
      desc: 'কোনো গ্রাহকের সাথে আপনি নিজে কথা বলতে চাইলে ১ ক্লিকে এআই সাময়িক বন্ধ করতে পারবেন। কথা শেষ হলে আবার চালু করে দিন।',
      cols: 'col-span-1 md:col-span-2 lg:col-span-2',
    },
    {
      icon: <Zap className="w-6 h-6 text-purple-600" />,
      title: '১ সেকেন্ডে ইনস্ট্যান্ট রিপ্লাই',
      badge: 'সেলস লস বন্ধ',
      desc: 'কাস্টমার নক করার সাথে সাথেই চোখের পলকে উত্তর পেয়ে যায়। দ্রুত উত্তরের কারণে অর্ডার পাওয়ার সম্ভাবনা ৩ গুণ বেড়ে যায়।',
      cols: 'col-span-1 md:col-span-2 lg:col-span-2',
    },
    {
      icon: <Truck className="w-6 h-6 text-rose-600" />,
      title: 'ডেলিভারি চার্জ অটোমেটিক যোগ',
      badge: 'কুরিয়ার ফ্রেন্ডলি',
      desc: 'ঢাকার ভেতরে ৮০ টাকা এবং ঢাকার বাইরে ১৫০ টাকা ডেলিভারি ফি স্বয়ংক্রিয়ভাবে মোট বিলের সাথে যোগ হয়ে যায়।',
      cols: 'col-span-1 md:col-span-1 lg:col-span-1',
    },
  ];

  return (
    <section id="features" className="py-24 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>কেন উদ্যোক্তারা এটি বেছে নিচ্ছেন?</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-normal leading-[1.3] sm:leading-[1.28]">
            সাধারণ চ্যাটবট নয়, এটি আপনার <br className="hidden sm:inline" />
            <span className="text-indigo-600 inline-block">সবচেয়ে দক্ষ সেলস এক্সিকিউটিভ</span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
            অনলাইন শপ ও পেজ ওনারদের আসল সমস্যাগুলো দূর করে বিক্রয় দ্বিগুণ করতে প্রতিটি ফিচার তৈরি করা।
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((item, idx) => (
            <div
              key={idx}
              className={`${item.cols} p-8 rounded-3xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 hover:border-indigo-300 transition-all shadow-sm hover:shadow-md group flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-200 flex items-center justify-center group-hover:scale-110 transition-transform">
                    {item.icon}
                  </div>
                  <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-white text-slate-700 border border-slate-200 shadow-2xs">
                    {item.badge}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2.5 group-hover:text-indigo-600 transition-colors">
                  {item.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed font-normal">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}

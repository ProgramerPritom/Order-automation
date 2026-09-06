'use client';

import React from 'react';
import Link from 'next/link';
import {
  Share2,
  Package,
  Rocket,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

export default function ThreeStepSetup() {
  const steps = [
    {
      step: '০১',
      title: 'Facebook Page যুক্ত করুন',
      desc: 'এক ক্লিকে আপনার ফেসবুক পেইজ ও হোয়াটসঅ্যাপ যুক্ত করুন — সম্পূর্ণ নিরাপদ মেটা অফিসিয়াল সংযোগ।',
      icon: <Share2 className="w-6 h-6 text-indigo-600" />,
      badge: '১ মিনিট',
    },
    {
      step: '০২',
      title: 'পণ্য ও ডেলিভারি তথ্য দিন',
      desc: 'পণ্যের নাম, দাম ও ডেলিভারি চার্জ লিখে রাখুন — এআই স্বয়ংক্রিয়ভাবে তথ্য শিখে উত্তর দিতে শুরু করবে।',
      icon: <Package className="w-6 h-6 text-indigo-600" />,
      badge: '২ মিনিট',
    },
    {
      step: '০৩',
      title: 'অটোমেশন চালু — বিক্রি শুরু!',
      desc: 'এখন থেকে প্রতিটি মেসেজে ২৪/৭ সেকেন্ডে রিপ্লাই, নির্ভুল অর্ডার তৈরি ও পাঠাও/স্টেডফাস্ট কুরিয়ারে বুকিং।',
      icon: <Rocket className="w-6 h-6 text-emerald-600" />,
      badge: 'লাইভ',
    },
  ];

  return (
    <section className="py-20 bg-white relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold mb-4">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>সহজ সেটআপ • কোডিং প্রয়োজন নেই</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            ৩ ধাপে চালু — মিনিটেই ⚡
          </h2>
          <p className="mt-3 text-sm text-slate-500">
            কোনো জটিল ওয়েবসাইট ছাড়াই আপনার বিদ্যমান ফেসবুক পেজ দিয়েই আজই সেলস অটোমেশন চালু করুন।
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {steps.map((item, idx) => (
            <div
              key={idx}
              className="p-8 rounded-3xl bg-slate-50 border border-slate-200/80 relative flex flex-col justify-between hover:shadow-lg hover:border-indigo-200 transition-all group"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                    {item.icon}
                  </div>
                  <span className="text-2xl font-black text-slate-300 group-hover:text-indigo-600 transition-colors">
                    {item.step}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {item.desc}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200/60 flex items-center justify-between text-xs font-bold text-indigo-600">
                <span>সময় লাগবে: {item.badge}</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
            </div>
          ))}
        </div>

        {/* Call to action bar */}
        <div className="mt-14 p-8 rounded-3xl bg-gradient-to-r from-indigo-900 to-indigo-800 text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
          <div>
            <h3 className="text-xl font-bold">আজই ৭ দিন সম্পূর্ণ বিনামূল্যে চালিয়ে দেখুন</h3>
            <p className="text-xs text-indigo-200 mt-1">কোনো ক্রেডিট কার্ডের প্রয়োজন নেই • মিনিটেই রেডি</p>
          </div>
          <Link
            href="/register"
            className="px-6 py-3 rounded-2xl bg-white text-indigo-900 font-extrabold text-xs shadow-lg hover:bg-slate-100 transition-colors flex items-center gap-2 shrink-0"
          >
            <span>ফ্রি ট্রায়াল শুরু করুন</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

      </div>
    </section>
  );
}

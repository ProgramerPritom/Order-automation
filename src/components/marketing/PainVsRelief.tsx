'use client';

import React from 'react';
import {
  XCircle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Mic,
  TrendingDown,
  Sparkles,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

export default function PainVsRelief() {
  const comparisons = [
    {
      painIcon: <Clock className="w-5 h-5 text-rose-500" />,
      painTitle: 'রাত ২টায় ৫০টা মেসেজ জমে থাকে',
      painDesc: 'সকালে ঘুম থেকে উঠে উত্তর দেওয়ার আগেই কাস্টমার অন্য পেজ থেকে অর্ডার করে চলে যায়।',
      reliefIcon: <Sparkles className="w-5 h-5 text-emerald-500" />,
      reliefTitle: '২৪/৭ মুহূর্তের মধ্যে মানুষের মতো উত্তর',
      reliefDesc: 'দিন হোক বা রাত ২টা — প্রতিটি কাস্টমার সাথে সাথে রেসপন্স পায়। একটাও মেসেজ আনরিড থাকে না।',
    },
    {
      painIcon: <ShieldAlert className="w-5 h-5 text-rose-500" />,
      painTitle: 'ফেক অর্ডার ও কুরিয়ার রিটার্নে টাকা লস',
      painDesc: 'ভুয়া ঠিকানায় পার্সেল পাঠিয়ে ডেলিভারি রিটার্ন চার্জ ১৫০-২০০ টাকা পকেট থেকে লস হয়।',
      reliefIcon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
      reliefTitle: 'শিপের আগেই কুরিয়ার ফ্রড ও ট্রাস্ট চেক',
      reliefDesc: 'পাঠাও ও স্টেডফাস্ট হিস্ট্রি দেখে ঝুঁকিপূর্ণ কাস্টমার চিনে ফেলে — হাই-রিস্ক হলে বিকাশ অ্যাডভান্স চায়।',
    },
    {
      painIcon: <Mic className="w-5 h-5 text-rose-500" />,
      painTitle: 'কাস্টমার ছবি বা অডিও পাঠায় — হাতে টাইপ করতে করতে দিন শেষ',
      painDesc: 'একজন কাস্টমারের ভয়েস নোট শুনতে আর ছবির জামা খুঁজে বের করতেই ঘণ্টার পর ঘণ্টা নষ্ট।',
      reliefIcon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
      reliefTitle: 'ছবি ও বাংলা ভয়েস নোট স্বয়ংক্রিয়ভাবে বোঝে',
      reliefDesc: 'কাস্টমার পণ্যের ছবি দিলে ক্যাটালগ দেখে দাম বলে, আর অডিও ভয়েস পাঠালে শুনে বাংলায় নিজেই অর্ডার নেয়।',
    },
    {
      painIcon: <TrendingDown className="w-5 h-5 text-rose-500" />,
      painTitle: 'বিক্রি অনেক হচ্ছে, কিন্তু লাভ কত হিসাব নেই',
      painDesc: 'মাস শেষে কুরিয়ার চার্জ আর পণ্যের কেনা দামের হিসাব মেলাতে গিয়ে দেখা যায় আসল লাভ উধাও।',
      reliefIcon: <TrendingUp className="w-5 h-5 text-emerald-500" />,
      reliefTitle: 'প্রতিটি ডেলিভারড অর্ডারে আসল নিট লাভ পরিষ্কার',
      reliefDesc: 'কেনা দাম ও ডেলিভারি ফি বাদে আপনার পকেটে ঠিক কত টাকা লাভ থাকল — ড্যাশবোর্ডে এক নজরে লাইভ দেখুন।',
    },
  ];

  return (
    <section className="py-20 bg-slate-900 text-white relative overflow-hidden">
      
      {/* Background glow accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold mb-4">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>এফ-কমার্স বিক্রেতাদের বাস্তব চিত্র</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            রোজকার যন্ত্রণা <span className="text-indigo-400">→</span> এআই-এর স্বস্তি
          </h2>
          <p className="mt-3 text-sm text-slate-400">
            প্রতিদিন যে সমস্যাগুলো আপনার সময় ও টাকা কেড়ে নিচ্ছে — KothaShop.ai ঠিক কীভাবে সমাধান করে, দেখে নিন।
          </p>
        </div>

        {/* Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {comparisons.map((item, idx) => (
            <div
              key={idx}
              className="rounded-3xl bg-slate-800/60 border border-slate-700/60 p-6 sm:p-8 flex flex-col justify-between hover:border-slate-600 transition-all shadow-xl"
            >
              {/* The Pain (রোজকার যন্ত্রণা) */}
              <div className="pb-5 border-b border-slate-700/60">
                <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider mb-2">
                  <XCircle className="w-4 h-4 text-rose-500" />
                  <span>রোজকার সমস্যা</span>
                </div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  {item.painTitle}
                </h3>
                <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                  {item.painDesc}
                </p>
              </div>

              {/* The Relief (আমাদের এআই স্বস্তি) */}
              <div className="pt-5 bg-gradient-to-br from-indigo-950/40 to-transparent -mx-6 -mb-6 sm:-mx-8 sm:-mb-8 p-6 sm:p-8 rounded-b-3xl">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>KothaShop সমাধান</span>
                </div>
                <h3 className="text-base font-extrabold text-white">
                  {item.reliefTitle}
                </h3>
                <p className="mt-1.5 text-xs text-indigo-200/80 leading-relaxed">
                  {item.reliefDesc}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}

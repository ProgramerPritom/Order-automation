'use client';

import React, { useState } from 'react';
import { Calculator, TrendingUp, AlertCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function RoiCalculator() {
  const [dailyMessages, setDailyMessages] = useState<number>(100);
  const [avgOrderValue, setAvgOrderValue] = useState<number>(1800);

  // Business logic for Bangladesh e-commerce:
  // Usually ~15% of inquiries convert if answered in <2 mins
  // If answered after 15-30 mins, conversion drops by 40% (Lost orders)
  const monthlyInquiries = dailyMessages * 30;
  const potentialOrders = Math.round(monthlyInquiries * 0.15);
  const lostOrdersDueToDelay = Math.round(potentialOrders * 0.35);
  const recoveredRevenue = lostOrdersDueToDelay * avgOrderValue;

  return (
    <section id="roi-calculator" className="py-20 bg-slate-900 text-white relative">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-xs font-bold text-emerald-400 mb-4">
            <Calculator className="w-3.5 h-3.5 text-emerald-400" />
            <span>ROI & LOST REVENUE CALCULATOR</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-normal leading-[1.3] sm:leading-[1.28]">
            দেরিতে রিপ্লাই দেওয়ার কারণে প্রতি মাসে <br className="hidden sm:inline" />
            <span className="text-rose-400 inline-block">আপনার কত টাকার সেল লস হচ্ছে?</span>
          </h2>
          <p className="mt-3 text-slate-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed font-normal">
            গবেষণায় দেখা গেছে, সোশ্যাল কমার্সে কাস্টমার মেসেজ দেওয়ার ৫ মিনিটের মধ্যে উত্তর না পেলে ৩৫% কাস্টমার অন্য পেজ থেকে কিনে ফেলে।
          </p>
        </div>

        {/* Interactive Calculator Box */}
        <div className="p-8 sm:p-10 rounded-3xl bg-slate-800/90 border border-slate-700 shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            
            {/* Left Controls */}
            <div className="space-y-6">
              
              {/* Slider 1: Daily Messages */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-semibold text-slate-300">
                    প্রতিদিন পেজে মোট কত মেসেজ আসে?
                  </label>
                  <span className="text-lg font-black text-indigo-400">{dailyMessages} টি</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="600"
                  step="10"
                  value={dailyMessages}
                  onChange={(e) => setDailyMessages(Number(e.target.value))}
                  className="w-full h-2.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                  <span>২০ টি</span>
                  <span>৩০০ টি</span>
                  <span>৬০০ টি</span>
                </div>
              </div>

              {/* Slider 2: Average Order Value */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-semibold text-slate-300">
                    আপনার পণ্যের গড় মূল্য (Average Order Value)
                  </label>
                  <span className="text-lg font-black text-indigo-400">৳ {avgOrderValue.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="6000"
                  step="100"
                  value={avgOrderValue}
                  onChange={(e) => setAvgOrderValue(Number(e.target.value))}
                  className="w-full h-2.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                  <span>৳ ৫০০</span>
                  <span>৳ ৩,০০০</span>
                  <span>৳ ৬,০০০</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  দেরিতে রিপ্লাই দিলে প্রতি মাসে গড়ে <strong className="text-white">{lostOrdersDueToDelay} টি অর্ডার</strong> হাতছাড়া হয়ে যায়।
                </span>
              </div>

            </div>

            {/* Right Result Card */}
            <div className="p-8 rounded-2xl bg-gradient-to-br from-indigo-900/60 to-slate-900 border border-indigo-500/40 text-center flex flex-col justify-between h-full">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                  KothaShop দিয়ে প্রতি মাসে অতিরিক্ত আয়
                </span>
                <p className="mt-3 text-4xl sm:text-5xl font-black text-emerald-400">
                  ৳ {recoveredRevenue.toLocaleString()}
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  (অটোমেটেড ইনস্ট্যান্ট রিপ্লাই ও অর্ডার রিসিভের মাধ্যমে)
                </p>
              </div>

              <div className="mt-8 pt-6 border-t border-indigo-800/60">
                <Link
                  href="/register"
                  className="w-full inline-flex items-center justify-center py-3.5 px-6 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/25 transition-all group"
                >
                  <span>এই অতিরিক্ত সেল রিকভার শুরু করুন</span>
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}

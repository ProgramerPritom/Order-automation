'use client';

import React from 'react';
import Link from 'next/link';
import { Check, Sparkles, Zap, Tag } from 'lucide-react';

export default function PricingOffers() {
  const tiers = [
    {
      name: 'বেসিক প্ল্যান (Starter)',
      price: '৯৯০',
      period: 'টাকা / প্রতি মাস',
      desc: 'নতুন শুরু করা একক ফেসবুক পেজের জন্য উপযুক্ত, যেখানে কোনো সেলস কল বা মেসেজ মিস হবে না।',
      features: [
        '১টি ফেসবুক পেজ কানেকশন',
        'মাসে ৫০০টি পর্যন্ত নিশ্চিত অর্ডার গ্রহণ',
        '২৪/৭ ইনস্ট্যান্ট অটো রিপ্লাই ও প্রডাক্ট শোকেস',
        'সঠিক ফোন নম্বর (১১ ডিজিট) ও ঠিকানা যাচাই',
        'ঢাকার ভেতরে ৮০ ও বাইরে ১৫০ টাকা চার্জ অটো যোগ',
        'রিয়েল-টাইম অর্ডার ম্যানেজমেন্ট ড্যাশবোর্ড',
        'ডেইলি সেলস রিপোর্ট ভিউ',
      ],
      popular: false,
      cta: 'বেসিক প্ল্যানে শুরু করুন',
    },
    {
      name: 'প্রো প্ল্যান (সবচেয়ে জনপ্রিয়)',
      price: '১,৯৯০',
      period: 'টাকা / প্রতি মাস',
      desc: 'নিয়মিত বিক্রি হওয়া গ্রোয়িং এফ-কমার্স শপের জন্য সম্পূর্ণ স্বয়ংক্রিয় সেলস অ্যাসিস্ট্যান্ট।',
      features: [
        'ফেসবুক + হোয়াটসঅ্যাপ + ইনস্টাগ্রাম ৩টি চ্যানেল',
        'আনলিমিটেড মেসেজ ও আনলিমিটেড অর্ডার (নো লিমিট)',
        'সাইজ (M, L, XL), কালার ও স্টক রিয়েল-টাইম যাচাই',
        '১-ক্লিকে নিজে কথা বলার সুবিধা (হিউম্যান টেকওভার)',
        'দৈনিক ও মাসিক সেলস রিপোর্ট ডাউনলোড (Excel / CSV)',
        'নতুন অর্ডার আসলে টেলিগ্রাম ও ড্যাশবোর্ডে পুশ অ্যালার্ট',
        'ডেলিভারি চার্জ অটোমেটিক ক্যালকুলেশন',
        '২৪/৭ ভিআইপি প্রায়োরিটি সাপোর্ট',
      ],
      popular: true,
      cta: '৭ দিনের ফ্রি ট্রায়াল নিন',
    },
    {
      name: 'বিজনেস প্ল্যান (Business)',
      price: '৩,৪৯০',
      period: 'টাকা / প্রতি মাস',
      desc: 'বড় ব্র্যান্ড ও মাল্টিপল পেজ পরিচালনাকারী উদ্যোক্তা ও এজেন্সির জন্য এন্টারপ্রাইজ সল্যুশন।',
      features: [
        'সর্বোচ্চ ৫টি সোশ্যাল পেজ ও হোয়াটসঅ্যাপ কানেক্ট',
        'আনলিমিটেড প্রোডাক্ট ক্যাটালগ ও আনলিমিটেড অর্ডার',
        'কুরিয়ার অটো বুকিং রেডি (Steadfast ও Pathao)',
        'টিম মেম্বারদের জন্য আলাদা স্টাফ অ্যাকাউন্ট',
        'কাস্টমার ডাটাবেজ ও ফুল রিপোর্ট এক্সপোর্ট (CSV)',
        'কাস্টম ব্র্যান্ড টোন ও শপ পলিসি ইন্টিগ্রেশন',
        'ডেডিকেটেড অ্যাকাউন্ট ম্যানেজার সাপোর্ট',
      ],
      popular: false,
      cta: 'বিজনেস প্ল্যান বেছে নিন',
    },
  ];

  return (
    <section id="pricing" className="py-24 bg-slate-50 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Launch Promo Ribbon */}
        <div className="max-w-xl mx-auto mb-10 p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-rose-500/15 to-indigo-500/15 border border-amber-300 text-center flex items-center justify-center gap-2 text-xs sm:text-sm font-bold text-slate-800">
          <Tag className="w-4 h-4 text-rose-600 shrink-0" />
          <span>🔥 সীমিত সময়ের অফার: প্রথম ৫০টি শপের জন্য আজীবন ৩০% ছাড়! কোড:</span>
          <span className="font-mono px-2 py-0.5 rounded bg-white font-black text-rose-600 border border-rose-200">
            KOTHA30
          </span>
        </div>

        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>স্বচ্ছ ও সাশ্রয়ী মাসিক সাবস্ক্রিপশন</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-normal leading-[1.3] sm:leading-[1.28]">
            আপনার পেজের জন্য সেরা প্ল্যান বেছে নিন
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
            কোনো দীর্ঘমেয়াদি চুক্তি বা গোপন ফি নেই — প্রতি মাসেই রিনিউ করুন। সাথে ৭ দিনের সম্পূর্ণ ঝুঁকিমুক্ত ফ্রি ট্রায়াল।
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {tiers.map((tier, idx) => (
            <div
              key={idx}
              className={`rounded-3xl p-8 flex flex-col justify-between transition-all relative ${
                tier.popular
                  ? 'bg-white border-2 border-indigo-600 shadow-2xl shadow-indigo-600/15 scale-105 z-10'
                  : 'bg-white/80 border border-slate-200 hover:border-slate-300 shadow-sm'
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-md whitespace-nowrap">
                  সবচেয়ে জনপ্রিয় চয়েস
                </div>
              )}

              <div>
                <h3 className="text-xl font-bold text-slate-900">{tier.name}</h3>
                <p className="mt-2 text-xs text-slate-500 min-h-[32px] leading-relaxed">{tier.desc}</p>
                
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl sm:text-5xl font-black text-slate-900">৳ {tier.price}</span>
                  <span className="text-xs font-semibold text-slate-500">{tier.period}</span>
                </div>

                <div className="mt-8 space-y-3.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">সুবিধাসমূহ:</p>
                  {tier.features.map((feature, fIdx) => (
                    <div key={fIdx} className="flex items-start gap-2.5 text-xs text-slate-700">
                      <div className="w-4 h-4 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3" />
                      </div>
                      <span className="leading-snug">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100">
                <Link
                  href="/register"
                  className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm text-center block transition-all ${
                    tier.popular
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/35'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}

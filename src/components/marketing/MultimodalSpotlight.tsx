'use client';

import React, { useState } from 'react';
import {
  Mic,
  Image as ImageIcon,
  Play,
  Volume2,
  Sparkles,
  CheckCircle2,
  Bot,
  User,
  ShoppingBag,
  ArrowRight,
} from 'lucide-react';

export default function MultimodalSpotlight() {
  const [activeTab, setActiveTab] = useState<'audio' | 'image'>('audio');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  return (
    <section className="py-20 bg-slate-50 relative overflow-hidden border-t border-b border-slate-200/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold mb-4">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Multimodal AI — ভিশন ও স্পিচ-টু-টেক্সট</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            কাস্টমারের ছবি ও অডিও ভয়েস নোট — সবই বোঝে এআই
          </h2>
          <p className="mt-3 text-sm text-slate-600 leading-relaxed">
            বাংলাদেশের ৬০% ফেসবুক ক্রেতা মেসেঞ্জারে টাইপ না করে ভয়েস নোট পাঠায় কিংবা পণ্যের ছবি ইনবক্সে দেয়। KothaShop.ai মানুষের মতো শুনে ও দেখে সঠিক জবাব দেয় এবং অর্ডার নিশ্চিত করে।
          </p>
        </div>

        {/* Interactive Tab Switcher */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex p-1.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <button
              onClick={() => setActiveTab('audio')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'audio'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Mic className="w-4 h-4" />
              <span>১. বাংলা অডিও ভয়েস ট্রান্সক্রিপশন</span>
            </button>

            <button
              onClick={() => setActiveTab('image')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'image'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>২. ছবি দেখে পণ্য শনাক্তকরণ (Vision)</span>
            </button>
          </div>
        </div>

        {/* Live Simulation Card */}
        <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-slate-200/80 shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-12">
          
          {/* Left Explanation Column */}
          <div className="md:col-span-5 p-8 bg-slate-900 text-white flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                {activeTab === 'audio' ? 'স্পিচ-টু-টেক্সট ইঞ্জিন' : 'কম্পিউটার ভিশন ইঞ্জিন'}
              </span>
              <h3 className="text-xl font-black mt-2 text-white">
                {activeTab === 'audio'
                  ? 'মুখে বলা অডিও শুনে নিজে থেকেই অর্ডার এন্ট্রি'
                  : 'কাস্টমারের পাঠানো ছবি চিনে দাম ও স্টক প্রদান'}
              </h3>
              <p className="mt-3 text-xs text-slate-300 leading-relaxed">
                {activeTab === 'audio'
                  ? 'কাস্টমার আঞ্চলিক ভাষায় বা দ্রুত গতিতে ভয়েস নোট দিলেও এআই তাৎক্ষণিক বাংলা শব্দে রূপান্তর করে গ্রাহকের নাম, ফোন নম্বর ও ডেলিভারি ঠিকানা ডাটাবেজে আলাদা করে সাজিয়ে ফেলে।'
                  : 'কাস্টমার জামা, জুতা বা যেকোনো প্রোডাক্টের স্ক্রিনশট বা ছবি পাঠালে এআই আপনার স্টোরের ডাটাবেজ সার্চ করে সঠিক ভ্যারিয়েন্ট, সাইজ ও মূল্য নিশ্চিত করে।'}
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800 space-y-2.5 text-xs">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>{activeTab === 'audio' ? '৯৫%+ বাংলা একিউরেসি' : 'রিয়েলটাইম ক্যাটালগ ম্যাচিং'}</span>
              </div>
              <div className="flex items-center gap-2 text-indigo-300">
                <CheckCircle2 className="w-4 h-4" />
                <span>{activeTab === 'audio' ? 'কোনো থার্ড-পার্টি অ্যাপ ছাড়াই মেসেঞ্জারে সরাসরি' : 'ভুল তথ্যের কোনো সুযোগ নেই'}</span>
              </div>
            </div>
          </div>

          {/* Right Interactive Messenger Chat Simulation */}
          <div className="md:col-span-7 p-6 sm:p-8 bg-slate-50/50 flex flex-col justify-between">
            <div className="space-y-4">
              
              {/* Header Bar of Chat */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">KothaShop AI Agent</p>
                    <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Active • Facebook Messenger</span>
                    </p>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                  {activeTab === 'audio' ? '🎙️ Audio Ingest' : '📸 Image Ingest'}
                </span>
              </div>

              {/* Chat Content based on Tab */}
              {activeTab === 'audio' ? (
                <div className="space-y-3.5 pt-2">
                  {/* Customer Voice Note Bubble */}
                  <div className="flex items-start justify-end gap-2">
                    <div className="max-w-xs p-3.5 rounded-2xl rounded-tr-none bg-indigo-600 text-white shadow-sm space-y-2">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                          className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors shrink-0"
                        >
                          <Play className="w-4 h-4 fill-white ml-0.5" />
                        </button>
                        {/* Audio Waveform visualization */}
                        <div className="flex items-center gap-1 h-6 flex-1">
                          {[40, 70, 30, 90, 60, 100, 45, 80, 50, 75, 30, 85].map((h, i) => (
                            <span
                              key={i}
                              style={{ height: `${h}%` }}
                              className={`w-1 rounded-full bg-white/70 ${
                                isPlayingAudio ? 'animate-pulse' : ''
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] text-indigo-200">0:06</span>
                      </div>
                      <p className="text-[10px] text-indigo-100 italic border-t border-indigo-500/40 pt-1.5">
                        💬 ভয়েস নোট: &quot;ভাইয়া এই শাড়িটা ২ পিস ধানমন্ডিতে পাঠান, ফোন 01712-345678&quot;
                      </p>
                    </div>
                  </div>

                  {/* AI Response Bubble */}
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 text-xs">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="max-w-sm p-4 rounded-2xl rounded-tl-none bg-white border border-slate-200 text-slate-800 text-xs shadow-sm space-y-2">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>অডিও ট্রান্সক্রিপশন সম্পন্ন (১০০% নির্ভুল)</span>
                      </div>
                      <p className="leading-relaxed">
                        ধন্যবাদ ভাইয়া! আপনার অডিও মেসেজ অনুযায়ী <strong>প্রিমিয়াম কাতান শাড়ি (রয়্যাল ব্লু) × ২ পিস</strong> এর অর্ডার গ্রহণ করা হয়েছে।
                      </p>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] space-y-1">
                        <p>📍 ডেলিভারি: ধানমন্ডি, ঢাকা (চার্জ: ৳৮০)</p>
                        <p>📞 ফোন: 01712-345678</p>
                        <p className="font-bold text-slate-900">💵 সর্বমোট ক্যাশ অন ডেলিভারি: ৳৬,৯৮০</p>
                      </div>
                      <p className="text-emerald-600 font-bold text-[11px]">
                        ✅ আপনার অর্ডারটি সিস্টেমে নিশ্চিত হয়েছে!
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5 pt-2">
                  {/* Customer Image Attachment Bubble */}
                  <div className="flex items-start justify-end gap-2">
                    <div className="max-w-xs p-2.5 rounded-2xl rounded-tr-none bg-indigo-600 text-white shadow-sm space-y-2">
                      <div className="w-48 h-32 rounded-xl bg-indigo-950/60 border border-indigo-400/30 flex flex-col items-center justify-center p-3 relative overflow-hidden">
                        <ShoppingBag className="w-10 h-10 text-indigo-300" />
                        <span className="text-[10px] text-indigo-200 mt-2 font-bold">
                          [গ্রাহকের আপলোডকৃত ছবির প্রিভিউ]
                        </span>
                        <div className="absolute inset-0 border-2 border-indigo-400/40 rounded-xl pointer-events-none animate-pulse" />
                      </div>
                      <p className="text-[11px] px-1 text-white">
                        &quot;এইটার প্রাইস কত? আর স্টক আছে কি না?&quot;
                      </p>
                    </div>
                  </div>

                  {/* AI Vision Match Bubble */}
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 text-xs">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="max-w-sm p-4 rounded-2xl rounded-tl-none bg-white border border-slate-200 text-slate-800 text-xs shadow-sm space-y-2">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        <span>ছবিতে পণ্য শনাক্ত হয়েছে (AI Vision Match)</span>
                      </div>
                      <p className="leading-relaxed">
                        জি আপু! এটি আমাদের <strong>প্রিমিয়াম কাতান শাড়ি (রয়্যাল ব্লু)</strong>। বর্তমানে <strong>১২ পিস</strong> স্টকে আছে।
                      </p>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] flex items-center justify-between">
                        <span>মূল্য: <strong>৳৩,৪৫০</strong> (অফার মূল্য)</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">ইন-স্টক</span>
                      </div>
                      <p className="text-slate-600 text-[11px]">
                        অর্ডার কনফার্ম করতে আপনার নাম, মোবাইল নম্বর ও ঠিকানা লিখে পাঠান।
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>ফেসবুক মেসেঞ্জার, ইনস্টাগ্রাম ও হোয়াটসঅ্যাপে স্বয়ংক্রিয়ভাবে সক্রিয়</span>
              <span className="font-bold text-indigo-600">KothaShop Vision Core</span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}

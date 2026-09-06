'use client';

import React, { useState, useEffect } from 'react';
import { Bot, Check, CheckCheck, ShoppingBag, Send, PhoneCall, Sparkles, ShieldCheck } from 'lucide-react';

interface ChatMessage {
  id: number;
  sender: 'user' | 'bot';
  text: string;
  time: string;
}

const MESSAGES_SEQUENCE: ChatMessage[] = [
  {
    id: 1,
    sender: 'user',
    text: 'ভাইয়া ব্ল্যাক প্রিমিয়াম পাঞ্জাবির L সাইজ আছে? দাম কত আর ডেলিভারি কত দিনে পাবো?',
    time: '03:14 AM',
  },
  {
    id: 2,
    sender: 'bot',
    text: 'জি ভাইয়া! আমাদের প্রিমিয়াম ব্ল্যাক পাঞ্জাবি (L সাইজ) বর্তমানে স্টকে আছে। মূল্য: ২১৫০ টাকা। ঢাকার ভেতরে ডেলিভারি চার্জ ৮০ টাকা (৪৮ ঘণ্টার মধ্যে পাবেন)। অর্ডার কনফার্ম করতে আপনার নাম, মোবাইল নম্বর এবং পূর্ণ ঠিকানাটি দিন।',
    time: '03:14 AM',
  },
  {
    id: 3,
    sender: 'user',
    text: 'নাম: সোহেল রানা, ফোন: 01712345678, ঠিকানা: রোড ১২, বাড়ি ৫, ধানমন্ডি, ঢাকা।',
    time: '03:15 AM',
  },
  {
    id: 4,
    sender: 'bot',
    text: 'ধন্যবাদ সোহেল ভাইয়া! আপনার অর্ডারটি নিশ্চিত করা হয়েছে (অর্ডার #AS-8842)। মোট প্রদেয়: ২২৩০ টাকা (ক্যাশ অন ডেলিভারি)। আমাদের টিম দ্রুত পার্সেলটি হ্যান্ডওভার করছে।',
    time: '03:15 AM',
  },
];

export default function LiveChatSimulation() {
  const [platform, setPlatform] = useState<'messenger' | 'whatsapp'>('messenger');
  const [activeStep, setActiveStep] = useState(1);
  const [autoPlay, setAutoPlay] = useState(true);

  useEffect(() => {
    if (!autoPlay) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev >= MESSAGES_SEQUENCE.length ? 1 : prev + 1));
    }, 3200);
    return () => clearInterval(interval);
  }, [autoPlay]);

  return (
    <section id="live-demo" className="py-20 bg-slate-900 text-white relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-400/30 text-xs font-bold text-indigo-400 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>সরাসরি দেখুন লাইভ ডেমো</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-normal leading-[1.3] sm:leading-[1.28]">
            চোখের সামনে দেখুন কীভাবে <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent inline-block pb-1">
              এআই স্বয়ংক্রিয়ভাবে ইনবক্স সামলে সেলস কনফার্ম করে
            </span>
          </h2>
          <p className="mt-4 text-slate-400 text-base sm:text-lg leading-relaxed font-normal">
            কাস্টমার যেভাবে বাংলায় বা বাংলিশে নক দিক না কেন — আমাদের এআই পণ্যের সাইজ ও স্টক মিলিয়ে মাত্র ১ মিনিটে সম্পূর্ণ অর্ডার কনফার্ম করে নেয়।
          </p>

          {/* Platform Selector Buttons */}
          <div className="mt-8 inline-flex items-center p-1.5 rounded-2xl bg-slate-800/80 border border-slate-700/60 shadow-inner">
            <button
              onClick={() => setPlatform('messenger')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                platform === 'messenger'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Facebook Messenger</span>
            </button>
            <button
              onClick={() => setPlatform('whatsapp')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                platform === 'whatsapp'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>WhatsApp Business</span>
            </button>
          </div>
        </div>

        {/* The Two Column Demo View */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-6xl mx-auto">
          
          {/* Column 1: The Smartphone Chat Mockup (7 cols) */}
          <div className="lg:col-span-7 flex justify-center">
            <div className="w-full max-w-md bg-slate-950 rounded-[40px] p-3.5 shadow-2xl border-4 border-slate-800 ring-1 ring-slate-700/50">
              
              {/* Phone Speaker & Camera Notch */}
              <div className="flex justify-center mb-3">
                <div className="w-28 h-4 bg-slate-800 rounded-full flex items-center justify-end px-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-700" />
                </div>
              </div>

              {/* Chat Screen Container */}
              <div className="bg-slate-900 rounded-[28px] overflow-hidden flex flex-col h-[520px] border border-slate-800">
                
                {/* Chat App Header */}
                <div className={`p-4 flex items-center justify-between border-b ${
                  platform === 'messenger'
                    ? 'bg-indigo-950/80 border-indigo-900/50'
                    : 'bg-emerald-950/80 border-emerald-900/50'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center text-white font-black shadow-md">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <span>Aarong Fashions (AI Agent)</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        {platform === 'messenger' ? 'Active now on Facebook' : 'Official WhatsApp Business'}
                      </p>
                    </div>
                  </div>
                  <div className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>২৪/৭ সক্রিয়</span>
                  </div>
                </div>

                {/* Chat Messages Body */}
                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                  {MESSAGES_SEQUENCE.slice(0, activeStep).map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        msg.sender === 'user' ? 'items-end' : 'items-start'
                      } animate-fade-in`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                          msg.sender === 'user'
                            ? platform === 'messenger'
                              ? 'bg-blue-600 text-white rounded-br-none'
                              : 'bg-emerald-700 text-white rounded-br-none'
                            : 'bg-slate-800 text-slate-100 border border-slate-700/70 rounded-bl-none shadow-md'
                        }`}
                      >
                        <p>{msg.text}</p>
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 px-1 flex items-center gap-1">
                        {msg.time}
                        {msg.sender === 'user' && <CheckCheck className="w-3 h-3 text-blue-400" />}
                      </span>
                    </div>
                  ))}

                  {/* Typing indicator when progressing */}
                  {activeStep < MESSAGES_SEQUENCE.length && (
                    <div className="flex items-center gap-1.5 p-2 bg-slate-800/60 rounded-xl w-16 border border-slate-700/40">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" />
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce delay-100" />
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce delay-200" />
                    </div>
                  )}
                </div>

                {/* Input Simulation Bar */}
                <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
                  <div className="flex-1 bg-slate-900 border border-slate-800 rounded-full px-4 py-2 text-xs text-slate-500">
                    Type a message...
                  </div>
                  <button className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white">
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>

            </div>
          </div>

          {/* Column 2: The Real-time Order Generator Card (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            
            {/* Live Synchronized Order Card */}
            <div className="p-6 rounded-3xl bg-slate-800/90 border border-slate-700 shadow-2xl backdrop-blur-sm">
              <div className="flex items-center justify-between pb-4 border-b border-slate-700">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">ড্যাশবোর্ডে নতুন অর্ডার যুক্ত হয়েছে</h3>
                    <p className="text-[11px] text-slate-400">অটোমেটিক ডেলিভারি শিট তৈরি</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {activeStep >= 4 ? 'অর্ডার কনফার্মড' : 'তথ্য নেওয়া হচ্ছে...'}
                </span>
              </div>

              {/* Order Details Body */}
              <div className="mt-5 space-y-3.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-700/50">
                  <span className="text-slate-400">অর্ডার নম্বর:</span>
                  <span className="font-mono font-bold text-indigo-300">#AS-8842</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-700/50">
                  <span className="text-slate-400">কাস্টমারের নাম:</span>
                  <span className="font-semibold text-white">
                    {activeStep >= 3 ? 'সোহেল রানা' : '---'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-700/50">
                  <span className="text-slate-400">মোবাইল নম্বর:</span>
                  <span className="font-semibold text-emerald-400">
                    {activeStep >= 3 ? '01712345678 (Verified BD)' : '---'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-700/50">
                  <span className="text-slate-400">ডেলিভারি ঠিকানা:</span>
                  <span className="font-semibold text-white text-right max-w-[200px]">
                    {activeStep >= 3 ? 'ধানমন্ডি, ঢাকা' : '---'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-700/50">
                  <span className="text-slate-400">নির্বাচিত পণ্য:</span>
                  <span className="font-semibold text-white">প্রিমিয়াম ব্ল্যাক পাঞ্জাবি (L) x ১</span>
                </div>
                <div className="flex justify-between pt-2 text-sm font-bold">
                  <span className="text-slate-300">সর্বমোট প্রদেয়:</span>
                  <span className="text-emerald-400 font-extrabold">
                    {activeStep >= 2 ? '৳ ২,২৩০ (COD)' : '---'}
                  </span>
                </div>
              </div>

              {/* Owner Alert Simulation */}
              <div className="mt-6 p-3.5 rounded-2xl bg-indigo-950/60 border border-indigo-800/60 text-xs flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <PhoneCall className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="font-bold text-indigo-200">ওনার নোটিফিকেশন সেন্ট</p>
                  <p className="text-[11px] text-slate-400">টেলিগ্রাম ও ড্যাশবোর্ডে রিয়েল-টাইম পুশ অ্যালার্ট</p>
                </div>
              </div>
            </div>

            {/* Simulation Controls */}
            <div className="flex items-center justify-between px-2 text-xs text-slate-400">
              <button
                onClick={() => setActiveStep((prev) => (prev < 4 ? prev + 1 : 1))}
                className="font-bold text-indigo-400 hover:text-indigo-300 underline"
              >
                পরবর্তী ধাপ দেখুন ({activeStep}/4)
              </button>
              <button
                onClick={() => setAutoPlay(!autoPlay)}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                {autoPlay ? 'Pause Auto-Play' : 'Resume Auto-Play'}
              </button>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}

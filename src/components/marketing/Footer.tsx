import React from 'react';
import Link from 'next/link';
import { Bot, Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400 py-16 border-t border-slate-800 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-400 flex items-center justify-center text-white">
                <Bot className="w-5 h-5" />
              </div>
              <span className="font-black text-xl text-white tracking-tight">
                KothaShop<span className="text-indigo-400">.ai</span>
              </span>
            </div>
            <p className="text-slate-400 max-w-sm leading-relaxed text-xs">
              বাংলাদেশের অনলাইন ও এফ-কমার্স উদ্যোক্তাদের জন্য স্বয়ংক্রিয় এআই সেলস ও অর্ডার ম্যানেজমেন্ট ইঞ্জিন। মেটা অফিসিয়াল এপিআই এবং n8n অটোমেশন দ্বারা পরিচালিত।
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-bold text-white uppercase tracking-wider mb-3">প্ল্যাটফর্ম</h4>
            <ul className="space-y-2">
              <li><a href="#features" className="hover:text-white transition-colors">ফিচারসমূহ</a></li>
              <li><a href="#live-demo" className="hover:text-white transition-colors">লাইভ চ্যাট ডেমো</a></li>
              <li><a href="#roi-calculator" className="hover:text-white transition-colors">সেলস ক্যালকুলেটর</a></li>
              <li><a href="#pricing" className="hover:text-white transition-colors">প্যাকেজ ও অফার</a></li>
            </ul>
          </div>

          {/* Legal & Auth */}
          <div>
            <h4 className="font-bold text-white uppercase tracking-wider mb-3">ইউজার এক্সেস</h4>
            <ul className="space-y-2">
              <li><Link href="/login" className="hover:text-white transition-colors">লগইন করুন</Link></li>
              <li><Link href="/register" className="hover:text-white transition-colors">ফ্রি অ্যাকাউন্ট তৈরি</Link></li>
              <li><a href="#" className="hover:text-white transition-colors">প্রাইভেসি পলিসি</a></li>
              <li><a href="#" className="hover:text-white transition-colors">টার্মস অব সার্ভিস</a></li>
            </ul>
          </div>

        </div>

        <div className="pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} KothaShop.ai — All rights reserved.</p>
          <p className="flex items-center gap-1 text-slate-500">
            <span>Crafted for Bangladeshi E-Commerce with</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
          </p>
        </div>
      </div>
    </footer>
  );
}

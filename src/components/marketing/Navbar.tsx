'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Bot, Sparkles, Menu, X, ArrowRight } from 'lucide-react';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-slate-200/80 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Brand Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-xl tracking-tight text-slate-900">
                  KothaShop<span className="text-indigo-600">.ai</span>
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 tracking-wide uppercase">
                  SaaS 2.0
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 hidden sm:block">
                ফেসবুক ও হোয়াটসঅ্যাপ অটোমেটেড সেলস
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link href="/features" className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors">
              ফিচারসমূহ (Features)
            </Link>
            <a href="#live-demo" className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              লাইভ ডেমো
            </a>
            <a href="#roi-calculator" className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors">
              লাভের হিসাব (ROI)
            </a>
            <a href="#pricing" className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors">
              প্যাকেজ ও প্রাইসিং
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="hidden md:flex items-center space-x-4">
            <Link
              href="/login"
              className="text-sm font-bold text-slate-700 hover:text-indigo-600 px-4 py-2 transition-colors"
            >
              লগইন / Sign In
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all whitespace-nowrap"
            >
              <span>৭ দিনের ফ্রি ট্রায়াল</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white px-4 pt-2 pb-6 space-y-3">
          <a
            href="#features"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-semibold text-slate-700 hover:text-indigo-600"
          >
            ফিচারসমূহ
          </a>
          <a
            href="#live-demo"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-semibold text-slate-700 hover:text-indigo-600"
          >
            লাইভ ডেমো
          </a>
          <a
            href="#roi-calculator"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-semibold text-slate-700 hover:text-indigo-600"
          >
            লাভের হিসাব (ROI)
          </a>
          <a
            href="#pricing"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-semibold text-slate-700 hover:text-indigo-600"
          >
            প্যাকেজ ও প্রাইসিং
          </a>
          <div className="pt-4 border-t border-slate-100 flex flex-col space-y-2">
            <Link
              href="/login"
              className="w-full text-center py-2.5 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200"
            >
              লগইন / Sign In
            </Link>
            <Link
              href="/register"
              className="w-full text-center py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700"
            >
              ৭ দিনের ফ্রি ট্রায়াল নিন
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

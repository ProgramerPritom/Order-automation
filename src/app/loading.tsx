import React from 'react';
import { Bot } from 'lucide-react';

export default function GlobalLoading() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute w-80 h-80 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none translate-x-20 -translate-y-20 animate-pulse-slow" />

      {/* Center Animated Logo & Ring */}
      <div className="relative flex flex-col items-center">
        <div className="relative w-20 h-20 flex items-center justify-center">
          {/* Outer spinning gradient ring */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-indigo-500 via-cyan-400 to-indigo-600 animate-spin blur-[2px] opacity-75" />
          
          {/* Logo container */}
          <div className="relative w-[72px] h-[72px] rounded-2xl bg-slate-950 flex items-center justify-center border border-indigo-500/40 shadow-2xl">
            <Bot className="w-9 h-9 text-indigo-400 animate-bounce" />
          </div>
        </div>

        {/* Brand & Loading text */}
        <h2 className="mt-6 text-xl font-extrabold text-white tracking-tight">
          KothaShop<span className="text-indigo-400">.ai</span>
        </h2>
        <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400 font-medium">
          <span>লোড হচ্ছে</span>
          <span className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce delay-100" />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce delay-200" />
          </span>
        </div>
      </div>
    </div>
  );
}

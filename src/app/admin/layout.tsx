'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Users,
  Activity,
  Store,
  LogOut,
  Sparkles,
  Menu,
  X,
  Phone,
  Database,
} from 'lucide-react';
import { getSessionData, clearSession } from '@/lib/session';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminUser, setAdminUser] = useState<{ name?: string; phone?: string; email?: string } | null>(null);

  useEffect(() => {
    // If on login page, skip loading session
    if (pathname === '/admin/login') return;

    const { user } = getSessionData();
    if (user) {
      setAdminUser(user);
    }
  }, [pathname]);

  // If user is on the dedicated admin login page, render children directly without dashboard shell
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  const handleAdminLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    clearSession();
    window.location.href = '/admin/login';
  };

  const navItems = [
    {
      name: 'মার্চেন্ট ও শপ ওভারভিউ',
      href: '/admin',
      icon: <Users className="w-4 h-4" />,
      exact: true,
    },
    {
      name: 'n8n ও টেলিমেট্রি হেলথ',
      href: '/dashboard/automation',
      icon: <Activity className="w-4 h-4 text-emerald-400" />,
      exact: false,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      
      {/* Mobile Top Navbar */}
      <header className="md:hidden flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-600/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-sm text-white tracking-tight">
              ShopPilot <span className="text-purple-400">Admin</span>
            </span>
          </div>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition-colors"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Desktop Master Admin Sidebar */}
      <aside
        className={`${
          mobileMenuOpen ? 'block' : 'hidden'
        } md:flex flex-col w-full md:w-64 bg-slate-900/90 border-r border-slate-800 shrink-0 sticky top-0 h-auto md:h-screen z-30 p-5`}
      >
        {/* Sidebar Brand Header */}
        <div className="hidden md:flex items-center gap-3 pb-6 border-b border-slate-800">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-600/30 ring-2 ring-purple-500/20 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="overflow-hidden">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-sm text-white tracking-tight">
                ShopPilot <span className="text-purple-400">Master</span>
              </span>
            </div>
            <p className="text-[10px] font-black tracking-widest uppercase text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 w-fit mt-0.5">
              Super Admin Control
            </p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="mt-6 space-y-1.5 flex-1">
          {navItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 ring-1 ring-purple-400/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {item.icon}
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Database Live Telemetry Pill */}
        <div className="my-4 p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-[11px] space-y-1.5">
          <div className="flex items-center justify-between font-bold text-slate-300">
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-purple-400" />
              <span>Postgres Core</span>
            </span>
            <span className="flex items-center gap-1 text-emerald-400 text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Online</span>
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-mono">Role: master-superadmin</p>
        </div>

        {/* Super Admin User Card & Logout */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-950 border border-slate-800/90">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 font-black text-xs flex items-center justify-center border border-purple-500/30 shrink-0">
              SA
            </div>
            <div className="overflow-hidden flex-1">
              <p className="font-bold text-xs text-white truncate">
                {adminUser?.name || 'System Admin'}
              </p>
              <p className="text-[10px] text-indigo-400 font-mono flex items-center gap-1">
                <Phone className="w-2.5 h-2.5" />
                <span>{adminUser?.phone || '01767026831'}</span>
              </p>
            </div>
          </div>

          <button
            onClick={handleAdminLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 transition-colors border border-rose-500/20 shadow-sm"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>এডমিন সাইন-আউট</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </main>

    </div>
  );
}

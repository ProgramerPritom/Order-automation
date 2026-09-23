'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Share2,
  Activity,
  Package,
  ShoppingBag,
  MessageSquare,
  MessageCircle,
  LogOut,
  Bot,
  Store,
  CheckCircle2,
  Menu,
  X,
  Sparkles,
  BarChart3,
  Brain,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Film,
  ShieldAlert,
  CreditCard,
  AlertTriangle,
} from 'lucide-react';

import { useAppDispatch, useAppSelector } from '@/lib/store/hooks';
import { hydrateAuth, logout as reduxLogout } from '@/lib/store/slices/authSlice';
import { fetchSubscription } from '@/lib/store/slices/dashboardSlice';
import {
  getSessionToken,
  getSessionData,
  clearSession,
  refreshTokenAndResume,
  setupFetchAuthInterceptor,
} from '@/lib/session';
import DashboardSkeleton from '@/components/ui/DashboardSkeleton';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();

  // Redux cached state
  const auth = useAppSelector((state) => state.auth);
  const subInfo = useAppSelector((state) => state.dashboard.subscription);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAuthChecked, setIsAuthChecked] = useState(false);

  const userRole = auth.user?.role || 'merchant';
  const storeName = auth.tenant?.name || 'My Store';
  const userEmail = auth.user?.email || auth.user?.phone || '';

  useEffect(() => {
    // Load persisted collapse preference
    const savedCollapsed = localStorage.getItem('sidebar_collapsed');
    if (savedCollapsed !== null) {
      setIsCollapsed(savedCollapsed === 'true');
    }
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  useEffect(() => {
    // 1. Install global fetch interceptor (handles silent token refresh on 401 & auto-logout)
    setupFetchAuthInterceptor();

    const initAuth = async () => {
      let token = getSessionToken();
      if (!token) {
        // If access token is absent, attempt immediate silent refresh using refresh token cookie
        token = await refreshTokenAndResume();
      }

      if (!token) {
        clearSession();
        window.location.href = '/login?expired=true';
        return;
      }

      // Hydrate Redux state from storage/cookies
      const { user, tenant } = getSessionData();
      dispatch(hydrateAuth({ user, tenant, token }));
      setIsAuthChecked(true);

      // Fetch live subscription (Redux thunk skips network call if already cached)
      dispatch(fetchSubscription(token));
    };

    initAuth();

    // 2. Reconnect listener: If user regains internet and session token is missing, restore it
    const handleOnline = () => {
      if (typeof window !== 'undefined' && navigator.onLine) {
        const token = getSessionToken();
        if (!token) {
          refreshTokenAndResume().then((newToken) => {
            if (newToken) {
              const { user, tenant } = getSessionData();
              dispatch(hydrateAuth({ user, tenant, token: newToken }));
            }
          });
        }
      }
    };

    window.addEventListener('online', handleOnline);

    // 3. Periodic session health check every 30 minutes
    const interval = setInterval(() => {
      if (typeof window !== 'undefined' && navigator.onLine && document.visibilityState === 'visible') {
        refreshTokenAndResume();
      }
    }, 30 * 60 * 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(interval);
    };
  }, [dispatch]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    dispatch(reduxLogout());
    clearSession();
    window.location.href = '/login';
  };

  if (!isAuthChecked) {
    return (
      <div className="h-screen max-h-screen overflow-hidden bg-slate-100 flex">
        {/* Skeleton Sidebar */}
        <aside className="hidden lg:flex lg:flex-col lg:w-64 h-screen bg-slate-900 border-r border-slate-800 shrink-0 p-4 space-y-4 no-scrollbar">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0 animate-pulse">
              <Bot className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <div className="h-4 w-28 bg-slate-800 rounded animate-pulse" />
              <div className="h-2.5 w-16 bg-slate-800/80 rounded animate-pulse" />
            </div>
          </div>
          <div className="space-y-2 pt-4">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-9 rounded-xl bg-slate-800/60 animate-pulse" />
            ))}
          </div>
        </aside>

        {/* Content Area Skeleton */}
        <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
          <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
            <div className="h-4 w-36 bg-slate-200 rounded animate-pulse" />
            <div className="h-7 w-28 bg-slate-100 rounded-full animate-pulse" />
          </header>
          <main className="flex-1 overflow-y-auto p-4 sm:p-8 no-scrollbar">
            <DashboardSkeleton />
          </main>
        </div>
      </div>
    );
  }

  const isSuperAdmin = userRole === 'superadmin';

  // Base navigation for clients (Clean, minimal, eye-catching)
  const navItems = [
    {
      name: 'Overview',
      href: '/dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      name: 'আমার সহকারী',
      href: '/dashboard/assistant',
      icon: <Bot className="w-5 h-5 text-indigo-400" />,
    },
    {
      name: 'Social Channels',
      href: '/dashboard/channels',
      icon: <Share2 className="w-5 h-5" />,
    },
    {
      name: 'পোস্ট ও ভিডিও (Feed)',
      href: '/dashboard/comments',
      icon: <Film className="w-5 h-5 text-sky-400" />,
    },
    {
      name: 'রিঅ্যাক্ট ও বট শিল্ড',
      href: '/dashboard/reactions',
      icon: <ShieldAlert className="w-5 h-5 text-rose-400" />,
    },
    ...(isSuperAdmin
      ? [
          {
            name: '👑 Super Admin Master',
            href: '/admin',
            icon: <Sparkles className="w-5 h-5 text-amber-400" />,
          },
          {
            name: 'n8n & Health Monitor',
            href: '/dashboard/automation',
            icon: <Activity className="w-5 h-5 text-emerald-400" />,
          },
        ]
      : []),
    {
      name: 'Products & Stock',
      href: '/dashboard/products',
      icon: <Package className="w-5 h-5" />,
    },
    {
      name: 'AI & Shop Knowledge',
      href: '/dashboard/knowledge',
      icon: <Brain className="w-5 h-5 text-purple-400" />,
    },
    {
      name: 'Orders CRM',
      href: '/dashboard/orders',
      icon: <ShoppingBag className="w-5 h-5" />,
    },
    {
      name: 'Reports & Analytics',
      href: '/dashboard/reports',
      icon: <BarChart3 className="w-5 h-5" />,
    },
    {
      name: 'Live Inbox & Takeover',
      href: '/dashboard/inbox',
      icon: <MessageSquare className="w-5 h-5" />,
    },
    {
      name: 'বিলিং ও সাবস্ক্রিপশন',
      href: '/dashboard/billing',
      icon: <CreditCard className="w-5 h-5 text-emerald-400" />,
    },
    {
      name: 'প্রোফাইল ও সেটিংস',
      href: '/dashboard/settings',
      icon: <Settings className="w-5 h-5" />,
    },
  ];

  return (
    <div className="h-screen max-h-screen overflow-hidden bg-slate-100 flex">
      
      {/* Sidebar for Desktop */}
      <aside
        className={`hidden lg:flex lg:flex-col ${
          isCollapsed ? 'lg:w-20' : 'lg:w-64'
        } h-screen max-h-screen bg-slate-900 text-white border-r border-slate-800 shrink-0 transition-all duration-300 ease-in-out no-scrollbar overflow-hidden`}
      >
        {/* Brand Header */}
        <div className={`p-4 border-b border-slate-800 shrink-0 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center space-x-3 overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              {!isCollapsed && (
                <div className="overflow-hidden">
                  <span className="font-extrabold text-lg text-white tracking-tight">
                    ShopPilot<span className="text-indigo-400">.ai</span>
                  </span>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
                    {isSuperAdmin ? 'Master Admin' : 'Client Dashboard'}
                  </p>
                </div>
              )}
            </Link>
            {!isCollapsed && (
              <button
                onClick={toggleSidebar}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="সাইডবার সংকুচিত করুন (Collapse sidebar)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
          </div>

          {isCollapsed && (
            <button
              onClick={toggleSidebar}
              className="mt-3 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="সাইডবার প্রসারিত করুন (Expand sidebar)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {/* Active Store & Subscription Badge */}
          {!isCollapsed ? (
            <div className="mt-4 p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-600/30 text-indigo-400 flex items-center justify-center shrink-0">
                  <Store className="w-4 h-4" />
                </div>
                <div className="overflow-hidden flex-1">
                  <p className="text-xs font-bold text-white truncate">{storeName}</p>
                  <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>AI Agent Active</span>
                  </p>
                </div>
              </div>

              {/* Live Trial or Plan Indicator */}
              {subInfo && (
                <div className="mt-2 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">প্ল্যান স্ট্যাটাস:</span>
                  {subInfo.status === 'trialing' ? (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                      ট্রায়াল ({String(Math.min(7, subInfo.daysRemaining || 7)).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[parseInt(d, 10)])} দিন)
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 uppercase">
                      {subInfo.plan} ({String(subInfo.daysRemaining).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[parseInt(d, 10)])} দিন)
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div
              className="mt-3 p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 flex flex-col items-center justify-center cursor-pointer"
              title={`${storeName} • AI Active (${subInfo?.plan || 'Trial'})`}
            >
              <Store className="w-4 h-4 text-indigo-400" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mt-1" />
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto no-scrollbar">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? item.name : undefined}
                className={`flex items-center ${
                  isCollapsed ? 'justify-center px-2 py-3' : 'gap-3 px-3.5 py-2.5'
                } rounded-xl text-xs font-bold transition-all group relative ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <div className="shrink-0">{item.icon}</div>
                {!isCollapsed && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom User & Logout */}
        <div className="p-3 border-t border-slate-800">
          {!isCollapsed ? (
            <>
              <Link
                href="/dashboard/settings"
                className="flex items-center justify-between mb-3 px-2 py-1.5 rounded-xl hover:bg-slate-800 transition-colors group cursor-pointer"
                title="প্রোফাইল ও অ্যাকাউন্ট সেটিংস"
              >
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors truncate">
                    {userEmail || 'Store Client'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {isSuperAdmin ? '👑 Super Admin' : 'Client Account'}
                  </p>
                </div>
                <Settings className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors shrink-0" />
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>লগআউট (Logout)</span>
              </button>
            </>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center p-2.5 rounded-xl text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"
              title="লগআউট (Logout)"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative w-72 max-w-full bg-slate-900 text-white flex flex-col z-10 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <span className="font-extrabold text-base text-white">
                ShopPilot<span className="text-indigo-400">.ai</span>
              </span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1.5 overflow-y-auto no-scrollbar">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="shrink-0">{item.icon}</div>
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="pt-4 border-t border-slate-800 mt-4">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>লগআউট</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen max-h-screen min-w-0 overflow-hidden">
        
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              title="মেনু খুলুন"
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Desktop Sidebar Collapse Toggle */}
            <button
              onClick={toggleSidebar}
              className="hidden lg:flex items-center justify-center p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title={isCollapsed ? 'সাইডবার প্রসারিত করুন (Expand sidebar)' : 'সাইডবার সংকুচিত করুন (Collapse sidebar)'}
            >
              {isCollapsed ? (
                <PanelLeftOpen className="w-5 h-5 text-indigo-600" />
              ) : (
                <PanelLeftClose className="w-5 h-5 text-slate-600" />
              )}
            </button>

            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-900">{storeName}</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-500 font-medium capitalize">
                {pathname.replace('/dashboard', '').replace('/', '') || 'Overview'}
              </span>
            </div>
          </div>

          {/* System Telemetry / Service Connection Badge */}
          <div className="flex items-center gap-3">
            {isSuperAdmin ? (
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                <span>👑 Super Admin Console</span>
              </Link>
            ) : (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>এআই সেলস সার্ভিস: সক্রিয় (Connected)</span>
              </div>
            )}
          </div>
        </header>

        {/* Top Subscription & Grace Period Alert Banner */}
        {subInfo &&
          (subInfo.status === 'past_due' ||
            subInfo.status === 'suspended' ||
            subInfo.status === 'expired' ||
            (subInfo.daysRemaining !== undefined && subInfo.daysRemaining <= 2)) && (
            <div className="bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 text-white px-4 py-2.5 text-xs font-bold flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0 shadow-md">
              <div className="flex items-center gap-2 text-center sm:text-left">
                <AlertTriangle className="w-4 h-4 text-white shrink-0 animate-bounce" />
                <span>
                  {subInfo.status === 'suspended'
                    ? '⛔ বিল পরিশোধ না করায় আপনার এআই সেলস সার্ভিস সাময়িকভাবে স্থগিত রয়েছে।'
                    : subInfo.status === 'past_due'
                    ? `⚠️ আপনার প্যাকেজের মেয়াদ শেষ হয়েছে। ৩ দিনের গ্রেস পিরিয়ড চলছে (${subInfo.daysRemaining || 1} দিন বাকি)।`
                    : subInfo.status === 'expired'
                    ? '⛔ আপনার ৭ দিনের ফ্রি ট্রায়াল শেষ হয়েছে। সার্ভিস সচল রাখতে একটি প্যাকেজ বেছে নিন।'
                    : `⏳ আপনার চলতি প্যাকেজের মেয়াদ শেষ হতে মাত্র ${subInfo.daysRemaining} দিন বাকি।`}
                </span>
              </div>
              <Link
                href="/dashboard/billing"
                className="px-3 py-1 rounded-lg bg-white text-slate-900 font-extrabold hover:bg-slate-100 transition-colors shrink-0 text-[11px] shadow-sm"
              >
                এখনই প্যাকেজ রিনিউ বা আপগ্রেড করুন 💳
              </Link>
            </div>
          )}

        {/* Page Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto w-full">
          {children}
        </main>

      </div>

    </div>
  );
}

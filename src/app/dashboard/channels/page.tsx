'use client';

import React, { useState, useEffect } from 'react';
import { getSessionToken } from '@/lib/session';
import {
  Share2,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Power,
  ShieldCheck,
  ExternalLink,
  MessageSquare,
  Layers,
  Info,
  ChevronDown,
  ChevronUp,
  Trash2,
  Copy,
  Check,
  Bot,
  Send,
  Sparkles,
  Phone,
} from 'lucide-react';

interface Channel {
  id: string;
  platform: 'facebook' | 'instagram' | 'whatsapp';
  channel_identifier: string;
  channel_name: string;
  ai_active: boolean;
  webhook_verified: boolean;
  quality_rating: string;
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [masterStatus, setMasterStatus] = useState<any>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [platform, setPlatform] = useState<'facebook' | 'instagram' | 'whatsapp'>('facebook');
  const [channelName, setChannelName] = useState('');
  const [channelIdentifier, setChannelIdentifier] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [oauthSuccess, setOauthSuccess] = useState(false);
  const [oauthSuccessMessage, setOauthSuccessMessage] = useState('');
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [oauthErrorDetails, setOauthErrorDetails] = useState<string | null>(null);
  const [quickSyncLoading, setQuickSyncLoading] = useState(false);
  const [showAdvancedMeta, setShowAdvancedMeta] = useState(false);

  // Live AI Testing Modal State
  const [testingChannel, setTestingChannel] = useState<Channel | null>(null);
  const [testMessage, setTestMessage] = useState('');
  const [testSenderPhone, setTestSenderPhone] = useState('01712345678');
  const [testLoading, setTestLoading] = useState(false);
  const [testHistory, setTestHistory] = useState<Array<{ sender: 'user' | 'ai'; text: string; order?: any }>>([]);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [storeContext, setStoreContext] = useState<any>(null);

  useEffect(() => {
    fetchChannels();
    // Check if redirected after OAuth callback
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'true') {
      const pageName = params.get('channel_name') || 'চ্যানেল';
      const isWa = params.get('platform') === 'whatsapp';
      setOauthSuccessMessage(
        isWa
          ? `🎉 অভিনন্দন! "${pageName}" সফলভাবে মেটা দিয়ে সংযুক্ত হয়েছে এবং হোয়াটসঅ্যাপ এআই সক্রিয়!`
          : `🎉 অভিনন্দন! "${pageName}" সফলভাবে সংযুক্ত হয়েছে এবং এআই সেলস কনসালট্যান্ট সক্রিয় করা হয়েছে!`
      );
      setOauthSuccess(true);
      setOauthError(null);
      setTimeout(() => setOauthSuccess(false), 8000);
    }
    if (params.get('error')) {
      const err = params.get('error');
      setOauthError(err);
      setOauthErrorDetails(params.get('details') || null);
    }
    // Clean URL bar smoothly
    if (params.get('connected') || params.get('error')) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleFacebookOAuthLogin = () => {
    const token = getSessionToken();
    if (!token) {
      alert('আপনার লগইন সেশনের মেয়াদ শেষ হয়েছে। অনুগ্রহ করে আবার লগইন করুন।');
      window.location.href = '/login';
      return;
    }
    window.location.href = `/api/auth/facebook/login?token=${token}`;
  };

  const handleWhatsAppOAuthLogin = () => {
    const token = getSessionToken();
    if (!token) {
      alert('আপনার লগইন সেশনের মেয়াদ শেষ হয়েছে। অনুগ্রহ করে আবার লগইন করুন।');
      window.location.href = '/login';
      return;
    }
    window.location.href = `/api/auth/whatsapp/login?token=${token}`;
  };

  const handleQuickSync = async () => {
    setQuickSyncLoading(true);
    try {
      const token = getSessionToken();
      const res = await fetch('/api/channels/quick-sync', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Quick sync failed');
      setOauthSuccessMessage(data.message || 'ফেসবুক পেজ সফলভাবে কানেক্ট হয়েছে!');
      setOauthSuccess(true);
      setOauthError(null);
      fetchChannels();
    } catch (err: any) {
      setOauthError(err.message);
    } finally {
      setQuickSyncLoading(false);
    }
  };

  const fetchChannels = async () => {
    setLoading(true);
    try {
      const token = getSessionToken();
      const res = await fetch('/api/channels', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.channels) {
        setChannels(data.channels);
      } else {
        setChannels([]);
      }

      // Fetch Meta Master Architecture status
      fetch('/api/channels/master-status', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((r) => r.json())
        .then((d) => setMasterStatus(d))
        .catch(() => {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleAi = async (channel: Channel) => {
    setUpdatingId(channel.id);
    const newStatus = !channel.ai_active;

    // Optimistic UI update
    setChannels((prev) =>
      prev.map((c) => (c.id === channel.id ? { ...c, ai_active: newStatus } : c))
    );

    try {
      const token = getSessionToken();
      const res = await fetch('/api/channels', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          channelId: channel.id,
          ai_active: newStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Revert on failure
        setChannels((prev) =>
          prev.map((c) => (c.id === channel.id ? { ...c, ai_active: channel.ai_active } : c))
        );
        alert(data.error || 'এআই স্ট্যাটাস পরিবর্তন করা যায়নি');
      } else {
        setOauthSuccessMessage(
          newStatus
            ? `🟢 "${channel.channel_name}"-এর এআই সফলভাবে চালু করা হয়েছে!`
            : `🔴 "${channel.channel_name}"-এর এআই সম্পূর্ণ বন্ধ (OFF) করা হয়েছে। কোনো অটো-রিপ্লাই যাবে না।`
        );
        setOauthSuccess(true);
        setOauthError(null);
        setTimeout(() => setOauthSuccess(false), 5000);
      }
    } catch (e) {
      console.error('Failed to toggle AI status in DB:', e);
      setChannels((prev) =>
        prev.map((c) => (c.id === channel.id ? { ...c, ai_active: channel.ai_active } : c))
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCopyWaLink = (phone: string) => {
    const cleanPhone = phone.replace(/[\s\-\+\(\)]/g, '');
    const waLink = `https://wa.me/${cleanPhone}?text=Hello,%20I%20want%20to%20order`;
    navigator.clipboard.writeText(waLink);
    setCopiedLink(phone);
    setTimeout(() => setCopiedLink(null), 3000);
  };

  const handleDeleteChannel = async (channelId: string, name: string) => {
    if (
      !confirm(
        `আপনি কি নিশ্চিত যে "${name}" পেজটি সংযোগ বিচ্ছিন্ন (Disconnect) করতে চান? নিশ্চিত করলে এই পেজটি ড্যাশবোর্ড থেকে মুছে যাবে।`
      )
    ) {
      return;
    }

    setDeletingId(channelId);
    try {
      const token = getSessionToken();
      const res = await fetch(`/api/channels?channelId=${channelId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (res.ok) {
        setChannels((prev) => prev.filter((c) => c.id !== channelId));
        setOauthSuccessMessage(data.message || `"${name}" চ্যানেলটি সফলভাবে মুছে ফেলা হয়েছে।`);
        setOauthSuccess(true);
        setOauthError(null);
        setTimeout(() => setOauthSuccess(false), 6000);
      } else {
        alert(data.error || 'চ্যানেল ডিলিট করা যায়নি।');
      }
    } catch (e: any) {
      console.error('Delete channel error:', e);
      alert(e.message || 'চ্যানেল ডিলিট করা যায়নি।');
    } finally {
      setDeletingId(null);
    }
  };

  const openTestModal = async (channel: Channel) => {
    setTestingChannel(channel);
    setTestMessage('');
    if (channel.platform === 'whatsapp') {
      setTestHistory([
        {
          sender: 'ai',
          text: `👋 আসসালামু আলাইকুম! আমি আপনার "${channel.channel_name}"-এর পার্সোনাল WhatsApp এআই ম্যানেজার।\n\nআপনি "মেনু", "অর্ডার", "স্টক", "বিক্রি" লিখে পাঠাতে পারেন অথবা যেকোনো স্বাভাবিক প্রশ্ন জিজ্ঞেস করতে পারেন!`,
        },
      ]);
    } else {
      setTestHistory([
        {
          sender: 'ai',
          text: `নমস্কার/সালাম! আমি "${channel.channel_name}"-এর এআই সেলস কনসালট্যান্ট। আপনি যেকোনো প্রশ্ন জিজ্ঞেস করতে পারেন অথবা প্রোডাক্টের সাইজ ও ঠিকানা দিয়ে টেস্ট অর্ডার করতে পারেন!`,
        },
      ]);
    }

    try {
      const token = getSessionToken();
      const res = await fetch('/api/channels/test-context', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.suggestions) {
        setStoreContext(data);
      }
    } catch (e) {
      console.warn('Could not fetch store test context:', e);
    }
  };

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testMessage.trim() || !testingChannel || testLoading) return;
    const msg = testMessage.trim();
    setTestMessage('');
    setTestHistory((prev) => [...prev, { sender: 'user', text: msg }]);
    setTestLoading(true);

    try {
      const token = getSessionToken();
      let res;
      if (testingChannel.platform === 'whatsapp') {
        res = await fetch('/api/whatsapp-copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senderPhone: testSenderPhone,
            messageText: msg,
          }),
        });
      } else {
        res = await fetch('/api/channels/test-message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            channelId: testingChannel.id,
            messageText: msg,
            customerPhone: testSenderPhone,
          }),
        });
      }

      const data = await res.json();
      if (data.replyText) {
        setTestHistory((prev) => [
          ...prev,
          {
            sender: 'ai',
            text: data.replyText,
            order: data.orderCreated ? { orderNumber: data.orderNumber, orderId: data.orderId } : null,
          },
        ]);
      } else {
        setTestHistory((prev) => [
          ...prev,
          { sender: 'ai', text: data.error || 'দুঃখিত, কোনো উত্তর পাওয়া যায়নি।' },
        ]);
      }
    } catch (err: any) {
      setTestHistory((prev) => [
        ...prev,
        { sender: 'ai', text: 'দুঃখিত, টেস্ট মেসেজ প্রসেস করতে সাময়িক সমস্যা হয়েছে।' },
      ]);
    } finally {
      setTestLoading(false);
    }
  };

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = getSessionToken();
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          platform,
          channel_name: channelName,
          channel_identifier: channelIdentifier,
          access_token: accessToken,
        }),
      });
      const data = await res.json();
      if (res.ok && data.channel) {
        setChannels((prev) => [data.channel, ...prev.filter((c) => c.id !== data.channel.id)]);
        setModalOpen(false);
        setChannelName('');
        setChannelIdentifier('');
        setAccessToken('');
        setOauthSuccessMessage(
          platform === 'whatsapp'
            ? `🎉 চমৎকার! আপনার WhatsApp নম্বর (+${data.channel.channel_identifier}) সফলভাবে কানেক্ট হয়েছে এবং এআই সেলস কনসালট্যান্ট সক্রিয়!`
            : `🎉 চ্যানেল সফলভাবে কানেক্ট হয়েছে!`
        );
        setOauthSuccess(true);
        setTimeout(() => setOauthSuccess(false), 8000);
      } else {
        alert(data.error || 'চ্যানেল যুক্ত করতে সমস্যা হয়েছে।');
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'চ্যানেল যুক্ত করতে সমস্যা হয়েছে।');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      
      {/* OAuth Success Alert Banner */}
      {oauthSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shadow-sm animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-bold">
              {oauthSuccessMessage || '🎉 অভিনন্দন! আপনার ফেসবুক পেজ সফলভাবে সংযুক্ত হয়েছে এবং এআই সক্রিয় করা হয়েছে!'}
            </span>
          </div>
          <button onClick={() => setOauthSuccess(false)} className="text-emerald-600 hover:text-emerald-800 font-bold p-1">
            ✕
          </button>
        </div>
      )}

      {/* OAuth Error Assistance Card */}
      {oauthError && (
        <div className="p-5 rounded-2xl bg-amber-50/90 border-2 border-amber-300/80 text-amber-950 text-xs shadow-md space-y-3 animate-in fade-in duration-300">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-200/80 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-sm text-amber-950">
                  ফেসবুক পেজ কানেকশনে সাময়িক সমস্যা হয়েছে ({oauthError})
                </h3>
                <p className="text-slate-700 mt-1 leading-relaxed">
                  ফেসবুকের রিডাইরেক্ট কোড হ্যান্ডশেকের সময় সমস্যা হয়েছে। তবে চিন্তার কোনো কারণ নেই, আপনি নিচের যেকোনো একটি সহজ উপায়ে এখনই পেজ কানেক্ট করতে পারেন:
                </p>
                {oauthErrorDetails && (
                  <p className="mt-1.5 font-mono text-[11px] bg-white/80 p-2 rounded-lg border border-amber-200 text-amber-900 break-all">
                    মেটা মেসেজ: {oauthErrorDetails}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => setOauthError(null)}
              className="text-amber-700 hover:text-amber-900 font-bold text-sm p-1 rounded-lg hover:bg-amber-100"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-amber-200/60">
            <button
              onClick={handleFacebookOAuthLogin}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all"
            >
              <span className="font-black">f</span>
              <span>পুনরায় ফেসবুক কানেক্ট করুন</span>
            </button>

            <button
              onClick={() => {
                setPlatform('facebook');
                setChannelName('');
                setChannelIdentifier('');
                setAccessToken('');
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 transition-all"
            >
              <span>🔑</span>
              <span>ম্যানুয়ালি টোকেন প্রদান করুন</span>
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">সোশ্যাল চ্যানেল কানেকশন হাব</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            ফেসবুক মেসেঞ্জার, ইনস্টাগ্রাম এবং হোয়াটসঅ্যাপ চ্যানেল কানেক্ট করুন ও এআই অটোমেশন পরিচালনা করুন
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* 1-Click Facebook OAuth Connect Button */}
          <button
            onClick={handleFacebookOAuthLogin}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all"
          >
            <span className="font-bold text-sm">f</span>
            <span>১-ক্লিকে ফেসবুক পেজ কানেক্ট</span>
          </button>

          {/* Instagram Connect Button */}
          <button
            onClick={() => {
              setPlatform('instagram');
              setChannelName('');
              setChannelIdentifier('');
              setAccessToken('');
              setModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-md shadow-pink-600/20 transition-all"
          >
            <span>📸</span>
            <span>ইনস্টাগ্রাম কানেক্ট</span>
          </button>

          {/* 1-Click WhatsApp OAuth Connect Button */}
          <button
            onClick={handleWhatsAppOAuthLogin}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all"
          >
            <span>💬</span>
            <span>১-ক্লিকে হোয়াটসঅ্যাপ কানেক্ট</span>
          </button>

          {/* WhatsApp Copilot QR Runner & Test Button */}
          <button
            onClick={() =>
              openTestModal({
                id: 'whatsapp-copilot-bot',
                platform: 'whatsapp',
                channel_identifier: '01712345678',
                channel_name: 'WhatsApp AI Manager',
                ai_active: true,
                webhook_verified: true,
                quality_rating: 'GREEN',
              })
            }
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 shadow-md shadow-emerald-600/20 transition-all"
          >
            <span>📱</span>
            <span>WhatsApp সহকারী (QR ও টেস্ট)</span>
          </button>

          <button
            onClick={() => {
              setPlatform('facebook');
              setModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>ম্যানুয়ালি চ্যানেল যোগ</span>
          </button>
        </div>
      </div>

      {/* Meta Master Architecture & Omnichannel Diagnostics Panel */}
      {masterStatus && (
        <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-7 shadow-xl border border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black tracking-tight">মেটা মাস্টার আর্কিটেকচার ও ওমনি-চ্যানেল হাব</h2>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                    Master App Live
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Master App ID: <span className="font-mono text-indigo-300 font-bold">{masterStatus.masterApp?.appId}</span> • {masterStatus.masterApp?.mode}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all self-start sm:self-auto"
            >
              <span>{showDiagnostics ? 'সংক্ষেপ করুন' : 'বিস্তারিত আর্কিটেকচার দেখুন'}</span>
              {showDiagnostics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {showDiagnostics && (
            <div className="mt-6 space-y-6 text-xs">
              {/* Omnichannel Matrix (FB, IG, WA) */}
              <div>
                <h3 className="text-slate-400 uppercase tracking-wider font-extrabold text-[11px] mb-3">
                  ওমনি-চ্যানেল ইন্টিগ্রেশন স্ট্যাটাস (Facebook • Instagram • WhatsApp)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Facebook */}
                  <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-slate-200">Facebook Messenger & Feed</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                          সক্রিয় (Active)
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        কাস্টমার মেসেজ ও পোস্টের কমেন্টে স্বয়ংক্রিয় এআই রিপ্লাই এবং ১-ক্লিক প্রাইভেট ইনবক্স মেসেজিং চালু আছে।
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between">
                      <span className="text-indigo-300 font-bold text-[11px]">
                        সংযুক্ত পেজ: {masterStatus.omnichannelStatus?.facebook?.connectedCount || 0} টি
                      </span>
                      <button
                        onClick={handleFacebookOAuthLogin}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px]"
                      >
                        + পেজ কানেক্ট
                      </button>
                    </div>
                  </div>

                  {/* Instagram */}
                  <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-slate-200">Instagram Direct DM</span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-[10px]">
                          প্রস্তুত (Ready)
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        {masterStatus.omnichannelStatus?.instagram?.note}
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between">
                      <span className="text-amber-300 font-bold text-[11px]">
                        সংযুক্ত চ্যানেল: {masterStatus.omnichannelStatus?.instagram?.connectedCount || 0} টি
                      </span>
                      <button
                        onClick={() => {
                          setPlatform('instagram');
                          setChannelName('');
                          setChannelIdentifier('');
                          setAccessToken('');
                          setModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 text-white font-bold text-[10px]"
                      >
                        + ইনস্টাগ্রাম কানেক্ট
                      </button>
                    </div>
                  </div>

                  {/* WhatsApp */}
                  <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-slate-200">WhatsApp Cloud API</span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-[10px]">
                          প্রস্তুত (Ready)
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        {masterStatus.omnichannelStatus?.whatsapp?.note}
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between">
                      <span className="text-emerald-300 font-bold text-[11px]">
                        সংযুক্ত নম্বর: {masterStatus.omnichannelStatus?.whatsapp?.connectedCount || 0} টি
                      </span>
                      <button
                        onClick={() => {
                          setPlatform('whatsapp');
                          setChannelName('');
                          setChannelIdentifier('');
                          setAccessToken('');
                          setModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px]"
                      >
                        + হোয়াটসঅ্যাপ কানেক্ট
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Master App Production Checklist */}
              <div className="pt-4 border-t border-slate-800">
                <h3 className="text-slate-400 uppercase tracking-wider font-extrabold text-[11px] mb-3">
                  ১০০+ ক্লায়েন্টের জন্য মেটা আর্কিটেকচার চেকলিস্ট (Production Readiness)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {masterStatus.productionRoadmap?.map((item: any) => (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                        item.status === 'COMPLETED'
                          ? 'bg-emerald-950/20 border-emerald-800/40 text-slate-300'
                          : 'bg-amber-950/20 border-amber-800/40 text-slate-300'
                      }`}
                    >
                      <div className="mt-0.5">
                        {item.status === 'COMPLETED' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-slate-100 text-xs">{item.title}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{item.details}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Channels Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm animate-pulse space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-200" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-slate-200 rounded w-1/2" />
                  <div className="h-3 bg-slate-200 rounded w-1/3" />
                </div>
              </div>
              <div className="h-16 bg-slate-100 rounded-xl" />
              <div className="h-8 bg-slate-200 rounded-xl" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Facebook Messenger Card */}
          {channels
            .filter((c) => c.platform === 'facebook')
            .map((c) => (
              <div
                key={c.id}
                className={`bg-white rounded-3xl p-6 sm:p-7 border transition-all shadow-sm flex flex-col justify-between relative overflow-hidden group ${
                  c.ai_active ? 'border-slate-200/80 hover:shadow-md' : 'border-rose-200 bg-rose-50/10 hover:shadow-md'
                }`}
              >
                <div className={`absolute top-0 right-0 w-28 h-28 rounded-full blur-2xl -mr-10 -mt-10 ${c.ai_active ? 'bg-blue-50/50' : 'bg-rose-100/40'}`} />

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xl shadow-sm">
                      f
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {/* Clear AI Active Badge */}
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          c.ai_active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            c.ai_active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                          }`}
                        />
                        <span>{c.ai_active ? '🟢 এআই চালু (ON)' : '🔴 এআই সম্পূর্ণ বন্ধ (OFF)'}</span>
                      </span>

                      <button
                        onClick={() => handleDeleteChannel(c.id, c.channel_name)}
                        disabled={deletingId === c.id}
                        title="পেজ ডিসকানেক্ট করুন"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-extrabold text-base text-slate-900">{c.channel_name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono">Page ID: {c.channel_identifier}</p>

                  <div className="mt-5 space-y-2 text-xs border-t border-slate-100 pt-4">
                    <div className="flex justify-between py-1 text-slate-600">
                      <span>প্ল্যাটফর্ম:</span>
                      <span className="font-bold text-slate-800">Facebook Messenger</span>
                    </div>
                    <div className="flex justify-between py-1 text-slate-600">
                      <span>কমেন্ট ও মেসেজ এআই:</span>
                      <span className={`font-bold ${c.ai_active ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {c.ai_active ? 'সক্রিয় (Active)' : 'সাময়িক বন্ধ (Paused)'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 text-slate-600">
                      <span>Webhook সংযোগ:</span>
                      <span className="font-bold text-slate-700">
                        {c.webhook_verified ? '✅ ভেরিফাইড' : '⚠️ পেন্ডিং'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Controls: AI ON/OFF Toggle, Test, and Disconnect */}
                <div className="mt-6 pt-5 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/60">
                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        {c.ai_active ? 'এআই চালু আছে' : 'এআই অফ করা আছে'}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {c.ai_active ? 'অর্ডার ও মেসেজে স্বয়ংক্রিয় রিপ্লাই যাবে' : 'কোনো স্বয়ংক্রিয় মেসেজ যাবে না'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleAi(c)}
                      disabled={updatingId === c.id}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        c.ai_active ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          c.ai_active ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Fast Action Buttons */}
                  <button
                    type="button"
                    onClick={() => toggleAi(c)}
                    disabled={updatingId === c.id}
                    className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                      c.ai_active
                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>
                      {updatingId === c.id
                        ? 'আপডেট হচ্ছে...'
                        : c.ai_active
                        ? '⏸️ এআই অফ করুন (Pause AI)'
                        : '▶️ এআই চালু করুন (Turn ON)'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openTestModal(c)}
                    className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>🧪 ফেসবুক এআই টেস্ট করুন</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteChannel(c.id, c.channel_name)}
                    disabled={deletingId === c.id}
                    className="w-full py-2 px-3 rounded-xl bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 hover:text-rose-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>{deletingId === c.id ? 'ডিসকানেক্ট হচ্ছে...' : '🗑️ পেজ ডিসকানেক্ট / ডিলিট করুন'}</span>
                  </button>
                </div>
              </div>
            ))}

          {/* Instagram Direct Card */}
          {channels
            .filter((c) => c.platform === 'instagram')
            .map((c) => (
              <div
                key={c.id}
                className={`bg-white rounded-3xl p-6 sm:p-7 border transition-all shadow-sm flex flex-col justify-between relative overflow-hidden ${
                  c.ai_active ? 'border-slate-200/80 hover:shadow-md' : 'border-rose-200 bg-rose-50/10 hover:shadow-md'
                }`}
              >
                <div className={`absolute top-0 right-0 w-28 h-28 rounded-full blur-2xl -mr-10 -mt-10 ${c.ai_active ? 'bg-pink-50/50' : 'bg-rose-100/40'}`} />

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                      IG
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          c.ai_active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            c.ai_active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                          }`}
                        />
                        <span>{c.ai_active ? '🟢 এআই চালু (ON)' : '🔴 এআই সম্পূর্ণ বন্ধ (OFF)'}</span>
                      </span>
                      <button
                        onClick={() => handleDeleteChannel(c.id, c.channel_name)}
                        disabled={deletingId === c.id}
                        title="চ্যানেল ডিসকানেক্ট করুন"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-extrabold text-base text-slate-900">{c.channel_name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono">IG ID: {c.channel_identifier}</p>

                  <div className="mt-5 space-y-2 text-xs border-t border-slate-100 pt-4">
                    <div className="flex justify-between py-1 text-slate-600">
                      <span>প্ল্যাটফর্ম:</span>
                      <span className="font-bold text-slate-800">Instagram Direct DM</span>
                    </div>
                    <div className="flex justify-between py-1 text-slate-600">
                      <span>ডিএম ও কমেন্ট এআই:</span>
                      <span className={`font-bold ${c.ai_active ? 'text-pink-600' : 'text-rose-600'}`}>
                        {c.ai_active ? 'সক্রিয় (Active)' : 'সাময়িক বন্ধ (Paused)'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Controls: AI ON/OFF Toggle, Test, and Disconnect */}
                <div className="mt-6 pt-5 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/60">
                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        {c.ai_active ? 'এআই চালু আছে' : 'এআই অফ করা আছে'}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {c.ai_active ? 'ডিএম ও কমেন্টে উত্তর দিচ্ছে' : 'বট সাময়িকভাবে বন্ধ আছে'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleAi(c)}
                      disabled={updatingId === c.id}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        c.ai_active ? 'bg-indigo-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          c.ai_active ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleAi(c)}
                    disabled={updatingId === c.id}
                    className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                      c.ai_active
                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>
                      {updatingId === c.id
                        ? 'আপডেট হচ্ছে...'
                        : c.ai_active
                        ? '⏸️ এআই অফ করুন (Pause AI)'
                        : '▶️ এআই চালু করুন (Turn ON)'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openTestModal(c)}
                    className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>🧪 ইনস্টাগ্রাম এআই টেস্ট করুন</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteChannel(c.id, c.channel_name)}
                    disabled={deletingId === c.id}
                    className="w-full py-2 px-3 rounded-xl bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 hover:text-rose-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>{deletingId === c.id ? 'ডিসকানেক্ট হচ্ছে...' : '🗑️ ইনস্টাগ্রাম ডিসকানেক্ট করুন'}</span>
                  </button>
                </div>
              </div>
            ))}

          {/* WhatsApp Cloud API Card */}
          {channels
            .filter((c) => c.platform === 'whatsapp')
            .map((c) => {
              const cleanPhone = c.channel_identifier.replace(/[\s\-\+\(\)]/g, '');
              const waUrl = `https://wa.me/${cleanPhone}?text=Hello,%20I%20want%20to%20order`;

              return (
                <div
                  key={c.id}
                  className={`bg-white rounded-3xl p-6 sm:p-7 border transition-all shadow-sm flex flex-col justify-between relative overflow-hidden group ${
                    c.ai_active ? 'border-slate-200/80 hover:shadow-md' : 'border-rose-200 bg-rose-50/10 hover:shadow-md'
                  }`}
                >
                  <div className={`absolute top-0 right-0 w-28 h-28 rounded-full blur-2xl -mr-10 -mt-10 ${c.ai_active ? 'bg-emerald-50/50' : 'bg-rose-100/40'}`} />

                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                        💬
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                            c.ai_active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              c.ai_active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                            }`}
                          />
                          <span>{c.ai_active ? '🟢 এআই চালু (ON)' : '🔴 এআই সম্পূর্ণ বন্ধ (OFF)'}</span>
                        </span>
                        <button
                          onClick={() => handleDeleteChannel(c.id, c.channel_name)}
                          disabled={deletingId === c.id}
                          title="চ্যানেল ডিসকানেক্ট করুন"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <h3 className="font-extrabold text-base text-slate-900">{c.channel_name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 font-mono flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-emerald-600 inline" />
                      <span>+{c.channel_identifier}</span>
                    </p>

                    {/* Smart wa.me Order Link */}
                    <div className="mt-4 p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-emerald-900">স্মার্ট WhatsApp লিঙ্ক:</span>
                        <span className="text-[10px] text-emerald-700 font-medium">কাস্টমারকে পাঠানোর লিঙ্ক</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-xl border border-emerald-200">
                        <span className="font-mono text-[10px] text-slate-600 truncate flex-1 pl-1">
                          wa.me/{cleanPhone}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyWaLink(c.channel_identifier)}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 shrink-0"
                        >
                          {copiedLink === c.channel_identifier ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>কপি হয়েছে!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>কপি</span>
                            </>
                          )}
                        </button>
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all shrink-0"
                          title="WhatsApp-এ ওপেন করুন"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 text-xs border-t border-slate-100 pt-3">
                      <div className="flex justify-between py-0.5 text-slate-600">
                        <span>প্ল্যাটফর্ম:</span>
                        <span className="font-bold text-slate-800">WhatsApp Commerce Hub</span>
                      </div>
                      <div className="flex justify-between py-0.5 text-slate-600">
                        <span>অটো-রিপ্লাই ও সেলস এআই:</span>
                        <span className={`font-bold ${c.ai_active ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {c.ai_active ? 'সক্রিয় (Active)' : 'সাময়িক বন্ধ (Paused)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Controls: AI ON/OFF Toggle, Test, and Disconnect */}
                  <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/60">
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {c.ai_active ? 'হোয়াটসঅ্যাপ এআই চালু' : 'হোয়াটসঅ্যাপ এআই অফ'}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {c.ai_active ? 'গ্রাহকের মেসেজে স্বয়ংক্রিয় উত্তর দিচ্ছে' : 'এআই বর্তমানে বন্ধ আছে'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleAi(c)}
                        disabled={updatingId === c.id}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          c.ai_active ? 'bg-emerald-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            c.ai_active ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleAi(c)}
                      disabled={updatingId === c.id}
                      className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                        c.ai_active
                          ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>
                        {updatingId === c.id
                          ? 'আপডেট হচ্ছে...'
                          : c.ai_active
                          ? '⏸️ এআই অফ করুন (Pause AI)'
                          : '▶️ এআই চালু করুন (Turn ON)'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openTestModal(c)}
                      className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>🧪 হোয়াটসঅ্যাপ এআই টেস্ট করুন</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteChannel(c.id, c.channel_name)}
                      disabled={deletingId === c.id}
                      className="w-full py-2 px-3 rounded-xl bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 hover:text-rose-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      <span>{deletingId === c.id ? 'ডিসকানেক্ট হচ্ছে...' : '🗑️ হোয়াটসঅ্যাপ ডিসকানেক্ট / রিমুভ করুন'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {channels.length === 0 && !loading && (
        <div className="text-center py-16 px-4 bg-white rounded-3xl border border-slate-200/80 shadow-sm max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
            <Share2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">এখনো কোনো সোশ্যাল চ্যানেল কানেক্ট করা হয়নি</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            আপনার ফেসবুক পেজ, ইনস্টাগ্রাম বা হোয়াটসঅ্যাপ যুক্ত করুন যাতে এআই স্বয়ংক্রিয়ভাবে মেসেজের উত্তর দিতে পারে।
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন চ্যানেল যুক্ত করুন</span>
          </button>
        </div>
      )}

      {/* Add Channel Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200">
            <h3 className="text-lg font-black text-slate-900">নতুন সোশ্যাল চ্যানেল যুক্ত করুন</h3>
            <p className="text-xs text-slate-500 mt-1">
              প্ল্যাটফর্ম নির্বাচন করুন ও ক্রেডেনশিয়াল প্রদান করুন
            </p>

            {/* Platform Visual Tab Selectors */}
            <div className="grid grid-cols-3 gap-2.5 mt-4 p-1.5 bg-slate-100 rounded-2xl">
              <button
                type="button"
                onClick={() => setPlatform('facebook')}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                  platform === 'facebook'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-blue-600'
                }`}
              >
                <span className="font-extrabold text-sm">f</span>
                <span>Facebook</span>
              </button>
              <button
                type="button"
                onClick={() => setPlatform('instagram')}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                  platform === 'instagram'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-pink-600'
                }`}
              >
                <span>📸</span>
                <span>Instagram</span>
              </button>
              <button
                type="button"
                onClick={() => setPlatform('whatsapp')}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                  platform === 'whatsapp'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-emerald-600'
                }`}
              >
                <span>💬</span>
                <span>WhatsApp</span>
              </button>
            </div>

            <form onSubmit={handleAddChannel} className="mt-5 space-y-4 text-xs">
              {platform === 'whatsapp' ? (
                <>
                  {/* Option 1: 1-Click Meta OAuth Redirect Button */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs flex items-center gap-1.5">
                        <span>💬</span>
                        <span>১-ক্লিকে মেটা দিয়ে WhatsApp কানেক্ট</span>
                      </span>
                      <span className="px-2 py-0.5 bg-white/20 text-white rounded-full text-[10px] font-bold">
                        রিকমেন্ডেড
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-50 leading-relaxed">
                      মেটাতে লগইন করে আপনার বিজনেস অ্যাকাউন্ট ও হোয়াটসঅ্যাপ সিলেক্ট করুন। ফেসবুক পেজের মতো সরাসরি কানেক্ট হয়ে যাবে।
                    </p>
                    <button
                      type="button"
                      onClick={handleWhatsAppOAuthLogin}
                      className="w-full py-2.5 px-4 bg-white text-emerald-800 hover:bg-emerald-50 rounded-xl font-black text-xs transition-all shadow-sm flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>মেটা লগইনে রিডাইরেক্ট করুন →</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 my-2">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">অথবা সরাসরি নম্বর দিন</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                      WhatsApp বিজনেস মোবাইল নম্বর
                    </label>
                    <input
                      type="text"
                      required
                      value={channelIdentifier}
                      onChange={(e) => setChannelIdentifier(e.target.value)}
                      placeholder="যেমন: 01712345678"
                      className="w-full p-2.5 rounded-xl border border-slate-200 font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      নম্বরটি আপনার পেজের সাথে যুক্ত নম্বর অথবা যেকোনো সক্রিয় হোয়াটসঅ্যাপ নম্বর হতে পারে।
                    </p>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                      শপ / বিজনেস নাম
                    </label>
                    <input
                      type="text"
                      required
                      value={channelName}
                      onChange={(e) => setChannelName(e.target.value)}
                      placeholder="যেমন: Little Joys WhatsApp"
                      className="w-full p-2.5 rounded-xl border border-slate-200 font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* Advanced Collapsible Accordion */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedMeta(!showAdvancedMeta)}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1"
                    >
                      <span>{showAdvancedMeta ? '▾' : '▸'}</span>
                      <span>মেটা ক্লাউড এপিআই সেটিংস (ঐচ্ছিক/ডেভেলপারদের জন্য)</span>
                    </button>

                    {showAdvancedMeta && (
                      <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3 animate-in fade-in">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase">
                            Phone Number ID (Optional)
                          </label>
                          <input
                            type="text"
                            value={channelIdentifier}
                            onChange={(e) => setChannelIdentifier(e.target.value)}
                            placeholder="যেমন: 10892746198"
                            className="w-full p-2 rounded-lg border border-slate-200 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase">
                            Permanent Access Token (Optional)
                          </label>
                          <input
                            type="password"
                            value={accessToken}
                            onChange={(e) => setAccessToken(e.target.value)}
                            placeholder="EAA..."
                            className="w-full p-2 rounded-lg border border-slate-200 text-xs font-mono"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                      {platform === 'facebook'
                        ? 'ফেসবুক পেজের নাম'
                        : 'ইনস্টাগ্রাম অ্যাকাউন্ট নাম (@handle)'}
                    </label>
                    <input
                      type="text"
                      required
                      value={channelName}
                      onChange={(e) => setChannelName(e.target.value)}
                      placeholder={
                        platform === 'facebook'
                          ? 'যেমন: Little Joys'
                          : 'যেমন: @littlejoys_official'
                      }
                      className="w-full p-2.5 rounded-xl border border-slate-200 font-medium text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                      {platform === 'facebook' ? 'Facebook Page ID' : 'Instagram Account ID'}
                    </label>
                    <input
                      type="text"
                      required
                      value={channelIdentifier}
                      onChange={(e) => setChannelIdentifier(e.target.value)}
                      placeholder="যেমন: 1374129259109200"
                      className="w-full p-2.5 rounded-xl border border-slate-200 font-medium text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Access Token (Page Token)
                    </label>
                    <input
                      type="password"
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder="EAA..."
                      className="w-full p-2.5 rounded-xl border border-slate-200 font-medium text-slate-900"
                    />
                  </div>
                </>
              )}

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-5 py-2.5 rounded-xl text-white font-bold transition-all shadow-md ${
                    platform === 'whatsapp'
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                  }`}
                >
                  {submitting ? 'সেভ হচ্ছে...' : platform === 'whatsapp' ? '🟢 WhatsApp যুক্ত করুন' : 'চ্যানেল সেভ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live AI Test Chat Simulator Modal */}
      {testingChannel && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] animate-in fade-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white shadow-sm ${
                    testingChannel.platform === 'whatsapp'
                      ? 'bg-emerald-600'
                      : testingChannel.platform === 'facebook'
                      ? 'bg-blue-600'
                      : 'bg-pink-600'
                  }`}
                >
                  {testingChannel.platform === 'whatsapp' ? '💬' : testingChannel.platform === 'facebook' ? 'f' : 'IG'}
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                    <span>এআই লাইভ সেলস চ্যাট টেস্ট</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      লাইভ সিমুলেটর
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {testingChannel.channel_name} ({testingChannel.platform === 'whatsapp' ? 'WhatsApp' : 'Facebook'})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTestingChannel(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 font-bold"
              >
                ✕
              </button>
            </div>

            {/* WhatsApp Copilot Info Banner */}
            {testingChannel.platform === 'whatsapp' && (
              <div className="mt-3 p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200/80 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-emerald-950 flex items-center gap-1.5">
                    <span>📱</span>
                    <span>WhatsApp ওনার সহকারী মোড (Zero-Login AI Manager)</span>
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-200/60 text-emerald-800 text-[10px] font-bold rounded-md">
                    Terminal QR + Webhook Ready
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  মেটা ক্লাউড এপিআই ভেরিফিকেশন ছাড়া যেকোনো বাংলাদেশি সিম দিয়ে চালাতে আপনার পিসি বা সার্ভার টার্মিনালে রান করুন:{' '}
                  <code className="bg-white px-1.5 py-0.5 rounded text-emerald-900 font-mono font-bold border border-emerald-300">
                    npm run bot:whatsapp
                  </code>
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-emerald-200/60 text-[11px]">
                  <span className="text-emerald-950 font-bold">শপ ওনার মোবাইল নম্বর:</span>
                  <input
                    type="text"
                    value={testSenderPhone}
                    onChange={(e) => setTestSenderPhone(e.target.value)}
                    placeholder="01712345678"
                    className="px-2.5 py-1 rounded-lg border border-emerald-300 bg-white font-mono text-xs w-36 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <span className="text-[10px] text-emerald-700">
                    (ডাটাবেজের নম্বর মিলিয়ে স্বয়ংক্রিয়ভাবে ঐ শপের লাইভ ডাটা লোড করে)
                  </span>
                </div>
              </div>
            )}

            {/* Quick Test Message Suggestions */}
            <div className="py-3 border-b border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                ক্লিক করে টেস্ট মেসেজ দিন:
              </p>
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {(testingChannel.platform === 'whatsapp'
                  ? [
                      'অর্ডার',
                      'স্টক',
                      'বিক্রি',
                      'পেজ',
                      'আজকের মোট বিক্রি ও লাভ কত?',
                      'লাস্ট অর্ডারটা কার?',
                    ]
                  : storeContext?.suggestions || [
                      'ভাইয়া ডেলিভারি চার্জ কত এবং ঢাকায় কতদিন সময় লাগে?',
                      'আপনাদের স্টকে কী কী পণ্য আছে?',
                      'আমার নাম কবির হোসেন, মিরপুর ১০ ঢাকা, ফোন ০১৮৯৯১১২২৩৩, ক্যাশ অন ডেলিভারিতে ১টি আইটেম পাঠান।',
                    ]
                ).map((sug: string, i: number) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setTestMessage(sug)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 transition-colors text-left font-medium"
                  >
                    <span>{sug}</span>
                  </button>
                ))}
              </div>

              {/* Real In-Stock Products Chips */}
              {storeContext?.products && storeContext.products.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-bold">শপের রিয়েল প্রোডাক্ট:</span>
                  {storeContext.products.slice(0, 3).map((p: any) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setTestMessage(
                          `আমার নাম কবির হোসেন, মিরপুর ১২ ঢাকা, ফোন ০১৮৯৯১১২২৩৩। আমি ১টি "${p.title}" ক্যাশ অন ডেলিভারিতে অর্ডার করতে চাই।`
                        )
                      }
                      className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] hover:bg-emerald-100 font-medium transition-colors"
                      title="অর্ডার টেস্ট করতে ক্লিক করুন"
                    >
                      {p.title} (৳{p.price})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Chat History Messages */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3 min-h-[200px] max-h-[350px] pr-1">
              {testHistory.map((item, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${item.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                      item.sender === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-none shadow-sm'
                        : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200/80 shadow-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{item.text}</p>
                    {item.order && (
                      <div className="mt-2.5 p-2.5 bg-emerald-100/90 rounded-xl border border-emerald-300 text-emerald-950 font-bold text-[11px] flex items-center justify-between gap-2">
                        <span>🎉 অর্ডার তৈরি হয়েছে: #{item.order.orderNumber}</span>
                        <a
                          href="/dashboard/orders"
                          className="underline hover:text-emerald-800 font-bold"
                        >
                          অর্ডার দেখুন →
                        </a>
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] text-slate-400 mt-1 px-1">
                    {item.sender === 'user' ? 'আপনি (গ্রাহক)' : 'এআই বিক্রয় প্রতিনিধি'}
                  </span>
                </div>
              ))}
              {testLoading && (
                <div className="flex items-start">
                  <div className="bg-slate-100 text-slate-600 rounded-2xl rounded-tl-none p-3 text-xs border border-slate-200 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                    <span>এআই বিক্রয় প্রতিনিধি উত্তর প্রস্তুত করছে...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input Footer */}
            <form onSubmit={handleSendTestMessage} className="pt-3 border-t border-slate-100 flex items-center gap-2">
              <input
                type="text"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="গ্রাহক হিসেবে কোনো মেসেজ লিখুন..."
                disabled={testLoading}
                className="flex-1 p-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={!testMessage.trim() || testLoading}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>পাঠান</span>
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}


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

  useEffect(() => {
    fetchChannels();
    // Check if redirected after OAuth callback
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'true') {
      const pageName = params.get('channel_name') || 'ফেসবুক পেজ';
      setOauthSuccessMessage(
        `🎉 অভিনন্দন! আপনার "${pageName}" সফলভাবে সংযুক্ত হয়েছে এবং এআই সেলস কনসালট্যান্ট সক্রিয় করা হয়েছে!`
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
      await fetch('/api/channels', {
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
    } catch (e) {
      console.error('Failed to toggle AI status in DB:', e);
    } finally {
      setUpdatingId(null);
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
        setChannels((prev) => [data.channel, ...prev]);
        setModalOpen(false);
        setChannelName('');
        setChannelIdentifier('');
        setAccessToken('');
      }
    } catch (e) {
      console.error(e);
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

          {/* WhatsApp Connect Button */}
          <button
            onClick={() => {
              setPlatform('whatsapp');
              setChannelName('');
              setChannelIdentifier('');
              setAccessToken('');
              setModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all"
          >
            <span>💬</span>
            <span>হোয়াটসঅ্যাপ কানেক্ট</span>
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
                className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-28 h-28 bg-blue-50/50 rounded-full blur-2xl -mr-10 -mt-10" />

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xl shadow-sm">
                      f
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                        c.webhook_verified
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          c.webhook_verified ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                        }`}
                      />
                      <span>{c.webhook_verified ? 'Webhook সচল' : 'পেন্ডিং'}</span>
                    </span>
                  </div>

                  <h3 className="font-extrabold text-base text-slate-900">{c.channel_name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono">Page ID: {c.channel_identifier}</p>

                  <div className="mt-5 space-y-2 text-xs border-t border-slate-100 pt-4">
                    <div className="flex justify-between py-1 text-slate-600">
                      <span>প্ল্যাটফর্ম:</span>
                      <span className="font-bold text-slate-800">Facebook Messenger</span>
                    </div>
                    <div className="flex justify-between py-1 text-slate-600">
                      <span>কমেন্ট অটোমেশন:</span>
                      <span className="font-bold text-indigo-600">সক্রিয় (Active)</span>
                    </div>
                  </div>
                </div>

                {/* AI Auto-Reply Switch */}
                <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-900">এআই সেলস কনসালট্যান্ট</p>
                    <p className="text-[10px] text-slate-500">
                      {c.ai_active ? 'স্বয়ংক্রিয় অর্ডার গ্রহণ করছে' : 'এআই বর্তমানে মিউট আছে'}
                    </p>
                  </div>
                  <button
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
              </div>
            ))}

          {/* Instagram Direct Card */}
          {channels
            .filter((c) => c.platform === 'instagram')
            .map((c) => (
              <div
                key={c.id}
                className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-28 h-28 bg-pink-50/50 rounded-full blur-2xl -mr-10 -mt-10" />

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                      IG
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>সক্রিয়</span>
                    </span>
                  </div>

                  <h3 className="font-extrabold text-base text-slate-900">{c.channel_name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono">IG ID: {c.channel_identifier}</p>

                  <div className="mt-5 space-y-2 text-xs border-t border-slate-100 pt-4">
                    <div className="flex justify-between py-1 text-slate-600">
                      <span>প্ল্যাটফর্ম:</span>
                      <span className="font-bold text-slate-800">Instagram Direct DM</span>
                    </div>
                    <div className="flex justify-between py-1 text-slate-600">
                      <span>পোস্ট কমেন্ট সিঙ্ক:</span>
                      <span className="font-bold text-pink-600">সক্রিয় (Active)</span>
                    </div>
                  </div>
                </div>

                {/* AI Auto-Reply Switch */}
                <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-900">এআই অটো-রিপ্লাই</p>
                    <p className="text-[10px] text-slate-500">
                      {c.ai_active ? 'ডিএম ও কমেন্টে উত্তর দিচ্ছে' : 'বট সাময়িকভাবে বন্ধ আছে'}
                    </p>
                  </div>
                  <button
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
              </div>
            ))}

          {/* WhatsApp Cloud API Card */}
          {channels
            .filter((c) => c.platform === 'whatsapp')
            .map((c) => (
              <div
                key={c.id}
                className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-50/50 rounded-full blur-2xl -mr-10 -mt-10" />

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                      WA
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>সক্রিয়</span>
                    </span>
                  </div>

                  <h3 className="font-extrabold text-base text-slate-900">{c.channel_name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono">ID: {c.channel_identifier}</p>

                  <div className="mt-5 space-y-2 text-xs border-t border-slate-100 pt-4">
                    <div className="flex justify-between py-1 text-slate-600">
                      <span>প্ল্যাটফর্ম:</span>
                      <span className="font-bold text-slate-800">WhatsApp Cloud API</span>
                    </div>
                    <div className="flex justify-between py-1 text-slate-600">
                      <span>কোয়ালিটি রেটিং:</span>
                      <span className="font-bold text-emerald-600">High (Green Rating)</span>
                    </div>
                  </div>
                </div>

                {/* AI Auto-Reply Switch */}
                <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-900">এআই অটো-রিপ্লাই</p>
                    <p className="text-[10px] text-slate-500">
                      {c.ai_active ? 'হোয়াটসঅ্যাপে উত্তর দিচ্ছে' : 'বট সাময়িকভাবে বন্ধ আছে'}
                    </p>
                  </div>
                  <button
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
              </div>
            ))}
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
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  {platform === 'facebook'
                    ? 'ফেসবুক পেজের নাম'
                    : platform === 'instagram'
                    ? 'ইনস্টাগ্রাম অ্যাকাউন্ট নাম (@handle)'
                    : 'হোয়াটসঅ্যাপ বিজনেস নাম'}
                </label>
                <input
                  type="text"
                  required
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder={
                    platform === 'facebook'
                      ? 'যেমন: শপ বিডি'
                      : platform === 'instagram'
                      ? 'যেমন: @shopbd_official'
                      : 'যেমন: শপ বিডি অফিসিয়াল'
                  }
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  {platform === 'whatsapp' ? 'Phone Number ID / WABA ID' : 'Page ID / Account ID'}
                </label>
                <input
                  type="text"
                  required
                  value={channelIdentifier}
                  onChange={(e) => setChannelIdentifier(e.target.value)}
                  placeholder="যেমন: 10892746198"
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Access Token (Permanent Page Token)
                </label>
                <input
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="EAA..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-medium text-slate-900"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  {submitting ? 'সেভ হচ্ছে...' : 'চ্যানেল সেভ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
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

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [platform, setPlatform] = useState<'facebook' | 'instagram' | 'whatsapp'>('facebook');
  const [channelName, setChannelName] = useState('');
  const [channelIdentifier, setChannelIdentifier] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/channels', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.channels) {
        setChannels(data.channels);
      } else {
        setChannels([]);
      }
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
      const token = localStorage.getItem('accessToken');
      await fetch('/api/channels', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
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
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
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
    <div className="space-y-8 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">সোশ্যাল চ্যানেল কানেকশন হাব</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            ফেসবুক মেসেঞ্জার, ইনস্টাগ্রাম এবং হোয়াটসঅ্যাপ চ্যানেল ম্যানেজ ও এআই অটো-রিপ্লাই অন/অফ করুন
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>নতুন চ্যানেল যুক্ত করুন</span>
        </button>
      </div>

      {/* Channels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Facebook Messenger Card */}
        {channels
          .filter((c) => c.platform === 'facebook')
          .map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xl shadow-sm">
                    f
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Webhook Active</span>
                  </span>
                </div>

                <h3 className="font-extrabold text-base text-slate-900">{c.channel_name}</h3>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">ID: {c.channel_identifier}</p>

                <div className="mt-5 space-y-2 text-xs border-t border-slate-100 pt-4">
                  <div className="flex justify-between py-1 text-slate-600">
                    <span>প্ল্যাটফর্ম:</span>
                    <span className="font-bold text-slate-800">Facebook Messenger</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-600">
                    <span>টোকেন স্ট্যাটাস:</span>
                    <span className="font-bold text-emerald-600 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Permanent Valid</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* AI Auto-Reply Switch */}
              <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900">এআই অটো-রিপ্লাই</p>
                  <p className="text-[10px] text-slate-500">
                    {c.ai_active ? 'গ্রাহকের মেসেজে এআই উত্তর দিচ্ছে' : 'বট সাময়িকভাবে বন্ধ আছে'}
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
              className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white flex items-center justify-center font-bold text-xl shadow-sm">
                    📷
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Direct Active</span>
                  </span>
                </div>

                <h3 className="font-extrabold text-base text-slate-900">{c.channel_name}</h3>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">ID: {c.channel_identifier}</p>

                <div className="mt-5 space-y-2 text-xs border-t border-slate-100 pt-4">
                  <div className="flex justify-between py-1 text-slate-600">
                    <span>প্ল্যাটফর্ম:</span>
                    <span className="font-bold text-slate-800">Instagram Direct DM</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-600">
                    <span>কানেকশন টাইপ:</span>
                    <span className="font-bold text-slate-800">Meta Professional App</span>
                  </div>
                </div>
              </div>

              {/* AI Auto-Reply Switch */}
              <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900">এআই অটো-রিপ্লাই</p>
                  <p className="text-[10px] text-slate-500">
                    {c.ai_active ? 'গ্রাহকের মেসেজে এআই উত্তর দিচ্ছে' : 'বট সাময়িকভাবে বন্ধ আছে'}
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

        {/* WhatsApp Business Card */}
        {channels
          .filter((c) => c.platform === 'whatsapp')
          .map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xl shadow-sm">
                    💬
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Cloud API Tier 1</span>
                  </span>
                </div>

                <h3 className="font-extrabold text-base text-slate-900">{c.channel_name}</h3>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">ID: {c.channel_identifier}</p>

                <div className="mt-5 space-y-2 text-xs border-t border-slate-100 pt-4">
                  <div className="flex justify-between py-1 text-slate-600">
                    <span>প্ল্যাটফর্ম:</span>
                    <span className="font-bold text-slate-800">WhatsApp Official Cloud</span>
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
                    {c.ai_active ? 'গ্রাহকের মেসেজে এআই উত্তর দিচ্ছে' : 'বট সাময়িকভাবে বন্ধ আছে'}
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
              মেটা গ্রাফ এপিআই ক্রেডেনশিয়াল প্রদান করুন
            </p>

            <form onSubmit={handleAddChannel} className="mt-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  প্ল্যাটফর্ম
                </label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-medium text-slate-900"
                >
                  <option value="facebook">Facebook Messenger Page</option>
                  <option value="instagram">Instagram Direct Professional</option>
                  <option value="whatsapp">WhatsApp Business Cloud API</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  চ্যানেল / পেজের নাম
                </label>
                <input
                  type="text"
                  required
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="যেমন: Aarong Fashion Page 2"
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Page ID / Phone Number ID
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

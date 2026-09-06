'use client';

import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Bot,
  User,
  ShieldAlert,
  Send,
  Sparkles,
  Phone,
  CheckCircle2,
  Clock,
} from 'lucide-react';

interface Conversation {
  id: string;
  customer_name: string;
  customer_phone: string;
  channel_platform: string;
  channel_name: string;
  last_message: string;
  is_human_takeover_active: boolean;
  time: string;
}

export default function LiveInboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [replyText, setReplyText] = useState('');
  const [toggling, setToggling] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInbox();
  }, []);

  const fetchInbox = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/inbox', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.conversations && Array.isArray(data.conversations)) {
        const mapped = data.conversations.map((c: any) => ({
          id: c.id,
          customer_name: c.customer_name || 'ফেসবুক ক্রেতা',
          customer_phone: c.customer_phone || c.customer_identifier || 'N/A',
          channel_platform: c.channel_platform || 'facebook',
          channel_name: c.channel_name || 'Facebook Page',
          last_message: 'গ্রাহকের সাম্প্রতিক বার্তা',
          is_human_takeover_active: !!c.is_human_takeover_active,
          time: new Date(c.updated_at || Date.now()).toLocaleTimeString('bn-BD', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        }));
        setConversations(mapped);
        if (mapped.length > 0) {
          setSelectedConv(mapped[0]);
        }
      }
    } catch (e) {
      console.error('Fetch inbox error:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleTakeover = async (conv: Conversation) => {
    setToggling(true);
    const newStatus = !conv.is_human_takeover_active;

    // Optimistic UI update
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, is_human_takeover_active: newStatus } : c))
    );
    setSelectedConv((prev) => (prev ? { ...prev, is_human_takeover_active: newStatus } : null));

    try {
      const token = localStorage.getItem('accessToken');
      await fetch('/api/inbox/takeover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId: conv.id,
          action: newStatus ? 'takeover' : 'release',
        }),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold mb-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Unified Omnichannel Inbox</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">লাইভ ইনবক্স ও হিউম্যান টেকওভার</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          গ্রাহকদের সাথে রিয়েল-টাইম চ্যাট দেখুন এবং প্রয়োজন হলে ১ ক্লিকে এআই মিউট করে নিজে কথা বলুন
        </p>
      </div>

      {/* Main Grid: Chat List + Active Thread */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[640px] bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Conversations List (4 cols) */}
        <div className="lg:col-span-4 border-r border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-100 bg-slate-50/70">
            <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
              সকল ইনবক্স মেসেজ ({conversations.length})
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {conversations.map((conv) => {
              const isSelected = selectedConv?.id === conv.id;
              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConv(conv)}
                  className={`p-4 cursor-pointer transition-colors ${
                    isSelected ? 'bg-indigo-50/70 border-l-4 border-indigo-600' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-slate-900">{conv.customer_name}</span>
                    <span className="text-[10px] text-slate-400">{conv.time}</span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-1 mb-2">{conv.last_message}</p>

                  <div className="flex items-center justify-between text-[10px]">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                      {conv.channel_platform.toUpperCase()}
                    </span>
                    {conv.is_human_takeover_active ? (
                      <span className="px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800">
                        Human Takeover
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700">
                        AI Active
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {conversations.length === 0 && !loading && (
              <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center h-full">
                <MessageSquare className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="font-bold text-slate-700">এখনো কোনো ইনবক্স মেসেজ নেই</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-[200px] leading-relaxed">
                  ফেসবুক পেজে কেউ মেসেজ দিলে সাথে সাথে এখানে লাইভ চ্যাট দেখা যাবে।
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Active Conversation Thread (8 cols) */}
        {selectedConv ? (
          <div className="lg:col-span-8 flex flex-col justify-between h-full bg-slate-50/30">
            {/* Thread Header */}
            <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-600/10 text-indigo-600 flex items-center justify-center font-bold">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">{selectedConv.customer_name}</h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {selectedConv.customer_phone} • {selectedConv.channel_name}
                  </p>
                </div>
              </div>

              {/* Human Takeover Action Button */}
              <button
                onClick={() => toggleTakeover(selectedConv)}
                disabled={toggling}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  selectedConv.is_human_takeover_active
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md'
                    : 'bg-amber-500 hover:bg-amber-600 text-white shadow-md'
                }`}
              >
                {selectedConv.is_human_takeover_active ? (
                  <>
                    <Bot className="w-4 h-4" />
                    <span>Resume AI (এআই আবার চালু করুন)</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-4 h-4" />
                    <span>Take Over Chat (২৪ ঘণ্টার জন্য বট মিউট করুন)</span>
                  </>
                )}
              </button>
            </div>

            {/* Takeover Notice Banner */}
            {selectedConv.is_human_takeover_active && (
              <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-xs text-amber-800 flex items-center gap-2 shrink-0">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>হিউম্যান টেকওভার সক্রিয়:</strong> এআই এই গ্রাহকের জন্য মিউট আছে। আপনি সরাসরি উত্তর পাঠাতে পারেন।
                </span>
              </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              <div className="flex flex-col items-start max-w-md">
                <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm text-xs text-slate-800">
                  {selectedConv.last_message}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1">{selectedConv.time}</span>
              </div>

              <div className="flex flex-col items-end max-w-md ml-auto">
                <div className="bg-indigo-600 text-white p-4 rounded-2xl rounded-tr-none shadow-md text-xs leading-relaxed">
                  জি অবশ্যই! আমাদের সকল প্রোডাক্ট ইন-স্টক রয়েছে এবং ঢাকার ভেতর মাত্র ১-২ দিনে ডেলিভারি পাবেন।
                </div>
                <div className="flex items-center gap-1 text-[10px] text-indigo-400 mt-1 px-1">
                  <Bot className="w-3 h-3" />
                  <span>{selectedConv.time} (by AI Agent)</span>
                </div>
              </div>
            </div>

            {/* Input Bar */}
            <div className="p-4 bg-white border-t border-slate-200 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!replyText.trim()) return;
                  setReplyText('');
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={
                    selectedConv.is_human_takeover_active
                      ? 'সরাসরি বাংলায় উত্তর লিখুন...'
                      : 'নিজে মেসেজ পাঠাতে আগে টেকওভার বাটনে ক্লিক করুন...'
                  }
                  disabled={!selectedConv.is_human_takeover_active}
                  className="flex-1 p-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
                <button
                  type="submit"
                  disabled={!selectedConv.is_human_takeover_active || !replyText.trim()}
                  className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 shadow-md"
                >
                  <Send className="w-4 h-4" />
                  <span>পাঠান</span>
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-8 flex flex-col items-center justify-center text-center p-8 text-slate-400 bg-slate-50/20">
            <MessageSquare className="w-12 h-12 text-slate-300 mb-3" />
            <p className="font-bold text-slate-700 text-sm">কোনো চ্যাট নির্বাচন করা হয়নি</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              বামপাশের তালিকা থেকে কাস্টমার নির্বাচন করুন অথবা ফেসবুক পেজে নতুন মেসেজের জন্য অপেক্ষা করুন।
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

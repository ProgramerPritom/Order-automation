'use client';

import React, { useState, useEffect } from 'react';
import PaginationControl from '@/components/ui/PaginationControl';
import { getSessionToken } from '@/lib/session';
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
  UserCheck,
  Trash2,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender_type: 'customer' | 'ai' | 'human_agent';
  content: string;
  created_at: string;
}

interface Conversation {
  id: string;
  customer_name: string;
  customer_phone: string;
  channel_platform: string;
  channel_name: string;
  last_message: string;
  is_human_takeover_active: boolean;
  time: string;
  messages: ChatMessage[];
}

export default function LiveInboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [replyText, setReplyText] = useState('');
  const [toggling, setToggling] = useState(false);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activePlatform, setActivePlatform] = useState<'all' | 'facebook' | 'instagram' | 'whatsapp'>('all');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 15;

  useEffect(() => {
    setCurrentPage(1);
    setCursorStack([null]);
    fetchInbox(activePlatform, null, 1);
  }, [activePlatform]);

  const fetchInbox = async (platform = activePlatform, cursorParam?: string | null, targetPage: number = 1) => {
    setLoading(true);
    try {
      const token = getSessionToken();
      let url = platform === 'all' ? `/api/inbox?limit=${pageSize}` : `/api/inbox?platform=${platform}&limit=${pageSize}`;
      if (cursorParam) url += `&cursor=${encodeURIComponent(cursorParam)}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.conversations && Array.isArray(data.conversations)) {
        const mapped = data.conversations.map((c: any) => {
          const msgs: ChatMessage[] = c.messages || [];
          const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1].content : 'কথোপকথন শুরু হয়েছে';
          return {
            id: c.id,
            customer_name: c.customer_name || 'গ্রাহক',
            customer_phone: c.customer_phone || c.customer_identifier || 'N/A',
            channel_platform: c.channel_platform || 'facebook',
            channel_name: c.channel_name || 'Social Channel',
            last_message: lastMsg,
            is_human_takeover_active: !!c.is_human_takeover_active,
            time: new Date(c.updated_at || Date.now()).toLocaleTimeString('bn-BD', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            messages: msgs,
          };
        });
        setConversations(mapped);
        if (mapped.length > 0) {
          setSelectedConv(mapped[0]);
        } else {
          setSelectedConv(null);
        }
        if (data.pagination) {
          setNextCursor(data.pagination.nextCursor);
          setHasMore(data.pagination.hasMore);
          setTotalCount(data.pagination.totalCount || 0);
        }
        setCurrentPage(targetPage);
      } else {
        setConversations([]);
        setSelectedConv(null);
      }
    } catch (e) {
      console.error('Fetch inbox error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleNextPage = () => {
    if (!nextCursor || loading) return;
    setCursorStack((prev) => [...prev, nextCursor]);
    fetchInbox(activePlatform, nextCursor, currentPage + 1);
  };

  const handlePrevPage = () => {
    if (currentPage <= 1 || loading) return;
    const prevCursor = cursorStack[currentPage - 2] || null;
    setCursorStack((prev) => prev.slice(0, currentPage - 1));
    fetchInbox(activePlatform, prevCursor, currentPage - 1);
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

  const handleDeleteConversation = async (convId: string) => {
    if (!confirm('আপনি কি নিশ্চিত যে এই চ্যাটটি মুছে ফেলতে চান?')) return;
    setDeleting(true);
    try {
      const token = getSessionToken();
      const res = await fetch(`/api/inbox?id=${convId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== convId));
        if (selectedConv?.id === convId) {
          setSelectedConv(null);
        }
      }
    } catch (e) {
      console.error('Delete conversation error:', e);
    } finally {
      setDeleting(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConv || !replyText.trim()) return;

    const textToSend = replyText.trim();
    setReplyText('');
    setSending(true);

    const tempMessage: ChatMessage = {
      id: `temp_${Date.now()}`,
      sender_type: 'human_agent',
      content: textToSend,
      created_at: new Date().toISOString(),
    };

    // Optimistic append
    const updatedMessages = [...(selectedConv.messages || []), tempMessage];
    setSelectedConv({
      ...selectedConv,
      last_message: textToSend,
      messages: updatedMessages,
    });
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConv.id ? { ...c, last_message: textToSend, messages: updatedMessages } : c
      )
    );

    try {
      const token = getSessionToken();
      await fetch('/api/inbox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          conversationId: selectedConv.id,
          messageText: textToSend,
        }),
      });
    } catch (err) {
      console.error('Failed to send live message:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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

        {/* Platform Switcher Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-sm w-fit self-start sm:self-auto">
          <button
            onClick={() => setActivePlatform('all')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all border ${
              activePlatform === 'all'
                ? 'bg-white text-indigo-600 border-slate-200/90 shadow-sm'
                : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-white/60 hover:border-slate-200/50'
            }`}
          >
            সকল মেসেজ
          </button>
          <button
            onClick={() => setActivePlatform('facebook')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition-all border ${
              activePlatform === 'facebook'
                ? 'bg-blue-600 text-white border-blue-500 shadow-sm shadow-blue-500/20'
                : 'text-slate-600 border-transparent hover:text-blue-600 hover:bg-white/60 hover:border-blue-200'
            }`}
          >
            <span className="font-bold">f</span>
            <span>মেসেঞ্জার</span>
          </button>
          <button
            onClick={() => setActivePlatform('instagram')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition-all border ${
              activePlatform === 'instagram'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-pink-400 shadow-sm shadow-pink-500/20'
                : 'text-slate-600 border-transparent hover:text-pink-600 hover:bg-white/60 hover:border-pink-200'
            }`}
          >
            <span>📸</span>
            <span>ইনস্টাগ্রাম</span>
          </button>
          <button
            onClick={() => setActivePlatform('whatsapp')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition-all border ${
              activePlatform === 'whatsapp'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm shadow-emerald-500/20'
                : 'text-slate-600 border-transparent hover:text-emerald-600 hover:bg-white/60 hover:border-emerald-200'
            }`}
          >
            <span>💬</span>
            <span>হোয়াটসঅ্যাপ</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Chat List + Active Thread */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[640px] bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Conversations List (4 cols) */}
        <div className="lg:col-span-4 border-r border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
              {activePlatform === 'all'
                ? 'সকল ইনবক্স চ্যাট'
                : activePlatform === 'facebook'
                ? 'ফেসবুক মেসেঞ্জার'
                : activePlatform === 'instagram'
                ? 'ইনস্টাগ্রাম ডিএম'
                : 'হোয়াটসঅ্যাপ চ্যাট'}{' '}
              ({loading ? '...' : conversations.length})
            </h3>
            <button
              onClick={() => fetchInbox(activePlatform)}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
            >
              রিফ্রেশ
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loading && (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-3 rounded-2xl bg-slate-50 animate-pulse space-y-2">
                    <div className="h-3 bg-slate-200 rounded w-1/3" />
                    <div className="h-3.5 bg-slate-200 rounded w-full" />
                    <div className="h-2.5 bg-slate-200 rounded w-1/4" />
                  </div>
                ))}
              </div>
            )}

            {!loading &&
              conversations.map((conv) => {
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
                      <span
                        className={`px-1.5 py-0.5 rounded font-bold ${
                          conv.channel_platform === 'facebook'
                            ? 'bg-blue-50 text-blue-700'
                            : conv.channel_platform === 'instagram'
                            ? 'bg-pink-50 text-pink-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
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
                  ফেসবুক বা হোয়াটসঅ্যাপে কেউ মেসেজ দিলে সাথে সাথে এখানে লাইভ চ্যাট দেখা যাবে।
                </p>
              </div>
            )}
          </div>

          {/* Cursor Pagination Controls */}
          <PaginationControl
            currentPage={currentPage}
            pageSize={pageSize}
            totalCount={totalCount}
            hasMore={hasMore}
            onNextPage={handleNextPage}
            onPrevPage={handlePrevPage}
            loading={loading}
            itemLabel="চ্যাট"
          />
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

              <div className="flex items-center gap-2">
                {/* Delete Conversation Button */}
                <button
                  onClick={() => handleDeleteConversation(selectedConv.id)}
                  disabled={deleting}
                  className="p-2.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 transition-all"
                  title="এই চ্যাটটি মুছে ফেলুন"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

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
            </div>

            {/* Takeover Notice Banner */}
            {selectedConv.is_human_takeover_active && (
              <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800 flex items-center gap-2 shrink-0">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>হিউম্যান টেকওভার সক্রিয়:</strong> এআই এই গ্রাহকের জন্য মিউট আছে। আপনি নিচে সরাসরি বাংলায় উত্তর পাঠাতে পারেন।
                </span>
              </div>
            )}

            {/* Messages Area (Real Multi-Turn Messages) */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {selectedConv.messages && selectedConv.messages.length > 0 ? (
                selectedConv.messages.map((msg) => {
                  const isCustomer = msg.sender_type === 'customer';
                  const isHuman = msg.sender_type === 'human_agent';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end ml-auto'} max-w-md`}
                    >
                      <div
                        className={`p-4 rounded-2xl text-xs leading-relaxed shadow-xs ${
                          isCustomer
                            ? 'bg-white text-slate-800 rounded-tl-none border border-slate-200'
                            : isHuman
                            ? 'bg-emerald-600 text-white rounded-tr-none'
                            : 'bg-indigo-600 text-white rounded-tr-none'
                        }`}
                      >
                        {msg.content}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1 px-1">
                        {!isCustomer && (
                          isHuman ? <UserCheck className="w-3 h-3 text-emerald-600" /> : <Bot className="w-3 h-3 text-indigo-500" />
                        )}
                        <span>
                          {isCustomer ? 'Customer' : isHuman ? 'Human Agent (You)' : 'AI Sales Agent'} •{' '}
                          {new Date(msg.created_at).toLocaleTimeString('bn-BD', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center">
                  <p>এই কথোপকথনে কোনো বার্তা রেকর্ড নেই</p>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <div className="p-4 bg-white border-t border-slate-200 shrink-0">
              <form onSubmit={handleSendReply} className="flex items-center gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={
                    selectedConv.is_human_takeover_active
                      ? 'সরাসরি বাংলায় উত্তর লিখুন...'
                      : 'নিজে মেসেজ পাঠাতে আগে টেকওভার বাটনে ক্লিক করুন...'
                  }
                  disabled={!selectedConv.is_human_takeover_active || sending}
                  className="flex-1 p-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
                <button
                  type="submit"
                  disabled={!selectedConv.is_human_takeover_active || !replyText.trim() || sending}
                  className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 shadow-md"
                >
                  <Send className="w-4 h-4" />
                  <span>{sending ? 'পাঠানো হচ্ছে...' : 'পাঠান'}</span>
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

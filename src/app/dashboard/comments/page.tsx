'use client';

import React, { useState, useEffect } from 'react';
import PaginationControl from '@/components/ui/PaginationControl';
import { getSessionToken } from '@/lib/session';
import {
  MessageCircle,
  Sparkles,
  Send,
  RefreshCw,
  CheckCircle2,
  Clock,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  User,
  Bot,
  AlertCircle,
  FileText,
  X,
  Share2,
} from 'lucide-react';

interface CommentItem {
  id: string;
  comment_id: string;
  customer_name: string;
  customer_id?: string;
  comment_text: string;
  ai_reply_text?: string;
  ai_replied: boolean;
  private_reply_sent: boolean;
  created_at: string;
}

interface PostItem {
  id: string;
  post_id: string;
  message?: string;
  media_url?: string;
  permalink_url?: string;
  comment_count: number;
  created_time: string;
  updated_at: string;
  channel_name?: string;
  platform?: string;
  comments: CommentItem[];
}

export default function CommentsPage() {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [selectedPost, setSelectedPost] = useState<PostItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<'all' | 'facebook' | 'instagram'>('all');

  // Stats
  const [metrics, setMetrics] = useState({
    totalPosts: 0,
    totalComments: 0,
    aiRepliedCount: 0,
    privateRepliedCount: 0,
  });

  // Private Message Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [targetComment, setTargetComment] = useState<CommentItem | null>(null);
  const [privateMessage, setPrivateMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
    fetchComments(platformFilter, null, 1);
  }, [platformFilter]);

  const fetchComments = async (platform = platformFilter, cursorParam?: string | null, targetPage: number = 1) => {
    setLoading(true);
    try {
      const token = getSessionToken();
      let url = platform === 'all' ? `/api/comments?limit=${pageSize}` : `/api/comments?platform=${platform}&limit=${pageSize}`;
      if (cursorParam) url += `&cursor=${encodeURIComponent(cursorParam)}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.posts) {
        setPosts(data.posts);
        if (data.posts.length > 0) {
          setSelectedPost((current) => {
            if (current) {
              const matched = data.posts.find((p: any) => p.id === current.id);
              return matched || data.posts[0];
            }
            return data.posts[0];
          });
        } else {
          setSelectedPost(null);
        }
        if (data.pagination) {
          setNextCursor(data.pagination.nextCursor);
          setHasMore(data.pagination.hasMore);
          setTotalCount(data.pagination.totalCount || 0);
        }
        setCurrentPage(targetPage);
      } else {
        setPosts([]);
        setSelectedPost(null);
      }
      if (data.metrics) {
        setMetrics(data.metrics);
      }
    } catch (e) {
      console.error('Fetch comments error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleNextPage = () => {
    if (!nextCursor || loading) return;
    setCursorStack((prev) => [...prev, nextCursor]);
    fetchComments(platformFilter, nextCursor, currentPage + 1);
  };

  const handlePrevPage = () => {
    if (currentPage <= 1 || loading) return;
    const prevCursor = cursorStack[currentPage - 2] || null;
    setCursorStack((prev) => prev.slice(0, currentPage - 1));
    fetchComments(platformFilter, prevCursor, currentPage - 1);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchComments(platformFilter, null, 1);
  };

  const openPrivateMessageModal = (comment: CommentItem) => {
    setTargetComment(comment);
    setPrivateMessage(
      `আসসালামু আলাইকুম ${comment.customer_name || 'ভাইয়া/আপু'}! আমাদের ফেসবুক পোস্টে কমেন্ট করার জন্য ধন্যবাদ। আপনি কি এই পণ্যটি অর্ডার করতে চান? বিস্তারিত জানালে আমরা সাহায্য করব।`
    );
    setFeedback(null);
    setModalOpen(true);
  };

  const handleSendPrivateReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetComment || !privateMessage.trim()) return;

    setSendingMessage(true);
    setFeedback(null);

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'private_reply',
          commentId: targetComment.comment_id,
          messageText: privateMessage.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: 'success', message: 'গ্রাহকের ইনবক্সে মেসেজ সফলভাবে পাঠানো হয়েছে!' });
        setTimeout(() => {
          setModalOpen(false);
          fetchComments();
        }, 1200);
      } else {
        setFeedback({ type: 'error', message: data.error || 'মেসেজ পাঠানো ব্যর্থ হয়েছে।' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'নেটওয়ার্ক এরর' });
    } finally {
      setSendingMessage(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-sky-500" />
            <span>Omnichannel Comments & AI Auto-Reply Hub</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">পোস্ট ও কমেন্ট অটোমেশন</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            ফেসবুক ও ইনস্টাগ্রাম পোস্টের কমেন্টগুলো এআই স্বয়ংক্রিয়ভাবে উত্তর দিচ্ছে। প্রয়োজনে ১ ক্লিকে গ্রাহকের ইনবক্সে সরাসরি মেসেজ পাঠান।
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-sm transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>রিফ্রেশ করুন</span>
        </button>
      </div>

      {/* Platform Switcher Tabs */}
      <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-sm w-fit">
        <button
          onClick={() => setPlatformFilter('all')}
          className={`px-4 py-2 rounded-xl font-bold text-xs transition-all border ${
            platformFilter === 'all'
              ? 'bg-white text-indigo-600 border-slate-200/90 shadow-sm'
              : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-white/60 hover:border-slate-200/50'
          }`}
        >
          সকল পোস্ট ({metrics.totalPosts})
        </button>
        <button
          onClick={() => setPlatformFilter('facebook')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition-all border ${
            platformFilter === 'facebook'
              ? 'bg-blue-600 text-white border-blue-500 shadow-sm shadow-blue-500/20'
              : 'text-slate-600 border-transparent hover:text-blue-600 hover:bg-white/60 hover:border-blue-200'
          }`}
        >
          <span className="font-bold">f</span>
          <span>ফেসবুক পোস্ট</span>
        </button>
        <button
          onClick={() => setPlatformFilter('instagram')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition-all border ${
            platformFilter === 'instagram'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-pink-400 shadow-sm shadow-pink-500/20'
              : 'text-slate-600 border-transparent hover:text-pink-600 hover:bg-white/60 hover:border-pink-200'
          }`}
        >
          <span>📸</span>
          <span>ইনস্টাগ্রাম পোস্ট</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">মোট ট্র্যাকড পোস্ট</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{loading ? '...' : metrics.totalPosts}</p>
          <p className="text-[10px] text-slate-400 mt-1">কানেক্টেড পেজের সক্রিয় পোস্ট</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">মোট কমেন্ট সংখ্যা</p>
          <p className="text-2xl font-black text-indigo-600 mt-1">{loading ? '...' : metrics.totalComments}</p>
          <p className="text-[10px] text-slate-400 mt-1">গ্রাহকদের মোট প্রশ্ন ও মন্তব্য</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">এআই অটো-রিপ্লাই সম্পন্ন</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{loading ? '...' : metrics.aiRepliedCount}</p>
          <p className="text-[10px] text-emerald-600 font-bold mt-1">১০০% তাৎক্ষণিক রেসপন্স</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ইনবক্স মেসেজ প্রেরিত</p>
          <p className="text-2xl font-black text-sky-600 mt-1">{loading ? '...' : metrics.privateRepliedCount}</p>
          <p className="text-[10px] text-sky-600 font-bold mt-1">ডিরেক্ট সেলস ইনবক্স কানেকশন</p>
        </div>
      </div>

      {/* Main Container: Posts List (4 cols) + Comments Stream (8 cols) - Viewport Adaptive */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[550px] lg:h-[calc(100vh-270px)] lg:min-h-[520px]">
        {/* Posts List */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
            <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
              {platformFilter === 'all'
                ? 'সকল পোস্ট'
                : platformFilter === 'facebook'
                ? 'ফেসবুক পোস্টসমূহ'
                : 'ইনস্টাগ্রাম পোস্টসমূহ'}{' '}
              ({loading ? '...' : posts.length})
            </h3>
            {loading && <span className="w-3 h-3 rounded-full bg-indigo-600 animate-ping" />}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
            {loading && (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-4 rounded-2xl bg-slate-50 animate-pulse space-y-2.5">
                    <div className="h-3 bg-slate-200 rounded w-1/3" />
                    <div className="h-4 bg-slate-200 rounded w-full" />
                    <div className="h-3 bg-slate-200 rounded w-1/4" />
                  </div>
                ))}
              </div>
            )}
            {posts.map((post) => {
              const isSelected = selectedPost?.id === post.id;
              return (
                <div
                  key={post.id}
                  onClick={() => setSelectedPost(post)}
                  className={`p-4 rounded-2xl cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-sky-50 border-2 border-sky-500 shadow-sm'
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                    <span className="font-bold text-slate-700">{post.channel_name || 'Facebook Page'}</span>
                    <span>{new Date(post.created_time || post.updated_at).toLocaleDateString('bn-BD')}</span>
                  </div>

                  <p className="text-xs font-bold text-slate-900 line-clamp-2 leading-relaxed">
                    {post.message || 'পোস্টের ক্যাপশন নেই (ছবি বা ভিডিও পোস্ট)'}
                  </p>

                  <div className="mt-3 flex items-center justify-between text-[11px]">
                    <span className="inline-flex items-center gap-1 font-bold text-sky-700 bg-sky-100/70 px-2.5 py-0.5 rounded-full">
                      <MessageCircle className="w-3 h-3" />
                      <span>{post.comment_count} কমেন্ট</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">ID: {post.post_id.slice(-6)}</span>
                  </div>
                </div>
              );
            })}

            {posts.length === 0 && !loading && (
              <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center h-full">
                <FileText className="w-8 h-8 text-slate-300 mb-2" />
                <p className="font-bold text-slate-700">কোনো পোস্ট ট্র্যাক করা হয়নি</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-[220px]">
                  আপনার ফেসবুক পেজে কেউ কমেন্ট করলে পোস্টটি এখানে স্বয়ংক্রিয়ভাবে সিঙ্ক হয়ে যাবে।
                </p>
              </div>
            )}
          </div>

          {/* Cursor Pagination Controls */}
          <div className="shrink-0 border-t border-slate-100">
            <PaginationControl
              currentPage={currentPage}
              pageSize={pageSize}
              totalCount={totalCount}
              hasMore={hasMore}
              onNextPage={handleNextPage}
              onPrevPage={handlePrevPage}
              loading={loading}
              itemLabel="পোস্ট"
            />
          </div>
        </div>

        {/* Comments Detail Stream */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
          {selectedPost ? (
            <>
              {/* Post Header Banner */}
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-bold text-[10px]">
                      FACEBOOK POST
                    </span>
                    <span className="text-xs text-slate-500 font-mono">Post ID: {selectedPost.post_id}</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-800 mt-1 line-clamp-2">
                    {selectedPost.message || 'ছবি/ভিডিও ফেসবুক পোস্ট'}
                  </p>
                </div>

                {selectedPost.permalink_url && (
                  <a
                    href={selectedPost.permalink_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 shrink-0"
                  >
                    <span>ফেসবুকে দেখুন</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {/* Comments Stream */}
              <div className="flex-1 p-6 overflow-y-auto space-y-4">
                <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                  কমেন্টসমূহ ({selectedPost.comments?.length || 0})
                </h4>

                {selectedPost.comments && selectedPost.comments.length > 0 ? (
                  selectedPost.comments.map((comment, index) => {
                    // Check if this is the first (latest) comment from this specific customer
                    const isFirstCommentOfCustomer =
                      selectedPost.comments.findIndex(
                        (c) =>
                          (c.customer_id && c.customer_id === comment.customer_id) ||
                          c.customer_name === comment.customer_name
                      ) === index;

                    // Check if an inbox message was already sent to this customer
                    const customerAlreadyMessaged = selectedPost.comments.some(
                      (c) =>
                        ((c.customer_id && c.customer_id === comment.customer_id) ||
                          c.customer_name === comment.customer_name) &&
                        c.private_reply_sent
                    );

                    return (
                      <div
                        key={comment.id || comment.comment_id}
                        className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/40 hover:bg-slate-50 transition-colors"
                      >
                        {/* Commenter Info */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                              <User className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-extrabold text-xs text-slate-900">{comment.customer_name}</p>
                              <p className="text-[10px] text-slate-400">
                                {new Date(comment.created_at).toLocaleTimeString('bn-BD', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                          </div>

                          {/* Only show 1 button per customer (not repeated on every comment) */}
                          {isFirstCommentOfCustomer && (
                            customerAlreadyMessaged ? (
                              <span
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-xs text-sky-700 bg-sky-50 border border-sky-200"
                                title="এই গ্রাহকের সাথে ইতিমধ্যে ইনবক্সে যোগাযোগ করা হয়েছে"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
                                <span>ইনবক্সে কানেক্টেড ✓</span>
                              </span>
                            ) : (
                              <button
                                onClick={() => openPrivateMessageModal(comment)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all"
                              >
                                <Send className="w-3 h-3" />
                                <span>ইনবক্সে মেসেজ পাঠান</span>
                              </button>
                            )
                          )}
                        </div>

                      {/* Comment Text */}
                      <div className="mt-2.5 pl-10 text-xs text-slate-800 font-medium">
                        "{comment.comment_text}"
                      </div>

                      {/* AI Public Reply Box */}
                      {comment.ai_reply_text && (
                        <div className="mt-3 ml-10 p-3 rounded-xl bg-white border border-emerald-200/80 shadow-xs flex items-start gap-2">
                          <div className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                            <Bot className="w-3 h-3" />
                          </div>
                          <div className="text-xs">
                            <p className="font-bold text-emerald-800 text-[11px] mb-0.5">
                              এআই পাবলিক কমেন্ট রিপ্লাই (স্বয়ংক্রিয়ভাবে পোস্ট করা হয়েছে):
                            </p>
                            <p className="text-slate-700 leading-relaxed">{comment.ai_reply_text}</p>
                          </div>
                        </div>
                      )}

                      {/* Status Badges */}
                      <div className="mt-3 ml-10 flex items-center gap-2 text-[10px]">
                        {comment.ai_replied ? (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>AI Replied</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3" />
                            <span>Pending Reply</span>
                          </span>
                        )}

                        {comment.private_reply_sent && (
                          <span className="inline-flex items-center gap-1 font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full">
                            <ShieldCheck className="w-3 h-3" />
                            <span>ইনবক্স মেসেজ পাঠানো হয়েছে</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
                ) : (
                  <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center">
                    <MessageSquare className="w-8 h-8 text-slate-300 mb-2" />
                    <p className="font-bold text-slate-700">এই পোস্টে এখনো কোনো কমেন্ট নেই</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      গ্রাহকরা ফেসবুকে কমেন্ট করলে সাথে সাথে এখানে দেখা যাবে এবং এআই উত্তর দেবে।
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400">
              <FileText className="w-12 h-12 text-slate-300 mb-3" />
              <p className="font-bold text-slate-700 text-sm">কোনো পোস্ট নির্বাচন করা হয়নি</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs text-center">
                বামপাশের তালিকা থেকে যেকোনো পোস্টে ক্লিক করুন কমেন্ট ও এআই রিপ্লাই দেখতে।
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Private Outreach Modal (Connect with Buyer) */}
      {modalOpen && targetComment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">গ্রাহকের ইনবক্সে মেসেজ পাঠান</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  কমেন্টকারী: <strong>{targetComment.customer_name}</strong>
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <span className="font-bold text-slate-600 block mb-1">গ্রাহকের কমেন্ট:</span>
              <p className="text-slate-800 italic">"{targetComment.comment_text}"</p>
            </div>

            <form onSubmit={handleSendPrivateReply} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  মেসেঞ্জারে পাঠানোর বার্তা:
                </label>
                <textarea
                  rows={4}
                  required
                  value={privateMessage}
                  onChange={(e) => setPrivateMessage(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="আপনার মেসেজ লিখুন..."
                />
              </div>

              {feedback && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    feedback.type === 'success'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border border-rose-200 text-rose-800'
                  }`}
                >
                  {feedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{feedback.message}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={sendingMessage || !privateMessage.trim()}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-indigo-600/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sendingMessage ? 'পাঠানো হচ্ছে...' : 'মেসেঞ্জারে পাঠান'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

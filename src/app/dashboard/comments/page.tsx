'use client';

import React, { useState, useEffect } from 'react';
import PaginationControl from '@/components/ui/PaginationControl';
import { getSessionToken } from '@/lib/session';
import { useAppDispatch, useAppSelector } from '@/lib/store/hooks';
import {
  fetchPosts as fetchReduxPosts,
  syncFacebookFeed,
  updatePostProductMapping,
  setSelectedPostId,
} from '@/lib/store/slices/postsSlice';
import { toast } from 'sonner';
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
  Tag,
  Link2,
  Unlink,
  PackageCheck,
  Check,
  Film,
  Eye,
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

export interface LinkedProduct {
  id: string;
  title: string;
  price: number;
  stock: number;
  image_url?: string;
  sku?: string;
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
  linked_product?: LinkedProduct | null;
  comments: CommentItem[];
}

export interface ProductOption {
  id: string;
  title: string;
  price: number;
  stock: number;
  image_url?: string;
  sku?: string;
}

// Helper to guarantee direct, working Facebook URL
const getFacebookUrl = (post?: PostItem | null): string => {
  if (!post) return 'https://www.facebook.com';
  let url = (post.permalink_url || '').trim();
  if (url) {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) return `https://www.facebook.com${url}`;
    return `https://www.facebook.com/${url}`;
  }
  const cleanId = post.post_id.includes('_') ? post.post_id.split('_')[1] : post.post_id;
  return `https://www.facebook.com/${cleanId}`;
};

export default function CommentsPage() {
  const dispatch = useAppDispatch();
  const reduxPostsState = useAppSelector((state) => state.posts);

  const [posts, setPosts] = useState<PostItem[]>([]);
  const [selectedPost, setSelectedPost] = useState<PostItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSyncingFeed, setIsSyncingFeed] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<'all' | 'facebook' | 'instagram'>('all');

  // Product Catalog for Video/Post Linking
  const [catalogProducts, setCatalogProducts] = useState<ProductOption[]>([]);
  const [mappingLoadingPostId, setMappingLoadingPostId] = useState<string | null>(null);
  const [mappingToast, setMappingToast] = useState<string | null>(null);

  // Post Detail Modal (Large Thumbnail & Full Post Content)
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailModalPost, setDetailModalPost] = useState<PostItem | null>(null);

  const openPostDetailModal = (post: PostItem) => {
    setDetailModalPost(post);
    setDetailModalOpen(true);
  };

  // Helper to filter out stories and captionless posts and sort by latest date first
  const sanitizeAndSortPosts = (rawPosts: PostItem[]): PostItem[] => {
    return rawPosts
      .filter((p) => p.message && p.message.trim().length > 0 && !p.permalink_url?.includes('substory_index'))
      .sort(
        (a, b) =>
          new Date(b.created_time || b.updated_at).getTime() -
          new Date(a.created_time || a.updated_at).getTime()
      );
  };

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

  const fetchCatalogProducts = async () => {
    try {
      const token = getSessionToken();
      const res = await fetch('/api/products?limit=100', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.products && Array.isArray(data.products)) {
        setCatalogProducts(data.products);
      }
    } catch (e) {
      console.error('Failed to load store products for mapping:', e);
    }
  };

  const handleMapProductToPost = async (postId: string, productId: string | null) => {
    setMappingLoadingPostId(postId);
    try {
      const token = getSessionToken();
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: 'map_product',
          postId,
          productId: productId || null,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        dispatch(updatePostProductMapping({ postId, linkedProduct: data.linkedProduct }));
        setPosts((prev) =>
          prev.map((p) =>
            p.post_id === postId ? { ...p, linked_product: data.linkedProduct } : p
          )
        );
        if (selectedPost && selectedPost.post_id === postId) {
          setSelectedPost((prev) => (prev ? { ...prev, linked_product: data.linkedProduct } : null));
        }
        toast.success(data.message || 'প্রোডাক্ট লিংক সফলভাবে আপডেট হয়েছে!');
      } else {
        toast.error(data.error || 'প্রোডাক্ট লিংক ব্যর্থ হয়েছে');
      }
    } catch (err: any) {
      console.error('Map product error:', err);
      toast.error('প্রোডাক্ট লিংক করার সময় সমস্যা হয়েছে।');
    } finally {
      setMappingLoadingPostId(null);
    }
  };

  // Sync with Redux state if populated
  useEffect(() => {
    if (reduxPostsState.posts.length > 0) {
      const sanitized = sanitizeAndSortPosts(reduxPostsState.posts);
      setPosts(sanitized);
      setSelectedPost((curr) => {
        if (curr) {
          const matched = sanitized.find((p) => p.post_id === curr.post_id);
          return matched || sanitized[0];
        }
        return sanitized[0];
      });
      setMetrics((prev) => ({
        ...prev,
        totalPosts: reduxPostsState.totalCount || sanitized.length,
      }));
      setLoading(false);
    }
  }, [reduxPostsState.posts, reduxPostsState.totalCount]);

  useEffect(() => {
    setCurrentPage(1);
    setCursorStack([null]);
    const token = getSessionToken();
    if (token) {
      if (!reduxPostsState.isLoaded) {
        dispatch(fetchReduxPosts({ token }));
      }
    }
    fetchComments(platformFilter, null, 1);
    fetchCatalogProducts();
  }, [platformFilter, dispatch]);

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
        const sanitized = sanitizeAndSortPosts(data.posts);
        setPosts(sanitized);
        if (sanitized.length > 0) {
          setSelectedPost((current) => {
            if (current) {
              const matched = sanitized.find((p: any) => p.id === current.id);
              return matched || sanitized[0];
            }
            return sanitized[0];
          });
        } else {
          setSelectedPost(null);
        }
        if (data.pagination) {
          setNextCursor(data.pagination.nextCursor);
          setHasMore(data.pagination.hasMore);
          setTotalCount(data.pagination.totalCount || sanitized.length);
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
      `আসসালামু আলাইকুম ${comment.customer_name || 'ভাইয়া/আপু'}! আমাদের এই চমৎকার ব্রেইন ডেভেলপমেন্ট খেলনাটিতে আগ্রহের জন্য আন্তরিক ধন্যবাদ। এটি বাচ্চাদের মোবাইল আসক্তি দূর করে নিজে নিজে খেলায় মনোযোগী করতে দারুণ কার্যকরী। আপনার সোনামণির বয়স কত ভাইয়া/আপু? বয়স অনুযায়ী এটি তার জন্য কতটা পারফেক্ট হবে, তা আমি আপনাকে বিস্তারিত জানিয়ে ক্যাশ অন ডেলিভারিতে অর্ডার বুকিংয়ে সাহায্য করতে পারব!`
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

  const handleSyncFacebookPosts = async () => {
    setIsSyncingFeed(true);
    try {
      const token = getSessionToken();
      if (!token) {
        toast.error('লগইন সেশনের মেয়াদ শেষ হয়েছে। অনুগ্রহ করে আবার লগইন করুন।');
        return;
      }
      const res = await dispatch(syncFacebookFeed({ token })).unwrap();
      toast.success(res.message || 'ফেসবুক পেজ থেকে পোস্ট সফলভাবে সিঙ্ক করা হয়েছে!');
      if (res.posts) {
        const sanitized = sanitizeAndSortPosts(res.posts);
        setPosts(sanitized);
        if (sanitized.length > 0) {
          setSelectedPost(sanitized[0]);
        }
        setMetrics((m) => ({ ...m, totalPosts: res.totalCount || sanitized.length }));
      }
    } catch (err: any) {
      toast.error('সিঙ্ক ব্যর্থ হয়েছে', {
        description: err || 'ফেসবুক থেকে পোস্ট সিঙ্ক করা সম্ভব হয়নি। Social Channels থেকে পেজ কানেকশন চেক করুন।',
      });
    } finally {
      setIsSyncingFeed(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-sky-500" />
            <span>Facebook & Instagram Feed + AI RAG Product Linker</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">ফেসবুক পোস্ট, ভিডিও ও কমেন্ট হাব</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            ফেসবুক পেজের লাইভ পোস্ট ও ভিডিও দেখুন, সরাসরি প্রোডাক্ট লিংক করুন এবং এআই অটো-রিপ্লাই পরিচালনা করুন।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Sync Live Feed from Facebook Graph API */}
          <button
            onClick={handleSyncFacebookPosts}
            disabled={isSyncingFeed || reduxPostsState.isSyncing}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/20 transition-all disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncingFeed || reduxPostsState.isSyncing ? 'animate-spin' : ''}`} />
            <span>
              {isSyncingFeed || reduxPostsState.isSyncing ? 'ফেসবুক থেকে সিঙ্ক হচ্ছে...' : 'ফেসবুক থেকে পোস্ট রিফ্রেশ করুন'}
            </span>
          </button>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-sm transition-all"
            title="ডাটাবেজ রিফ্রেশ"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">রিফ্রেশ</span>
          </button>
        </div>
      </div>

      {/* Platform Switcher Tabs */}
      <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-sm w-fit">
        <button
          onClick={() => setPlatformFilter('all')}
          className={`px-4 py-2 rounded-xl font-bold text-xs transition-all border ${platformFilter === 'all'
              ? 'bg-white text-indigo-600 border-slate-200/90 shadow-sm'
              : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-white/60 hover:border-slate-200/50'
            }`}
        >
          সকল পোস্ট ({metrics.totalPosts})
        </button>
        <button
          onClick={() => setPlatformFilter('facebook')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition-all border ${platformFilter === 'facebook'
              ? 'bg-blue-600 text-white border-blue-500 shadow-sm shadow-blue-500/20'
              : 'text-slate-600 border-transparent hover:text-blue-600 hover:bg-white/60 hover:border-blue-200'
            }`}
        >
          <span className="font-bold">f</span>
          <span>ফেসবুক পোস্ট</span>
        </button>
        <button
          onClick={() => setPlatformFilter('instagram')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition-all border ${platformFilter === 'instagram'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-pink-400 shadow-sm shadow-pink-500/20'
              : 'text-slate-600 border-transparent hover:text-pink-600 hover:bg-white/60 hover:border-pink-200'
            }`}
        >
          <span>📸</span>
          <span>ইনস্টাগ্রাম পোস্ট</span>
        </button>
      </div>

      {/* Compact Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white px-3.5 py-2.5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">মোট ট্র্যাকড পোস্ট</p>
            <p className="text-xl font-black text-slate-900 leading-tight mt-0.5">{loading ? '...' : metrics.totalPosts}</p>
          </div>
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
            <Film className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white px-3.5 py-2.5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">মোট কমেন্ট সংখ্যা</p>
            <p className="text-xl font-black text-indigo-600 leading-tight mt-0.5">{loading ? '...' : metrics.totalComments}</p>
          </div>
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
            <MessageCircle className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white px-3.5 py-2.5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">এআই অটো-রিপ্লাই</p>
            <p className="text-xl font-black text-emerald-600 leading-tight mt-0.5">{loading ? '...' : metrics.aiRepliedCount}</p>
          </div>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0">
            <Bot className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white px-3.5 py-2.5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ইনবক্স মেসেজ প্রেরিত</p>
            <p className="text-xl font-black text-sky-600 leading-tight mt-0.5">{loading ? '...' : metrics.privateRepliedCount}</p>
          </div>
          <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-xs shrink-0">
            <Send className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Main Container: Posts List (4 cols) + Comments Stream (8 cols) - Viewport Adaptive */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[550px] lg:h-[calc(100vh-220px)] lg:min-h-[520px]">
        {/* Posts List */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
            <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
              {platformFilter === 'all'
                ? 'সকল পোস্ট'
                : platformFilter === 'facebook'
                  ? 'ফেসবুক পোস্টসমূহ'
                  : 'ইনস্টাগ্রাম পোস্টসমূহ'}{' '}
              ({loading || isSyncingFeed || reduxPostsState.isSyncing ? '...' : posts.length})
            </h3>
            {(loading || isSyncingFeed || reduxPostsState.isSyncing) && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200/60">
                <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
                <span className="text-[10px] font-bold text-blue-600">সিঙ্ক হচ্ছে...</span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
            {/* Active Sync Progress Banner */}
            {(isSyncingFeed || reduxPostsState.isSyncing) && (
              <div className="p-3.5 mb-2 bg-gradient-to-r from-blue-50 via-indigo-50 to-sky-50 border border-blue-200/80 rounded-2xl shadow-xs animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/30">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                      <span>মেটা পেজ থেকে পোস্ট সিঙ্ক হচ্ছে</span>
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                    </p>
                    <p className="text-[10px] text-blue-700/90 mt-0.5">
                      লাইভ পোস্ট ও মিডিয়া ডাটা লোড হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...
                    </p>
                  </div>
                </div>
                {/* Visual indeterminate progress shimmer */}
                <div className="mt-2.5 w-full bg-blue-200/60 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full animate-pulse w-4/5" />
                </div>
              </div>
            )}

            {/* Syncing or Loading Skeleton State */}
            {(loading || isSyncingFeed || reduxPostsState.isSyncing) && posts.length === 0 && (
              <div className="p-2 space-y-2.5">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 animate-pulse space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="h-3 bg-slate-200 rounded w-28" />
                      <div className="h-2.5 bg-slate-200 rounded w-16" />
                    </div>
                    <div className="flex items-start gap-2.5">
                      <div className="w-11 h-11 rounded-xl bg-slate-200 shrink-0" />
                      <div className="space-y-1.5 flex-1">
                        <div className="h-3 bg-slate-200 rounded w-full" />
                        <div className="h-3 bg-slate-200 rounded w-3/4" />
                      </div>
                    </div>
                    <div className="h-5 bg-slate-100 rounded-lg w-1/2" />
                  </div>
                ))}
              </div>
            )}

            {/* Skeletons on top if posts already exist during sync */}
            {(isSyncingFeed || reduxPostsState.isSyncing) && posts.length > 0 && (
              <div className="p-2 pb-0 space-y-2">
                <div className="p-3 rounded-2xl bg-blue-50/40 border border-blue-100 animate-pulse space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="h-3 bg-blue-200/70 rounded w-24" />
                    <div className="h-2.5 bg-blue-200/50 rounded w-12" />
                  </div>
                  <div className="h-3 bg-blue-200/60 rounded w-5/6" />
                </div>
              </div>
            )}
            {posts.map((post) => {
              const isSelected = selectedPost?.id === post.id;
              return (
                <div
                  key={post.id}
                  onClick={() => setSelectedPost(post)}
                  className={`p-3 rounded-2xl cursor-pointer transition-all ${isSelected
                      ? 'bg-sky-50 border-2 border-sky-500 shadow-sm'
                      : 'hover:bg-slate-50 border border-transparent'
                    }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                    <span className="font-bold text-slate-700 truncate max-w-[130px]">
                      {post.channel_name || 'Facebook Page'}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] text-slate-500 font-medium">
                        {new Date(post.created_time || post.updated_at).toLocaleDateString('bn-BD')}
                      </span>
                      {/* Option button to open post details & large picture modal */}
                      <button
                        type="button"
                        title="পোস্টের বিবরণ ও ছবি বড় করে দেখুন"
                        onClick={(e) => {
                          e.stopPropagation();
                          openPostDetailModal(post);
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200/60 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {/* Direct Facebook Link button */}
                      <a
                        href={getFacebookUrl(post)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="ফেসবুকে পোস্টটি সরাসরি দেখুন"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-slate-200/60 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>

                  {/* Post row: thumbnail + text */}
                  <div className="flex items-start gap-2.5">
                    {post.media_url ? (
                      <div
                        className="relative group/thumb shrink-0 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          openPostDetailModal(post);
                        }}
                        title="ছবি বড় করে দেখতে ক্লিক করুন"
                      >
                        <img
                          src={post.media_url}
                          alt="পোস্ট থাম্বনেইল"
                          className="w-12 h-12 rounded-xl object-cover border border-slate-100 group-hover/thumb:opacity-90 group-hover/thumb:scale-105 transition-all"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <div className="absolute inset-0 bg-black/25 rounded-xl opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity text-white">
                          <Eye className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 border border-slate-100">
                        <Film className="w-5 h-5 text-slate-300" />
                      </div>
                    )}
                    <p className="text-xs font-bold text-slate-900 line-clamp-2 leading-relaxed flex-1">
                      {post.message || 'পোস্টের ক্যাপশন নেই'}
                    </p>
                  </div>

                  {/* Linked Product Status Badge */}
                  {post.linked_product ? (
                    <div className="mt-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-50 border border-purple-200/80 text-[10px] text-purple-900">
                      <Tag className="w-3 h-3 text-purple-600 shrink-0" />
                      <span className="font-extrabold truncate max-w-[120px]">{post.linked_product.title}</span>
                      <span className="font-mono font-bold text-purple-700">৳{post.linked_product.price}</span>
                      <span className="text-purple-300">|</span>
                      <span className={post.linked_product.stock > 0 ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                        {post.linked_product.stock > 0 ? `স্টক: ${post.linked_product.stock}` : 'স্টক ০'}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-700/80 font-medium">
                      <AlertCircle className="w-2.5 h-2.5 shrink-0 text-amber-500" />
                      <span>প্রোডাক্ট লিংক নেই (ক্লিক করে লিংক করুন)</span>
                    </div>
                  )}

                  <div className="mt-2.5 flex items-center justify-between text-[11px]">
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

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openPostDetailModal(selectedPost)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-xs transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 text-indigo-600" />
                    <span>বিস্তারিত ও ছবি</span>
                  </button>
                  <a
                    href={getFacebookUrl(selectedPost)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 shrink-0 transition-colors shadow-xs"
                  >
                    <span>ফেসবুকে দেখুন</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Product Linking Control Bar (Option 1: 1-Click Dropdown Linker) */}
              <div className="px-5 py-3.5 bg-gradient-to-r from-purple-50/90 via-indigo-50/60 to-purple-50/40 border-b border-purple-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-purple-600 text-white shadow-sm shadow-purple-600/20 shrink-0">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-purple-950">
                        ভিডিও/পোস্টের সাথে প্রোডাক্ট লিংক করুন
                      </span>
                      {selectedPost.linked_product ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-2.5 py-0.5 rounded-full border border-emerald-300">
                          <Check className="w-2.5 h-2.5" />
                          <span>লিংক সক্রিয়</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                          <span>প্রোডাক্ট আনট্যাগড</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-purple-800/80 mt-0.5">
                      এই ভিডিও থেকে কমেন্ট বা মেসেজ আসলে এআই স্বয়ংক্রিয়ভাবে লিংক করা পণ্যের তথ্য ও দাম দিয়ে উত্তর দেবে।
                    </p>
                  </div>
                </div>

                {/* Dropdown Selector */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="relative">
                    <select
                      value={selectedPost.linked_product?.id || ''}
                      onChange={(e) => handleMapProductToPost(selectedPost.post_id, e.target.value || null)}
                      disabled={mappingLoadingPostId === selectedPost.post_id}
                      className="text-xs font-bold bg-white text-slate-800 border border-purple-200 hover:border-purple-400 focus:ring-2 focus:ring-purple-500/20 rounded-xl px-3 py-2 pr-8 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                    >
                      <option value="">-- কোনো প্রোডাক্ট লিংক নেই (আনলিঙ্ক) --</option>
                      {catalogProducts.map((prod) => (
                        <option key={prod.id} value={prod.id}>
                          {prod.title} (৳{prod.price} | স্টক: {prod.stock})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedPost.linked_product && (
                    <button
                      type="button"
                      title="লিংক রিমুভ করুন"
                      onClick={() => handleMapProductToPost(selectedPost.post_id, null)}
                      disabled={mappingLoadingPostId === selectedPost.post_id}
                      className="p-2 rounded-xl bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition-colors shadow-sm disabled:opacity-50"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Toast Feedback for Product Mapping */}
              {mappingToast && (
                <div className="mx-5 mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{mappingToast}</span>
                </div>
              )}

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
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${feedback.type === 'success'
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

      {/* Post Detail & Large Picture Modal */}
      {detailModalOpen && detailModalPost && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 sm:p-7 max-w-xl w-full shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px]">
                  FACEBOOK POST DETAILS
                </span>
                <span className="text-xs text-slate-400 font-mono">ID: {detailModalPost.post_id.slice(-8)}</span>
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {/* Large Thumbnail Image */}
              {detailModalPost.media_url ? (
                <div className="rounded-2xl overflow-hidden bg-slate-950/5 border border-slate-100 flex items-center justify-center max-h-[340px]">
                  <img
                    src={detailModalPost.media_url}
                    alt="পোস্টের ছবি বা থাম্বনেইল"
                    className="max-h-[340px] w-full object-contain rounded-2xl"
                  />
                </div>
              ) : (
                <div className="h-32 rounded-2xl bg-slate-100 flex flex-col items-center justify-center text-slate-400 gap-2 border border-slate-200">
                  <Film className="w-8 h-8 text-slate-300" />
                  <span className="text-xs font-semibold">কোনো থাম্বনেইল ছবি পাওয়া যায়নি</span>
                </div>
              )}

              {/* Date & Channel Info */}
              <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="font-bold text-slate-700">{detailModalPost.channel_name || 'Facebook Page'}</span>
                <span>
                  {new Date(detailModalPost.created_time || detailModalPost.updated_at).toLocaleString('bn-BD', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              </div>

              {/* Full Post Caption / Text */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  পোস্টের সম্পূর্ণ বিবরণ / ক্যাপশন:
                </label>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 leading-relaxed whitespace-pre-line max-h-56 overflow-y-auto">
                  {detailModalPost.message || 'পোস্টের কোনো লিখিত ক্যাপশন নেই।'}
                </div>
              </div>

              {/* Linked Product Summary (if linked) */}
              {detailModalPost.linked_product && (
                <div className="p-3 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-purple-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-purple-950">লিংক করা প্রোডাক্ট:</p>
                      <p className="text-xs text-purple-900 font-semibold">{detailModalPost.linked_product.title}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-black text-purple-700 font-mono">৳{detailModalPost.linked_product.price}</p>
                    <p className="text-[10px] text-emerald-600 font-bold">স্টক: {detailModalPost.linked_product.stock}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 shrink-0 gap-2">
              <span className="text-xs text-slate-500">
                মোট কমেন্ট: <strong>{detailModalPost.comment_count} টি</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDetailModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  বন্ধ করুন
                </button>
                <a
                  href={getFacebookUrl(detailModalPost)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/20 transition-all"
                >
                  <span>ফেসবুকে সরাসরি পোস্টটি খুলুন</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

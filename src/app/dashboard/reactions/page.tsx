'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { getSessionToken } from '@/lib/session';
import { toast } from 'sonner';
import {
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Eye,
  EyeOff,
  UserX,
  AlertTriangle,
  CheckCircle2,
  X,
  Search,
  Filter,
  Check,
  Ban,
  Users,
  ChevronRight,
  TrendingDown,
  Info,
  HelpCircle,
  ThumbsUp,
  Heart,
  Smile,
  Frown,
  Flame,
  Shield,
  Loader2,
} from 'lucide-react';

interface ReactionSummary {
  total: number;
  like: number;
  love: number;
  care?: number;
  haha: number;
  wow: number;
  sad: number;
  angry: number;
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
  hide_reactions_internal?: boolean;
  reaction_summary?: ReactionSummary | null;
  last_reaction_sync?: string | null;
}

interface AngryReactor {
  id: string;
  name: string;
  type: string;
  isBlocked?: boolean;
}

interface BlockedUserRecord {
  id: string;
  facebook_user_id: string;
  user_name: string;
  post_id?: string;
  reason: string;
  blocked_at: string;
}

export default function ReactionsPage() {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [channel, setChannel] = useState<{ id: string; name: string; pageId: string } | null>(null);
  const [blockedCount, setBlockedCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'risk' | 'angry'>('all');

  // Modal states
  const [inspectingPost, setInspectingPost] = useState<PostItem | null>(null);
  const [inspectLoading, setInspectLoading] = useState<boolean>(false);
  const [inspectSummary, setInspectSummary] = useState<ReactionSummary | null>(null);
  const [angryReactors, setAngryReactors] = useState<AngryReactor[]>([]);
  const [isAttackRisk, setIsAttackRisk] = useState<boolean>(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isBanning, setIsBanning] = useState<boolean>(false);
  const [manualBanId, setManualBanId] = useState<string>('');
  const [bulkInputText, setBulkInputText] = useState<string>('');
  const [showBulkBanModal, setShowBulkBanModal] = useState<boolean>(false);

  // Guide modal state
  const [guideModalPost, setGuideModalPost] = useState<PostItem | null>(null);

  // Blocked users drawer/modal state
  const [showBlockedModal, setShowBlockedModal] = useState<boolean>(false);
  const [blockedUsersList, setBlockedUsersList] = useState<BlockedUserRecord[]>([]);
  const [loadingBlockedList, setLoadingBlockedList] = useState<boolean>(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  // Fetch initial posts and channel state (automatically sync fresh reaction counts)
  const loadPosts = async (forceSync = true) => {
    setIsLoading(true);
    try {
      const token = getSessionToken();
      if (!token) return;

      const res = await fetch(`/api/channels/facebook/reactions${forceSync ? '?refresh=true' : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'তথ্য লোড করতে ব্যর্থ হয়েছে');

      setPosts(data.posts || []);
      setChannel(data.channel || null);
      setBlockedCount(data.blockedCount || 0);
    } catch (err: any) {
      toast.error(err.message || 'পোস্ট ও রিঅ্যাকশন লোড করতে সমস্যা হয়েছে');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  // Sync latest posts from Facebook feed
  const handleSyncPosts = async () => {
    setIsSyncing(true);
    const toastId = toast.loading('ফেসবুক পেজ থেকে পোস্ট সিঙ্ক করা হচ্ছে...');
    try {
      const token = getSessionToken();
      const res = await fetch('/api/channels/facebook/sync-posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'সিঙ্ক ব্যর্থ হয়েছে');

      toast.success(data.message || 'ফেসবুক থেকে পোস্ট সফলভাবে সিঙ্ক হয়েছে!', { id: toastId });
      await loadPosts();
    } catch (err: any) {
      toast.error(err.message || 'সিঙ্ক করতে সমস্যা হয়েছে', { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  // Inspect reactions and fetch angry reactors for a post
  const handleInspectPost = async (post: PostItem) => {
    setInspectingPost(post);
    setInspectLoading(true);
    setSelectedUserIds([]);
    try {
      const token = getSessionToken();
      const res = await fetch(`/api/channels/facebook/reactions?postId=${post.post_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'রিঅ্যাকশন আনা যায়নি');

      setInspectSummary(data.summary);
      setAngryReactors(data.angryReactors || []);
      setIsAttackRisk(data.isAttackRisk || false);

      // Update local post state with new summary
      setPosts((prev) =>
        prev.map((p) =>
          p.post_id === post.post_id
            ? { ...p, reaction_summary: data.summary, last_reaction_sync: data.lastReactionSync }
            : p
        )
      );
    } catch (err: any) {
      toast.error(err.message || 'রিঅ্যাকশন ও বট তালিকা ফেচ করা যায়নি');
    } finally {
      setInspectLoading(false);
    }
  };

  // Toggle selection for bulk ban
  const toggleSelectUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    const unblocked = angryReactors.filter((u) => !u.isBlocked);
    if (selectedUserIds.length === unblocked.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(unblocked.map((u) => u.id));
    }
  };

  // Ban selected or single users
  const handleBanUsers = async (usersToBan: { id: string; name: string }[]) => {
    if (usersToBan.length === 0) return;
    setIsBanning(true);
    const toastId = toast.loading(`${usersToBan.length} টি বট অ্যাকাউন্ট পেজ থেকে ব্যান করা হচ্ছে...`);
    try {
      const token = getSessionToken();
      const res = await fetch('/api/channels/facebook/ban-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          users: usersToBan,
          postId: inspectingPost?.post_id,
          reason: 'angry_bot_attack',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ব্যান করতে ব্যর্থ হয়েছে');

      toast.success(data.message || 'বট অ্যাকাউন্ট পেজ থেকে ব্যান করা হয়েছে!', { id: toastId });

      // Mark these users as blocked in state
      const bannedIds = new Set(usersToBan.map((u) => u.id));
      setAngryReactors((prev) =>
        prev.map((u) => (bannedIds.has(u.id) ? { ...u, isBlocked: true } : u))
      );
      setSelectedUserIds((prev) => prev.filter((id) => !bannedIds.has(id)));
      setBlockedCount((prev) => prev + data.bannedCount);
    } catch (err: any) {
      toast.error(err.message || 'ব্যান করতে সমস্যা হয়েছে', { id: toastId });
    } finally {
      setIsBanning(false);
    }
  };

  // Bulk Ban parser: handles comma, newline, spaces, or profile links
  const handleBulkBan = async (rawText: string) => {
    if (!rawText.trim()) {
      toast.error('অনুগ্রহ করে অন্তত একটি ইউজার আইডি বা প্রোফাইল লিঙ্ক লিখুন');
      return;
    }
    const rawTokens = rawText
      .split(/[\n,; \t]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const extractedIds = rawTokens
      .map((t) => {
        if (t.includes('id=')) {
          const m = t.match(/id=([0-9]+)/);
          if (m) return m[1];
        }
        if (t.startsWith('http')) {
          const parts = t.split('/').filter(Boolean);
          const last = parts[parts.length - 1];
          return last.includes('?') ? last.split('?')[0] : last;
        }
        return t.replace(/[^a-zA-Z0-9._-]/g, '');
      })
      .filter(Boolean);

    const uniqueIds = Array.from(new Set(extractedIds));
    if (uniqueIds.length === 0) {
      toast.error('কোনো ভ্যালিড ইউজার আইডি সনাক্ত করা যায়নি');
      return;
    }

    const usersToBan = uniqueIds.map((id) => ({ id, name: `Bot User (${id})` }));
    await handleBanUsers(usersToBan);
    setBulkInputText('');
    setManualBanId('');
  };

  // Toggle internal reaction visibility
  const handleToggleReactionVisibility = async (post: PostItem, newStatus: boolean) => {
    try {
      const token = getSessionToken();
      const res = await fetch('/api/channels/facebook/toggle-reaction-visibility', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          postId: post.post_id,
          hide: newStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'আপডেট করতে ব্যর্থ হয়েছে');

      toast.success(data.message);
      setPosts((prev) =>
        prev.map((p) =>
          p.post_id === post.post_id ? { ...p, hide_reactions_internal: newStatus } : p
        )
      );
    } catch (err: any) {
      toast.error(err.message || 'স্ট্যাটাস আপডেট করা যায়নি');
    }
  };

  // Load blocked users list
  const handleOpenBlockedModal = async () => {
    setShowBlockedModal(true);
    setLoadingBlockedList(true);
    try {
      const token = getSessionToken();
      const res = await fetch('/api/channels/facebook/ban-user', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'লিস্ট আনা যায়নি');
      setBlockedUsersList(data.blockedUsers || []);
    } catch (err: any) {
      toast.error(err.message || 'ব্যানড ইউজার লিস্ট লোড করতে সমস্যা');
    } finally {
      setLoadingBlockedList(false);
    }
  };

  // Unblock user
  const handleUnblockUser = async (userId: string) => {
    setUnblockingId(userId);
    try {
      const token = getSessionToken();
      const res = await fetch(`/api/channels/facebook/ban-user?userId=${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'আনব্লক করা যায়নি');

      toast.success(data.message || 'ইউজার আনব্লক হয়েছে');
      setBlockedUsersList((prev) => prev.filter((u) => u.facebook_user_id !== userId));
      setBlockedCount((prev) => Math.max(0, prev - 1));

      // Also unblock in inspector if active
      setAngryReactors((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isBlocked: false } : u))
      );
    } catch (err: any) {
      toast.error(err.message || 'আনব্লক করতে সমস্যা');
    } finally {
      setUnblockingId(null);
    }
  };

  // Filter posts
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const matchSearch =
        !searchQuery ||
        (post.message || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.post_id.includes(searchQuery);

      if (!matchSearch) return false;

      const summary = post.reaction_summary;
      const angryCount = summary?.angry || 0;
      const totalCount = summary?.total || 0;
      const isRisk = angryCount >= 15 || (totalCount > 10 && angryCount / totalCount >= 0.15);

      if (filterType === 'risk') return isRisk;
      if (filterType === 'angry') return angryCount > 0;
      return true;
    });
  }, [posts, searchQuery, filterType]);

  // Aggregate stats
  const totalAngryCount = useMemo(() => {
    return posts.reduce((sum, p) => sum + (p.reaction_summary?.angry || 0), 0);
  }, [posts]);

  const totalAttackRisks = useMemo(() => {
    return posts.filter((p) => {
      const angry = p.reaction_summary?.angry || 0;
      const total = p.reaction_summary?.total || 0;
      return angry >= 15 || (total > 10 && angry / total >= 0.15);
    }).length;
  }, [posts]);

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header & Branding */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-2xl text-white shadow-xl border border-slate-700/50">
        <div>
          <div className="flex items-center space-x-2 text-rose-400 mb-1">
            <ShieldAlert className="w-5 h-5 animate-pulse" />
            <span className="text-xs font-semibold tracking-wider uppercase">
              Bot Defense & Reaction Management
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            রিঅ্যাক্ট ও বট শিল্ড ম্যানেজমেন্ট
          </h1>
          <p className="text-slate-300 text-sm mt-1 max-w-2xl">
            আপনার ফেসবুক পোস্টগুলোতে আসা ক্ষতিকর অ্যাংরি রিঅ্যাক্ট (Angry Bots) ট্র্যাক করুন, সন্দেহভাজন
            বট অ্যাকাউন্ট চিহ্নিত করে এক ক্লিকে পেজ থেকে পার্মানেন্টলি ব্যান করুন।
          </p>
          {channel && (
            <div className="mt-3 flex items-center space-x-2 text-xs text-sky-300 bg-sky-950/60 px-3 py-1.5 rounded-lg border border-sky-800/60 w-fit">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>কানেক্টেড পেজ:</span>
              <strong className="text-white font-medium">{channel.name}</strong>
              <span className="text-slate-400">({channel.pageId})</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setShowBulkBanModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-semibold transition shadow-md shadow-rose-600/30"
          >
            <Ban className="w-4 h-4" />
            <span>🚨 বাল্ক বট ব্যান</span>
          </button>

          <button
            onClick={handleOpenBlockedModal}
            className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-slate-600 text-sm font-medium transition shadow-sm"
          >
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>ব্যান হিস্ট্রি ({blockedCount})</span>
          </button>

          <button
            onClick={handleSyncPosts}
            disabled={isSyncing}
            className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white rounded-xl text-sm font-medium transition shadow-md shadow-indigo-600/30"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'সিঙ্ক হচ্ছে...' : 'পোস্ট রিফ্রেশ করুন'}</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">মোট মনিটরকৃত পোস্ট</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">{posts.length} টি</h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">মোট অ্যাংরি রিঅ্যাক্ট</p>
            <h3 className="text-2xl font-bold text-rose-600 mt-1">{totalAngryCount} টি</h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <Flame className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">বট অ্যাটাক ঝুঁকিপূর্ণ পোস্ট</p>
            <h3 className="text-2xl font-bold text-amber-600 mt-1">{totalAttackRisks} টি</h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">পেজ থেকে ব্যানকৃত বট</p>
            <h3 className="text-2xl font-bold text-emerald-600 mt-1">{blockedCount} জন</h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="পোস্টের ক্যাপশন বা আইডি খুঁজুন..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filterType === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            সকল পোস্ট ({posts.length})
          </button>
          <button
            onClick={() => setFilterType('risk')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition ${
              filterType === 'risk'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>⚠️ বট অ্যাটাক রিস্ক ({totalAttackRisks})</span>
          </button>
          <button
            onClick={() => setFilterType('angry')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition ${
              filterType === 'angry'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>অ্যাংরি রিঅ্যাক্ট যুক্ত</span>
          </button>
        </div>
      </div>

      {/* Posts Grid List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm animate-pulse space-y-4">
              <div className="h-5 bg-slate-200 rounded w-1/3" />
              <div className="h-16 bg-slate-100 rounded" />
              <div className="h-8 bg-slate-200 rounded w-full" />
            </div>
          ))}
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">কোনো পোস্ট পাওয়া যায়নি</h3>
          <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
            {posts.length === 0
              ? 'আপনার কোনো ফেসবুক পোস্ট এখনও সিস্টেমে সিঙ্ক করা নেই। উপরে "পোস্ট রিফ্রেশ করুন" বাটনে ক্লিক করুন।'
              : 'আপনার ফিল্টারিংয়ের সাথে মিল রেখে কোনো পোস্ট খুঁজে পাওয়া যায়নি।'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredPosts.map((post) => {
            const summary = post.reaction_summary;
            const angry = summary?.angry || 0;
            const like = summary?.like || 0;
            const love = summary?.love || 0;
            const total = summary?.total || 0;
            const isRisk = angry >= 15 || (total > 10 && angry / total >= 0.15);
            const isHiddenInternal = !!post.hide_reactions_internal;

            const postUrl = post.permalink_url?.startsWith('http')
              ? post.permalink_url
              : `https://www.facebook.com/${post.post_id}`;

            return (
              <div
                key={post.id || post.post_id}
                className={`bg-white rounded-2xl border transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between overflow-hidden ${
                  isRisk ? 'border-rose-300 ring-2 ring-rose-500/20' : 'border-slate-200'
                }`}
              >
                {/* Post Top Card Header */}
                <div className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-2 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">পোস্ট আইডি:</span>
                      <code className="bg-slate-100 px-2 py-0.5 rounded text-slate-800 font-mono text-[11px]">
                        {post.post_id.includes('_') ? post.post_id.split('_')[1] : post.post_id}
                      </code>
                    </div>

                    <div className="flex items-center space-x-2">
                      {isRisk && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 bg-rose-100 text-rose-700 rounded-full text-xs font-semibold animate-pulse">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>বট অ্যাটাক অ্যালার্ট</span>
                        </span>
                      )}
                      <a
                        href={postUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:text-indigo-700 p-1 hover:bg-indigo-50 rounded-lg transition"
                        title="ফেসবুকে দেখুন"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  {/* Post Content Snippet & Media */}
                  <div className="mt-3 flex gap-3">
                    {post.media_url && (
                      <img
                        src={post.media_url}
                        alt="Post media"
                        className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-100"
                        onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
                      />
                    )}
                    <p className="text-sm text-slate-700 line-clamp-3 leading-relaxed flex-1">
                      {post.message || <span className="text-slate-400 italic">কোনো টেক্সট ক্যাপশন নেই</span>}
                    </p>
                  </div>

                  {/* Reaction Pills Summary */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <div className="flex items-center space-x-1 px-2 py-1 bg-slate-100 rounded-md text-xs font-medium text-slate-700">
                        <span>মোট:</span>
                        <strong>{total}</strong>
                      </div>

                      <div className="flex items-center space-x-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs">
                        <span>👍</span>
                        <span className="font-semibold">{like}</span>
                      </div>

                      <div className="flex items-center space-x-1 px-2 py-1 bg-rose-50 text-rose-700 rounded-md text-xs">
                        <span>❤️</span>
                        <span className="font-semibold">{love}</span>
                      </div>

                      {summary?.haha ? (
                        <div className="flex items-center space-x-1 px-2 py-1 bg-amber-50 text-amber-700 rounded-md text-xs">
                          <span>😆</span>
                          <span className="font-semibold">{summary.haha}</span>
                        </div>
                      ) : null}

                      {/* Angry React Badge with Alert styling if > 0 */}
                      <div
                        className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-semibold ${
                          angry > 0
                            ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/30'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <span>😡</span>
                        <span>{angry} Angry</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                  {/* Internal Reaction Display Toggle */}
                  <div className="flex items-center space-x-2 text-xs">
                    <button
                      onClick={() => handleToggleReactionVisibility(post, !isHiddenInternal)}
                      className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border transition ${
                        isHiddenInternal
                          ? 'bg-amber-50 border-amber-300 text-amber-800'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                      title="পাবলিক বা ইন-সিস্টেম ক্যাটালগে রিঅ্যাক্ট হাইড বা শো করুন"
                    >
                      {isHiddenInternal ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                          <span className="font-medium">রিঅ্যাক্ট হাইড আছে</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span>রিঅ্যাক্ট দৃশ্যমান</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => setGuideModalPost(post)}
                      className="text-indigo-600 hover:text-indigo-700 hover:underline inline-flex items-center space-x-1"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>ফেসবুকে লুকাবেন কীভাবে?</span>
                    </button>
                  </div>

                  {/* Primary Action Button: Inspect & Ban Bots */}
                  <button
                    onClick={() => handleInspectPost(post)}
                    className={`w-full sm:w-auto px-4 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition shadow-sm ${
                      isRisk || angry > 0
                        ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    <UserX className="w-4 h-4" />
                    <span>{angry > 0 ? 'বট ডিটেকশন ও ব্যান' : 'রিঅ্যাকশন যাচাই করুন'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal 1: Bot Inspection & Banning Modal */}
      {inspectingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 pb-4 border-b border-slate-200 bg-slate-900 text-white flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2 text-rose-400 mb-1 text-xs font-semibold uppercase tracking-wider">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Reaction Bot Defense Center</span>
                </div>
                <h2 className="text-xl font-bold">অ্যাংরি বট ডিটেকশন ও ওয়ান-ক্লিক ব্যান</h2>
                <p className="text-slate-300 text-xs mt-1 line-clamp-1">
                  পোস্ট: {inspectingPost.message || inspectingPost.post_id}
                </p>
              </div>

              <button
                onClick={() => setInspectingPost(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {inspectLoading ? (
                <div className="py-16 text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                  <p className="text-sm text-slate-600 font-medium">
                    মেটা গ্রাফ এপিআই থেকে লাইভ রিঅ্যাকশন ও বট ইউজার ডেটা ফেচ করা হচ্ছে...
                  </p>
                </div>
              ) : (
                <>
                  {/* Reaction Statistics Strip */}
                  {inspectSummary && (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                        <span className="font-semibold text-slate-700">লাইভ রিঅ্যাক্ট অনুপাত</span>
                        <span>মোট: {inspectSummary.total} টি</span>
                      </div>

                      {/* Visual Reaction Proportion Bar */}
                      <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden flex">
                        {inspectSummary.total > 0 && (
                          <>
                            <div
                              style={{ width: `${(inspectSummary.like / inspectSummary.total) * 100}%` }}
                              className="bg-blue-500 h-full"
                              title={`Likes: ${inspectSummary.like}`}
                            />
                            <div
                              style={{ width: `${(inspectSummary.love / inspectSummary.total) * 100}%` }}
                              className="bg-rose-500 h-full"
                              title={`Love: ${inspectSummary.love}`}
                            />
                            <div
                              style={{ width: `${(inspectSummary.haha / inspectSummary.total) * 100}%` }}
                              className="bg-amber-400 h-full"
                              title={`Haha: ${inspectSummary.haha}`}
                            />
                            <div
                              style={{ width: `${(inspectSummary.angry / inspectSummary.total) * 100}%` }}
                              className="bg-rose-600 h-full"
                              title={`Angry: ${inspectSummary.angry}`}
                            />
                          </>
                        )}
                      </div>

                      <div className="grid grid-cols-4 gap-2 mt-3 text-center">
                        <div className="bg-white p-2 rounded-xl border border-slate-200">
                          <span className="text-xs text-slate-500">লাইক 👍</span>
                          <p className="text-sm font-bold text-slate-800">{inspectSummary.like}</p>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-slate-200">
                          <span className="text-xs text-slate-500">লাভ ❤️</span>
                          <p className="text-sm font-bold text-slate-800">{inspectSummary.love}</p>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-slate-200">
                          <span className="text-xs text-slate-500">হাহা 😆</span>
                          <p className="text-sm font-bold text-slate-800">{inspectSummary.haha}</p>
                        </div>
                        <div className="bg-rose-50 p-2 rounded-xl border border-rose-200">
                          <span className="text-xs text-rose-600 font-semibold">অ্যাংরি 😡</span>
                          <p className="text-sm font-bold text-rose-700">{inspectSummary.angry}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Warning banner if attack risk */}
                  {isAttackRisk && (
                    <div className="bg-rose-50 border border-rose-300 p-4 rounded-2xl flex items-start space-x-3 text-rose-800">
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <strong className="font-semibold block text-sm">⚠️ সন্দেহভাজন বট অ্যাটাক চিহ্নিত!</strong>
                        এই পোস্টে স্বাভাবিকের চেয়ে অনেক বেশি অ্যাংরি রিঅ্যাক্ট এসেছে। নিচের বট অ্যাকাউন্টগুলোকে
                        পেজ থেকে ব্যান করলে তারা পেজের ভবিষ্যৎ কোনো পোস্টে আর রিঅ্যাক্ট বা ক্ষতি করতে পারবে না।
                      </div>
                    </div>
                  )}

                  {/* Reactors List */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-bold text-slate-800">
                          অ্যাংরি রিঅ্যাক্টকারী প্রোফাইল তালিকা ({angryReactors.length})
                        </h4>
                      </div>

                      {angryReactors.length > 0 && (
                        <button
                          onClick={handleSelectAll}
                          className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
                        >
                          {selectedUserIds.length ===
                          angryReactors.filter((u) => !u.isBlocked).length
                            ? 'সব আনসিলেক্ট করুন'
                            : 'সব সিলেক্ট করুন'}
                        </button>
                      )}
                    </div>

                    {angryReactors.length === 0 ? (
                      (inspectSummary?.angry || 0) > 0 ? (
                        <div className="p-5 bg-rose-50/70 rounded-2xl border border-rose-200 space-y-4">
                          <div className="flex items-start space-x-3 text-rose-900">
                            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                            <div>
                              <h5 className="font-bold text-sm">
                                🚨 {inspectSummary?.angry} টি অ্যাংরি রিঅ্যাক্ট সনাক্ত হয়েছে!
                              </h5>
                              <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                                মেটা (ফেসবুক)-এর ইউজার প্রাইভেসি পলিসির কারণে বহিরাগত বট অ্যাকাউন্টগুলোর ব্যক্তিগত প্রোফাইল আইডি এপিআই দিয়ে সরাসরি মাস্ক করে রাখা হয়। তবে ফেসবুক সরাসরি তাদের পেজ ইন্টারফেসে প্রোফাইলগুলো প্রদর্শন করে।
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                            <a
                              href={
                                inspectingPost.permalink_url?.startsWith('http')
                                  ? inspectingPost.permalink_url
                                  : `https://www.facebook.com/${inspectingPost.post_id}`
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-xs transition shadow-sm"
                            >
                              <span>ফেসবুকে বট প্রোফাইল দেখে ব্যান করুন</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>

                            <button
                              onClick={() => {
                                setGuideModalPost(inspectingPost);
                              }}
                              className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold text-xs transition shadow-sm"
                            >
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>পোস্টে রিঅ্যাকশন সংখ্যা লুকান (১ ক্লিকে)</span>
                            </button>
                          </div>

                          {/* Quick Bulk / Manual Ban Box */}
                          <div className="pt-3 border-t border-rose-200/80 space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                                <Ban className="w-3.5 h-3.5 text-rose-600" />
                                <span>বাল্ক বট আইডি পেস্ট করে একসাথে ব্যান করুন:</span>
                              </p>
                              <span className="text-[10px] text-slate-400 font-medium">
                                কমা বা নতুন লাইনে একাধিক আইডি পেস্ট করা যাবে
                              </span>
                            </div>
                            <textarea
                              rows={3}
                              placeholder="বটের Facebook ID, PSID বা প্রোফাইল লিংক পেস্ট করুন...&#10;উদাহরণ:&#10;1234567890&#10;9876543210&#10;https://facebook.com/profile.php?id=11223344"
                              value={manualBanId}
                              onChange={(e) => setManualBanId(e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                            />
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-slate-500">
                                {manualBanId.trim()
                                  ? `${
                                      manualBanId
                                        .split(/[\n,; \t]+/)
                                        .filter((t) => t.trim().length > 0).length
                                    } টি আইডি সনাক্ত হয়েছে`
                                  : 'আইডি লিখে বা পেস্ট করে নিচের বাটনে চাপুন'}
                              </span>
                              <button
                                onClick={() => handleBulkBan(manualBanId)}
                                disabled={!manualBanId.trim() || isBanning}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition shadow-sm"
                              >
                                {isBanning ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Ban className="w-3.5 h-3.5" />
                                )}
                                <span>🚨 এক ক্লিকে সব ব্যান করুন</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-center">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                          <p className="text-sm font-medium text-slate-700">
                            এই পোস্টে কোনো অ্যাংরি রিঅ্যাক্ট নেই।
                          </p>
                        </div>
                      )
                    ) : (
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                        {angryReactors.map((reactor) => {
                          const isSelected = selectedUserIds.includes(reactor.id);
                          const isAlreadyBlocked = !!reactor.isBlocked;

                          return (
                            <div
                              key={reactor.id}
                              className={`p-3.5 flex items-center justify-between text-xs transition ${
                                isAlreadyBlocked
                                  ? 'bg-slate-50 opacity-60'
                                  : isSelected
                                  ? 'bg-indigo-50/50'
                                  : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center space-x-3 min-w-0">
                                <input
                                  type="checkbox"
                                  disabled={isAlreadyBlocked}
                                  checked={isSelected}
                                  onChange={() => toggleSelectUser(reactor.id)}
                                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed"
                                />

                                <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs shrink-0">
                                  😡
                                </div>

                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-800 truncate">{reactor.name}</p>
                                  <span className="text-[11px] text-slate-400 font-mono">
                                    PSID: {reactor.id}
                                  </span>
                                </div>
                              </div>

                              <div>
                                {isAlreadyBlocked ? (
                                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-200 text-slate-600 rounded-full font-medium text-[11px]">
                                    <Check className="w-3 h-3" />
                                    <span>ব্যান করা হয়েছে</span>
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleBanUsers([{ id: reactor.id, name: reactor.name }])}
                                    disabled={isBanning}
                                    className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-medium transition disabled:opacity-50"
                                  >
                                    ব্যান করুন
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer Bulk Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                সিলেক্ট করা হয়েছে: <strong className="text-slate-800">{selectedUserIds.length}</strong> জন
              </span>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setInspectingPost(null)}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
                >
                  বন্ধ করুন
                </button>

                <button
                  onClick={() => {
                    const toBan = angryReactors.filter((u) => selectedUserIds.includes(u.id));
                    handleBanUsers(toBan);
                  }}
                  disabled={selectedUserIds.length === 0 || isBanning}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm"
                >
                  {isBanning ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Ban className="w-4 h-4" />
                  )}
                  <span>সিলেক্ট করা সব বট ব্যান করুন ({selectedUserIds.length})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Facebook Official Hide Reaction Counts Guide */}
      {guideModalPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="p-6 bg-indigo-900 text-white flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-1.5 text-indigo-300 text-xs font-semibold uppercase mb-1">
                  <Info className="w-4 h-4" />
                  <span>Reaction Privacy Guide</span>
                </div>
                <h3 className="text-lg font-bold">ফেসবুক পোস্টে রিঅ্যাকশন সংখ্যা লুকাবেন কীভাবে?</h3>
              </div>
              <button
                onClick={() => setGuideModalPost(null)}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700">
              <div className="bg-sky-50 border border-sky-200 p-3.5 rounded-xl text-sky-900 leading-relaxed">
                <strong>কেন এটি জরুরি?</strong> মেটা (Meta) থার্ড-পার্টি অ্যাপকে এপিআই দিয়ে ফেসবুকের পাবলিক
                পোস্টের রিঅ্যাকশন সুইচ ঘোরানোর অনুমতি দেয় না। তবে ফেসবুক তাদের অফিশিয়াল অ্যাপ বা সাইটে খুব
                সহজে এটি করার ব্যবস্থা রেখেছে।
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-start space-x-3">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0">
                    ১
                  </span>
                  <div>
                    <p className="font-semibold text-slate-800">ফেসবুক পোস্টটি ওপেন করুন</p>
                    <p className="text-slate-500 mt-0.5">নিচের বাটনে ক্লিক করে সরাসরি এই পোস্টে যান।</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0">
                    ২
                  </span>
                  <div>
                    <p className="font-semibold text-slate-800">পোস্টের ৩-ডট (...) মেনুতে ক্লিক করুন</p>
                    <p className="text-slate-500 mt-0.5">
                      পোস্টের উপরের ডানদিকের তিনটি ডটে (...) ক্লিক করুন।
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0">
                    ৩
                  </span>
                  <div>
                    <p className="font-semibold text-slate-800">
                      "Hide number of reactions" বা "রিঅ্যাকশন সংখ্যা লুকান" অন করুন
                    </p>
                    <p className="text-slate-500 mt-0.5">
                      এটি অন করার সাথে সাথে পাবলিক বা ভিজিটররা আর কখনো অ্যাংরি রিঅ্যাক্ট সংখ্যা দেখতে পাবে না!
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                <button
                  onClick={() => setGuideModalPost(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-50"
                >
                  বুঝেছি
                </button>

                <a
                  href={
                    guideModalPost.permalink_url?.startsWith('http')
                      ? guideModalPost.permalink_url
                      : `https://www.facebook.com/${guideModalPost.post_id}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold flex items-center space-x-1.5 shadow-sm"
                >
                  <span>ফেসবুক পোস্টে যান</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Blocked Users History Drawer/Modal */}
      {showBlockedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-6 bg-slate-900 text-white flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-1.5 text-emerald-400 text-xs font-semibold uppercase mb-1">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Page Blocklist Registry</span>
                </div>
                <h3 className="text-lg font-bold">পেজ থেকে ব্যান করা বট অ্যাকাউন্টের ইতিহাস</h3>
              </div>
              <button
                onClick={() => setShowBlockedModal(false)}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {loadingBlockedList ? (
                <div className="py-12 text-center space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
                  <p className="text-xs text-slate-500">ব্যানড ইউজার তালিকা লোড হচ্ছে...</p>
                </div>
              ) : blockedUsersList.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  এখনও পর্যন্ত কোনো অ্যাকাউন্ট ব্যান করা হয়নি।
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                  {blockedUsersList.map((user) => (
                    <div
                      key={user.id || user.facebook_user_id}
                      className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-50"
                    >
                      <div>
                        <p className="font-semibold text-slate-800">{user.user_name || 'Facebook User'}</p>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          PSID: {user.facebook_user_id}
                        </p>
                        <span className="text-[10px] text-slate-400">
                          ব্যান সময়: {new Date(user.blocked_at).toLocaleString('bn-BD')}
                        </span>
                      </div>

                      <button
                        onClick={() => handleUnblockUser(user.facebook_user_id)}
                        disabled={unblockingId === user.facebook_user_id}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition"
                      >
                        {unblockingId === user.facebook_user_id ? 'আনব্লক হচ্ছে...' : 'আনব্লক'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowBlockedModal(false)}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Standalone Bulk Bot Ban Tool */}
      {showBulkBanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="p-6 bg-rose-950 text-white flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-1.5 text-rose-400 text-xs font-semibold uppercase mb-1">
                  <Ban className="w-4 h-4" />
                  <span>Bulk Bot Termination Center</span>
                </div>
                <h3 className="text-xl font-bold">বাল্ক বট অ্যাকাউন্ট ব্যান টুল</h3>
                <p className="text-rose-200 text-xs mt-1">
                  একসাথে একাধিক বট প্রোফাইল আইডি বা লিঙ্ক পেস্ট করে পেজ থেকে পার্মানেন্টলি ব্লক করুন।
                </p>
              </div>
              <button
                onClick={() => setShowBulkBanModal(false)}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>বট আইডি বা প্রোফাইল লিঙ্ক তালিকা:</span>
                  <span className="text-[11px] font-normal text-slate-500">
                    {bulkInputText.trim()
                      ? `${
                          bulkInputText
                            .split(/[\n,; \t]+/)
                            .filter((t) => t.trim().length > 0).length
                        } টি আইডি`
                      : 'প্রতি লাইনে একটি করে'}
                  </span>
                </label>
                <textarea
                  rows={6}
                  placeholder="এখানে এক বা একাধিক Facebook User ID / PSID বা প্রোফাইল লিংক পেস্ট করুন...&#10;&#10;উদাহরণ:&#10;100087456123456&#10;100098765432101&#10;https://www.facebook.com/profile.php?id=123456789"
                  value={bulkInputText}
                  onChange={(e) => setBulkInputText(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-800 leading-relaxed">
                <strong>💡 টিপস:</strong> আপনি ফেসবুকের রিঅ্যাকশন পপআপ বা কমেন্ট বক্স থেকে বট প্রোফাইলগুলোর লিঙ্ক বা আইডি কপি করে সরাসরি এখানে একবারে পেস্ট করতে পারেন।
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  onClick={() => setShowBulkBanModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
                >
                  বাতিল
                </button>

                <button
                  onClick={async () => {
                    await handleBulkBan(bulkInputText);
                    setShowBulkBanModal(false);
                  }}
                  disabled={!bulkInputText.trim() || isBanning}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold flex items-center space-x-2 transition shadow-md shadow-rose-600/20"
                >
                  {isBanning ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Ban className="w-4 h-4" />
                  )}
                  <span>সবগুলো পেজ থেকে ব্যান করুন</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

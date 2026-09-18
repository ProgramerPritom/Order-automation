import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

export interface CommentItem {
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

export interface PostItem {
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

export interface PostsState {
  posts: PostItem[];
  totalCount: number;
  selectedPostId: string | null;
  isLoaded: boolean;
  isLoading: boolean;
  isSyncing: boolean;
  lastSynced: number | null;
  error: string | null;
  syncMessage: string | null;
}

const initialState: PostsState = {
  posts: [],
  totalCount: 0,
  selectedPostId: null,
  isLoaded: false,
  isLoading: false,
  isSyncing: false,
  lastSynced: null,
  error: null,
  syncMessage: null,
};

// Async thunk to fetch posts with in-memory caching
export const fetchPosts = createAsyncThunk(
  'posts/fetchPosts',
  async (
    { token, force = false }: { token: string; force?: boolean },
    { getState, rejectWithValue }
  ) => {
    const state = (getState() as any).posts as PostsState;
    // Return cached posts if already loaded and not forced
    if (state.isLoaded && !force && state.posts.length > 0) {
      return { posts: state.posts, totalCount: state.totalCount };
    }

    try {
      const res = await fetch('/api/comments?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch posts');
      return {
        posts: data.posts || [],
        totalCount: data.pagination?.totalCount || (data.posts || []).length,
      };
    } catch (err: any) {
      return rejectWithValue(err.message || 'পোস্ট লোড করতে ব্যর্থ হয়েছে');
    }
  }
);

// Async thunk to trigger live Facebook Graph API sync and update posts
export const syncFacebookFeed = createAsyncThunk(
  'posts/syncFacebookFeed',
  async ({ token }: { token: string }, { rejectWithValue }) => {
    try {
      const res = await fetch('/api/channels/facebook/sync-posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      return data;
    } catch (err: any) {
      return rejectWithValue(err.message || 'ফেসবুক পেজ থেকে পোস্ট সিঙ্ক করতে সমস্যা হয়েছে');
    }
  }
);

export const postsSlice = createSlice({
  name: 'posts',
  initialState,
  reducers: {
    setPosts: (state, action: PayloadAction<PostItem[]>) => {
      state.posts = action.payload;
      state.isLoaded = true;
      if (!state.selectedPostId && action.payload.length > 0) {
        state.selectedPostId = action.payload[0].post_id;
      }
    },
    setSelectedPostId: (state, action: PayloadAction<string | null>) => {
      state.selectedPostId = action.payload;
    },
    updatePostProductMapping: (
      state,
      action: PayloadAction<{ postId: string; linkedProduct: LinkedProduct | null }>
    ) => {
      const { postId, linkedProduct } = action.payload;
      const target = state.posts.find((p) => p.post_id === postId);
      if (target) {
        target.linked_product = linkedProduct;
      }
    },
    clearPostsError: (state) => {
      state.error = null;
      state.syncMessage = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch posts
      .addCase(fetchPosts.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPosts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isLoaded = true;
        state.posts = action.payload.posts;
        state.totalCount = action.payload.totalCount;
        if (!state.selectedPostId && action.payload.posts.length > 0) {
          state.selectedPostId = action.payload.posts[0].post_id;
        }
      })
      .addCase(fetchPosts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Sync posts from Facebook
      .addCase(syncFacebookFeed.pending, (state) => {
        state.isSyncing = true;
        state.error = null;
        state.syncMessage = null;
      })
      .addCase(syncFacebookFeed.fulfilled, (state, action) => {
        state.isSyncing = false;
        state.lastSynced = Date.now();
        state.syncMessage = action.payload.message || 'ফেসবুক পোস্ট সফলভাবে সিঙ্ক হয়েছে!';
        if (action.payload.posts) {
          state.posts = action.payload.posts;
          state.totalCount = action.payload.totalCount || action.payload.posts.length;
          if (!state.selectedPostId && action.payload.posts.length > 0) {
            state.selectedPostId = action.payload.posts[0].post_id;
          }
        }
      })
      .addCase(syncFacebookFeed.rejected, (state, action) => {
        state.isSyncing = false;
        state.error = action.payload as string;
      });
  },
});

export const { setPosts, setSelectedPostId, updatePostProductMapping, clearPostsError } =
  postsSlice.actions;

export default postsSlice.reducer;

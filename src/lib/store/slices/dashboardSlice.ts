import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { getSessionToken } from '@/lib/session';

export interface SubscriptionInfo {
  status: string;
  plan: string;
  daysRemaining: number;
  message: string;
  trialEndsAt?: string;
}

export interface DashboardState {
  subscription: SubscriptionInfo | null;
  subscriptionLoading: boolean;
  subscriptionLoaded: boolean;
  error: string | null;
}

const initialState: DashboardState = {
  subscription: null,
  subscriptionLoading: false,
  subscriptionLoaded: false,
  error: null,
};

// Async thunk to fetch subscription once and cache in Redux
export const fetchSubscription = createAsyncThunk(
  'dashboard/fetchSubscription',
  async (token: string, { getState, rejectWithValue }) => {
    const state = (getState() as any).dashboard as DashboardState;
    // If already loaded and not expired, skip network call
    if (state.subscriptionLoaded && state.subscription) {
      return state.subscription;
    }

    try {
      const activeToken = token || getSessionToken();
      const res = await fetch('/api/tenants/subscription', {
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch subscription');
      return data.subscription;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  }
);

export const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    setSubscription: (state, action: PayloadAction<SubscriptionInfo>) => {
      state.subscription = action.payload;
      state.subscriptionLoaded = true;
    },
    invalidateSubscription: (state) => {
      state.subscriptionLoaded = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSubscription.pending, (state) => {
        state.subscriptionLoading = true;
        state.error = null;
      })
      .addCase(fetchSubscription.fulfilled, (state, action) => {
        state.subscriptionLoading = false;
        state.subscriptionLoaded = true;
        state.subscription = action.payload;
      })
      .addCase(fetchSubscription.rejected, (state, action) => {
        state.subscriptionLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setSubscription, invalidateSubscription } = dashboardSlice.actions;
export default dashboardSlice.reducer;

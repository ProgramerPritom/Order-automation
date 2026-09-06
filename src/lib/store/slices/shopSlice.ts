import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

export interface ShopKnowledge {
  about_shop: string;
  business_category: string;
  support_phone: string;
  showroom_address: string;
  delivery_inside_dhaka: number;
  delivery_outside_dhaka: number;
  delivery_time_dhaka: string;
  delivery_time_outside: string;
  return_policy: string;
  ai_tone: string;
  custom_rules: string;
}

export interface ShopState {
  knowledge: ShopKnowledge;
  isLoaded: boolean;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

const defaultKnowledge: ShopKnowledge = {
  about_shop: '',
  business_category: 'ফ্যাশন ও ক্লথিং',
  support_phone: '',
  showroom_address: '',
  delivery_inside_dhaka: 80,
  delivery_outside_dhaka: 150,
  delivery_time_dhaka: '২৪ থেকে ৪৮ ঘণ্টার মধ্যে',
  delivery_time_outside: '৩ থেকে ৪ কার্যদিবসের মধ্যে',
  return_policy: 'ডেলিভারি ম্যান থাকা অবস্থায় পার্সেল খুলে চেক করে নিতে পারবেন। কোনো ত্রুটি থাকলে সাথে সাথে রিটার্ন করা যাবে।',
  ai_tone: 'friendly',
  custom_rules: 'অগ্রিম কোনো টাকা লাগবে না, সম্পূর্ণ ক্যাশ অন ডেলিভারি। অর্ডার কনফার্ম করতে নাম, ফোন ও ঠিকানা আবশ্যক।',
};

const initialState: ShopState = {
  knowledge: defaultKnowledge,
  isLoaded: false,
  isLoading: false,
  isSaving: false,
  error: null,
};

// Async thunk to fetch shop knowledge once and cache in Redux
export const fetchShopKnowledge = createAsyncThunk(
  'shop/fetchShopKnowledge',
  async (token: string, { getState, rejectWithValue }) => {
    const state = (getState() as any).shop as ShopState;
    if (state.isLoaded) {
      return state.knowledge;
    }

    try {
      const res = await fetch('/api/tenants/knowledge', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch knowledge');
      return data.knowledge;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  }
);

// Async thunk to save shop knowledge
export const saveShopKnowledge = createAsyncThunk(
  'shop/saveShopKnowledge',
  async (
    { token, form }: { token: string; form: Partial<ShopKnowledge> },
    { rejectWithValue }
  ) => {
    try {
      const res = await fetch('/api/tenants/knowledge', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save knowledge');
      return { form, message: data.message };
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  }
);

export const shopSlice = createSlice({
  name: 'shop',
  initialState,
  reducers: {
    updateKnowledgeField: (
      state,
      action: PayloadAction<Partial<ShopKnowledge>>
    ) => {
      state.knowledge = { ...state.knowledge, ...action.payload };
    },
    invalidateKnowledge: (state) => {
      state.isLoaded = false;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch
      .addCase(fetchShopKnowledge.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchShopKnowledge.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isLoaded = true;
        if (action.payload) {
          state.knowledge = { ...state.knowledge, ...action.payload };
        }
      })
      .addCase(fetchShopKnowledge.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Save
      .addCase(saveShopKnowledge.pending, (state) => {
        state.isSaving = true;
        state.error = null;
      })
      .addCase(saveShopKnowledge.fulfilled, (state, action) => {
        state.isSaving = false;
        state.isLoaded = true;
        state.knowledge = { ...state.knowledge, ...action.payload.form };
      })
      .addCase(saveShopKnowledge.rejected, (state, action) => {
        state.isSaving = false;
        state.error = action.payload as string;
      });
  },
});

export const { updateKnowledgeField, invalidateKnowledge } = shopSlice.actions;
export default shopSlice.reducer;

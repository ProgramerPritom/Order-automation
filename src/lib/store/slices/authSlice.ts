import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface UserState {
  id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: 'superadmin' | 'admin' | 'staff' | string;
}

export interface TenantState {
  id: string | null;
  name: string;
  slug: string | null;
}

export interface AuthState {
  user: UserState | null;
  tenant: TenantState | null;
  token: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
}

const initialState: AuthState = {
  user: null,
  tenant: null,
  token: null,
  isAuthenticated: false,
  isHydrated: false,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    hydrateAuth: (
      state,
      action: PayloadAction<{
        user: UserState | null;
        tenant: TenantState | null;
        token: string | null;
      }>
    ) => {
      state.user = action.payload.user;
      state.tenant = action.payload.tenant;
      state.token = action.payload.token;
      state.isAuthenticated = !!action.payload.token;
      state.isHydrated = true;
    },
    updateUser: (state, action: PayloadAction<Partial<UserState>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
    updateTenant: (state, action: PayloadAction<Partial<TenantState>>) => {
      if (state.tenant) {
        state.tenant = { ...state.tenant, ...action.payload };
      }
    },
    logout: (state) => {
      state.user = null;
      state.tenant = null;
      state.token = null;
      state.isAuthenticated = false;
      state.isHydrated = true;
    },
  },
});

export const { hydrateAuth, updateUser, updateTenant, logout } = authSlice.actions;
export default authSlice.reducer;

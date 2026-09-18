import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import dashboardReducer from './slices/dashboardSlice';
import shopReducer from './slices/shopSlice';
import postsReducer from './slices/postsSlice';

export const makeStore = () => {
  return configureStore({
    reducer: {
      auth: authReducer,
      dashboard: dashboardReducer,
      shop: shopReducer,
      posts: postsReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
      }),
  });
};

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

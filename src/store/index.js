import { configureStore, combineReducers } from '@reduxjs/toolkit';
import sessionReducer from './sessionSlice';
import { persistStore, persistReducer } from 'redux-persist';
import localForage from 'localforage';
import { FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';

const rootReducer = combineReducers({ session: sessionReducer });
const persistConfig = { key: 'root', storage: localForage, whitelist: ['session'] };
const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: { ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER] }
    })
});

export const persistor = persistStore(store);

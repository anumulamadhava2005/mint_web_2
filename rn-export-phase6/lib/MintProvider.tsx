// @ts-nocheck
import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createMintRuntime, configureMint, hydrateSession } from "./mint-runtime";
import { SCHEMA, ROUTES, PROJECT_ID as _PID, API_ORIGIN_DEFAULT, AUTH_TOKEN_DEFAULT } from "./schema";

// Backend origin + project token. Override per-environment with a .env file
// (Expo inlines EXPO_PUBLIC_* at build time); falls back to the values baked
// at export. On a phone/Android emulator "localhost" is the DEVICE — point
// EXPO_PUBLIC_API_ORIGIN at your machine's LAN IP.
export const API_ORIGIN =
  (typeof process !== "undefined" && process.env && process.env.EXPO_PUBLIC_API_ORIGIN) || API_ORIGIN_DEFAULT;
export const AUTH_TOKEN =
  (typeof process !== "undefined" && process.env && process.env.EXPO_PUBLIC_MINT_TOKEN) || AUTH_TOKEN_DEFAULT;
export const PROJECT_ID = _PID;
// Persist the signed-in session across app launches via AsyncStorage.
const _rnStorage = {
  getItem: (k) => AsyncStorage.getItem(k),
  setItem: (k, v) => AsyncStorage.setItem(k, v),
  removeItem: (k) => AsyncStorage.removeItem(k),
};
// Must run before createMintRuntime so the DB/auth client picks up base + token.
configureMint({ apiOrigin: API_ORIGIN, authToken: AUTH_TOKEN, projectId: PROJECT_ID, storage: _rnStorage });

const Ctx = createContext(null);
export function useMint() { return useContext(Ctx); }

function routeFor(target) {
  if (!target) return "/";
  if (ROUTES[target]) return ROUTES[target];            // screenId → path
  return String(target)[0] === "/" ? String(target) : "/" + target;
}

export function MintProvider({ children }) {
  const ref = useRef(null);
  if (!ref.current) ref.current = createMintRuntime(SCHEMA);
  const runtime = ref.current;
  const [, force] = useReducer((x) => x + 1, 0);
  const [hydrated, setHydrated] = useState(false);

  // Restore a persisted session before rendering, then re-render on any change.
  useEffect(() => { Promise.resolve(hydrateSession(runtime, { userPath: "user" })).finally(() => setHydrated(true)); }, []);
  useEffect(() => runtime.state.subscribe("", () => force()), []);

  const navigation = useMemo(() => ({
    navigate: (r) => router.push(routeFor(r)),
    goBack: () => router.back(),
    replace: (r) => router.replace(routeFor(r)),
    reset: (routes) => { if (routes && routes[0]) router.replace(routeFor(routes[0])); },
  }), []);

  const dispatch = useMemo(() => (refs, event, loopCtx) => {
    const list = Array.isArray(refs) ? refs : [refs];
    for (const r of list) Promise.resolve(runtime.actions.dispatch(r, { navigation, event, loopCtx })).catch((e) => {
      const msg = (e && e.message) || String(e);
      console.error("[mint] action failed:", msg);
      runtime.state.set("_lastError", msg); // bind a component to $_lastError to surface it
    });
  }, [navigation]);

  const value = useMemo(() => ({ runtime, dispatch, navigation }), [dispatch, navigation]);
  return React.createElement(Ctx.Provider, { value }, hydrated ? children : null);
}

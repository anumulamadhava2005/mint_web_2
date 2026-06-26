// Unit tests for the 4 navigation/auth methods added to useRuntimeStore:
//   updateNavigation, addRoute, removeRoute, updateAuthConfig

import { describe, it, expect, beforeEach } from "vitest";
import { useRuntimeStore } from "@/lib/runtime/runtime-store";

// ── helpers ───────────────────────────────────────────────────────

function resetNav() {
  useRuntimeStore.setState((s) => {
    s.schema.navigation = { type: "stack", initialRoute: "/", routes: [] };
    s.schema.auth = undefined as any;
    s.dirty = false;
  });
}

// ── updateNavigation ──────────────────────────────────────────────

describe("updateNavigation", () => {
  beforeEach(() => resetNav());

  it("can change initialRoute", () => {
    useRuntimeStore.getState().updateNavigation({ initialRoute: "/home" });
    expect(useRuntimeStore.getState().schema.navigation.initialRoute).toBe("/home");
  });

  it("can change navigation type", () => {
    useRuntimeStore.getState().updateNavigation({ type: "tab" });
    expect(useRuntimeStore.getState().schema.navigation.type).toBe("tab");
  });

  it("marks the store as dirty", () => {
    useRuntimeStore.getState().updateNavigation({ initialRoute: "/dashboard" });
    expect(useRuntimeStore.getState().dirty).toBe(true);
  });
});

// ── addRoute ──────────────────────────────────────────────────────

describe("addRoute", () => {
  beforeEach(() => resetNav());

  it("adds a route that does not exist yet", () => {
    useRuntimeStore.getState().addRoute({ path: "/profile", screenId: "screen-1" });
    const routes = useRuntimeStore.getState().schema.navigation.routes;
    expect(routes).toHaveLength(1);
    expect(routes[0].path).toBe("/profile");
    expect(routes[0].screenId).toBe("screen-1");
  });

  it("is idempotent — ignores duplicate paths", () => {
    useRuntimeStore.getState().addRoute({ path: "/profile", screenId: "screen-1" });
    useRuntimeStore.getState().addRoute({ path: "/profile", screenId: "screen-2" });
    const routes = useRuntimeStore.getState().schema.navigation.routes;
    expect(routes).toHaveLength(1);
  });

  it("marks the store as dirty", () => {
    useRuntimeStore.getState().addRoute({ path: "/new", screenId: "s" });
    expect(useRuntimeStore.getState().dirty).toBe(true);
  });
});

// ── removeRoute ───────────────────────────────────────────────────

describe("removeRoute", () => {
  beforeEach(() => {
    resetNav();
    useRuntimeStore.getState().addRoute({ path: "/settings", screenId: "screen-10" });
    useRuntimeStore.getState().addRoute({ path: "/about", screenId: "screen-11" });
    // reset dirty so we can test it independently
    useRuntimeStore.setState((s) => { s.dirty = false; });
  });

  it("removes a route by path", () => {
    useRuntimeStore.getState().removeRoute("/settings");
    const routes = useRuntimeStore.getState().schema.navigation.routes;
    expect(routes.some((r: any) => r.path === "/settings")).toBe(false);
    expect(routes.some((r: any) => r.path === "/about")).toBe(true);
  });

  it("does nothing if path is not found", () => {
    useRuntimeStore.getState().removeRoute("/nonexistent");
    const routes = useRuntimeStore.getState().schema.navigation.routes;
    expect(routes).toHaveLength(2);
  });

  it("marks the store as dirty even when removing an existing route", () => {
    useRuntimeStore.getState().removeRoute("/settings");
    expect(useRuntimeStore.getState().dirty).toBe(true);
  });
});

// ── updateAuthConfig ──────────────────────────────────────────────

describe("updateAuthConfig", () => {
  beforeEach(() => resetNav());

  it("creates auth object from scratch when auth is undefined", () => {
    expect(useRuntimeStore.getState().schema.auth).toBeUndefined();
    useRuntimeStore.getState().updateAuthConfig({ sessionType: "cookie" });
    const auth = useRuntimeStore.getState().schema.auth;
    expect(auth).toBeDefined();
    expect((auth as any).sessionType).toBe("cookie");
  });

  it("provides sensible defaults when creating auth from scratch", () => {
    useRuntimeStore.getState().updateAuthConfig({ sessionType: "jwt" });
    const auth = useRuntimeStore.getState().schema.auth as any;
    expect(auth.providers).toEqual([]);
    expect(auth.tokenExpiry).toBe(3600);
    expect(auth.refreshEnabled).toBe(true);
  });

  it("merges updates into existing auth without replacing other fields", () => {
    // First call establishes auth
    useRuntimeStore.getState().updateAuthConfig({ sessionType: "jwt", tokenExpiry: 7200 });
    // Second call should only update tokenExpiry, leave sessionType intact
    useRuntimeStore.getState().updateAuthConfig({ tokenExpiry: 900 });
    const auth = useRuntimeStore.getState().schema.auth as any;
    expect(auth.sessionType).toBe("jwt");
    expect(auth.tokenExpiry).toBe(900);
  });

  it("marks the store as dirty", () => {
    useRuntimeStore.getState().updateAuthConfig({ refreshEnabled: false });
    expect(useRuntimeStore.getState().dirty).toBe(true);
  });
});

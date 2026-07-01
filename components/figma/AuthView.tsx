"use client";

// ═══════════════════════════════════════════════════════════════
// AuthView — project authentication configuration.
// Edits figmaStore.auth (providers, sessions, roles, MFA). Rides the
// Figma file autosave; consumed by exported apps / runtime.
// ═══════════════════════════════════════════════════════════════

import React, { useState } from "react";
import { Users, Plus, X } from "lucide-react";
import { useFigmaStore, type AuthProviderType } from "@/lib/stores/figmaStore";
import { C, inputStyle } from "./dbStudioTheme";
import { Toggle, SectionLabel } from "./dbStudioControls";

const PROVIDER_LABELS: Record<AuthProviderType, string> = {
  email: "Email & Password",
  google: "Google",
  github: "GitHub",
  apple: "Apple",
  facebook: "Facebook",
  "magic-link": "Magic Link",
};
const OAUTH = new Set<AuthProviderType>(["google", "github", "apple", "facebook"]);

export default function AuthView() {
  const auth = useFigmaStore((s) => s.auth);
  const setAuthConfig = useFigmaStore((s) => s.setAuthConfig);
  const toggleAuthProvider = useFigmaStore((s) => s.toggleAuthProvider);
  const updateAuthProvider = useFigmaStore((s) => s.updateAuthProvider);
  const [newRole, setNewRole] = useState("");

  const addRole = () => {
    const r = newRole.trim().replace(/[^a-zA-Z0-9_]/g, "_");
    if (r && !auth.roles.includes(r)) setAuthConfig({ roles: [...auth.roles, r] });
    setNewRole("");
  };
  const removeRole = (r: string) => {
    if (r === auth.defaultRole) return;
    setAuthConfig({ roles: auth.roles.filter((x) => x !== r) });
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: C.canvas, overflow: "hidden" }}>
      <div style={{ height: 40, display: "flex", alignItems: "center", gap: 10, padding: "0 12px",
        borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <Users size={13} style={{ color: C.accent }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>Authentication</span>
        <div style={{ flex: 1 }} />
        <Toggle on={auth.enabled} label={auth.enabled ? "Enabled" : "Disabled"} onClick={() => setAuthConfig({ enabled: !auth.enabled })} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 20, opacity: auth.enabled ? 1 : 0.55, pointerEvents: auth.enabled ? "auto" : "none" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 640 }}>

          {/* Providers */}
          <section>
            <SectionLabel style={{ marginBottom: 10 }}>Providers</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {auth.providers.map((p) => (
                <div key={p.type} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: C.text }}>{PROVIDER_LABELS[p.type]}</span>
                    <Toggle on={p.enabled} label="" onClick={() => toggleAuthProvider(p.type)} />
                  </div>
                  {p.enabled && OAUTH.has(p.type) && (
                    <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                      <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                        <span style={{ fontSize: 9, color: C.textDim }}>Client ID</span>
                        <input value={p.clientId ?? ""} spellCheck={false}
                          onChange={(e) => updateAuthProvider(p.type, { clientId: e.target.value })} style={inputStyle} />
                      </label>
                      <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                        <span style={{ fontSize: 9, color: C.textDim }}>Client Secret</span>
                        <input type="password" value={p.clientSecret ?? ""} spellCheck={false}
                          onChange={(e) => updateAuthProvider(p.type, { clientSecret: e.target.value })} style={inputStyle} />
                      </label>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Sessions */}
          <section>
            <SectionLabel style={{ marginBottom: 10 }}>Sessions</SectionLabel>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
              <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 9, color: C.textDim }}>Strategy</span>
                <select value={auth.sessionType} onChange={(e) => setAuthConfig({ sessionType: e.target.value as typeof auth.sessionType })}
                  style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="jwt">JWT</option>
                  <option value="cookie">Cookie</option>
                  <option value="session">Server session</option>
                </select>
              </label>
              <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 9, color: C.textDim }}>Token expiry (seconds)</span>
                <input type="number" value={auth.tokenExpiry}
                  onChange={(e) => setAuthConfig({ tokenExpiry: Number(e.target.value) || 0 })} style={inputStyle} />
              </label>
              <div style={{ paddingBottom: 6 }}>
                <Toggle on={auth.refresh} label="Refresh tokens" onClick={() => setAuthConfig({ refresh: !auth.refresh })} />
              </div>
            </div>
          </section>

          {/* Roles */}
          <section>
            <SectionLabel style={{ marginBottom: 10 }}>Roles</SectionLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              {auth.roles.map((r) => (
                <span key={r} style={{ display: "flex", alignItems: "center", gap: 6, background: C.panel,
                  border: `1px solid ${r === auth.defaultRole ? C.accent : C.border}`, borderRadius: 14, padding: "4px 10px", fontSize: 11, color: C.text }}>
                  {r}{r === auth.defaultRole && <span style={{ fontSize: 8, color: C.accent, textTransform: "uppercase" }}>default</span>}
                  {r !== auth.defaultRole && (
                    <button onClick={() => removeRole(r)} style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", padding: 0, display: "flex" }}>
                      <X size={11} />
                    </button>
                  )}
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input value={newRole} placeholder="new role" spellCheck={false}
                onChange={(e) => setNewRole(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addRole(); }}
                style={{ ...inputStyle, width: 160 }} />
              <button onClick={addRole}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 6, border: "none",
                  background: C.accentSoft, color: C.accent, fontSize: 11, cursor: "pointer" }}>
                <Plus size={11} /> Add
              </button>
              <label style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
                <span style={{ fontSize: 10, color: C.textDim }}>Default</span>
                <select value={auth.defaultRole} onChange={(e) => setAuthConfig({ defaultRole: e.target.value })}
                  style={{ ...inputStyle, width: 120, cursor: "pointer" }}>
                  {auth.roles.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
            </div>
          </section>

          {/* MFA */}
          <section>
            <SectionLabel style={{ marginBottom: 10 }}>Multi-factor auth</SectionLabel>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <Toggle on={auth.mfaEnabled} label="Require MFA" onClick={() => setAuthConfig({ mfaEnabled: !auth.mfaEnabled })} />
              {auth.mfaEnabled && (
                <select value={auth.mfaType} onChange={(e) => setAuthConfig({ mfaType: e.target.value as typeof auth.mfaType })}
                  style={{ ...inputStyle, width: 140, cursor: "pointer" }}>
                  <option value="totp">TOTP (authenticator)</option>
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                </select>
              )}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

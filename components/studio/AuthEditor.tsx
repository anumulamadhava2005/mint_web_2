"use client";

// ═══════════════════════════════════════════════════════════════
// AuthEditor — Auth & Security configuration panel
// Two-column layout: providers/JWT/roles on left, access matrix
// and provider config on the right.
// ═══════════════════════════════════════════════════════════════

import { useState } from "react";
import {
  Mail,
  Github,
  Smartphone,
  Chrome,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Shield,
  KeyRound,
} from "lucide-react";
import {
  Section,
  Field,
  TextField,
  Toggle,
  ToggleRow,
  Btn,
  IconBtn,
  Pill,
} from "./primitives";
import { useRuntimeStore } from "@/lib/runtime/runtime-store";
import type { AuthConfigSchema, AuthProvider } from "@/lib/runtime/schema";

// ── Default data ─────────────────────────────────────────────

const DEFAULT_AUTH: AuthConfigSchema = {
  providers: [
    { type: "email", enabled: true },
    { type: "google", enabled: false },
    { type: "github", enabled: false },
    { type: "apple", enabled: false },
  ],
  sessionType: "jwt",
  tokenExpiry: 7,
  refreshEnabled: true,
  rbac: {
    roles: ["admin", "user", "moderator"],
    defaultRole: "user",
  },
};

// ── Role / resource types for the access matrix ──────────────

type CrudAction = "C" | "R" | "U" | "D";

interface RoleAccess {
  name: string;
  isDefault: boolean;
  access: Record<string, CrudAction[]>;
}

const DEFAULT_RESOURCES = ["users", "posts", "products", "settings"];

const DEFAULT_ROLES: RoleAccess[] = [
  {
    name: "admin",
    isDefault: false,
    access: {
      users: ["C", "R", "U", "D"],
      posts: ["C", "R", "U", "D"],
      products: ["C", "R", "U", "D"],
      settings: ["C", "R", "U", "D"],
    },
  },
  {
    name: "user",
    isDefault: true,
    access: {
      users: [],
      posts: ["R"],
      products: ["R"],
      settings: [],
    },
  },
  {
    name: "moderator",
    isDefault: false,
    access: {
      users: ["R"],
      posts: ["R", "U"],
      products: ["R"],
      settings: [],
    },
  },
];

// ── Provider metadata ─────────────────────────────────────────

interface ProviderMeta {
  type: AuthProvider["type"];
  label: string;
  subtitle: string;
  icon: React.ReactNode;
}

const PROVIDER_META: ProviderMeta[] = [
  {
    type: "email",
    label: "Email / Password",
    subtitle: "Built-in auth",
    icon: <Mail size={18} />,
  },
  {
    type: "google",
    label: "Google OAuth",
    subtitle: "OAuth 2.0",
    icon: <Chrome size={18} />,
  },
  {
    type: "github",
    label: "GitHub OAuth",
    subtitle: "OAuth 2.0",
    icon: <Github size={18} />,
  },
  {
    type: "apple",
    label: "Apple Sign In",
    subtitle: "Sign in with Apple",
    icon: <Smartphone size={18} />,
  },
];

// ── Provider card ─────────────────────────────────────────────

function ProviderCard({
  meta,
  provider,
  selected,
  onToggle,
  onSelect,
}: {
  meta: ProviderMeta;
  provider: AuthProvider;
  selected: boolean;
  onToggle: (enabled: boolean) => void;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className="flex cursor-pointer flex-col gap-2 rounded-[var(--st-r-lg)] border p-3 transition-all"
      style={{
        background: selected ? "var(--st-brand-tint)" : "var(--st-elevated)",
        borderColor: selected ? "var(--st-brand)" : "var(--st-border)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--st-r-md)]"
          style={{
            background: "var(--st-surface-2)",
            color: provider.enabled ? "var(--st-brand)" : "var(--st-text-3)",
          }}
        >
          {meta.icon}
        </div>
        <Toggle
          checked={provider.enabled}
          onChange={(v) => {
            onToggle(v);
          }}
          label={`Enable ${meta.label}`}
        />
      </div>
      <div>
        <div className="text-[12px] font-semibold" style={{ color: "var(--st-text)" }}>
          {meta.label}
        </div>
        <div className="text-[10.5px]" style={{ color: "var(--st-text-3)" }}>
          {meta.subtitle}
        </div>
      </div>
      {provider.enabled && (
        <Pill tone="success">Active</Pill>
      )}
    </div>
  );
}

// ── Provider config panel ─────────────────────────────────────

function ProviderConfig({
  meta,
  provider,
  onChange,
}: {
  meta: ProviderMeta;
  provider: AuthProvider;
  onChange: (cfg: Record<string, string>) => void;
}) {
  if (provider.type === "email") {
    return (
      <div
        className="rounded-[var(--st-r-lg)] border p-3"
        style={{ background: "var(--st-elevated)", borderColor: "var(--st-border)" }}
      >
        <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--st-text-3)" }}>
          Email / Password Config
        </div>
        <p className="text-[11px]" style={{ color: "var(--st-text-2)" }}>
          No external credentials required. Users authenticate with email and password stored in the built-in user table.
        </p>
      </div>
    );
  }

  const cfg = provider.config ?? {};

  return (
    <div
      className="rounded-[var(--st-r-lg)] border p-3"
      style={{ background: "var(--st-elevated)", borderColor: "var(--st-border)" }}
    >
      <div className="mb-3 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--st-text-3)" }}>
        {meta.label} Config
      </div>
      <Field label="Client ID" htmlFor={`${provider.type}-client-id`}>
        <TextField
          id={`${provider.type}-client-id`}
          placeholder="your-client-id"
          value={cfg.clientId ?? ""}
          onChange={(e) => onChange({ ...cfg, clientId: e.target.value })}
        />
      </Field>
      <Field label="Client Secret" htmlFor={`${provider.type}-client-secret`}>
        <TextField
          id={`${provider.type}-client-secret`}
          type="password"
          placeholder="your-client-secret"
          value={cfg.clientSecret ?? ""}
          onChange={(e) => onChange({ ...cfg, clientSecret: e.target.value })}
        />
      </Field>
      <Field label="Scopes" htmlFor={`${provider.type}-scopes`} hint="space-separated">
        <textarea
          id={`${provider.type}-scopes`}
          rows={2}
          placeholder="openid email profile"
          value={cfg.scopes ?? ""}
          onChange={(e) => onChange({ ...cfg, scopes: e.target.value })}
          className="w-full resize-none rounded-[var(--st-r-md)] px-2.5 py-1.5 text-[12.5px] outline-none"
          style={{
            background: "var(--st-bg)",
            color: "var(--st-text)",
            boxShadow: "inset 0 0 0 1px var(--st-border-2)",
          }}
        />
      </Field>
    </div>
  );
}

// ── Access matrix ─────────────────────────────────────────────

const CRUD_ACTIONS: CrudAction[] = ["C", "R", "U", "D"];

function cellColor(action: CrudAction, allowed: boolean): string {
  if (!allowed) return "var(--st-surface-2)";
  const map: Record<CrudAction, string> = {
    C: "rgba(74,222,128,0.18)",
    R: "rgba(96,165,250,0.18)",
    U: "rgba(251,191,36,0.18)",
    D: "rgba(248,113,113,0.18)",
  };
  return map[action];
}

function cellTextColor(action: CrudAction, allowed: boolean): string {
  if (!allowed) return "var(--st-text-3)";
  const map: Record<CrudAction, string> = {
    C: "var(--st-success)",
    R: "#60a5fa",
    U: "var(--st-warning)",
    D: "var(--st-error)",
  };
  return map[action];
}

function AccessMatrix({
  roles,
  onToggle,
}: {
  roles: RoleAccess[];
  onToggle: (roleName: string, resource: string, action: CrudAction) => void;
}) {
  return (
    <div>
      <div
        className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: "var(--st-text-2)" }}
      >
        Access Matrix
      </div>
      <div className="overflow-x-auto rounded-[var(--st-r-md)] border" style={{ borderColor: "var(--st-border)" }}>
        <table className="w-full border-collapse text-[10.5px]">
          <thead>
            <tr style={{ background: "var(--st-surface-2)" }}>
              <th
                className="px-2 py-1.5 text-left font-semibold"
                style={{ color: "var(--st-text-2)", borderBottom: "1px solid var(--st-border)" }}
              >
                Role
              </th>
              {DEFAULT_RESOURCES.map((res) => (
                <th
                  key={res}
                  className="px-2 py-1.5 text-center font-semibold capitalize"
                  style={{ color: "var(--st-text-2)", borderBottom: "1px solid var(--st-border)" }}
                >
                  {res}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map((role, ri) => (
              <tr
                key={role.name}
                style={{
                  background: ri % 2 === 0 ? "transparent" : "var(--st-surface-2)",
                }}
              >
                <td
                  className="px-2 py-1.5 font-medium capitalize"
                  style={{ color: "var(--st-text)", borderBottom: "1px solid var(--st-border)" }}
                >
                  {role.name}
                  {role.isDefault && (
                    <span className="ml-1.5 text-[9px]" style={{ color: "var(--st-text-3)" }}>
                      default
                    </span>
                  )}
                </td>
                {DEFAULT_RESOURCES.map((res) => {
                  const granted = role.access[res] ?? [];
                  return (
                    <td
                      key={res}
                      className="px-1 py-1.5"
                      style={{ borderBottom: "1px solid var(--st-border)" }}
                    >
                      <div className="flex justify-center gap-0.5">
                        {CRUD_ACTIONS.map((action) => {
                          const has = granted.includes(action);
                          return (
                            <button
                              key={action}
                              type="button"
                              onClick={() => onToggle(role.name, res, action)}
                              title={`${action === "C" ? "Create" : action === "R" ? "Read" : action === "U" ? "Update" : "Delete"} ${res}`}
                              className="grid h-5 w-5 place-items-center rounded text-[9px] font-bold transition-all"
                              style={{
                                background: cellColor(action, has),
                                color: cellTextColor(action, has),
                              }}
                            >
                              {action}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-2 text-[9.5px]" style={{ color: "var(--st-text-3)" }}>
        {(["C", "R", "U", "D"] as CrudAction[]).map((a) => (
          <span key={a} style={{ color: cellTextColor(a, true) }}>
            {a}={a === "C" ? "Create" : a === "R" ? "Read" : a === "U" ? "Update" : "Delete"}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export function AuthEditor() {
  const { schema, setAuthConfig } = useRuntimeStore((s) => ({
    schema: s.schema,
    setAuthConfig: s.setAuthConfig,
  }));

  const auth: AuthConfigSchema = schema.auth ?? DEFAULT_AUTH;

  // Ensure all four provider types are present
  const allProviderTypes: AuthProvider["type"][] = ["email", "google", "github", "apple"];
  const providers = allProviderTypes.map(
    (t) => auth.providers.find((p) => p.type === t) ?? { type: t, enabled: false }
  );

  // Local UI state
  const [selectedProvider, setSelectedProvider] = useState<AuthProvider["type"] | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [roles, setRoles] = useState<RoleAccess[]>(() => {
    if (auth.rbac?.roles) {
      return auth.rbac.roles.map((name) => {
        const existing = DEFAULT_ROLES.find((r) => r.name === name);
        return existing ?? { name, isDefault: name === auth.rbac!.defaultRole, access: {} };
      });
    }
    return DEFAULT_ROLES;
  });
  const [newRoleName, setNewRoleName] = useState("");
  const [jwtSecret, setJwtSecret] = useState("");

  // ── Helpers ───────────────────────────────────────────────

  function updateProvider(type: AuthProvider["type"], updates: Partial<AuthProvider>) {
    const next = providers.map((p) =>
      p.type === type ? { ...p, ...updates } : p
    );
    setAuthConfig({ ...auth, providers: next });
  }

  function updateProviderConfig(type: AuthProvider["type"], cfg: Record<string, string>) {
    const next = providers.map((p) =>
      p.type === type ? { ...p, config: { ...(p.config ?? {}), ...cfg } } : p
    );
    setAuthConfig({ ...auth, providers: next });
  }

  function syncRolesToStore(nextRoles: RoleAccess[]) {
    const defaultRole = nextRoles.find((r) => r.isDefault)?.name ?? nextRoles[0]?.name ?? "user";
    setAuthConfig({
      ...auth,
      rbac: { roles: nextRoles.map((r) => r.name), defaultRole },
    });
  }

  function addRole() {
    const name = newRoleName.trim();
    if (!name || roles.find((r) => r.name === name)) return;
    const next = [...roles, { name, isDefault: false, access: {} }];
    setRoles(next);
    syncRolesToStore(next);
    setNewRoleName("");
  }

  function removeRole(name: string) {
    const next = roles.filter((r) => r.name !== name);
    setRoles(next);
    syncRolesToStore(next);
  }

  function setDefaultRole(name: string) {
    const next = roles.map((r) => ({ ...r, isDefault: r.name === name }));
    setRoles(next);
    syncRolesToStore(next);
  }

  function toggleMatrixCell(roleName: string, resource: string, action: CrudAction) {
    const next = roles.map((role) => {
      if (role.name !== roleName) return role;
      const cur = role.access[resource] ?? [];
      const has = cur.includes(action);
      return {
        ...role,
        access: {
          ...role.access,
          [resource]: has ? cur.filter((a) => a !== action) : [...cur, action],
        },
      };
    });
    setRoles(next);
  }

  const selectedProviderObj = selectedProvider
    ? providers.find((p) => p.type === selectedProvider) ?? null
    : null;
  const selectedMeta = selectedProvider
    ? PROVIDER_META.find((m) => m.type === selectedProvider) ?? null
    : null;

  // ── Render ────────────────────────────────────────────────

  return (
    <div
      className="flex h-full w-full overflow-hidden"
      style={{ background: "var(--st-canvas)" }}
    >
      {/* Left column */}
      <div
        className="flex flex-1 flex-col gap-0 overflow-y-auto"
        style={{ borderRight: "1px solid var(--st-border)" }}
      >
        {/* Header */}
        <div
          className="flex h-11 shrink-0 items-center gap-2 border-b px-4"
          style={{ borderColor: "var(--st-border)", background: "var(--st-surface)" }}
        >
          <Shield size={15} style={{ color: "var(--st-brand)" }} />
          <span
            className="text-[12px] font-semibold"
            style={{ color: "var(--st-text)" }}
          >
            Auth & Security
          </span>
        </div>

        {/* Auth Providers */}
        <Section title="Auth Providers" badge={providers.filter((p) => p.enabled).length}>
          <div className="grid grid-cols-2 gap-2.5">
            {PROVIDER_META.map((meta) => {
              const provider = providers.find((p) => p.type === meta.type)!;
              return (
                <ProviderCard
                  key={meta.type}
                  meta={meta}
                  provider={provider}
                  selected={selectedProvider === meta.type}
                  onToggle={(enabled) => {
                    updateProvider(meta.type, { enabled });
                    if (enabled) setSelectedProvider(meta.type);
                  }}
                  onSelect={() =>
                    setSelectedProvider((prev) =>
                      prev === meta.type ? null : meta.type
                    )
                  }
                />
              );
            })}
          </div>
        </Section>

        {/* JWT & Session */}
        <Section title="JWT & Session">
          <Field label="JWT Secret" htmlFor="jwt-secret">
            <div className="relative">
              <TextField
                id="jwt-secret"
                type={showSecret ? "text" : "password"}
                placeholder="your-super-secret-key"
                mono
                value={jwtSecret}
                onChange={(e) => setJwtSecret(e.target.value)}
                className="pr-8"
              />
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2"
                style={{ color: "var(--st-text-3)" }}
              >
                {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </Field>
          <Field label="Session Expiry" htmlFor="session-expiry">
            <div className="flex items-center gap-2">
              <TextField
                id="session-expiry"
                type="number"
                min={1}
                max={365}
                value={auth.tokenExpiry}
                onChange={(e) =>
                  setAuthConfig({ ...auth, tokenExpiry: Number(e.target.value) })
                }
                className="w-20"
              />
              <span className="text-[12px]" style={{ color: "var(--st-text-3)" }}>
                days
              </span>
            </div>
          </Field>
          <ToggleRow
            label="Token Refresh"
            hint="Auto-refresh sessions before expiry"
            checked={auth.refreshEnabled}
            onChange={(v) => setAuthConfig({ ...auth, refreshEnabled: v })}
          />
          <Field label="Session Type" htmlFor="session-type">
            <select
              id="session-type"
              value={auth.sessionType}
              onChange={(e) =>
                setAuthConfig({
                  ...auth,
                  sessionType: e.target.value as AuthConfigSchema["sessionType"],
                })
              }
              className="w-full rounded-[var(--st-r-md)] px-2.5 py-1.5 text-[12.5px] outline-none appearance-none"
              style={{
                background: "var(--st-bg)",
                color: "var(--st-text)",
                boxShadow: "inset 0 0 0 1px var(--st-border-2)",
              }}
            >
              <option value="jwt">JWT</option>
              <option value="cookie">Cookie</option>
              <option value="session">Server Session</option>
            </select>
          </Field>
        </Section>

        {/* Roles */}
        <Section title="Roles" badge={roles.length}>
          <div className="flex flex-col gap-1.5">
            {roles.map((role) => (
              <div
                key={role.name}
                className="flex items-center gap-2 rounded-[var(--st-r-md)] border px-2.5 py-1.5"
                style={{
                  background: "var(--st-elevated)",
                  borderColor: "var(--st-border)",
                }}
              >
                <input
                  type="text"
                  value={role.name}
                  onChange={(e) => {
                    const next = roles.map((r) =>
                      r.name === role.name ? { ...r, name: e.target.value } : r
                    );
                    setRoles(next);
                    syncRolesToStore(next);
                  }}
                  className="min-w-0 flex-1 bg-transparent text-[12px] outline-none"
                  style={{ color: "var(--st-text)" }}
                />
                <label
                  className="flex cursor-pointer items-center gap-1 text-[10.5px]"
                  style={{ color: "var(--st-text-3)" }}
                >
                  <input
                    type="checkbox"
                    checked={role.isDefault}
                    onChange={() => setDefaultRole(role.name)}
                    className="accent-[var(--st-brand)]"
                  />
                  default
                </label>
                <IconBtn
                  onClick={() => removeRole(role.name)}
                  title="Remove role"
                  style={{ color: "var(--st-error)" }}
                >
                  <Trash2 size={13} />
                </IconBtn>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <TextField
              placeholder="Role name…"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addRole();
              }}
              className="flex-1"
            />
            <Btn variant="outline" size="sm" onClick={addRole}>
              <Plus size={12} />
              Add
            </Btn>
          </div>
        </Section>
      </div>

      {/* Right column */}
      <div className="flex w-80 shrink-0 flex-col gap-0 overflow-y-auto">
        {/* Header */}
        <div
          className="flex h-11 shrink-0 items-center gap-2 border-b px-4"
          style={{ borderColor: "var(--st-border)", background: "var(--st-surface)" }}
        >
          <KeyRound size={15} style={{ color: "var(--st-brand)" }} />
          <span className="text-[12px] font-semibold" style={{ color: "var(--st-text)" }}>
            Config
          </span>
        </div>

        {/* Provider config (shown when a provider is selected) */}
        {selectedProviderObj && selectedMeta && (
          <div className="border-b p-4" style={{ borderColor: "var(--st-border)" }}>
            <ProviderConfig
              meta={selectedMeta}
              provider={selectedProviderObj}
              onChange={(cfg) => updateProviderConfig(selectedMeta.type, cfg)}
            />
          </div>
        )}

        {/* Access Matrix */}
        <div className="p-4">
          <AccessMatrix roles={roles} onToggle={toggleMatrixCell} />
        </div>
      </div>
    </div>
  );
}

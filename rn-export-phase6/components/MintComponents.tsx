// @ts-nocheck
import React, { useState, useMemo } from "react";
import { View, Text, Pressable, TextInput, FlatList, Image } from "react-native";
import { s } from "../lib/styles";

// ── StatusChip (configs.ts DEFAULT_STATUS_COLORS/LABELS) ─────
const STATUS_COLORS = { draft:"#6B7280", pending_manager:"#F59E0B", pending_department_head:"#F59E0B", pending_finance:"#3B82F6", approved:"#10B981", rejected:"#EF4444", reimbursed:"#8B5CF6", active:"#3B82F6", completed:"#10B981" };
export function StatusChip({ value }) {
  const v = String(value || "");
  const color = STATUS_COLORS[v] || "#6B7280";
  const label = v.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  return <View style={[s.chip, { backgroundColor: color + "22", borderColor: color }]}><Text style={[s.chipText, { color }]}>{label}</Text></View>;
}

// ── formatCellValue (data-table.ts) ──────────────────────────
function formatCell(value, col) {
  if (value == null) return "—";
  switch (col.type) {
    case "currency": return new Intl.NumberFormat("en-US", { style: "currency", currency: col.format || "USD" }).format(Number(value));
    case "number": return Number(value).toLocaleString();
    case "status": return String(value).replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    default: return String(value);
  }
}

// ── DataTable: search → sort → render (ported) ───────────────
export function DataTable({ data, config }) {
  const cols = config.columns || [];
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState(config.defaultSort?.key || null);
  const [dir, setDir] = useState(config.defaultSort?.direction || "asc");
  const rows = useMemo(() => {
    let r = [...(data || [])];
    if (q && config.searchable) {
      const fields = config.searchFields || cols.map((c) => c.key);
      r = r.filter((row) => fields.some((f) => row[f] != null && String(row[f]).toLowerCase().includes(q.toLowerCase())));
    }
    if (sortKey) {
      const col = cols.find((c) => c.key === sortKey);
      const mul = dir === "asc" ? 1 : -1;
      r.sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        if (col && (col.type === "number" || col.type === "currency")) return (Number(av) - Number(bv)) * mul;
        return String(av).localeCompare(String(bv)) * mul;
      });
    }
    return r;
  }, [data, q, sortKey, dir]);
  return (
    <View style={s.table}>
      {config.searchable && <TextInput style={s.input} placeholder={config.searchPlaceholder || "Search…"} placeholderTextColor="#9CA3AF" value={q} onChangeText={setQ} />}
      <View style={[s.tableRow, s.tableHead]}>
        {cols.map((c) => (
          <Pressable key={c.key} style={s.tableCell} onPress={() => { if (sortKey === c.key) setDir(dir === "asc" ? "desc" : "asc"); else setSortKey(c.key); }}>
            <Text style={s.tableHeadText}>{c.label}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList data={rows} keyExtractor={(_, i) => String(i)} renderItem={({ item }) => (
        <View style={s.tableRow}>
          {cols.map((c) => <View key={c.key} style={s.tableCell}><Text style={s.tableCellText}>{formatCell(item[c.key], c)}</Text></View>)}
        </View>
      )} ListEmptyComponent={<Text style={s.muted}>{config.emptyMessage || "No data"}</Text>} />
    </View>
  );
}

// ── Timeline: step active/completed logic (timeline.ts) ──────
function mapStatus(v) {
  const l = String(v || "").toLowerCase();
  if (["completed","done","approved","reimbursed","success"].includes(l)) return "completed";
  if (["active","running","current","pending_manager","pending_finance","pending_department_head"].includes(l)) return "active";
  if (["failed","error","rejected"].includes(l)) return "failed";
  return "pending";
}
export function Timeline({ data, config, activeStepValue }) {
  let activeIndex = -1;
  const items = (data || []).map((row, i) => {
    let status = "pending";
    if (activeStepValue != null && config.activeMatchKey) {
      if (row[config.activeMatchKey] === activeStepValue) { status = "active"; activeIndex = i; }
      else if (activeIndex >= 0) status = "pending"; else status = "completed";
    } else if (config.statusKey) status = mapStatus(row[config.statusKey]);
    else status = "completed";
    return { key: String(row.id || row.step_key || i), title: String(row[config.titleKey] || ""), subtitle: config.subtitleKey ? String(row[config.subtitleKey] || "") : "", comment: config.commentKey ? row[config.commentKey] : "", status };
  });
  const dot = { completed: "#10B981", active: "#3B82F6", pending: "#9CA3AF", failed: "#EF4444" };
  return (
    <View style={s.col}>
      {items.map((it) => (
        <View key={it.key} style={s.timelineItem}>
          <View style={[s.timelineDot, { backgroundColor: dot[it.status] || "#9CA3AF" }]} />
          <View style={s.flex}>
            <Text style={s.timelineTitle}>{it.title}</Text>
            {!!it.subtitle && <Text style={s.muted}>{it.subtitle}</Text>}
            {!!it.comment && <Text style={s.muted}>{String(it.comment)}</Text>}
          </View>
        </View>
      ))}
    </View>
  );
}

// ── SelectInput (minimal RN picker) ──────────────────────────
export function SelectInput({ options, value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const opts = (options || []).map((o) => typeof o === "string" ? { label: o, value: o } : o);
  const cur = opts.find((o) => o.value === value);
  return (
    <View>
      <Pressable style={s.input} onPress={() => setOpen(!open)}><Text style={cur ? s.text : s.muted}>{cur ? cur.label : (placeholder || "Select")}</Text></Pressable>
      {open && opts.map((o) => (
        <Pressable key={String(o.value)} style={s.selectOption} onPress={() => { onChange(o.value); setOpen(false); }}>
          <Text style={s.text}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ── DateField (text date entry; avoids extra native dep) ─────
export function DateField({ value, onChange }) {
  return <TextInput style={s.input} placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF" value={value || ""} onChangeText={onChange} />;
}

// ── FileUpload (expo-image-picker) ───────────────────────────
export function FileUpload({ projectId, onUploaded }) {
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const pick = async () => {
    try {
      setBusy(true);
      const ImagePicker = require("expo-image-picker");
      const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
      if (r.canceled) return;
      const asset = r.assets[0];
      const fd = new FormData();
      fd.append("projectId", projectId);
      fd.append("file", { uri: asset.uri, name: asset.fileName || "upload.jpg", type: asset.mimeType || "image/jpeg" });
      const origin = require("../lib/MintProvider").API_ORIGIN || "";
      const res = await fetch(origin + "/api/upload", { method: "POST", body: fd });
      const j = await res.json();
      if (j.url) { setName(asset.fileName || "uploaded"); onUploaded(j.url); }
    } catch (e) { console.warn(e); } finally { setBusy(false); }
  };
  return <Pressable style={s.button} onPress={pick}><Text style={s.buttonText}>{busy ? "Uploading…" : name ? ("✓ " + name) : "Upload Receipt"}</Text></Pressable>;
}

// ── MintImage (physique / food / avatar) ─────────────────────
export function MintImage({ src, config }) {
  const cfg = config || {};
  const h = cfg.height || 160;
  const radius = cfg.radius != null ? cfg.radius : 8;
  if (!src) return <View style={[s.imagePlaceholder, { height: h, borderRadius: radius }]}><Text style={s.muted}>No image</Text></View>;
  return <Image source={{ uri: String(src) }} style={{ width: "100%", height: h, borderRadius: radius }} resizeMode={cfg.fit === "contain" ? "contain" : "cover"} />;
}

// ── Camera (capture via expo-image-picker, upload, return URL) ─
export function Camera({ config, projectId, onCaptured }) {
  const cfg = config || {};
  const [busy, setBusy] = useState(false);
  const [uri, setUri] = useState("");
  const shoot = async () => {
    try {
      setBusy(true);
      const ImagePicker = require("expo-image-picker");
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { console.warn("Camera permission denied"); return; }
      const r = await ImagePicker.launchCameraAsync({ quality: cfg.quality || 0.7, cameraType: cfg.facing === "front" ? "front" : "back" });
      if (r.canceled) return;
      const asset = r.assets[0];
      setUri(asset.uri);
      const fd = new FormData();
      fd.append("projectId", projectId);
      fd.append("file", { uri: asset.uri, name: asset.fileName || "photo.jpg", type: asset.mimeType || "image/jpeg" });
      const origin = require("../lib/MintProvider").API_ORIGIN || "";
      const res = await fetch(origin + (cfg.uploadUrl || "/api/upload"), { method: "POST", body: fd });
      const j = await res.json();
      if (j.url) onCaptured(j.url);
    } catch (e) { console.warn(e); } finally { setBusy(false); }
  };
  return (
    <View style={s.col}>
      {cfg.previewEnabled !== false && !!uri && <Image source={{ uri }} style={{ width: "100%", height: 200, borderRadius: 10 }} />}
      <Pressable style={s.button} onPress={shoot}><Text style={s.buttonText}>{busy ? "Uploading…" : ("📷 " + (cfg.label || "Take Photo"))}</Text></Pressable>
    </View>
  );
}

// ── Chart (line / bar / area — pure RN Views, no native dep) ──
export function Chart({ data, config }) {
  const cfg = config || {};
  const rows = (cfg.maxPoints ? (data || []).slice(-cfg.maxPoints) : (data || [])).map((r) => Number(r[cfg.yKey] ?? 0));
  const H = cfg.height || 180;
  const color = cfg.color || "#6366F1";
  if (!rows.length) return <View style={[s.card, { height: H, alignItems: "center", justifyContent: "center" }]}><Text style={s.muted}>{(cfg.title ? cfg.title + ": " : "") + "No data"}</Text></View>;
  const min = Math.min(...rows, 0), max = Math.max(...rows, 1), span = (max - min) || 1;
  return (
    <View style={s.card}>
      {!!cfg.title && <Text style={s.muted}>{cfg.title}</Text>}
      <View style={{ flexDirection: "row", alignItems: "flex-end", height: H, gap: 4 }}>
        {rows.map((y, i) => (
          <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
            {cfg.showValues && <Text style={[s.muted, { fontSize: 9 }]}>{y}</Text>}
            <View style={{ width: "70%", height: Math.max(2, ((y - min) / span) * (H - 16)), backgroundColor: color, borderRadius: 3, opacity: cfg.type === "area" ? 0.5 : 1 }} />
          </View>
        ))}
      </View>
    </View>
  );
}

// ── StatCard (metric tile) ───────────────────────────────────
export function StatCard({ value, delta, config }) {
  const cfg = config || {};
  const dn = delta != null ? Number(delta) : NaN;
  const goodDown = cfg.deltaDirection === "down-good";
  const deltaColor = isNaN(dn) ? "#9CA3AF" : ((dn < 0) === goodDown ? "#10B981" : "#EF4444");
  return (
    <View style={s.statCard}>
      <View style={s.row}>
        {!!cfg.icon && <Text style={s.muted}>{cfg.icon}</Text>}
        <Text style={s.muted}>{cfg.label}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
        <Text style={[s.statValue, cfg.color ? { color: cfg.color } : null]}>{String(value ?? "")}</Text>
        {!!cfg.unit && <Text style={s.muted}>{cfg.unit}</Text>}
      </View>
      {delta != null && String(delta) !== "" && <Text style={{ color: deltaColor, fontSize: 12 }}>{!isNaN(dn) && dn > 0 ? "▲ " : !isNaN(dn) && dn < 0 ? "▼ " : ""}{String(delta)}</Text>}
    </View>
  );
}

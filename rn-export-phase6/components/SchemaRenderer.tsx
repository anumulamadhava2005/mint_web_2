// @ts-nocheck
import React from "react";
import { View, Text, TextInput, Pressable, ScrollView, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMint, PROJECT_ID } from "../lib/MintProvider";
import { STYLES, SCHEMA } from "../lib/schema";
import { DataTable, Timeline, StatusChip, SelectInput, DateField, FileUpload, MintImage, Camera, Chart, StatCard } from "./MintComponents";

// Screen = the top-level components for a route, in a scrollable safe area.
export function Screen({ components, background }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: background || "#0B0B0F" }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16 }}>
        <View style={{ flex: 1, position: "relative" }}>
          {(components || []).map((c) => <Node key={c.id} comp={c} />)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ScreenHost runs the screen's onMount actions (e.g. dbQuery loads), then renders it.
export function ScreenHost({ screen, background }) {
  const { dispatch, runtime, navigation } = useMint();
  React.useEffect(() => {
    // Protected screen: redirect to login when there's no authenticated user.
    if (screen.requiresAuth) {
      const u = runtime.state.get("user");
      const login = (SCHEMA.navigation && SCHEMA.navigation.loginRoute) || "/";
      if ((!u || !u.id) && screen.route !== login) { navigation.navigate(login); return; }
    }
    (screen.onMount || []).forEach((a) => dispatch([a]));
    (screen.localState || []).forEach((d) => { if (d.async && d.async.autoFetch && d.async.source) dispatch([d.async.source]); });
    // eslint-disable-next-line
  }, [screen.id]);
  return <Screen components={screen.components} background={background} />;
}

// Row height for repeaters = the children's bounding box, so absolutely
// positioned children don't stack on top of each other (per-row context).
function rowHeightOf(children) {
  let h = 0;
  for (const ch of children || []) {
    const st = STYLES[ch.id] || {};
    const t = Number(st.top) || 0;
    const hh = Number(st.height) || 0;
    if (t + hh > h) h = t + hh;
  }
  return h || undefined;
}

function Node({ comp, loopCtx }) {
  const { runtime, dispatch } = useMint();
  const ctx = { ...runtime.state.getContext(), ...(loopCtx || {}) };

  // visibility (role + conditionalRender)
  if (comp.requiredRoles && comp.requiredRoles.length) {
    const role = ctx.user && ctx.user.role;
    if (!role || comp.requiredRoles.indexOf(role) === -1) return null;
  }
  if (comp.conditionalRender) {
    try { if (!runtime.evalExpr(comp.conditionalRender, ctx)) return null; } catch {}
  }

  // resolve bound props
  const props = { ...(comp.props || {}) };
  const b = comp.bindings || {};
  for (const k in b) { try { props[k] = runtime.evalExpr(b[k], ctx); } catch {} }

  const style = STYLES[comp.id] || {};
  const ev = comp.events || {};
  const fire = (refs) => { if (refs && refs.length) dispatch(refs, undefined, loopCtx); };
  const setBound = (key, v) => { const expr = b[key]; if (expr) runtime.state.set(String(expr).replace(/^\$/, ""), v); };
  const kids = (lc) => (comp.children || []).map((ch) => <Node key={ch.id} comp={ch} loopCtx={lc || loopCtx} />);

  const bindVal = b.value || b.inputBind;
  const setVal = (v) => { if (bindVal) runtime.state.set(String(bindVal).replace(/^\$/, ""), v); fire(ev.onChange); };
  const it = props.inputType ? String(props.inputType) : null;
  const kbType = (t) => (t === "email" ? "email-address" : t === "number" ? "numeric" : t === "tel" ? "phone-pad" : "default");

  switch (comp.type) {
    case "text":
      return <Text style={style}>{String(props.text ?? props.value ?? "")}</Text>;

    case "button": {
      const label = String(props.text ?? props.label ?? "Button");
      const textStyle = { color: style.color || "#fff", fontSize: style.fontSize || 15, fontWeight: style.fontWeight || "600", textAlign: "center" };
      return (
        <Pressable style={style} disabled={!!props.disabled} onPress={() => fire(ev.onClick || ev.onPress)}>
          <Text style={textStyle}>{label}</Text>
        </Pressable>
      );
    }

    case "input":
    case "searchInput":
      return (
        <TextInput
          style={style}
          value={props.value != null ? String(props.value) : ""}
          onChangeText={setVal}
          placeholder={props.placeholder != null ? String(props.placeholder) : ""}
          placeholderTextColor="#9CA3AF"
          secureTextEntry={it === "password"}
          keyboardType={kbType(it)}
          autoCapitalize={(it === "email" || it === "password") ? "none" : "sentences"}
        />
      );

    case "select":
      return <SelectInput options={props.options || props.enumValues || []} value={props.value} onChange={(v) => setVal(v)} placeholder={props.placeholder} />;

    case "datePicker":
      return <DateField value={props.value} onChange={(v) => setVal(v)} />;

    case "statusChip": return <StatusChip value={props.value} />;
    case "dataTable": return <DataTable data={Array.isArray(props.dataSource) ? props.dataSource : []} config={props} />;
    case "timeline": return <Timeline data={Array.isArray(props.dataSource) ? props.dataSource : []} config={props} activeStepValue={props.activeStepValue} />;
    case "chart": return <Chart data={Array.isArray(props.dataSource) ? props.dataSource : []} config={props} />;
    case "statCard": return <StatCard value={props.value} delta={props.delta} config={props} />;
    case "fileUpload": return <FileUpload projectId={PROJECT_ID} onUploaded={(url) => setBound("value", url)} />;
    case "camera": return <Camera config={props} projectId={PROJECT_ID} onCaptured={(url) => setBound("value", url)} />;
    case "image":
      return props.src ? <MintImage src={String(props.src)} config={props} /> : <View style={style} />;

    default: {
      // frame-as-input (LayerContent.inputType on a frame)
      if (it && comp.type === "frame") {
        if (it === "textarea")
          return <TextInput style={style} multiline numberOfLines={4} value={props.value != null ? String(props.value) : ""} onChangeText={setVal} placeholder={props.placeholder ? String(props.placeholder) : ""} placeholderTextColor="#9CA3AF" />;
        if (it === "select")
          return <SelectInput options={props.selectOptions || props.options || []} value={props.value} onChange={(v) => setVal(v)} placeholder={props.placeholder} />;
        if (it === "checkbox")
          return <Pressable style={style} onPress={() => setVal(!props.value)}><Text style={{ color: style.color || "#E5E7EB" }}>{props.value ? "☑" : "☐"} {props.placeholder || ""}</Text></Pressable>;
        return <TextInput style={style} value={props.value != null ? String(props.value) : ""} onChangeText={setVal} placeholder={props.placeholder ? String(props.placeholder) : ""} placeholderTextColor="#9CA3AF" secureTextEntry={it === "password"} keyboardType={kbType(it)} autoCapitalize={(it === "email" || it === "password") ? "none" : "sentences"} />;
      }

      // repeater (list / grid / frame with repeatFor)
      if (comp.repeatFor) {
        let items = [];
        try { const v = runtime.evalExpr(comp.repeatFor.items, ctx); items = Array.isArray(v) ? v : []; } catch {}
        const as = comp.repeatFor.as || "item";
        const rh = rowHeightOf(comp.children);
        const rows = items.map((row, i) => (
          <View key={i} style={rh ? { position: "relative", height: rh } : { position: "relative" }}>
            {(comp.children || []).map((ch) => <Node key={ch.id} comp={ch} loopCtx={{ ...loopCtx, [as]: row }} />)}
          </View>
        ));
        return ev.onClick
          ? <Pressable style={style} onPress={() => fire(ev.onClick)}>{rows}</Pressable>
          : <View style={style}>{rows}</View>;
      }

      return ev.onClick
        ? <Pressable style={style} onPress={() => fire(ev.onClick)}>{kids()}</Pressable>
        : <View style={style}>{kids()}</View>;
    }
  }
}

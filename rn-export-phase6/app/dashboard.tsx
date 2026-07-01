// @ts-nocheck
import React from "react";
import { ScreenHost } from "../components/SchemaRenderer";
import { SCHEMA, THEME_BG } from "../lib/schema";

export default function DashboardScreen() {
  return <ScreenHost screen={SCHEMA.screens[2]} background={THEME_BG} />;
}

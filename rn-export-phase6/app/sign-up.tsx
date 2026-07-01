// @ts-nocheck
import React from "react";
import { ScreenHost } from "../components/SchemaRenderer";
import { SCHEMA, THEME_BG } from "../lib/schema";

export default function SignUpScreen() {
  return <ScreenHost screen={SCHEMA.screens[1]} background={THEME_BG} />;
}

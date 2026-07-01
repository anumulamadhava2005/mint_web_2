// @ts-nocheck
import React from "react";
import { ScreenHost } from "../components/SchemaRenderer";
import { SCHEMA, THEME_BG } from "../lib/schema";

export default function NewExpenseScreen() {
  return <ScreenHost screen={SCHEMA.screens[3]} background={THEME_BG} />;
}

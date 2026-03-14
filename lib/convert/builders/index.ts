// ═══════════════════════════════════════════════════════════════
// Framework Builders Index
// ═══════════════════════════════════════════════════════════════

export { reactBuilder } from "./react";
export { nextBuilder } from "./next";
export { vueBuilder } from "./vue";
export { svelteBuilder } from "./svelte";
export { reactNativeBuilder } from "./reactNative";
export { flutterBuilder } from "./flutter";

import { reactBuilder } from "./react";
import { nextBuilder } from "./next";
import { vueBuilder } from "./vue";
import { svelteBuilder } from "./svelte";
import { reactNativeBuilder } from "./reactNative";
import { flutterBuilder } from "./flutter";
import type { FrameworkBuilder, TargetFramework } from "../types";

/**
 * Registry of all available framework builders
 */
export const builders: Record<TargetFramework, FrameworkBuilder> = {
  react: reactBuilder,
  nextjs: nextBuilder,
  vue: vueBuilder,
  svelte: svelteBuilder,
  "react-native": reactNativeBuilder,
  flutter: flutterBuilder,
  html: reactBuilder, // Fallback to React for now
};

/**
 * Get a builder by target framework
 */
export function getBuilder(target: TargetFramework): FrameworkBuilder | undefined {
  return builders[target];
}

/**
 * Get all available frameworks
 */
export function getAvailableFrameworks(): { name: TargetFramework; displayName: string }[] {
  return Object.values(builders).map((b) => ({
    name: b.name,
    displayName: b.displayName,
  }));
}

# Product

## Register

product

## Users

Builders creating real applications inside a visual editor — a spectrum from designers
and product people to technical founders and developers. Their context is a focused,
session-long workflow: they're on a desktop, in the editor for extended stretches,
moving fast between the canvas, property inspectors, state/action/workflow tooling, and
backend/database configuration. The secondary surface is the marketing/onboarding flow
(`/home`, `/signup`, `/waitlist-success`) where prospects decide whether to commit.

The job to be done: turn an idea into a working, exportable application — design the UI on
a Penpot-style canvas, wire up state/actions/workflows, model the backend/database, preview
it, and export to React/Next/Vue/Svelte/React Native/Flutter/HTML.

## Product Purpose

Mint Web is a runtime-driven visual application builder. The editor produces design and
runtime schemas; the server persists project state, commits, database metadata, and
collaboration history; export builders turn the same source into runnable code across
frameworks. Success is when a builder can express the full power of the underlying schema
(state, actions, workflows, auth, data, runtime behavior) directly in the editor without
dropping to code — the UI must keep pace with the architecture behind it.

## Brand Personality

Precise, pro-grade, confident. Three words: **sharp, fast, trustworthy.** The reference
point is Figma / Linear — dense where density serves the work, calm everywhere else, and
always getting out of the builder's way. Tone in copy is direct and expert: short labels,
no hand-holding fluff, no marketing voice inside the tool. The editor should feel like a
serious instrument that rewards mastery.

## Anti-references

- **Cluttered / overwhelming.** No wall-of-controls density that buries the canvas. Every
  panel, field, and control earns its place; progressive disclosure over dumping everything.
- **Generic SaaS dashboard.** No cards-everywhere layouts, no gradient hero-metric blocks,
  no stock admin-template chrome.
- **Toy / low-fidelity no-code.** It must read as a production tool, not a hobby builder.
  Polish, precision, and real capability over cute.
- **Heavy / slow.** No heavy chrome, oversized shadows, or sluggish motion. Light, snappy,
  responsive — interactions feel instant.

## Design Principles

1. **The canvas is the protagonist.** Chrome recedes; the artboard and the user's work hold
   focus. Panels are quiet until engaged.
2. **Expose the full schema, not a subset.** Every backend/runtime capability (state, async,
   validation, actions, workflows, auth, policies) deserves a first-class editor control.
   Capability hidden behind code is a product gap, not a simplification.
3. **Progressive disclosure beats density.** Advanced configuration (retry policies, MFA,
   conditional rendering) lives one deliberate layer down — discoverable, never in the way.
4. **Speed is a feature.** Instant feedback, snappy motion, no perceptible lag between intent
   and result. Animation is intentional and brief, never decorative drag.
5. **Consistency is trust.** One set of patterns for editing a property anywhere — an
   expression input, a binding control, a key/value editor behave identically across panels.

## Accessibility & Inclusion

Target WCAG 2.1 AA. Body text ≥4.5:1, large/UI text ≥3:1 (the dark token palette already
documents per-color ratios). Full keyboard operability for a tool used all day; visible
focus rings (`--focus` violet). Never rely on color as the sole information carrier
(pair with icon/label). Honor `prefers-reduced-motion` for all editor transitions.

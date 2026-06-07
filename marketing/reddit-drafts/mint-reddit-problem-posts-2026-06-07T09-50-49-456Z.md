# Reddit Problem Posts

These are first-person problem posts for manual review. They are intentionally framed as community questions, not campaign copy.

## 1. I am tired of full deployments for changes that are basically just product config

Subreddit: r/webdev
Flair: Discussion

```markdown
I keep running into this problem and it is starting to feel absurd.

- A button label changes.
- An onboarding step needs to move.
- A workflow condition changes.
- Someone wants a slightly different empty state or approval flow.

None of this feels like real engineering work, but it still turns into a code change, PR, review, build, deploy, QA pass, and sometimes a rollback plan. I get why the process exists, but for small product behavior changes it feels painfully heavy.

How are you handling this? Are you moving this stuff into config, feature flags, CMS-like systems, server-driven UI, internal tools, or just accepting the deploy cycle?

I am trying to figure out where the line should be between code and runtime-editable app behavior.

I am not looking for a sales pitch. I want to hear what has actually worked, what failed, and what tradeoffs people ran into.
```

## 2. Does anyone else feel like design-to-code handoff is still mostly manual translation?

Subreddit: r/Frontend
Flair: Discussion

```markdown
I am frustrated by how much work gets repeated between design and implementation.

- The design file has the intended screen.
- The frontend has the real screen.
- The prototype has the intended flow.
- The codebase has the actual state and edge cases.

After a few iterations these all drift. Then nobody knows which source of truth is current. The frontend engineer becomes the translator, the designer keeps tweaking the mockup, and the product person thinks the prototype was already close to done.

Has anyone found a workflow where visual design, prototype behavior, and production UI stay meaningfully connected? Or is the handoff pain just inevitable?

I am especially interested in approaches where the output is still real code, not a locked-in visual-builder runtime.

I am not looking for a sales pitch. I want to hear what has actually worked, what failed, and what tradeoffs people ran into.
```

## 3. I keep hitting the same wall with no-code tools: the backend gets real

Subreddit: r/SaaS
Flair: Discussion

```markdown
I want to like visual builders, but I keep running into the same failure mode.

- The UI is easy enough to sketch.
- Then I need state.
- Then actions.
- Then workflows.
- Then database tables and permissions.
- Then API behavior and edge cases.

At that point the visual builder stops feeling fast and starts feeling like another layer I have to fight. I either rebuild the whole thing in code or glue together a bunch of fragile automations.

For people building SaaS dashboards/internal tools, what do you use when the app is simple enough to be repetitive but complex enough that a basic no-code builder falls apart?

I am trying to understand whether the missing piece is better backend modeling, better code export, or just accepting that serious products need custom code earlier.

I am not looking for a sales pitch. I want to hear what has actually worked, what failed, and what tradeoffs people ran into.
```

## 4. How do you deal with mobile product changes that should not need an app release?

Subreddit: r/reactnative
Flair: Discussion

```markdown
This is one of those mobile problems that makes me want to scream a little.

- Marketing wants an onboarding tweak.
- Product wants a different screen order.
- Support wants copy changed on a confusing step.
- Ops wants to disable or reroute a flow temporarily.

The change itself is tiny, but because it lives in the app it gets treated like an app release. Even with Expo and good release tooling, there is still coordination, testing, and risk around something that feels more like configuration than code.

What are you all comfortable making remotely configurable in React Native apps? Screens? Copy? Navigation? Form validation? Entire flows?

I am trying to find the sane boundary between server-driven UI and normal compiled mobile code.

I am not looking for a sales pitch. I want to hear what has actually worked, what failed, and what tradeoffs people ran into.
```

## 5. Why does an approved prototype still turn into a huge translation project?

Subreddit: r/ProductManagement
Flair: Discussion

```markdown
This keeps bothering me on product work.

- The prototype explains the idea clearly.
- The team agrees on the flow.
- The edge cases get discussed.
- Then implementation starts and everything has to be translated into tickets, components, state, APIs, and QA notes.

It feels like the prototype captures a ton of product intent, but almost none of that intent is executable. So the same decisions get remade during implementation, and details get lost.

How do your teams keep prototype intent from getting lost before engineering ships the real thing?

I am looking for better ways to connect screens, interactions, state, and workflows instead of treating prototypes as disposable artifacts.

I am not looking for a sales pitch. I want to hear what has actually worked, what failed, and what tradeoffs people ran into.
```

## 6. I am sick of rebuilding the same internal tool patterns over and over

Subreddit: r/startups
Flair: Discussion

```markdown
Maybe this is just startup life, but this pattern is exhausting.

- Another dashboard.
- Another approval flow.
- Another CRUD table.
- Another admin screen.
- Another status workflow.

The domain changes, but the shape is almost always the same. We still spend engineering time wiring layout, state, forms, tables, permissions, filters, and deployment. It is not hard work exactly, but it eats focus that should go into the actual product.

What is your current approach for internal tools when you still want to own the code? Retool? Custom app? Rails/Django admin? Something else?

I am trying to find a workflow where the repetitive structure can be generated or visually assembled without giving up code ownership.

I am not looking for a sales pitch. I want to hear what has actually worked, what failed, and what tradeoffs people ran into.
```

## 7. Design feedback gets scattered everywhere and then nobody knows what actually changed

Subreddit: r/UXDesign
Flair: Discussion

```markdown
I am trying to understand if this is just our workflow or a common design/product problem.

- Some feedback is in the design file.
- Some is in Slack.
- Some is in a ticket.
- Some is on a screenshot.
- Some is remembered from a meeting and never written down.

By the time the UI is implemented, it is hard to connect feedback to the exact screen, state, frame, or behavior that caused it. Review becomes a memory game.

How do you keep feedback tied to the actual app surface and not just floating around in comments and screenshots?

I am especially interested in workflows for products with lots of states, flows, and role-specific screens.

I am not looking for a sales pitch. I want to hear what has actually worked, what failed, and what tradeoffs people ran into.
```

## 8. I do not trust visual builders that do not let me own the generated code

Subreddit: r/programming
Flair: Discussion

```markdown
This is my biggest hesitation with low-code and visual app builders.

- The first version is fast.
- The demo looks good.
- Then a real requirement shows up.
- Then you discover whether you own the app or you are trapped in the platform.

I want the speed of visual building, but I do not want a black box. If the tool cannot export readable source code, I get nervous about long-term maintenance, hiring, debugging, and migration.

Would you use a visual builder if the main output was real source code in your framework, or is the whole category a non-starter for you?

I am trying to understand what would make developers actually trust this kind of workflow.

I am not looking for a sales pitch. I want to hear what has actually worked, what failed, and what tradeoffs people ran into.
```

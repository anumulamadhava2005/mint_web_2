#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("fs");
const path = require("path");

const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), "marketing", "reddit-drafts");

const problemAngles = [
  {
    id: "deployment-bottleneck",
    subreddit: "webdev",
    title: "I am tired of full deployments for changes that are basically just product config",
    hook: "I keep running into this problem and it is starting to feel absurd.",
    pain: [
      "A button label changes.",
      "An onboarding step needs to move.",
      "A workflow condition changes.",
      "Someone wants a slightly different empty state or approval flow.",
    ],
    rant: "None of this feels like real engineering work, but it still turns into a code change, PR, review, build, deploy, QA pass, and sometimes a rollback plan. I get why the process exists, but for small product behavior changes it feels painfully heavy.",
    ask: "How are you handling this? Are you moving this stuff into config, feature flags, CMS-like systems, server-driven UI, internal tools, or just accepting the deploy cycle?",
    context: "I am trying to figure out where the line should be between code and runtime-editable app behavior.",
  },
  {
    id: "design-to-code-drift",
    subreddit: "Frontend",
    title: "Does anyone else feel like design-to-code handoff is still mostly manual translation?",
    hook: "I am frustrated by how much work gets repeated between design and implementation.",
    pain: [
      "The design file has the intended screen.",
      "The frontend has the real screen.",
      "The prototype has the intended flow.",
      "The codebase has the actual state and edge cases.",
    ],
    rant: "After a few iterations these all drift. Then nobody knows which source of truth is current. The frontend engineer becomes the translator, the designer keeps tweaking the mockup, and the product person thinks the prototype was already close to done.",
    ask: "Has anyone found a workflow where visual design, prototype behavior, and production UI stay meaningfully connected? Or is the handoff pain just inevitable?",
    context: "I am especially interested in approaches where the output is still real code, not a locked-in visual-builder runtime.",
  },
  {
    id: "backend-for-ui-builders",
    subreddit: "SaaS",
    title: "I keep hitting the same wall with no-code tools: the backend gets real",
    hook: "I want to like visual builders, but I keep running into the same failure mode.",
    pain: [
      "The UI is easy enough to sketch.",
      "Then I need state.",
      "Then actions.",
      "Then workflows.",
      "Then database tables and permissions.",
      "Then API behavior and edge cases.",
    ],
    rant: "At that point the visual builder stops feeling fast and starts feeling like another layer I have to fight. I either rebuild the whole thing in code or glue together a bunch of fragile automations.",
    ask: "For people building SaaS dashboards/internal tools, what do you use when the app is simple enough to be repetitive but complex enough that a basic no-code builder falls apart?",
    context: "I am trying to understand whether the missing piece is better backend modeling, better code export, or just accepting that serious products need custom code earlier.",
  },
  {
    id: "mobile-update-latency",
    subreddit: "reactnative",
    title: "How do you deal with mobile product changes that should not need an app release?",
    hook: "This is one of those mobile problems that makes me want to scream a little.",
    pain: [
      "Marketing wants an onboarding tweak.",
      "Product wants a different screen order.",
      "Support wants copy changed on a confusing step.",
      "Ops wants to disable or reroute a flow temporarily.",
    ],
    rant: "The change itself is tiny, but because it lives in the app it gets treated like an app release. Even with Expo and good release tooling, there is still coordination, testing, and risk around something that feels more like configuration than code.",
    ask: "What are you all comfortable making remotely configurable in React Native apps? Screens? Copy? Navigation? Form validation? Entire flows?",
    context: "I am trying to find the sane boundary between server-driven UI and normal compiled mobile code.",
  },
  {
    id: "prototype-to-production",
    subreddit: "ProductManagement",
    title: "Why does an approved prototype still turn into a huge translation project?",
    hook: "This keeps bothering me on product work.",
    pain: [
      "The prototype explains the idea clearly.",
      "The team agrees on the flow.",
      "The edge cases get discussed.",
      "Then implementation starts and everything has to be translated into tickets, components, state, APIs, and QA notes.",
    ],
    rant: "It feels like the prototype captures a ton of product intent, but almost none of that intent is executable. So the same decisions get remade during implementation, and details get lost.",
    ask: "How do your teams keep prototype intent from getting lost before engineering ships the real thing?",
    context: "I am looking for better ways to connect screens, interactions, state, and workflows instead of treating prototypes as disposable artifacts.",
  },
  {
    id: "internal-tools-repetition",
    subreddit: "startups",
    title: "I am sick of rebuilding the same internal tool patterns over and over",
    hook: "Maybe this is just startup life, but this pattern is exhausting.",
    pain: [
      "Another dashboard.",
      "Another approval flow.",
      "Another CRUD table.",
      "Another admin screen.",
      "Another status workflow.",
    ],
    rant: "The domain changes, but the shape is almost always the same. We still spend engineering time wiring layout, state, forms, tables, permissions, filters, and deployment. It is not hard work exactly, but it eats focus that should go into the actual product.",
    ask: "What is your current approach for internal tools when you still want to own the code? Retool? Custom app? Rails/Django admin? Something else?",
    context: "I am trying to find a workflow where the repetitive structure can be generated or visually assembled without giving up code ownership.",
  },
  {
    id: "collaboration-context",
    subreddit: "UXDesign",
    title: "Design feedback gets scattered everywhere and then nobody knows what actually changed",
    hook: "I am trying to understand if this is just our workflow or a common design/product problem.",
    pain: [
      "Some feedback is in the design file.",
      "Some is in Slack.",
      "Some is in a ticket.",
      "Some is on a screenshot.",
      "Some is remembered from a meeting and never written down.",
    ],
    rant: "By the time the UI is implemented, it is hard to connect feedback to the exact screen, state, frame, or behavior that caused it. Review becomes a memory game.",
    ask: "How do you keep feedback tied to the actual app surface and not just floating around in comments and screenshots?",
    context: "I am especially interested in workflows for products with lots of states, flows, and role-specific screens.",
  },
  {
    id: "framework-lock-in",
    subreddit: "programming",
    title: "I do not trust visual builders that do not let me own the generated code",
    hook: "This is my biggest hesitation with low-code and visual app builders.",
    pain: [
      "The first version is fast.",
      "The demo looks good.",
      "Then a real requirement shows up.",
      "Then you discover whether you own the app or you are trapped in the platform.",
    ],
    rant: "I want the speed of visual building, but I do not want a black box. If the tool cannot export readable source code, I get nervous about long-term maintenance, hiring, debugging, and migration.",
    ask: "Would you use a visual builder if the main output was real source code in your framework, or is the whole category a non-starter for you?",
    context: "I am trying to understand what would make developers actually trust this kind of workflow.",
  },
];

function parseArgs(argv) {
  const options = {
    count: problemAngles.length,
    format: "md",
    outputDir: DEFAULT_OUTPUT_DIR,
    subreddit: "",
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--count" && next) {
      options.count = Math.max(1, Math.min(problemAngles.length, Number(next) || problemAngles.length));
      i++;
    } else if (arg === "--format" && next) {
      if (!["md", "json"].includes(next)) {
        throw new Error("--format must be either md or json");
      }
      options.format = next;
      i++;
    } else if (arg === "--output" && next) {
      options.outputDir = path.resolve(process.cwd(), next);
      i++;
    } else if (arg === "--subreddit" && next) {
      options.subreddit = next.replace(/^r\//, "");
      i++;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function buildPost(angle, index, forcedSubreddit) {
  const subreddit = forcedSubreddit || angle.subreddit;
  const body = [
    angle.hook,
    "",
    ...angle.pain.map((point) => `- ${point}`),
    "",
    angle.rant,
    "",
    angle.ask,
    "",
    angle.context,
    "",
    "I am not looking for a sales pitch. I want to hear what has actually worked, what failed, and what tradeoffs people ran into.",
  ].join("\n");

  return {
    id: angle.id,
    index,
    subreddit: `r/${subreddit}`,
    title: angle.title,
    flair: "Discussion",
    body,
  };
}

function toMarkdown(posts) {
  return [
    "# Reddit Problem Posts",
    "",
    "These are first-person problem posts for manual review. They are intentionally framed as community questions, not campaign copy.",
    "",
    ...posts.map((post) => [
      `## ${post.index}. ${post.title}`,
      "",
      `Subreddit: ${post.subreddit}`,
      `Flair: ${post.flair}`,
      "",
      "```markdown",
      post.body,
      "```",
      "",
    ].join("\n")),
  ].join("\n");
}

function writeOutput(posts, options) {
  fs.mkdirSync(options.outputDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `mint-reddit-problem-posts-${stamp}.${options.format}`;
  const filePath = path.join(options.outputDir, fileName);
  const content = options.format === "json"
    ? JSON.stringify({ generatedAt: new Date().toISOString(), posts }, null, 2)
    : toMarkdown(posts);

  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

function printHelp() {
  console.log(`
Mint Web Reddit problem-post generator

Usage:
  npm run reddit:drafts
  npm run reddit:drafts -- --count 4
  npm run reddit:drafts -- --format json
  npm run reddit:drafts -- --output marketing/reddit-drafts
  npm run reddit:drafts -- --subreddit webdev

Options:
  --count <n>        Number of problem posts to generate. Defaults to all.
  --format <md|json> Output format. Defaults to md.
  --output <dir>     Output directory. Defaults to marketing/reddit-drafts.
  --subreddit <name> Override target subreddit for all drafts.
`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const posts = problemAngles
    .slice(0, options.count)
    .map((angle, index) => buildPost(angle, index + 1, options.subreddit));

  const filePath = writeOutput(posts, options);
  console.log(`Created ${posts.length} Reddit problem post${posts.length === 1 ? "" : "s"}: ${filePath}`);
}

main();

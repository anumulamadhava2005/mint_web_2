# Reddit Post Draft Automation

Mint Web includes a local generator for first-person Reddit problem posts:

```bash
npm run reddit:drafts
```

The tool creates review-ready drafts in `marketing/reddit-drafts/`. It does not automatically submit posts to Reddit. The generated posts are intentionally written as personal problem statements asking for advice, not campaign posts.

## Usage

Generate all problem posts as Markdown:

```bash
npm run reddit:drafts
```

Generate four problem posts:

```bash
npm run reddit:drafts -- --count 4
```

Generate JSON for another tool:

```bash
npm run reddit:drafts -- --format json
```

Override the target subreddit:

```bash
npm run reddit:drafts -- --subreddit webdev
```

Write to a custom directory:

```bash
npm run reddit:drafts -- --output tmp/reddit-drafts
```

## Post Angles

The generator creates first-person posts around different problems Mint Web can address:

- Deployment bottlenecks for small product changes.
- Design-to-code drift.
- Visual builders that fail when backend behavior gets real.
- Mobile update latency.
- Prototype-to-production translation.
- Repetitive internal-tool development.
- Design review losing context.
- Framework and platform lock-in.

There is also a hand-written third-post follow-up draft based on the earlier `r/reactnative` posts:

- `marketing/reddit-drafts/runtime-driven-third-waitlist-post.md`

Each post includes:

- Subreddit suggestion.
- First-person title.
- Frustrated problem setup.
- Concrete pain bullets.
- Ask-for-help discussion prompt.
- Minimal or no product mention.

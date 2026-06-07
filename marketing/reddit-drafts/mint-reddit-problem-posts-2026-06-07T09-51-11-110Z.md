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

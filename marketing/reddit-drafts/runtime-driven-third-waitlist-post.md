# Third Reddit Post Draft

Subreddit: `r/reactnative`
Flair: `Discussion`

Title:

```text
Update after feedback: I am opening a waitlist for the runtime-driven app builder I have been prototyping
```

Body:

```markdown
I posted here recently about the runtime-driven mobile/app architecture I have been experimenting with, and the feedback was honestly more useful than I expected.

The biggest pushbacks were fair:

- Is this just OTA updates with extra steps?
- Where does this run into App Store / Play Store policy problems?
- How do you keep runtime-driven apps maintainable instead of turning them into a black box?
- What parts of app behavior should be dynamic, and what should always stay as normal code?
- Would developers actually trust a visual/runtime system if they cannot own the output?

Those questions made me rethink how I explain the product.

The thing I am trying to build is not just "push new bundles faster". The problem I keep coming back to is this:

Small product changes still move through the same heavy pipeline as real engineering changes.

Changing a screen layout, onboarding step, workflow condition, backend action, form behavior, database binding, or navigation flow often means touching code, rebuilding, redeploying, testing again, and sometimes waiting for review/update cycles. That feels too slow for changes that are mostly product behavior.

So I have been building Mint Web as an early prototype around this idea:

What if the app could act more like a runtime engine, where UI, workflows, state, actions, and backend bindings are described through schemas and can be updated visually, while developers can still export/own the generated code?

It is still early. I know there are hard problems around performance, policy compliance, debugging, generated code quality, security, and long-term maintainability. I am not pretending this is solved.

But I want to start letting more people try it and tell me where it breaks.

I opened a waitlist here:

https://mintweb.mintit.pro/home

If you are building React Native apps, internal tools, mobile-first SaaS products, or you have dealt with this "small change, full redeploy" pain, I would genuinely love for you to join and give feedback.

Also, if you think this architecture is a bad idea, I still want to hear why. The criticism on my previous posts helped a lot.

What would you need to see before trusting a runtime-driven visual builder in a real project?
```


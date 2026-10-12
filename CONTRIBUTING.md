# Contributing

PatchScope has no runtime dependencies and requires Node.js 22+ and Git.

1. Fork and clone this repository.
2. Run `npm run check` and `npm test`.
3. Start `node src/cli.js /path/to/a/git/repository`.
4. Keep changes focused and explain the user-facing behavior in your pull request.

For diff parsing or Git behavior, add a test that uses a real temporary repository. For UI changes, check light and dark themes, keyboard navigation, an empty repository, and a narrow viewport. Keep repository content in text nodes; do not render source through `innerHTML`.

The static demo lives in `docs/` and shares the same UI as the local app. Update sample data only when it helps demonstrate actual behavior.

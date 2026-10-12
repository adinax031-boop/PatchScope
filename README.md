# ◈ PatchScope

### Small changes. Clearer perspective.

A calm, local-first workspace for reviewing Git changes before you ship. A real Git reader, a visual change map, and review checkpoints that reopen when a patch changes. **Zero runtime dependencies.**

[Try the interactive demo](https://adinax031-boop.github.io/PatchScope/) · [Contribute](CONTRIBUTING.md) · [Security](SECURITY.md)

## Run locally

Requires **Node.js 22+** and **Git**. No install step or account required.

```sh
git clone https://github.com/adinax031-boop/PatchScope.git
cd PatchScope
node src/cli.js /path/to/your/repository
```

Open **http://127.0.0.1:4317**. Use the exact printed loopback address. To choose a port:

```sh
node src/cli.js /path/to/your/repository --port 4318
```

To install the command from your clone, run `npm install -g .`, then `patchscope /path/to/repo`. This project is not yet published to npm.

## A workspace with purpose

| Feature | Behavior |
| --- | --- |
| Real Git diffs | Working tree compares tracked working files with HEAD; staged compares the index with HEAD. |
| Change map | Segment widths reflect additions plus deletions; click to jump to a file. |
| Review checkpoints | Keyed by repository, scope, path, and SHA-256 of the patch. Edits reopen the file. |
| Fast navigation | Search filenames, filter reviewed files, use the command palette. |
| Comfortable reading | Context toggle, numbered hunks, responsive layout, light and dark themes. |
| Export | Download a JSON report with fingerprints and checkpoint status. No code contents. |
| Private by default | Loopback-only, read-only, no analytics, no network dependencies. |

**Working tree** includes staged and unstaged changes together relative to HEAD. **Staged** includes only the index. Untracked files are counted but omitted until staged. Rename, binary, added, deleted, and metadata-only changes are represented. New repositories without a first commit are supported.

## Keyboard

| Shortcut | Action |
| --- | --- |
| `/` | Search files |
| `J` / `K` | Next / previous visible file |
| `R` | Review / reopen current file |
| `Ctrl K` / `⌘ K` | Command palette |
| `?` | Show commands |
| `Esc` | Close palette |

Checkpoints live in this browser. Switching browsers does not carry them over. No automatic polling: refresh to reread changes. Avoid editing files during a refresh; Git reads are not an atomic repository snapshot.

## Architecture

`src/cli.js` starts a Node HTTP server on loopback. `src/git.js` executes Git using argument arrays, parses NUL-separated numstat records, reads per-file patches, and fingerprints each diff. `src/server.js` exposes a bounded read-only snapshot endpoint and an asset allowlist. `docs/` contains the dependency-free UI and sample data, also deployable to GitHub Pages.

The server caps reviews at 150 changed files, displays up to 6,000 diff lines per file, and limits each Git command to 8 MiB and 15 seconds. Oversized commands return an explicit error. For larger changes, use smaller commits or a native Git client. Display truncation is called out in the UI and export.

## Validation

```sh
npm run check
npm test
```

Tests use real temporary Git repositories for staged/unstaged isolation, checkpoint changes, renames, binary files, untracked files, unborn HEAD, and special filenames. HTTP tests verify origin/host controls, read-only routes, fixed assets, and sanitized errors. CI runs on Node 22/24 on Linux, macOS, and Windows.

## Status

**v0.1.0** is a focused initial release. It does not write Git state, post GitHub reviews, synchronize approvals, or syntax-highlight code. Checkpoints are personal reading progress; exported reports are not signed attestations. The demo is explicitly labeled and never connects to your filesystem.

MIT licensed. Built for thoughtful shipping.

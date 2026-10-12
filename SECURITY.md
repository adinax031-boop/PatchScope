# Security

PatchScope reads local repository metadata and tracked-file diffs. It never commits, stages, resets, or sends repository content to GitHub. It binds only to `127.0.0.1`, validates Host and Origin, rejects cross-site fetches, disables Git external diff/textconv, and serves a fixed asset allowlist. No remote scripts, analytics, or fonts are loaded.

Run it only on repositories you trust. Git itself reads repository configuration. This is not a sandbox for malicious repositories or plugins. Do not expose the server through a proxy, tunnel, or public interface. The public demo uses sample data, not your local repository.

Review fingerprints and filenames are saved in browser localStorage; exported reports contain filenames and commit identifiers. Treat reports as repository metadata. Browser checkpoints are a convenience, not a signed approval or audit record.

Report security concerns privately using the repository owner's GitHub contact options. Do not publish sensitive repository contents in issues.

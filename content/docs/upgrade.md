# Upgrade and Uninstall

Upgrade the binary through the channel you installed with, then run the
post-upgrade sequence — the binary and the on-disk data have separate version
contracts, and skipping the sequence is the most common source of
post-upgrade drift.

## Upgrade per Channel

Use the same channel you installed from (see [Installation](installation)).

Homebrew:

```sh
brew update
brew upgrade --cask aziron-ai/atlas/atlas
atlas version
```

npm:

```sh
npm install -g @aziron/atlas
atlas version
```

Pin a version for reproducible automation:

```sh
npm install -g @aziron/atlas@0.1.43
```

For installations sourced from GitHub Packages, use the equivalent
`@aziron-ai/atlas@0.1.43` coordinate with the existing registry authentication.

Archives: download the new tar.gz, .deb, .rpm, or .apk from
[GitHub Releases](https://github.com/aziron-ai/atlas/releases/latest), replace
the installed binary, and confirm with `atlas version`.

## Post-Upgrade Sequence

Run these four commands after every upgrade. Each one closes a specific gap
that a binary swap leaves open:

```sh
atlas bootstrap
atlas migrate
atlas status --schema
atlas doctor --verify atlas
```

- **`atlas bootstrap`** refreshes the assistant glue: it re-registers Atlas as
  an MCP server and reinstalls the skill and CLAUDE.md directive for detected
  assistants, baking in the absolute binary path. It is idempotent — safe to
  run repeatedly.
- **`atlas migrate`** applies Atlas storage migrations to the database and
  reports the active contracts. Use `--all --root DIR` to migrate every
  `.atlas/atlas.db` under a directory.
- **`atlas status --schema`** reports the schema/index-format/lexical/MCP
  contract versions and per-repo snapshot format drift, so you can see
  whether existing snapshots match what the new binary expects.
- **`atlas doctor --verify atlas`** reports upgrade health and the
  schema/index contract state, and additionally checks binary drift — whether
  the `atlas` on PATH (what assistants launch via `command:"atlas"`) matches
  the binary you just upgraded.

## Reading Doctor Output After an Upgrade

Act on what doctor reports rather than rebuilding preemptively. A clean report
means the upgrade is complete. If doctor or status flags schema or index
contract drift, run `atlas migrate` and re-check. If doctor reports the
lexical sidecar needs rebuilding, use `atlas compact --rebuild-lexical` (see
[Troubleshooting](troubleshooting)). Run a full rebuild only when status,
doctor, or the release notes require it:

```sh
atlas index . --reindex
```

## Before Downgrading

Back up the full `.atlas/` directory first. Do not assume an older binary can
open a database already migrated by a newer release. Use a separate database
(`--db`) for downgrade testing when possible.

## Uninstall

Remove Atlas in this order: assistant integrations first, then the package,
then (only if intended) local data.

### 1. Remove Assistant Integrations

`atlas uninstall` reverses `atlas bootstrap` across every assistant it
provisions (Claude CLI and desktop, Cursor, Gemini, Codex, Copilot): it
removes the atlas MCP server entry from each config, the atlas skill
markdown, and the atlas-managed block in the global CLAUDE.md. Nothing else
is touched — other MCP servers, unrelated config keys, and your own CLAUDE.md
content outside the atlas markers are preserved. It is idempotent: re-running
reports `absent` and writes nothing.

```sh
atlas uninstall --dry-run
atlas uninstall
```

If this machine is connected to a central Atlas server, also disconnect —
`atlas disconnect` disconnects from the central Atlas and removes the capture
hooks:

```sh
atlas disconnect
```

### 2. Remove the Package

```sh
brew uninstall --cask aziron-ai/atlas/atlas   # Homebrew
npm uninstall -g @aziron/atlas                # public npm
npm uninstall -g @aziron-ai/atlas             # GitHub Packages
sudo rm /usr/local/bin/atlas                  # manual binary
```

### 3. Remove Local Data — Read First

> **Warning:** Package removal does not delete repository indexes. Every
> indexed repository keeps its `.atlas/` directory — index, settings,
> retrieval data, telemetry, and retained snapshots — until you remove it.
> Stop all Atlas processes and confirm the exact paths before deleting;
> removal is permanent.

`atlas uninstall --purge` removes the `.atlas` index directories for you — the global `~/.atlas` and every registry-known repo’s `.atlas` — printing the blast radius and total reclaimed space first, and requiring confirmation (`--yes` to skip, `--dry-run` to preview). To remove them by hand instead, per repository, after stopping all Atlas processes and verifying the path:

```sh
rm -rf /absolute/path/to/repository/.atlas
```

User-level data, only when all user-level Atlas data and installed Atlas
skills should go:

```sh
rm -rf "$HOME/.atlas"
```

## Verify Removal

```sh
command -v atlas || true
```

Also inspect the assistant configuration locations listed in
[AI Assistant Setup](assistants) if a client was configured manually.

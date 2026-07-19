# Upgrade and Uninstall

## Upgrade with Homebrew

```sh
brew update
brew upgrade --cask aziron-ai/atlas/atlas
atlas version
```

## Upgrade with npm

```sh
npm install -g @aziron-ai/atlas
atlas version
```

Pin a version for reproducible automation:

```sh
npm install -g @aziron-ai/atlas@0.1.36
```

## Post-Upgrade Checks

```sh
atlas bootstrap
atlas migrate
atlas status --schema
atlas doctor --verify atlas
```

Bootstrap refreshes assistant configuration that contains an absolute Atlas
binary path. Migration upgrades supported database schemas in place.

Run a full rebuild only when status, doctor, or release notes require it:

```sh
atlas index . --reindex
```

## Before Downgrading

Back up the full `.atlas/` directory. Do not assume an older binary can open a
database already migrated by a newer release.

Use a separate database for downgrade testing when possible.

## Remove Assistant Integrations

Preview:

```sh
atlas uninstall --dry-run
```

Apply:

```sh
atlas uninstall
```

Atlas removes the entries and skills it manages while preserving unrelated
assistant configuration.

## Remove the Package

Homebrew:

```sh
brew uninstall --cask aziron-ai/atlas/atlas
```

npm:

```sh
npm uninstall -g @aziron-ai/atlas
```

Manual binary:

```sh
sudo rm /usr/local/bin/atlas
```

## Remove Repository Data

Package removal does not delete indexes. After stopping all Atlas processes and
verifying the repository path:

```sh
rm -rf /absolute/path/to/repository/.atlas
```

This permanently removes the local index, settings, retrieval data, telemetry,
and retained snapshots for that repository.

## Remove User-Level Atlas Data

After reviewing the directory:

```sh
rm -rf "$HOME/.atlas"
```

Do this only when all user-level Atlas data and installed Atlas skills should
be removed.

## Verify Removal

```sh
command -v atlas || true
```

Also inspect the assistant configuration locations listed in
[AI Assistant Setup](AI-Assistant-Setup) if a client was configured manually.

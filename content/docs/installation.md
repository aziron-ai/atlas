# Installation

Atlas ships through five channels that all install the same native binary.
Pick the channel that matches how you manage software on the target machine:

| Channel | Best for | Platforms |
| --- | --- | --- |
| Homebrew | macOS/Linux workstations; managed upgrades | macOS/Linux amd64 and arm64 |
| npm (public registry) | Node toolchains, workstations, and public CI | macOS/Linux x64 and arm64; Windows x64 |
| npm (GitHub Packages) | Organization CI that already uses GitHub Packages | macOS/Linux x64 and arm64; Windows x64 |
| Release archive | Air-gapped hosts, exact-version pinning, Windows | macOS/Linux amd64 and arm64; Windows amd64 |
| Linux package | Fleet management with `.deb`/`.rpm`/`.apk` | amd64 and arm64 |

## Homebrew (macOS and Linux)

Use Homebrew when you want the shortest path and automatic upgrades alongside
your other tooling.

```sh
brew install --cask aziron-ai/atlas/atlas
atlas version
```

Homebrew names fully qualified casks as `<owner>/<tap>/<cask>`. The repository
`aziron-ai/homebrew-atlas` becomes the tap `aziron-ai/atlas`; the cask and the
installed executable are both named `atlas`.

## npm (public registry)

Use npm when Atlas should install through an existing Node toolchain or CI
pipeline. The public package needs no registry configuration or GitHub token:

```sh
npm install -g @aziron/atlas
atlas version
```

Pin an exact version for reproducible environments:

```sh
npm install -g @aziron/atlas@0.1.39
```

### GitHub Packages alternative

Atlas is also published to GitHub Packages as `@aziron-ai/atlas`. Use this
coordinate when organization CI already authenticates to GitHub Packages.
Point the `@aziron-ai` scope at GitHub and use a token with `read:packages`:

```sh
npm config set @aziron-ai:registry https://npm.pkg.github.com
npm config set //npm.pkg.github.com/:_authToken YOUR_GITHUB_TOKEN
npm install -g @aziron-ai/atlas
atlas version
```

```sh
npm install -g @aziron-ai/atlas@0.1.39
```

Both npm coordinates install the same wrapper and native Atlas binary for the
current platform. If you do not need npm specifically, Homebrew is the simpler
path on macOS and Linux.

## Release Archives

Use a release archive when no package manager is available, on air-gapped
hosts, or when you need to pin and checksum exact bytes. Choose the current
version and platform from
[GitHub Releases](https://github.com/aziron-ai/atlas/releases/latest):

```sh
VERSION=0.1.39
OS=darwin       # darwin or linux
ARCH=arm64      # arm64 or amd64
ASSET="atlas_${VERSION}_${OS}_${ARCH}.tar.gz"
BASE="https://github.com/aziron-ai/atlas/releases/download/v${VERSION}"

curl -fLO "$BASE/$ASSET"
curl -fLO "$BASE/checksums.txt"
grep " $ASSET\$" checksums.txt | shasum -a 256 -c -
tar -xzf "$ASSET"
sudo install -m 0755 atlas /usr/local/bin/atlas
atlas version
```

On Linux, replace the checksum command with `sha256sum -c -` when available.

### Windows

Each release also includes a Windows amd64 archive. Download it from the same
release page, extract the `atlas` executable, and add its directory to
`PATH`. Alternatively, the npm channel above supports Windows x64.

## Native Linux Packages

Use native packages when your fleet is managed through a distribution package
manager. Each release includes `.deb`, `.rpm`, and `.apk` packages for amd64
and arm64. Download the matching package from the release page, then install:

```sh
# Debian or Ubuntu
sudo dpkg -i atlas_0.1.39_linux_amd64.deb

# Fedora or RHEL
sudo rpm -U atlas_0.1.39_linux_amd64.rpm

# Alpine
sudo apk add --allow-untrusted atlas_0.1.39_linux_amd64.apk
```

## Post-Install: Assistant Bootstrap

Homebrew and npm installations run `atlas bootstrap` after install. Bootstrap
registers Atlas as an MCP server and installs the atlas-first skill and
CLAUDE.md directive for every detected assistant (Claude desktop and CLI,
Codex, Copilot, Cursor, Gemini). It is idempotent — safe to run repeatedly
and from a package post-install hook. Inspect the proposed changes at any
time without writing anything:

```sh
atlas bootstrap --dry-run
```

To prevent the npm post-install bootstrap in managed environments:

```sh
ATLAS_SKIP_BOOTSTRAP=1 npm install -g @aziron/atlas
```

Archive and Linux-package installs do not configure assistants automatically;
run `atlas bootstrap` yourself when you want them connected.

## PATH Note

Assistants launch Atlas by resolving `atlas` from `PATH`, so the binary must
be reachable from a login shell — not only your current session. Homebrew and
the Linux packages handle this; for archives, `/usr/local/bin` (used above)
is on `PATH` by default on most systems. For npm installs, ensure npm's
global bin directory is on `PATH`.

## Verify the Installation

Verification confirms three distinct things: the binary is on `PATH`, it
runs, and it is the same binary your assistants will launch.

```sh
command -v atlas
atlas version
atlas doctor --verify atlas
```

`atlas doctor` reports upgrade health and schema/index contract state;
`--verify atlas` additionally checks for binary drift — whether the `atlas`
on `PATH` (what assistants launch via `command:"atlas"`) matches the running
binary. Drift typically means an old install shadows the new one earlier on
`PATH`.

Continue with [Getting Started](getting-started), or read
[Core Concepts](concepts) for the model behind the commands.

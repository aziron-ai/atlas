# Installation

Atlas is distributed as a Homebrew cask, an npm wrapper, release archives, and
native Linux packages.

## Homebrew

```sh
brew install --cask aziron-ai/atlas/atlas
atlas version
```

Homebrew names fully qualified casks as `<owner>/<tap>/<cask>`. The repository
`aziron-ai/homebrew-atlas` becomes the tap `aziron-ai/atlas`; the cask and
installed executable are both named `atlas`.

## npm (GitHub Packages)

The npm package is published to GitHub Packages, so npm must be pointed at the
`@aziron-ai` scope with a GitHub token that has `read:packages` (GitHub Packages
requires authentication even for public packages):

```sh
npm config set @aziron-ai:registry https://npm.pkg.github.com
npm config set //npm.pkg.github.com/:_authToken YOUR_GITHUB_TOKEN
npm install -g @aziron-ai/atlas
atlas version
```

For a version-pinned installation:

```sh
npm install -g @aziron-ai/atlas@0.1.36
```

The npm package downloads the native Atlas binary for the current platform. If
you do not need npm specifically, Homebrew above is the simpler path.

## Installation and Assistant Configuration

Homebrew and npm installations run Atlas bootstrap to register supported local
assistant integrations. Inspect the proposed changes at any time:

```sh
atlas bootstrap --dry-run
```

To prevent npm post-install bootstrap in managed environments:

```sh
ATLAS_SKIP_BOOTSTRAP=1 npm install -g @aziron-ai/atlas
```

## Direct Release Archive

Choose the current version and platform from
[GitHub Releases](https://github.com/aziron-ai/atlas/releases/latest):

```sh
VERSION=0.1.36
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

## Native Linux Packages

Each release includes `.deb`, `.rpm`, and `.apk` packages for amd64 and arm64.
Download the matching package from the release page, then use the platform
package manager:

```sh
# Debian or Ubuntu
sudo dpkg -i atlas_0.1.36_linux_amd64.deb

# Fedora or RHEL
sudo rpm -U atlas_0.1.36_linux_amd64.rpm

# Alpine
sudo apk add --allow-untrusted atlas_0.1.36_linux_amd64.apk
```

## Supported Distribution Targets

| Channel | Platforms |
| --- | --- |
| Homebrew | macOS/Linux amd64 and arm64 |
| npm | macOS/Linux x64 and arm64; Windows x64 |
| Release archive | macOS/Linux amd64 and arm64; Windows amd64 |
| Linux package | `.deb`, `.rpm`, `.apk`; amd64 and arm64 |

## Verify the Installation

```sh
command -v atlas
atlas version
atlas doctor --verify atlas
```

Continue with [Getting Started](Getting-Started).

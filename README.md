# Atlas — public distribution repository

This repository hosts the **Atlas website, documentation, issue tracker, and release
distribution**:

- **Releases (binaries, SBOMs, checksums):** https://github.com/aziron-ai/atlas/releases
- **npm:** `npm install -g @aziron/atlas`
- **Homebrew:** `brew install --cask aziron-ai/atlas/atlas`
- **Website & docs:** the `main` branch

Atlas source code is developed in a private repository; release artifacts are built and
published from there. **This branch intentionally contains no source.**

> Note (2026-07-23): this branch previously carried a stale v0.1.31 source snapshot,
> 300+ commits behind the code that actually ships. It was removed because it predated
> every current fix and misled issue triage and QA. Please validate and file issues
> against the released binaries above.

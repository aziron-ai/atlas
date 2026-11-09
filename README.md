# Atlas documentation and wiki

Public documentation, user guides, and benchmark evidence for Atlas.

- [Documentation website](https://atlas.aziro.com/)
- [Getting started](https://atlas.aziro.com/docs/getting-started/)
- [GitHub Wiki](https://github.com/aziron-ai/atlas/wiki)
- [Wiki Markdown sources](wiki/Home.md)

This repository publishes the documentation website and its Wiki mirror. It does not publish binary releases. The previous repository is retained as `aziron-ai/atlas-arch`.

## Editing the website

The website source is in `src/`; the Markdown guides are in `content/docs/`. The committed `index.html`, `docs/`, and `assets/` files are served by GitHub Pages from the root of `main` at `atlas.aziro.com`.

Install the locked dependencies with `npm ci`, then run `npm run build` after editing the website or guide content. Commit the generated website files along with the source changes.

The `wiki/` directory keeps an editable copy of the GitHub Wiki pages.

## License

Apache License 2.0. See [LICENSE](LICENSE).

# Atlas documentation website

The public Atlas website and user guides, published with GitHub Pages.

- [Website](https://atlas.aziro.com/)
- [Documentation](https://atlas.aziro.com/docs/)
- [Getting started](https://atlas.aziro.com/docs/getting-started/)
- [GitHub Pages address](https://aziron-ai.github.io/atlas/) (redirects to the custom domain)

The previous repository is retained privately as `aziron-ai/atlas-arch`. This fresh public repository hosts the website and documentation.

## Publishing

GitHub Pages serves the root of the `main` branch. The `CNAME` file connects the site to `atlas.aziro.com`, and `.nojekyll` keeps the committed site assets intact.

## Editing

The website source is in `src/`; the Markdown guides are in `content/docs/`. Install the locked dependencies with `npm ci`, then run `npm run build` after changing website or guide content. Commit the generated `index.html`, `docs/`, and `assets/` files along with the source changes.

## License

Apache License 2.0. See [LICENSE](LICENSE).

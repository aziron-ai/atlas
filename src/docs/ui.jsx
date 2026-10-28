import React, { useState } from "react";
import { Check, Copy } from "lucide-react";
import packageMetadata from "../../package.json";

export const RELEASE = packageMetadata.version;
export const GITHUB = "https://github.com/aziron-ai/atlas";
export const WIKI = `${GITHUB}/wiki`;

export function CopyCommand({ command }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
    } catch {
      // Clipboard access can be blocked in a non-secure local preview.
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <button className={`icon-btn focusring${copied ? " copied-pop" : ""}`} type="button" onClick={copy} aria-label={`Copy ${command}`} title="Copy command">
      {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
    </button>
  );
}

export function Command({ children, label = "Terminal" }) {
  const command = Array.isArray(children) ? children.join("") : String(children);
  return (
    <div className="product-command">
      <div className="flex items-center justify-between gap-3">
        <span className="cmd-label">{label}</span>
        <CopyCommand command={command} />
      </div>
      <pre><code>{command}</code></pre>
    </div>
  );
}

export function sectionId(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function ProseSection({ title, children }) {
  return (
    <section className="docs-prose-section" data-toc-id={sectionId(title)}>
      <h2 id={sectionId(title)}>{title}</h2>
      {children}
    </section>
  );
}

export function Bullets({ children }) {
  return <ul className="docs-list">{children}</ul>;
}

export function Callout({ kind = "tip", label, children }) {
  return (
    <div className={`callout ${kind}`}>
      <span className="co-label">{label}</span>
      {children}
    </div>
  );
}

/* A screenshot with a caption. `src` is site-relative ("assets/docs/<page>/<name>.png"). */
export function Figure({ src, alt = "", caption, width }) {
  return (
    <figure className="docs-figure" style={width ? { maxWidth: width } : undefined}>
      <img src={src} alt={alt} loading="lazy" decoding="async" />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

/* A short silent clip (H.264 mp4) that loops; the poster is the same name with .png,
   and a .gif twin is offered for readers who cannot play video. */
export function Clip({ src, caption, alt = "", gif = true }) {
  const poster = src.replace(/\.mp4$/, ".png");
  const gifSrc = src.replace(/\.mp4$/, ".gif");
  return (
    <figure className="docs-figure docs-clip">
      <video autoPlay muted loop playsInline preload="metadata" poster={poster} aria-label={alt}>
        <source src={src} type="video/mp4" />
        <img src={gifSrc} alt={alt} />
      </video>
      {(caption || gif) && (
        <figcaption>
          {caption}
          {gif && <> <a className="text-link" href={gifSrc} target="_blank" rel="noreferrer">GIF</a></>}
        </figcaption>
      )}
    </figure>
  );
}

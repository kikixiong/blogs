# Jiaqi Xiong · Blogs

The source for [Jiaqi's blogs](https://kikixiong.github.io/blogs/). GitHub Pages builds this Jekyll site from the `main` branch. Its colors, fonts, and theme preference match the [homepage](https://kikixiong.github.io/).

## Publish a post

Create `_posts/YYYY-MM-DD-short-title.md` with front matter:

```markdown
---
title: "Post title"
description: "One sentence shown on the blog index."
category: ML_foundation
tags: [transformer, attention]
outline_key: ml-foundation-1-2
---

Write the post here.
```

Use `ML_foundation`, `single-cell_foundation model`, or `agent` as the category for a post. The expandable sidebar directory lives in `_data/topics.yml`. Set `outline_key` to the topic ID, one-based group number, and one-based item number joined by hyphens (for example, `ml-foundation-1-2`). A matching published post becomes a link in the directory; an unpublished entry opens its planned-article page. To typeset TeX math in a post, add `math: true` to its front matter. Commit and push to `main`; GitHub Pages will update the site.

The Transformer and multi-head attention posts include unmodified original-paper figures. Their captions link to the paper, Wikimedia Commons source pages, and the listed CC BY-SA 4.0 license.

For an interactive article, keep its CSS and JavaScript under `assets/posts/<slug>/` and list them in the post's front matter:

```yaml
post_css:
  - /assets/posts/<slug>/demo.css
post_js:
  - /assets/posts/<slug>/demo.js
```

These files load only on that article. Keep the central explanation and a static figure or text fallback readable without JavaScript; add keyboard-accessible controls and a reduced-motion state for animation.

The site uses `baseurl: /blogs`. For links to files inside this repository, use Jekyll's `relative_url` filter so paths work under `/blogs/`:

```liquid
{{ '/assets/images/example.png' | relative_url }}
```

## Local preview

With Jekyll installed, run `jekyll serve --baseurl /blogs` and open `http://127.0.0.1:4000/blogs/`.

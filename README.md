# Jiaqi Xiong · Notes

The source for [Jiaqi's blog](https://kikixiong.github.io/blog/). GitHub Pages builds this Jekyll site from the `main` branch. Its colors, fonts, and theme preference match the [homepage](https://kikixiong.github.io/).

## Publish a post

Create `_posts/YYYY-MM-DD-short-title.md` with front matter:

```markdown
---
title: "Post title"
description: "One sentence shown on the blog index."
category: Research notes
---

Write the post here.
```

Commit and push to `main`; GitHub Pages will update the site. Until the first post is added, the index intentionally displays an empty state and TBD sections.

The site uses `baseurl: /blog`. For links to files inside this repository, use Jekyll's `relative_url` filter so paths work under `/blog/`:

```liquid
{{ '/assets/images/example.png' | relative_url }}
```

## Local preview

With Jekyll installed, run `jekyll serve --baseurl /blog` and open `http://127.0.0.1:4000/blog/`.

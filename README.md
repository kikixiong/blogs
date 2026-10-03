# Jiaqi Xiong · Blogs

The source for [Jiaqi's blogs](https://kikixiong.github.io/blogs/). GitHub Pages builds this Jekyll site from the `main` branch. Its colors, fonts, and theme preference match the [homepage](https://kikixiong.github.io/).

## Publish a post

Create `_posts/YYYY-MM-DD-short-title.md` with front matter:

```markdown
---
title: "Post title"
description: "One sentence shown on the blog index."
category: Research
tags: [agents, evaluation]
---

Write the post here.
```

Use `Research`, `Reading`, or `Build` as the category to include the post in the topic explorer. Commit and push to `main`; GitHub Pages will update the site. Until the first post is added, the index intentionally displays an empty state and TBD sections.

The site uses `baseurl: /blogs`. For links to files inside this repository, use Jekyll's `relative_url` filter so paths work under `/blogs/`:

```liquid
{{ '/assets/images/example.png' | relative_url }}
```

## Local preview

With Jekyll installed, run `jekyll serve --baseurl /blogs` and open `http://127.0.0.1:4000/blogs/`.

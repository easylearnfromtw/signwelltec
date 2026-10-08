# SIGNWELL BIO Introduction — Claude handoff

Snapshot date: 2026-10-08 (Asia/Taipei)
Source repository: https://github.com/easylearnfromtw/signwelltec
Source branch: main
Source path: `medical-responsibility.html`
Source blob SHA: `93676cc0944c842850a9098d572dc3a71f3cbcfc`

## Scope
This handoff contains ONLY the introduction page opened from SIGNWELL 欣緯科技's 「醫療部分社會責任／認識欣緯生醫」 entrance.

- `medical-responsibility.html` — complete current production page, including inline CSS, inline SVG medicine sachet figure and inline JavaScript.
- `README.md` — this handoff note.

No other company pages, purchase/quotation workflows, SignWell Bio CMS or article site files are included. No font files are included.

## Existing behavior to preserve
1. Three sticky-overlap editorial chapters, introducing the platform, reading topics, founder / editor and external CTA.
2. Heat-sealed translucent medication-bag *character* passes through the visual composition while scrolling (not a page-wide masking transition).
3. Founder: 林哲愷. Editor-in-chief: 林哲緯.
4. CTA: https://easylearnfromtw.github.io/signwellbio/
5. Mobile layouts, accessible anchor navigation and reduced-motion preference.
6. No overt AI discussion or emoji in public-facing text.

## Working on this file
Open `medical-responsibility.html` directly in a browser. It is self-contained: no external JS, CSS, fonts or image assets needed for the intro.
The production entrance link is currently located in `signwelltec/index.html` and points to `medical-responsibility.html`. The parent index file is intentionally not included.
If editing for deployment, replace *only* `medical-responsibility.html` in `easylearnfromtw/signwelltec`. Preserve all other files.

## Notes
This is a byte-for-byte copy of the source blob identified above; further independent edits to main will not alter this handoff branch.

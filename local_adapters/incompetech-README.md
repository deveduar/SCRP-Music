# Incompetech adapter

This document describes the Incompetech adapter in `local_adapters/incompetech-adapter.ts`.

## Overview

- Adapter type: `html`
- Data source: public JSON feed + HTML page for genre discovery
- Purpose: scrape royalty-free music metadata and download links from Incompetech
- Uses the shared `MUSIC_LINKS` for music search buttons

## Adapter properties

| Property | Value |
|----------|-------|
| `id` | `incompetech` |
| `name` | `Incompetech` |
| `kind` | `html` |
| Genres | Discovered from the website HTML page |
| Data source | `https://incompetech.com/music/royalty-free/pieces.json` |
| Downloads | `https://incompetech.com/music/royalty-free/mp3-royaltyfree/<filename>` |
| Fast skip existing detail pages | Not exposed; there is no per-release detail fetch to skip |

## How it works

- The adapter fetches the public HTML page to discover the available genres.
- It then reads the public JSON feed containing the full music catalog.
- Each entry is transformed into the app's `Release` model and emitted via the scraping callbacks.
- The adapter uses `MUSIC_LINKS` from the shared helpers.
- The adapter now implements a simple simulated pagination layer so that the scraper UI can limit the work by page range without changing the core app logic.
- The paging model uses a fixed page size of 20 items per page.
- The adapter first filters by the selected genre and then applies the simulated page range to the filtered result set.

## Page behavior

- `detectMaxPages()` estimates the number of simulated pages from the filtered catalog.
- `startPage` and `endPage` are interpreted inside the adapter as a range over the simulated pages.
- This allows the UI to limit the scrape in a meaningful way even though the source itself does not expose real pagination.

## Notes

- Incompetech is a legal and lightweight example of a source that can be scraped efficiently without parsing each page individually.
- The fast-skip detail-page option is not enabled because the adapter already transforms entries from a shared JSON feed.
- The adapter is isolated from the core app and can be updated independently.
- The current implementation is intentionally simple and can be refined later if a more advanced pagination model is needed.

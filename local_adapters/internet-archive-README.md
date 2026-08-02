# Internet Archive adapter

This document describes the Internet Archive adapter in `local_adapters/internet-archive-adapter.ts`.

## Overview

- Adapter type: `api`
- Data source: Internet Archive public advanced search API
- Purpose: fetch audio releases from Internet Archive collections with genre-based filtering and page-based limits
- Uses the shared `MUSIC_LINKS` for music search buttons

## Adapter properties

| Property | Value |
|----------|-------|
| `id` | `internetarchive` |
| `name` | `Internet Archive` |
| `kind` | `api` |
| Genres | Fixed list of music-related genres |
| Data source | `https://archive.org/advancedsearch.php` |
| Downloads | `https://archive.org/download/<identifier>` (detail page for the item) |
| Fast skip existing detail pages | Not exposed; search result pages already contain the transformed metadata |

## How it works

- The adapter builds a search query for Internet Archive using a small set of allowed collections (`etree`, `audio_music`) and `mediatype:audio`.
- It applies a year filter (`1900 TO 2025`) to keep results reasonable.
- Genre selection is forwarded to the `subject` search field.
- Results are fetched in pages of 50 items.
- `detectMaxPages()` queries the total number of matching results and converts that into the number of pages.
- `scrape()` fetches only the requested page range and transforms each document into the app's `Release` model.
- The adapter is isolated from the core app and does not require any UI or store changes.

## Page behavior

- The adapter uses Internet Archive's real paging through the `page` and `rows` parameters.
- `startPage` and `endPage` are interpreted inside the adapter to limit the search result range.
- `detectMaxPages()` returns a real estimated page count based on the total number of search hits.

## Notes

- This adapter is intentionally minimal: it uses the public search API and basic metadata fields.
- The fast-skip detail-page option is not enabled because the adapter transforms search results directly instead of fetching a separate detail page per item.
- It can be extended later to retrieve more detailed metadata from `https://archive.org/metadata/<identifier>` if needed.
- The `downloads` array uses an archive download path for the item; a more advanced implementation can derive direct audio file URLs.

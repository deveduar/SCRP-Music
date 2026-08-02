# Jamendo adapter

This document describes the Jamendo adapter in `local_adapters/jamendo-adapter.ts`.

## Overview

- Adapter type: `api`
- Data source: Jamendo API (`api.jamendo.com`)
- Purpose: fetch album/track metadata and download links via JSON API
- Configuration: requires an API key stored in Settings → API Keys under the adapter id `jamendo`

## Adapter properties

| Property | Value |
|----------|-------|
| `id` | `jamendo` |
| `name` | `Jamendo` |
| `kind` | `api` |
| Genres | 23 valid tags (rock, pop, electronic, hiphop, jazz, indie, filmscore, classical, chillout, ambient, folk, metal, latin, rnb, reggae, punk, country, house, blues, techno, trance, dnb) |
| API | `api.jamendo.com/v3.0/tracks` | 
| Page detection | Single API call, read `headers.results_fullcount`, divide by page size |
| Fast skip existing detail pages | Not exposed; page data already arrives from the API response |

## How it works

- Fetches JSON from Jamendo using the adapter's `client_id`.
- Uses `groupby=album_id` to return one representative track per album.
- Transforms API results into the app's `Release` model.
- Adds download links from the API's `audiodownload` field.
- Returns `MUSIC_LINKS` from `getSearchLinks()` if search buttons are supported.

## API key

- The Jamendo adapter uses `UserSettings.apiKeys['jamendo']`.
- The value should be the Jamendo `client_id`.
- Without a configured key, the adapter must fail fast with a clear error message.

## Notes

- Jamendo is API-based, so the scraper UI shows genre selection and page range but does not require page-detection delays or proxy configuration.
- The fast-skip detail-page option is not enabled for this adapter because it does not fetch one detail page per release.
- The adapter is a good example of a legal, API-backed source.

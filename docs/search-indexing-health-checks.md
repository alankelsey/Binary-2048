# Search Indexing and Health Checks

## Setup

- Verify domain in Google Search Console and Bing Webmaster Tools.
- Submit sitemap: `https://www.binary2048.com/sitemap.xml`.

## Health Checks

- `robots.txt` available and valid.
- Sitemap returns 200 and contains core pages.
- Canonical tags present on public pages.
- No accidental indexing of `/api/*`.

## Monitoring

- Track crawl errors weekly.
- Track indexed pages count drift.
- Alert on sudden zero-index or robots misconfiguration.

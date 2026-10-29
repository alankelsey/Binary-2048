# Player background-upload safety design (2026-10-28)

<!-- cspell:words sandboxed EXIF IPTC geolocation cookied -->

## Boundary

Uploads are authenticated, private-by-default untrusted media. The browser
uploads directly to an isolated quarantine bucket through a single-use signed
request. Quarantine objects are never served publicly or referenced by CSS.

## Intake and validation

- Accept JPEG, PNG, AVIF, and WebP only; reject SVG, HTML, XML, animation,
  archives, and content whose decoded type differs from its signature.
- Initial limits: 10 MiB encoded, 24 megapixels decoded, 12,000 px maximum
  dimension, one frame, sRGB output, and 25 uploads/account/day.
- Decode in a sandboxed worker with memory/time limits; reject decoder errors,
  decompression bombs, malformed profiles, and excessive metadata.
- Strip EXIF/IPTC/XMP, embedded thumbnails, geolocation, comments, profiles, and
  filenames. Apply orientation, then discard orientation metadata.
- Generate new AVIF and WebP derivatives plus a safe JPEG fallback. Runtime
  URLs point only to generated derivatives on a cookied-off CDN origin.

## Crop and focal point

The client may propose crop and normalized focal coordinates, but the worker
clamps them to decoded bounds and generates fixed responsive derivatives.
Never store client-supplied CSS, HTML, SVG, selectors, URLs, or style strings.

## Ownership, moderation, and rights

Each object records account, opaque asset ID, source hash, derivative hashes,
status, timestamps, moderation result, and the user's ownership/right-to-use
attestation. Duplicate hashes can reuse moderation results but never transfer
ownership. Provide report, quarantine, appeal, and emergency-disable paths.
Public sharing is disabled initially.

## Lifecycle and cost controls

- Quarantine expires after 24 hours; rejected originals and derivatives are
  deleted. Accepted originals may be deleted after derivative verification.
- Default quota: 20 accepted backgrounds and 250 MiB derivatives/account.
- Deleting an account removes derivatives, moderation linkage permitted by
  policy, CDN entries, and loadout references; export includes metadata and the
  user's accepted derivatives.
- Rate, pixel, concurrency, storage, transform, CDN, and moderation budgets have
  independent alarms and hard caps. Processing fails closed when a cap or
  scanner is unavailable.

This is a design only. No upload endpoint or public storage was created.

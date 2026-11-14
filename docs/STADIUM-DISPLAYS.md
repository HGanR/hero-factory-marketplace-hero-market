# Independent stadium displays

In Green Terrain, open **World Manager → Events → Stadium displays · always available**. These controls do not require a scheduled event.

- The ticker has a 50–125% letter-size slider, smaller/larger buttons and reset. It changes the lettering, not the stadium or ring dimensions.
- The large `Screen_Main` accepts a PNG/JPEG/WebP or a short H.264 MP4. Fill-width mode preserves aspect ratio and crops excess content; whole-media mode adds borders. An enabled event's poster takes precedence while that event is displayed; the independent screen returns afterward.
- MP4 files are limited to 30 seconds, 3 MB, and 1920 × 1080. They loop muted with inline playback; a play button is shown if the browser blocks autoplay. Metadata and the video track are checked before upload. The signed administrator/same-origin upload route uses the project's existing Vercel Blob store, immutable UUID paths and no filesystem writes. Storage failures retain the previous display. No new storage service or migration is needed for these controls.
- Billboard text is independent of the main media and wraps/shrinks to fit the secondary displays. The two side screens and overhead scoreboard have separately fitted textures for their actual 14:8 and 16:5 dimensions. Explicit line breaks are preserved.
- The display font uses installed Impact when available. The bundled OFL-licensed Anton font supplies a consistent condensed fallback on devices without Impact. Font source: https://github.com/google/fonts/tree/main/ofl/anton; license is alongside the font in `public/fonts/stadium/OFL.txt`. No proprietary font is redistributed.

Save **events and world layout** to persist these settings. Preview saves remain branch-scoped and do not modify the live town. Images are bounded data URLs in the existing snapshot; MP4 references are durable public Blob URLs. This screen media is promotional content and uses no paid-event admission credentials. Existing event gating remains unchanged.

Tests cover old-snapshot compatibility, no-event saves, cropping without stretching, fitted billboard bounds, real H.264 metadata, invalid/oversized clips, canonical signed admin authorization, and non-overwriting storage calls. Browser tests use the actual GLB, real media decoding and a deterministic upload/storage port; they do not claim a live provider upload. Disposable MySQL tests verify full public reloads of the saved settings. Video frames, listeners, images and textures are released when content changes or the model unmounts.

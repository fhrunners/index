# Homepage Photo Gallery

The homepage collage is powered by the original image files in this folder, optimized copies in `optimized/`, and `manifest.json`.
You do not need to edit `index.html`, CSS, or JavaScript when adding more photos.

## Quick Update

1. Drop the new photos into `images/photo-strip/`.
2. From the repo root, run:

```sh
node scripts/update-photo-strip-manifest.js
```

3. Refresh the homepage and check the collage.
4. Commit the new photos, the generated optimized files, and the updated `images/photo-strip/manifest.json`.

## What The Script Does

- Scans this folder for `.avif`, `.gif`, `.jpeg`, `.jpg`, `.png`, and `.webp` source files.
- Skips non-image files such as `.DS_Store` and this README.
- Sorts photos by filename so the output is stable.
- Writes smaller display-ready copies to `images/photo-strip/optimized/`.
- Uses WebP when ImageMagick or Python with Pillow WebP support is available; otherwise it falls back to optimized JPEGs through macOS `sips`.
- Records each image's width, height, and orientation.
- Lets the homepage automatically place landscape photos into wider slots and portrait photos into taller slots.
- Preserves existing alt text in `manifest.json` when a photo keeps the same filename.

## Removing Or Replacing Photos

- To remove a photo from the collage, delete it from this folder and rerun the manifest command.
- To replace a photo but keep custom alt text, reuse the same filename and rerun the manifest command.
- To rename a photo, rerun the manifest command afterward. Any custom alt text for the old filename will not carry over automatically.

## Optional Alt Text

New photos get generic alt text unless their filename has useful words. If you want better descriptions, edit the `alt` field in `manifest.json` after running the script:

```json
{
  "src": "optimized/monday-pond-run.webp",
  "source": "monday-pond-run.jpg",
  "alt": "Forest Hills Runners at Jamaica Pond",
  "width": 1400,
  "height": 1050,
  "orientation": "landscape"
}
```

The next time you run the script, that alt text will be kept as long as the filename stays the same.

## Optional Settings

You can tune the optimizer with environment variables:

```sh
PHOTO_STRIP_MAX_DIMENSION=1200 PHOTO_STRIP_WEBP_QUALITY=74 node scripts/update-photo-strip-manifest.js
```

By default, optimized images are capped at 1000px on their longest side with WebP quality 74.

If your default `python3` does not have Pillow but another Python does, point the script at it:

```sh
PHOTO_STRIP_PYTHON=/path/to/python3 node scripts/update-photo-strip-manifest.js
```

## Preview Locally

If a local server is not already running, start one from the repo root:

```sh
python3 -m http.server 8010
```

Then open:

```text
http://localhost:8010/
```

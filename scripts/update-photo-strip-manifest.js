#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const photoDir = path.join(rootDir, "images", "photo-strip");
const optimizedDirName = "optimized";
const optimizedDir = path.join(photoDir, optimizedDirName);
const manifestPath = path.join(photoDir, "manifest.json");
const supportedExtensions = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".webp"]);
const optimizedMaxDimension = parseInt(process.env.PHOTO_STRIP_MAX_DIMENSION || "1000", 10);
const optimizedWebpQuality = parseInt(process.env.PHOTO_STRIP_WEBP_QUALITY || "74", 10);
const optimizedJpegQuality = parseInt(process.env.PHOTO_STRIP_JPEG_QUALITY || "72", 10);

const pillowWebpScript = `
from PIL import Image, ImageOps
import sys

source, destination, max_dimension, quality = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])

with Image.open(source) as image:
    image = ImageOps.exif_transpose(image)
    image.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)

    if image.mode == "RGBA":
        background = Image.new("RGB", image.size, (9, 36, 9))
        background.paste(image, mask=image.getchannel("A"))
        image = background
    elif image.mode != "RGB":
        image = image.convert("RGB")

    image.save(destination, "WEBP", quality=quality, method=6)
`;

function readExistingManifest() {
    if (!fs.existsSync(manifestPath)) {
        return new Map();
    }

    try {
        const items = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        const altByKey = new Map();

        items
            .filter((item) => item && item.src)
            .forEach((item) => {
                const alt = item.alt || "Forest Hills Runners photo";

                [item.source, item.src, item.src && path.basename(item.src)]
                    .filter(Boolean)
                    .forEach((key) => {
                        if (!altByKey.has(key)) {
                            altByKey.set(key, alt);
                        }
                    });
            });

        return altByKey;
    } catch (error) {
        return new Map();
    }
}

function readUint24LE(buffer, offset) {
    return buffer[offset] + (buffer[offset + 1] << 8) + (buffer[offset + 2] << 16);
}

function getJpegDimensions(buffer) {
    if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
        return null;
    }

    let offset = 2;
    const sofMarkers = new Set([
        0xc0, 0xc1, 0xc2, 0xc3,
        0xc5, 0xc6, 0xc7,
        0xc9, 0xca, 0xcb,
        0xcd, 0xce, 0xcf
    ]);

    while (offset + 4 < buffer.length) {
        while (offset < buffer.length && buffer[offset] !== 0xff) {
            offset += 1;
        }

        while (offset < buffer.length && buffer[offset] === 0xff) {
            offset += 1;
        }

        const marker = buffer[offset];
        offset += 1;

        if (marker === 0xd9 || marker === 0xda) {
            break;
        }

        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
            continue;
        }

        if (offset + 2 > buffer.length) {
            break;
        }

        const segmentLength = buffer.readUInt16BE(offset);

        if (segmentLength < 2 || offset + segmentLength > buffer.length) {
            break;
        }

        if (sofMarkers.has(marker) && segmentLength >= 7) {
            return {
                width: buffer.readUInt16BE(offset + 5),
                height: buffer.readUInt16BE(offset + 3)
            };
        }

        offset += segmentLength;
    }

    return null;
}

function getPngDimensions(buffer) {
    const pngSignature = "89504e470d0a1a0a";

    if (buffer.length < 24 || buffer.subarray(0, 8).toString("hex") !== pngSignature) {
        return null;
    }

    return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20)
    };
}

function getGifDimensions(buffer) {
    const signature = buffer.subarray(0, 6).toString("ascii");

    if (buffer.length < 10 || (signature !== "GIF87a" && signature !== "GIF89a")) {
        return null;
    }

    return {
        width: buffer.readUInt16LE(6),
        height: buffer.readUInt16LE(8)
    };
}

function getWebpDimensions(buffer) {
    if (
        buffer.length < 30
        || buffer.subarray(0, 4).toString("ascii") !== "RIFF"
        || buffer.subarray(8, 12).toString("ascii") !== "WEBP"
    ) {
        return null;
    }

    let offset = 12;

    while (offset + 8 <= buffer.length) {
        const chunkType = buffer.subarray(offset, offset + 4).toString("ascii");
        const chunkSize = buffer.readUInt32LE(offset + 4);
        const dataOffset = offset + 8;

        if (dataOffset + chunkSize > buffer.length) {
            break;
        }

        if (chunkType === "VP8X" && chunkSize >= 10) {
            return {
                width: readUint24LE(buffer, dataOffset + 4) + 1,
                height: readUint24LE(buffer, dataOffset + 7) + 1
            };
        }

        if (chunkType === "VP8L" && chunkSize >= 5 && buffer[dataOffset] === 0x2f) {
            const b0 = buffer[dataOffset + 1];
            const b1 = buffer[dataOffset + 2];
            const b2 = buffer[dataOffset + 3];
            const b3 = buffer[dataOffset + 4];

            return {
                width: 1 + (((b1 & 0x3f) << 8) | b0),
                height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6))
            };
        }

        if (
            chunkType === "VP8 "
            && chunkSize >= 10
            && buffer[dataOffset + 3] === 0x9d
            && buffer[dataOffset + 4] === 0x01
            && buffer[dataOffset + 5] === 0x2a
        ) {
            return {
                width: buffer.readUInt16LE(dataOffset + 6) & 0x3fff,
                height: buffer.readUInt16LE(dataOffset + 8) & 0x3fff
            };
        }

        offset = dataOffset + chunkSize + (chunkSize % 2);
    }

    return null;
}

function getImageDimensions(filePath) {
    const buffer = fs.readFileSync(filePath);
    const extension = path.extname(filePath).toLowerCase();

    if (extension === ".jpg" || extension === ".jpeg") {
        return getJpegDimensions(buffer);
    }

    if (extension === ".png") {
        return getPngDimensions(buffer);
    }

    if (extension === ".gif") {
        return getGifDimensions(buffer);
    }

    if (extension === ".webp") {
        return getWebpDimensions(buffer);
    }

    return null;
}

function orientationFromDimensions(dimensions) {
    if (!dimensions || !dimensions.width || !dimensions.height) {
        return "unknown";
    }

    const ratio = dimensions.width / dimensions.height;

    if (ratio > 1.08) {
        return "landscape";
    }

    if (ratio < 0.92) {
        return "portrait";
    }

    return "square";
}

function altFromFilename(filename) {
    const label = path
        .basename(filename, path.extname(filename))
        .replace(/^fhr[-_\s]*/i, "")
        .replace(/[-_]+/g, " ")
        .trim();

    const compactLabel = label.replace(/\s+/g, "");
    const hasMeaningfulLetters = /[a-mo-z]{3,}/i.test(label);
    const looksLikeCameraFilename = /^(img|dsc|photo|image)\s*\d+$/i.test(label);
    const looksLikeSocialExportId = /^[0-9n]+$/i.test(compactLabel);

    if (!label || !hasMeaningfulLetters || looksLikeCameraFilename || looksLikeSocialExportId) {
        return "Forest Hills Runners photo";
    }

    return label ? `Forest Hills Runners ${label}` : "Forest Hills Runners photo";
}

function runCommand(command, args) {
    const result = spawnSync(command, args, { encoding: "utf8" });

    if (result.status !== 0) {
        const details = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
        throw new Error(`${command} failed${details ? `:\n${details}` : "."}`);
    }
}

function executablePath(command) {
    const result = spawnSync("which", [command], { encoding: "utf8" });

    if (result.status !== 0) {
        return null;
    }

    return result.stdout.trim() || null;
}

function pythonSupportsPillowWebp(command) {
    const result = spawnSync(command, [
        "-c",
        "from PIL import Image, features; import sys; sys.exit(0 if features.check('webp') else 1)"
    ]);

    return result.status === 0;
}

function findPillowPython() {
    const candidates = [
        process.env.PHOTO_STRIP_PYTHON,
        executablePath("python3"),
        executablePath("python")
    ].filter(Boolean);
    const uniqueCandidates = Array.from(new Set(candidates));

    return uniqueCandidates.find(pythonSupportsPillowWebp) || null;
}

function createOptimizer() {
    const magick = executablePath("magick");

    if (magick) {
        return {
            extension: ".webp",
            label: "ImageMagick WebP",
            optimize(sourcePath, optimizedPath) {
                runCommand(magick, [
                    sourcePath,
                    "-auto-orient",
                    "-resize",
                    `${optimizedMaxDimension}x${optimizedMaxDimension}>`,
                    "-quality",
                    String(optimizedWebpQuality),
                    optimizedPath
                ]);
            }
        };
    }

    const pillowPython = findPillowPython();

    if (pillowPython) {
        return {
            extension: ".webp",
            label: "Pillow WebP",
            optimize(sourcePath, optimizedPath) {
                runCommand(pillowPython, [
                    "-c",
                    pillowWebpScript,
                    sourcePath,
                    optimizedPath,
                    String(optimizedMaxDimension),
                    String(optimizedWebpQuality)
                ]);
            }
        };
    }

    const sips = executablePath("sips");

    if (sips) {
        return {
            extension: ".jpg",
            label: "sips JPEG",
            optimize(sourcePath, optimizedPath) {
                runCommand(sips, [
                    "-s",
                    "format",
                    "jpeg",
                    "-s",
                    "formatOptions",
                    String(optimizedJpegQuality),
                    "-Z",
                    String(optimizedMaxDimension),
                    sourcePath,
                    "--out",
                    optimizedPath
                ]);
            }
        };
    }

    throw new Error("No supported image optimizer found. Install ImageMagick, Python with Pillow WebP support, or use macOS sips.");
}

function optimizedFilenameFor(filename, extension) {
    return `${path.basename(filename, path.extname(filename))}${extension}`;
}

function main() {
    const existingAltBySrc = readExistingManifest();
    const optimizer = createOptimizer();

    fs.mkdirSync(optimizedDir, { recursive: true });

    const files = fs
        .readdirSync(photoDir, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .filter((filename) => supportedExtensions.has(path.extname(filename).toLowerCase()))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

    const manifest = files.map((filename) => {
        const sourcePath = path.join(photoDir, filename);
        const optimizedFilename = optimizedFilenameFor(filename, optimizer.extension);
        const optimizedPath = path.join(optimizedDir, optimizedFilename);

        optimizer.optimize(sourcePath, optimizedPath);

        const dimensions = getImageDimensions(optimizedPath) || getImageDimensions(sourcePath);

        return {
            src: `${optimizedDirName}/${optimizedFilename}`,
            source: filename,
            alt: existingAltBySrc.get(filename) || altFromFilename(filename),
            width: dimensions ? dimensions.width : null,
            height: dimensions ? dimensions.height : null,
            orientation: orientationFromDimensions(dimensions)
        };
    });

    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`Optimized ${manifest.length} photos with ${optimizer.label}.`);
    console.log(`Wrote ${path.relative(rootDir, manifestPath)} with ${manifest.length} photos.`);
}

main();

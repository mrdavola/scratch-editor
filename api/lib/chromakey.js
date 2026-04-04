import sharp from 'sharp';

/**
 * Removes chromakey green (#00FF00) background from an image buffer.
 * Uses HSV color space for robust green detection.
 */
export async function removeGreenScreen(inputBuffer, options = {}) {
    const {
        hueCenter = 120,
        hueRange = 40,
        satMin = 0.2,
        valMin = 0.15,
        dilate = 2
    } = options;

    const { data, info } = await sharp(inputBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;
    const pixels = new Uint8Array(data);

    for (let i = 0; i < pixels.length; i += channels) {
        const r = pixels[i] / 255;
        const g = pixels[i + 1] / 255;
        const b = pixels[i + 2] / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const diff = max - min;

        let h = 0;
        if (diff !== 0) {
            if (max === r) h = 60 * (((g - b) / diff) % 6);
            else if (max === g) h = 60 * ((b - r) / diff + 2);
            else h = 60 * ((r - g) / diff + 4);
        }
        if (h < 0) h += 360;

        const s = max === 0 ? 0 : diff / max;
        const v = max;

        const hueDist = Math.min(Math.abs(h - hueCenter), 360 - Math.abs(h - hueCenter));

        if (hueDist < hueRange && s > satMin && v > valMin) {
            pixels[i + 3] = 0;
        }
    }

    if (dilate > 0) {
        const alpha = new Uint8Array(width * height);
        for (let i = 0; i < alpha.length; i++) {
            alpha[i] = pixels[i * channels + 3];
        }

        for (let pass = 0; pass < dilate; pass++) {
            const newAlpha = new Uint8Array(alpha);
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    const idx = y * width + x;
                    if (alpha[idx] > 0) {
                        const neighbors = [
                            alpha[(y-1) * width + x],
                            alpha[(y+1) * width + x],
                            alpha[y * width + (x-1)],
                            alpha[y * width + (x+1)],
                        ];
                        if (neighbors.some(n => n === 0)) {
                            newAlpha[idx] = 0;
                        }
                    }
                }
            }
            alpha.set(newAlpha);
        }

        for (let i = 0; i < alpha.length; i++) {
            pixels[i * channels + 3] = alpha[i];
        }
    }

    return sharp(Buffer.from(pixels), {
        raw: { width, height, channels }
    }).png().toBuffer();
}

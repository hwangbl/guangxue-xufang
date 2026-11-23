// Generated from src/lib/optics/newton-image.ts. Do not edit.
import { ringIntensity } from './newton-rings.mjs';
/** Same four subpixel samples and color mapping as the original 512px observation. */
export function renderNewtonImage(settings, half, size = 512) {
    const w = settings.wavelength;
    const rgb = w < 490 ? [40, 120 + (w - 400) * 1.2, 255] : w < 530 ? [40, 230, 255 - (w - 490) * 5] : w < 590 ? [40 + (w - 530) * 3.5, 230, 30] : [250, Math.max(35, 230 - (w - 590) * 1.8), 30];
    const data = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
            let intensity = 0;
            for (const dx of [.25, .75])
                for (const dy of [.25, .75])
                    intensity += ringIntensity(Math.hypot((x + dx - size / 2) * 2 * half / size, (y + dy - size / 2) * 2 * half / size), settings) / 4;
            const p = (y * size + x) * 4;
            for (let c = 0; c < 3; c++)
                data[p + c] = Math.round(7 + rgb[c] * .9 * intensity);
            data[p + 3] = 255;
        }
    return { data, size };
}

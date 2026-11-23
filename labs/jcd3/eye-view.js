import { contact, observationOffset, illumination, radians } from './physics.js';
function spectralColor(nm) {
  if (nm < 490) return [70 + (nm - 400) * .8, 90 + (nm - 400) * 1.4, 235];
  if (nm < 540) return [90 + (nm - 490) * 1.2, 235, 100];
  if (nm < 590) return [230 + (nm - 540) * .4, 222 - (nm - 540) * .7, 68];
  return [250, 180 - (nm - 590) * 1.1, 38];
}
export function createEyeRenderer(eye) {
  const ectx = eye.getContext('2d'),
    raw = document.createElement('canvas');
  raw.width = eye.width;
  raw.height = eye.height;
  const rctx = raw.getContext('2d');
  return function drawEye(state) {
    const w = eye.width,
      h = eye.height,
      img = rctx.createImageData(w, h),
      data = img.data,
      half = 2.4 / state.zoom,
      offset = observationOffset(state),
      ct = contact(state),
      lambda = state.wavelength_nm * 1e-6,
      light = illumination(state),
      col = spectralColor(state.wavelength_nm),
      r = state.radius_mm;
    for (let y = 0; y < h; y++) {
      const yy = (h / 2 - y) / (w / 2) * half + offset.y;
      for (let x = 0; x < w; x++) {
        const xx = (x - w / 2) / (w / 2) * half + offset.x,
          idx = (y * w + x) * 4;
        const rr = xx * xx + yy * yy,
          t = rr / (2 * r) + .001 * (ct.offset_um + ct.tilt_x_um_per_mm * xx + ct.tilt_y_um_per_mm * yy),
          phase = 2 * Math.PI * t / lambda;
        const bright = rr > 22 * 22 ? .012 : (.045 + .955 * Math.sin(phase) ** 2) * light;
        data[idx] = col[0] * bright;
        data[idx + 1] = col[1] * bright;
        data[idx + 2] = col[2] * bright;
        data[idx + 3] = 255;
      }
    }
    rctx.putImageData(img, 0, 0);
    ectx.save();
    ectx.fillStyle = '#020504';
    ectx.fillRect(0, 0, w, h);
    const blur = Math.min(14, Math.abs(state.focus_mm + state.column_mm - 12) * 1.35);
    ectx.filter = `blur(${blur}px)`;
    ectx.drawImage(raw, 0, 0);
    ectx.filter = 'none';
    const vg = ectx.createRadialGradient(w / 2, h / 2, w * .16, w / 2, h / 2, w * .51);
    vg.addColorStop(0, '#0000');
    vg.addColorStop(.82, '#0001');
    vg.addColorStop(1, '#000c');
    ectx.fillStyle = vg;
    ectx.fillRect(0, 0, w, h);
    ectx.translate(w / 2, h / 2);
    ectx.rotate(radians(state.reticle_deg));
    ectx.filter = `blur(${Math.abs(state.eyepiece_turn) * 2.3}px)`;
    ectx.strokeStyle = light > .07 ? 'rgba(4,9,10,.88)' : '#314347';
    ectx.lineWidth = 1.2;
    ectx.beginPath();
    ectx.moveTo(-w / 2, 0);
    ectx.lineTo(w / 2, 0);
    ectx.moveTo(0, -h / 2);
    ectx.lineTo(0, h / 2);
    ectx.stroke();
    ectx.restore();
  };
}

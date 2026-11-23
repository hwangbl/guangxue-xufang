// Shared by the React principle view and the instrument iframe. All lengths are SI.
const MODEL = 'gaussian-ideal-v1';
const ORIGIN_MM = 194;
const incompatible = () => Error('三维装置仅支持单透镜变换：λ632.8 nm、w₀0.5 mm、f0.15 m；透镜 z 为0.106–0.456 m，观察 z 为0.556–0.756 m。');
const near = (a, b) => Number.isFinite(a) && Math.abs(a - b) <= Math.abs(b) * 1e-10;

export function validateConditions(value) {
  if (value?.version !== 1 || value.lab !== 'gaussian' || value.model !== MODEL || value.units !== 'SI') {
    throw Error('高斯实验条件的版本、模型或单位不兼容。');
  }
  const {waistM, wavelengthM, focalLengthM, lensZM, detectorZM} = value;
  if (!near(waistM, .0005) || !near(wavelengthM, 632.8e-9) || !near(focalLengthM, .15)
    || !Number.isFinite(lensZM) || lensZM < .106 || lensZM > .456
    || !Number.isFinite(detectorZM) || detectorZM < .556 || detectorZM > .756) throw incompatible();
  return {version:1, lab:'gaussian', model:MODEL, units:'SI', waistM:.0005, wavelengthM:632.8e-9, focalLengthM:.15, lensZM, detectorZM};
}

export function fromInstrument(state) {
  if (!Number.isFinite(state?.lensMm) || !Number.isFinite(state?.detectorMm)) throw incompatible();
  return validateConditions({version:1, lab:'gaussian', model:MODEL, units:'SI',
    waistM:.0005, wavelengthM:632.8e-9, focalLengthM:.15,
    lensZM:(state?.lensMm - ORIGIN_MM) / 1000, detectorZM:(state?.detectorMm - ORIGIN_MM) / 1000});
}

export function fromPrinciple(state) {
  if (state?.expMode !== 'lens-transform' || !Array.isArray(state.lenses) || state.lenses.length !== 1
    || !Number.isFinite(state.w0) || !Number.isFinite(state.wavelength)) throw incompatible();
  return validateConditions({version:1, lab:'gaussian', model:MODEL, units:'SI',
    waistM:state.w0 / 1000, wavelengthM:state.wavelength * 1e-9,
    focalLengthM:state.lenses[0]?.focalLength, lensZM:state.lenses[0]?.position, detectorZM:state.observationZ});
}

export function toPrinciple(value) {
  const c = validateConditions(value);
  return {expMode:'lens-transform', w0:.5, wavelength:632.8, propagationDistance:.756,
    lensFocalLength:.15, lensPosition:c.lensZM, observationZ:c.detectorZM, showLens:true,
    lenses:[{position:c.lensZM, focalLength:.15}]};
}

export function applyConditions(state, value) {
  const c = validateConditions(value);
  // Whitelist positions. A transfer cannot replace records, notes, switches or aperture.
  return {...state, lensMm:Math.round(c.lensZM * 1000 + ORIGIN_MM), detectorMm:Math.round(c.detectorZM * 1000 + ORIGIN_MM)};
}

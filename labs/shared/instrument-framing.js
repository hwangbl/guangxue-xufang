import * as T from 'three';
import {LabResizeObserver, addLabCleanup} from './lab-runtime.js';

// Fit the projected instrument rather than the table or its bounding sphere.
export function installInstrumentFraming({camera, controls, host, model, render}) {
  let disposed = false;
  let fitting = false;
  let fittedPosition = null;
  let fittedTarget = null;
  const roots = () => {
    const current = typeof model === 'function' ? model() : model;
    return Array.isArray(current) ? current : [current];
  };
  function frameInstrument() {
    if (disposed || !host.clientWidth || !host.clientHeight) return;
    const box = new T.Box3();
    for (const root of roots()) {
      root.updateWorldMatrix(true, true);
      box.union(new T.Box3().setFromObject(root));
    }
    if (box.isEmpty()) return;
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
    const center = box.getCenter(new T.Vector3());
    const direction = camera.position.clone().sub(controls.target);
    if (direction.lengthSq() < 1e-10) direction.set(1, 1, 1);
    direction.normalize();
    camera.position.copy(center).add(direction);
    camera.lookAt(center);
    camera.updateMatrixWorld();
    const inverse = camera.quaternion.clone().invert();
    const tan = Math.tan(T.MathUtils.degToRad(camera.fov / 2));
    let distance = 0;
    const points = [];
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) {
          const point = new T.Vector3(x, y, z).sub(center).applyQuaternion(inverse);
          points.push(point);
          distance = Math.max(distance,
            Math.abs(point.x) / (tan * camera.aspect * .72) + point.z,
            Math.abs(point.y) / (tan * .72) + point.z);
        }
      }
    }
    // Perspective makes opposite box edges asymmetric. Solve for the full
    // projected span so flat and deep instruments have the same visual size.
    let nearDistance = Math.max(...points.map(point => point.z)) + camera.near * 2;
    let farDistance = distance;
    for (let iteration = 0; iteration < 24; iteration++) {
      const trial = (nearDistance + farDistance) / 2;
      const xs = points.map(point => point.x / (tan * camera.aspect * (trial - point.z)));
      const ys = points.map(point => point.y / (tan * (trial - point.z)));
      const span = Math.max((Math.max(...xs) - Math.min(...xs)) / 2,
        (Math.max(...ys) - Math.min(...ys)) / 2);
      if (span > .72) nearDistance = trial;
      else farDistance = trial;
    }
    distance = farDistance;
    controls.minDistance = Math.min(controls.minDistance, distance * .7);
    controls.maxDistance = Math.max(controls.maxDistance, distance * 1.3);
    controls.target.copy(center);
    camera.position.copy(center).addScaledVector(direction, distance);
    fitting = true;
    controls.update();
    fitting = false;
    fittedPosition = camera.position.clone();
    fittedTarget = controls.target.clone();
    render();
  }
  function changed() {
    if (fitting || !fittedPosition) return;
    if (camera.position.distanceToSquared(fittedPosition) > 1e-8 ||
        controls.target.distanceToSquared(fittedTarget) > 1e-8) {
      fittedPosition = null;
      fittedTarget = null;
    }
  }
  controls.addEventListener('start', changed);
  controls.addEventListener('change', changed);
  const near = () => frameInstrument();
  host.addEventListener('wx-frame-instrument', near);
  const observer = new LabResizeObserver(() => {
    if (fittedPosition) frameInstrument();
  });
  observer.observe(host);
  const initial = requestAnimationFrame(frameInstrument);
  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(initial);
    observer.disconnect();
    controls.removeEventListener('start', changed);
    controls.removeEventListener('change', changed);
    host.removeEventListener('wx-frame-instrument', near);
  }
  addLabCleanup(dispose);
  return {frameInstrument, dispose};
}

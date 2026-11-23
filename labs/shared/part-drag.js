import * as T from 'three';
import {addLabCleanup, flushLabUpdates} from './lab-runtime.js';

// Capture instrument gestures before OrbitControls; background gestures remain camera controls.
export function installPartDrag({renderer, camera, controls, model, resolvePart}) {
  const canvas = renderer.domElement, ray = new T.Raycaster(), pointer = new T.Vector2();
  let active = null;
  function cast(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    camera.updateMatrixWorld();
    ray.setFromCamera(pointer, camera);
  }
  function pick(event) {
    cast(event);
    const root = typeof model === 'function' ? model() : model;
    if (!root) return null;
    const hit = ray.intersectObject(root, true).find(({object}) => {
      for (let node = object; node; node = node.parent) if (!node.visible) return false;
      return true;
    });
    return hit ? {hit, part:resolvePart(hit.object)} : null;
  }
  function down(event) {
    if (event.button !== 0 || active) return;
    const picked = pick(event), part = picked?.part;
    const move = part?.start?.(event, picked.hit, ray) || (part?.click ? () => {} : null);
    if (!move) return;
    active = {move, click:part.click, x:event.clientX, y:event.clientY, moved:false, pointer:event.pointerId, enabled:controls.enabled};
    controls.enabled = false;
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = 'grabbing';
    event.preventDefault();event.stopImmediatePropagation();
  }
  function move(event) {
    if (active) {
      if (active.pointer !== event.pointerId) return;
      if (Math.hypot(event.clientX - active.x, event.clientY - active.y) > 4) active.moved = true;
      cast(event);
      active.move(event, ray);
      event.preventDefault();event.stopImmediatePropagation();
    } else canvas.style.cursor = pick(event)?.part ? 'grab' : '';
  }
  function stop(event) {
    if (!active || (event?.pointerId != null && event.pointerId !== active.pointer)) return;
    const previous = active;active = null;
    flushLabUpdates();
    controls.enabled = previous.enabled;
    if (canvas.hasPointerCapture(previous.pointer)) canvas.releasePointerCapture(previous.pointer);
    canvas.style.cursor = '';
    event?.stopImmediatePropagation?.();
  }
  function up(event) {
    if (active?.pointer === event.pointerId) {
      move(event);
      const click = !active.moved && active.click;
      stop(event);
      if (click) click();
    }
  }
  function wheel(event) {
    const part = pick(event)?.part;
    if (!part?.wheel || !event.deltaY) return;
    part.wheel(event);
    event.preventDefault();event.stopImmediatePropagation();
  }
  canvas.addEventListener('pointerdown', down, true);
  canvas.addEventListener('pointermove', move, true);
  canvas.addEventListener('pointerup', up, true);
  canvas.addEventListener('pointercancel', stop, true);
  canvas.addEventListener('lostpointercapture', stop, true);
  canvas.addEventListener('wheel', wheel, {capture:true, passive:false});
  window.addEventListener('wx-lab-suspend', stop);
  addLabCleanup(() => {
    stop();
    canvas.removeEventListener('pointerdown', down, true);
    canvas.removeEventListener('pointermove', move, true);
    canvas.removeEventListener('pointerup', up, true);
    canvas.removeEventListener('pointercancel', stop, true);
    canvas.removeEventListener('lostpointercapture', stop, true);
    canvas.removeEventListener('wheel', wheel, true);
    window.removeEventListener('wx-lab-suspend', stop);
  });
}

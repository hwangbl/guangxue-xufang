import { Euler, Quaternion } from './vendor/package/build/three.module.js';
// Blender Euler orders are extrinsic; Three.js Euler orders are intrinsic.
// Reverse the order so the same angles describe the same local-to-parent rotation.
export function blenderQuaternion(angles, blenderOrder = 'XYZ') {
  const order = blenderOrder.split('').reverse().join('');
  return new Quaternion().setFromEuler(new Euler(angles[0], angles[1], angles[2], order));
}

// The exported driver expressions contain only arithmetic, v and pi.
// No arbitrary evaluation, Python code or application code is imported from the model.
export function expressionValue(expr, v) {
  const toks = expr.match(/\d+(?:\.\d+)?|pi|v|[()+*/-]/g) || [];
  if (toks.join('') !== expr.replace(/\s/g, '')) throw new Error('不支持的驱动表达式');
  let i = 0;
  function atom() {
    let t = toks[i++];
    if (t === '-') return -atom();
    if (t === '+') return atom();
    if (t === '(') {
      let r = sum();
      if (toks[i++] !== ')') throw Error('括号');
      return r;
    }
    if (t === 'v') return v;
    if (t === 'pi') return Math.PI;
    if (t === undefined) throw Error('表达式');
    return Number(t);
  }
  function product() {
    let r = atom();
    while (['*', '/'].includes(toks[i])) {
      let op = toks[i++],
        n = atom();
      r = op === '*' ? r * n : r / n;
    }
    return r;
  }
  function sum() {
    let r = product();
    while (['+', '-'].includes(toks[i])) {
      let op = toks[i++],
        n = product();
      r = op === '+' ? r + n : r - n;
    }
    return r;
  }
  const result = sum();
  if (i !== toks.length || !Number.isFinite(result)) throw Error('驱动表达式无效');
  return result;
}

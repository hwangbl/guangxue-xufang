import {labSessionStorage as sessionStorage} from '../shared/lab-runtime.js';
import {manageLabScene,LabResizeObserver,scheduleLabFrame,setLabAnimationLoop,isLabDisposed,disposeLabTree,addLabCleanup} from '../shared/lab-runtime.js';
import {installProductPresentation} from '../shared/product-presentation.js';
import {configureJcd3Studio} from './studio.js';
let presentation;
import {addExperimentTable,frameExperimentTable} from '../shared/experiment-table.js';
import {applyConditions as applyNewtonConditions,completedRecords} from './conditions.mjs';
import {installPlatformBridge} from '../shared/platform-bridge.js';
import { createEyeRenderer } from './eye-view.js';
import { restoreSession, persistSession } from './session.js';
import { INSTRUMENT } from './assets/instrument-config.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from '../shared/optimized-gltf-loader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { blenderQuaternion, expressionValue } from './rig-math.js';
import { DEFAULTS, reflection, illumination, radiusFromDiameters, observationOffset, focusQuality, measurementConditions } from './physics.js';
const $ = s => document.querySelector(s),
  $$ = s => [...document.querySelectorAll(s)];
const state = {
    ...DEFAULTS
  },
  records = new Map(),
  nodes = new Map(),
  controls = new Map();
let model,
  manifest = INSTRUMENT,
  bindings = [],
  selected = null,
  dirty = true,
  showLight = false,
  ready = false,
  toastTimer,
  lastResult = null;
const stage = $('#scene'),
  scene = new THREE.Scene(),
  camera = new THREE.PerspectiveCamera(34, 1, .001, 8);
camera.up.set(0, 0, 1);
camera.position.set(-.40, -.58, .37);
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setClearColor(0x353B44, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
stage.prepend(renderer.domElement);
const orbit = new OrbitControls(camera, renderer.domElement);manageLabScene({renderer,scene,controls:orbit});
orbit.target.set(0, 0, .16);
orbit.enableDamping = true;
orbit.dampingFactor = .08;
orbit.minDistance = .035;
orbit.maxDistance = 1.1;
orbit.maxPolarAngle = Math.PI * .94;
const pmrem = new THREE.PMREMGenerator(renderer),
  environment = new RoomEnvironment();
scene.environment = pmrem.fromScene(environment, .04).texture;
scene.environmentIntensity = .65;
environment.dispose();
pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xaed2e5, 0x23303d, 1.0));
for (const [x, y, z, intensity, color] of [[-.3, -.45, .7, 3.0, 0xc6e5ff], [.3, .2, .55, 2, 0xffdda4]]) {
  let l = new THREE.DirectionalLight(color, intensity);
  l.position.set(x, y, z);
  scene.add(l);
}
const shadowCanvas = document.createElement('canvas');
shadowCanvas.width = 128;
shadowCanvas.height = 128;
const sh = shadowCanvas.getContext('2d');
let g = sh.createRadialGradient(64, 64, 5, 64, 64, 62);
g.addColorStop(0, '#000a');
g.addColorStop(1, '#0000');
sh.fillStyle = g;
sh.fillRect(0, 0, 128, 128);
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(.38, .37), new THREE.MeshBasicMaterial({
  map: new THREE.CanvasTexture(shadowCanvas),
  transparent: true,
  depthWrite: false
}));
shadow.position.z = -.0007;
scene.add(shadow);
const rayIn = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), .08, 0xf7c16b, .008, .0035),
  rayOut = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(), .045, 0x78e1d8, .008, .0035);
scene.add(rayIn, rayOut);
rayIn.visible = rayOut.visible = false;
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').hidden = true, 3500);
}
function bounds(k) {
  return manifest?.properties[k] || {
    min: -Infinity,
    max: Infinity
  };
}
function setState(k, value, {
  force = false
} = {}) {
  if (!(k in state)) throw new Error('未知实验参数');
  if (typeof state[k] === 'boolean') {
    state[k] = Boolean(value);
  } else {
    if (!Number.isFinite(Number(value))) throw new Error('请输入有效数值');
    const locked = k === 'arm_mm' && state.arm_lock > .5 || ['column_mm', 'column_deg'].includes(k) && state.column_lock > .5 || k === 'head_deg' && state.head_lock > .5;
    if (locked && !force) {
      toast('请先松开对应的锁紧轮');
      return false;
    }
    const b = bounds(k);
    state[k] = Math.max(b.min, Math.min(b.max, Number(value)));
    if (k === 'reading_mm') state[k] = Math.round(state[k] * 1000) / 1000;
  }
  if (k !== 'reading_mm' && records.size && ['wavelength_nm', 'radius_mm'].includes(k)) records.clear();
  sync();
  return true;
}
function updateModel() {
  if (!model) return;
  const rotations = new Set();
  for (const b of bindings) {
    const o = nodes.get(b.object);
    if (!o) continue;
    const val = expressionValue(b.expression, state[b.key]);
    if (b.path === 'location') o.position.setComponent(b.axis, val);
    if (b.path === 'rotation_euler') {
      o.userData.liveEuler[b.axis] = val;
      rotations.add(o);
    }
  }
  for (const o of rotations) {
    o.quaternion.copy(blenderQuaternion(o.userData.liveEuler, o.userData.webEulerOrder || 'XYZ'));
  }
  model.updateMatrixWorld(true);
  const m = nodes.get('RIG_HalfMirror');
  if (m) {
    const p = m.getWorldPosition(new THREE.Vector3());
    rayIn.position.copy(p).add(new THREE.Vector3(0, -.075, 0));
    rayIn.setLength(.075, .008, .003);
    rayOut.position.copy(p);
    const d = reflection(state.mirror_deg, state.mirror_yaw_deg + state.column_deg);
    rayOut.setDirection(new THREE.Vector3(...d));
    rayOut.setLength(.05, .008, .003);
  }
  rayIn.visible = rayOut.visible = showLight && state.lamp;
}
const renderEye = createEyeRenderer($('#eyepiece'));
function drawEye() {
  renderEye(state);
}
function makeControl(key, label, parent, step = .1) {
  const b = bounds(key),
    div = document.createElement('div'),
    id = (parent.id === 'selected-control' ? 'selected-' : 'control-') + key;
  div.className = 'control';
  div.innerHTML = `<label for="${id}">${label}<output></output></label><input id="${id}" type="range" min="${b.min}" max="${b.max}" step="${step}" value="${state[key]}">`;
  parent.append(div);
  div.querySelector('input').addEventListener('input', e => setState(key, e.target.value));
  if (!controls.has(key)) controls.set(key, []);
  controls.get(key).push(div);
  return div;
}
function sync() {
  saveProgress();
  $('#reading-output').textContent = state.reading_mm.toFixed(3);
  $('#reading-range').value = state.reading_mm;
  $('#reading-input').value = state.reading_mm.toFixed(3);
  const integer = Math.floor(state.reading_mm + 1e-8),
    frac = (state.reading_mm - integer) * 100;
  $('#scale-breakdown').textContent = `主尺 ${integer} mm + 鼓轮 ${frac.toFixed(1)} 格`;
  for (const [k, list] of controls) for (const d of list) {
    d.querySelector('input').value = state[k];
    d.querySelector('output').textContent = state[k].toFixed(k === 'reading_mm' ? 3 : k.includes('lock') ? 0 : 1);
  }
  for (const el of $$('.lock-button')) {
    const k = el.dataset.key;
    el.textContent = el.dataset.label + (state[k] > .5 ? '：已锁紧，点击松开' : '：已松开，点击锁紧');
    el.setAttribute('aria-pressed', String(state[k] > .5));
  }
  for (const [k, list] of controls) {
    const locked = k === 'arm_mm' && state.arm_lock > .5 || ['column_mm', 'column_deg'].includes(k) && state.column_lock > .5 || k === 'head_deg' && state.head_lock > .5;
    for (const el of list) {
      el.querySelector('input').disabled = locked;
      el.classList.toggle('locked', locked);
    }
  }
  const f = focusQuality(state),
    l = illumination(state);
  $('#focus-status').textContent = f > .65 ? '物像清晰' : '转动调焦轮，使条纹清晰';
  $('#focus-status').classList.toggle('warn', f <= .65);
  $('#light-status').textContent = l > .7 ? '照明已对准' : l > .15 ? '照明偏弱' : '照明未对准';
  $('#light-status').classList.toggle('warn', l <= .7);
  $('#lamp').checked = state.lamp;
  $('#field-size').textContent = `视场 ${(4.8 / state.zoom).toFixed(1)} mm`;
  $('#zoom-btn').textContent = state.zoom + '×';
  updateModel();
  dirty = true;
}
$('#reading-range').addEventListener('input', e => setState('reading_mm', e.target.value));
$('#reading-input').addEventListener('change', e => {
  if (e.target.value === '') {
    sync();
    return;
  }
  setState('reading_mm', e.target.value);
});
$$('[data-step]').forEach(b => b.addEventListener('click', () => setState('reading_mm', state.reading_mm + Number(b.dataset.step))));
$('#lamp').addEventListener('change', e => setState('lamp', e.target.checked));
$('#zoom-btn').addEventListener('click', () => {
  state.zoom = state.zoom === 1 ? 2 : 1;
  sync();
});
$('#help-btn').onclick = () => $('#help-dialog').showModal();
$('#help-close').onclick = () => $('#help-dialog').close();
$('#reset-btn').onclick = () => {
  Object.assign(state, DEFAULTS);
  sync();
  toast('仪器已复位；已有测量记录保留');
};
$('#lightpath-btn').onclick = () => {
  showLight = !showLight;
  $('#lightpath-btn').textContent = showLight ? '隐藏光路' : '显示光路';
  updateModel();
};
stage.addEventListener('keydown', e => {
  if (['ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault();
    setState('reading_mm', state.reading_mm + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? .1 : .001));
  }
});
function resize() {
  const w = stage.clientWidth,
    h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = Math.min(68, 34 * Math.max(1, .75 / camera.aspect));
  camera.updateProjectionMatrix();
}
new LabResizeObserver(resize).observe(stage);
let targetView = null;
function view(name) {
  let pos, target;
  if (name === 'hero') {
    pos = [-.40, -.58, .37];
    target = [0, 0, .16];
  } else if (name === 'ruler') {
    setState('head_deg', 180, {
      force: true
    });
    pos = [0, .012, .45];
    target = [0, .012, .198];
  } else if (name === 'drum') {
    pos = [-.108, -.005, .33];
    target = [-.077, .012, .163];
  } else {
    pos = [-.155, -.245, .17];
    target = [0, -.034, .111];
  }
  if(name==='hero'){camera.position.set(...pos);orbit.target.set(...target);frameExperimentTable(scene,camera,orbit);pos=camera.position.toArray();target=orbit.target.toArray();}
  targetView = {
    pos: new THREE.Vector3(...pos),
    target: new THREE.Vector3(...target)
  };
  $$('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === name));
}
$$('[data-view]').forEach(b => b.onclick = () => view(b.dataset.view));
const raycaster = new THREE.Raycaster(),
  pointer = new THREE.Vector2(),
  pickables = [];
const handleSpecs = [['RIG_Micrometer', 'reading_mm', '测微鼓轮', .008], ['调焦手轮 -1', 'focus_mm', '调焦手轮', .07], ['调焦手轮 1', 'focus_mm', '调焦手轮', .07], ['半反镜调节轮', 'mirror_deg', '半反镜倾角', .2], ['RIG_HalfMirrorAzimuth', 'mirror_yaw_deg', '半反镜方位', .3], ['RIG_Diopter', 'eyepiece_turn', '目镜视度', .007], ['RIG_PrismHead', 'head_deg', '镜头方位', .3], ['方轴锁紧手轮', 'arm_lock', '方轴锁紧', 0], ['支柱锁紧手轮', 'column_lock', '支柱锁紧', 0], ['棱镜室定位螺钉', 'head_lock', '镜头锁紧', 0], ['底座反光镜调节轮 -1', 'base_mirror_deg', '底座反光镜', .2], ['底座反光镜调节轮 1', 'base_mirror_deg', '底座反光镜', .2], ['RIG_CellScrew_1', 'cell_turn_1', '牛顿环螺钉 1', .004], ['RIG_CellScrew_2', 'cell_turn_2', '牛顿环螺钉 2', .004], ['RIG_CellScrew_3', 'cell_turn_3', '牛顿环螺钉 3', .004], ['压片转轴 -1', 'clip_left_deg', '左压片', .4], ['压片转轴 1', 'clip_right_deg', '右压片', .4]];
const handles = new Map();
function hit(e) {
  if (!model) return null;
  const rect = stage.getBoundingClientRect();
  pointer.set(2 * (e.clientX - rect.left) / rect.width - 1, 1 - 2 * (e.clientY - rect.top) / rect.height);
  raycaster.setFromCamera(pointer, camera);
  const h = raycaster.intersectObject(model, true)[0];
  if (!h) return null;
  let o = h.object;
  while (o) {
    if (handles.has(o.uuid)) return handles.get(o.uuid);
    o = o.parent;
  }
  return null;
}
function choose(h) {
  selected = h;
  $('#selection-label').textContent = h.label + ' · 上下拖动调节';
  const p = $('#selected-control');
  p.replaceChildren();
  p.hidden = false;
  for (const [key, list] of controls) controls.set(key, list.filter(el => el.isConnected));
  if (h.key.includes('lock')) {
    const b = document.createElement('button');
    b.textContent = state[h.key] > .5 ? '松开锁紧轮' : '锁紧';
    b.onclick = () => {
      setState(h.key, state[h.key] > .5 ? 0 : 1);
      choose(h);
    };
    p.append(b);
  } else makeControl(h.key, h.label, p, h.key === 'reading_mm' ? .001 : .1);
  updateModel();
  sync();
}
let drag = null;
stage.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  const h = hit(e);
  if (!h) return;
  orbit.enabled = false;
  targetView = null;
  choose(h);
  drag = {
    id: e.pointerId,
    y: e.clientY,
    value: state[h.key],
    h
  };
  stage.setPointerCapture(e.pointerId);
}, true);
stage.addEventListener('pointermove', e => {
  if (drag) {
    setState(drag.h.key, drag.value + (drag.y - e.clientY) * drag.h.sensitivity);
    return;
  }
  const h = hit(e),
    label = $('#hover-label');
  label.hidden = !h;
  stage.style.cursor = h ? 'ns-resize' : 'grab';
  if (h) {
    label.textContent = h.label;
    const r = stage.getBoundingClientRect();
    label.style.left = Math.min(e.clientX - r.left + 13, r.width - 160) + 'px';
    label.style.top = Math.max(5, e.clientY - r.top - 34) + 'px';
  }
});
function endDrag() {
  drag = null;
  orbit.enabled = true;
}
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);
stage.addEventListener('wheel', e => {
  if (selected && e.altKey) {
    e.preventDefault();
    setState(selected.key, state[selected.key] + (e.deltaY < 0 ? 1 : -1) * (selected.key === 'reading_mm' ? .01 : selected.sensitivity * 5));
  }
}, {
  passive: false
});
async function load() {
  try {
    manifest = INSTRUMENT;
    const gltf = await new GLTFLoader().loadAsync('./assets/jcd3-product.glb', p => {
      $('#load-progress').textContent = p.total ? Math.round(p.loaded / p.total * 100) + '%' : '正在读取部件';
    });
    if(isLabDisposed()){disposeLabTree(gltf.scene);return;}
    model = gltf.scene;
    model.traverse(o => {
      const n = o.userData.webName;
      if (n) {
        nodes.set(n, o);
        o.userData.liveEuler = [...(o.userData.webEuler || [0, 0, 0])];
      }
      if (o.isMesh) {
        o.frustumCulled = true;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          m.envMapIntensity = .65;
          if (m.transmission > .1) {
            m.roughness = .07;
            m.thickness = .001;
            m.ior = 1.46;
          }
          m.needsUpdate = true;
        }
      }
    });
    scene.add(model);
    shadow.visible=false;
    addExperimentTable(scene, model, {
      upAxis: 'z',
      topFinish: { color: 0x59636b, metalness: .55, roughness: .58 }
    });
    presentation=installProductPresentation({scene,camera,renderer,model:model,controls:orbit,upAxis:'z',name:'jcd3',configureScene:configureJcd3Studio,initialQuality:stage.clientWidth>=600?'high':'fast'});
    presentation.frameInstrument();orbit.update();
    bindings = manifest.bindings;
    for (const [name, key, label, sensitivity] of handleSpecs) {
      const object = nodes.get(name);
      if (!object) continue;
      const h = {
        key,
        label,
        sensitivity
      };
      handles.set(object.uuid, h);
      object.traverse(o => {
        if (o.isMesh && !pickables.includes(o)) pickables.push(o);
      });
    }
    for (const [key, label, step] of [['focus_mm', '调焦升降 / mm', .1], ['eyepiece_turn', '目镜视度 / 圈', .01], ['reticle_deg', '叉丝方向 / °', .1], ['mirror_deg', '半反镜倾角 / °', .1], ['mirror_yaw_deg', '半反镜方位 / °', .1]]) makeControl(key, label, $('#optical-controls'), step);
    ready = true;
    $('#model-loading').hidden = true;
    sync();
    initExperiment();
    window.parent.postMessage({type:'jcd3-ready'}, window.location.origin);
  } catch (e) {
    window.parent.postMessage({type:'jcd3-failed'}, window.location.origin);
    console.error(e);
    $('#model-loading').innerHTML = `<p>三维模型加载失败</p><small>请通过“启动网页实验.cmd”打开页面。</small><button id="reload-model">重新加载</button>`;
    $('#reload-model').onclick = () => location.reload();
  }
}
function animate() {
  scheduleLabFrame(animate,()=>!!targetView);if(document.hidden)return;
  if (targetView) {
    camera.position.lerp(targetView.pos, .12);
    orbit.target.lerp(targetView.target, .12);
    if (camera.position.distanceTo(targetView.pos) < .0002) targetView = null;
  }
  orbit.update();
  (presentation?presentation.render():renderer.render(scene,camera));
  if (dirty) {
    drawEye();
    dirty = false;
  }
}
const invariantKeys = ['radius_mm', 'wavelength_nm', 'arm_mm', 'column_mm', 'column_deg', 'cell_turn_1', 'cell_turn_2', 'cell_turn_3'];
function resetResult(message = '记录两组完整的环径后计算。') {
  lastResult = null;
  $('#radius-output').innerHTML = '—<small> m</small>';
  $('#result-hint').textContent = message;
}
function diameter(n) {
  const row = records.get(n);
  return row?.left && row?.right ? Math.abs(row.right.value - row.left.value) : null;
}
function renderRecords() {
  saveProgress();
  $('#record-rows').innerHTML = [5, 10, 15, 20].map(n => {
    const row = records.get(n),
      d = diameter(n);
    return `<tr><td>${n}</td><td class="${row?.left ? 'recorded' : ''}">${row?.left?.value.toFixed(3) ?? '—'}</td><td class="${row?.right ? 'recorded' : ''}">${row?.right?.value.toFixed(3) ?? '—'}</td><td>${d === null ? '—' : d.toFixed(3)}</td><td>${row ? `<button data-clear="${n}" aria-label="重测第 ${n} 级暗环">重测</button>` : '待测量'}</td></tr>`;
  }).join('');
  $$('[data-clear]').forEach(b => b.onclick = () => {
    records.delete(Number(b.dataset.clear));
    resetResult();
    renderRecords();
  });
  const count = [...records.values()].reduce((a, r) => a + Number(Boolean(r.left)) + Number(Boolean(r.right)), 0);
  $('#record-status').textContent = count ? `已记录 ${count} 个位置 · ${[5, 10, 15, 20].filter(n => diameter(n) !== null).length} 组完整环径` : '选择环次，再让纵丝与暗环中心线相切';
  $$('.steps span').forEach((el, i) => el.classList.toggle('current', i === (lastResult ? 2 : count ? 1 : 0)));
}
function record(side, order = Number($('#ring-order').value)) {
  if (!['left', 'right'].includes(side) || ![5, 10, 15, 20].includes(order)) throw Error('请选择有效的环次和左右位置');
  const row = records.get(order) || {},
    issues = measurementConditions(state);
  if (Math.abs(state.eyepiece_turn) > .4) issues.push('叉丝尚未清晰');
  row[side] = {
    value: state.reading_mm,
    conditions: Object.fromEntries(invariantKeys.map(k => [k, state[k]])),
    issues,
    time: new Date().toISOString()
  };
  records.set(order, row);
  resetResult('记录已更新，请重新计算。');
  renderRecords();
  const message = `已记录第 ${order} 级暗环${side === 'left' ? '左' : '右'}侧：${state.reading_mm.toFixed(3)} mm` + (issues.length ? '。注意：' + issues.join('、') : '');
  $('#record-message').textContent = message;
  $('#record-message').classList.toggle('warn', issues.length > 0);
  toast(message);
  return {
    order,
    side,
    value: state.reading_mm,
    issues
  };
}
function calculate(m = Number($('#m-order').value), n = Number($('#n-order').value)) {
  if (!(m > n)) {
    resetResult('请选择 m > n 的两级暗环。');
    return {
      error: 'm 必须大于 n'
    };
  }
  const dm = diameter(m),
    dn = diameter(n);
  if (dm === null || dn === null) {
    resetResult('请先记录这两级暗环的左右位置。');
    return {
      error: '缺少完整左右读数'
    };
  }
  const shots = [records.get(m).left, records.get(m).right, records.get(n).left, records.get(n).right];
  if (invariantKeys.some(k => shots.some(s => Math.abs(s.conditions[k] - shots[0].conditions[k]) > 1e-6))) {
    resetResult('测量期间实验条件发生变化，请在相同条件下重测。');
    return {
      error: '实验条件不一致'
    };
  }
  const wavelength = shots[0].conditions.wavelength_nm,
    r = radiusFromDiameters(dm, dn, m, n, wavelength);
  if (r === null) {
    resetResult('环径应满足 Dm > Dn > 0，请核对环次和读数。');
    return {
      error: '环径无效'
    };
  }
  lastResult = {
    m,
    n,
    dm_mm: dm,
    dn_mm: dn,
    wavelength_nm: wavelength,
    radius_mm: r,
    radius_m: r / 1000,
    error_percent: Math.abs(r / shots[0].conditions.radius_mm - 1) * 100
  };
  const warns = [...new Set(shots.flatMap(s => s.issues))];
  $('#radius-output').innerHTML = `${(r / 1000).toFixed(4)}<small> m</small>`;
  $('#result-hint').textContent = `与设定值偏差 ${lastResult.error_percent.toFixed(2)}%` + (warns.length ? '；记录包含操作状态警告。' : '；由所记录环径计算。');
  renderRecords();
  return {
    ...lastResult,
    warnings: warns
  };
}
function exportData() {
  if (!records.size) {
    toast('请先记录至少一个测量位置');
    return;
  }
  const rows = [['暗环级次', '左侧位置_mm', '右侧位置_mm', '直径_mm', '波长_nm', '测量状态']];
  for (const n of [5, 10, 15, 20]) {
    const r = records.get(n);
    if (!r) continue;
    rows.push([n, r.left?.value.toFixed(3) ?? '', r.right?.value.toFixed(3) ?? '', diameter(n)?.toFixed(3) ?? '', (r.left || r.right).conditions.wavelength_nm, [...(r.left?.issues || []), ...(r.right?.issues || [])].join(';')]);
  }
  if (lastResult) rows.push([], ['m', 'n', '曲率半径_m', '与设定值偏差_%'], [lastResult.m, lastResult.n, lastResult.radius_m.toFixed(6), lastResult.error_percent.toFixed(3)]);
  rows.push([], ['说明', '理想空气膜模型；三位小数为估读；调焦与照明为教学近似。']);
  const csv = '\uFEFF' + rows.map(r => r.map(v => '"' + String(v).replaceAll('"', '""') + '"').join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], {
    type: 'text/csv;charset=utf-8'
  }));
  const a = document.createElement('a');
  a.href = url;
  a.download = '牛顿环实验记录.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function initExperiment() {
  const parent = $('#mechanical-controls');
  for (const [key, label] of [['arm_lock', '方轴'], ['column_lock', '支柱'], ['head_lock', '镜头']]) {
    const el = document.createElement('div');
    el.className = 'control lock-control';
    el.innerHTML = `<button class="lock-button" data-key="${key}" data-label="${label}"></button>`;
    el.querySelector('button').onclick = () => setState(key, state[key] > .5 ? 0 : 1);
    parent.append(el);
  }
  for (const [k, l] of [['arm_mm', '方轴前后 / mm'], ['column_mm', '支柱升降 / mm'], ['column_deg', '支柱方位 / °'], ['head_deg', '镜头方位 / °'], ['clip_left_deg', '左压片 / °'], ['clip_right_deg', '右压片 / °'], ['base_mirror_deg', '底座反光镜 / °'], ['cell_turn_1', '牛顿环螺钉 1 / 圈'], ['cell_turn_2', '牛顿环螺钉 2 / 圈'], ['cell_turn_3', '牛顿环螺钉 3 / 圈']]) makeControl(k, l, parent, k.startsWith('cell_') ? .01 : .1);
  $('#record-left').onclick = () => record('left');
  $('#record-right').onclick = () => record('right');
  $('#calculate-btn').onclick = () => calculate();
  $('#export-btn').onclick = exportData;
  $('#m-order').onchange = $('#n-order').onchange = () => resetResult();
  $('#apply-params').onclick = () => {
    const w = Number($('#wavelength').value),
      r = Number($('#true-radius').value);
    if (!Number.isFinite(w) || w < 400 || w > 700 || !Number.isFinite(r) || r < 300 || r > 3000) {
      toast('波长范围 400–700 nm；曲率半径范围 300–3000 mm');
      return;
    }
    state.wavelength_nm = w;
    state.radius_mm = r;
    records.clear();
    resetResult();
    renderRecords();
    sync();
    toast('仿真参数已更新，原记录已清空');
  };
  const originalReset = $('#reset-btn').onclick;
  $('#reset-btn').onclick = () => {
    const radius = state.radius_mm,
      wavelength = state.wavelength_nm;
    originalReset();
    state.radius_mm = radius;
    state.wavelength_nm = wavelength;
    sync();
  };
  renderRecords();
  sync();
  registerTools();
}
function snapshot() {
  return {
    ready,
    state: {
      ...state
    },
    records: Object.fromEntries(records),
    result: lastResult,
    illumination: illumination(state),
    focus_quality: focusQuality(state),
    observation_offset_mm: observationOffset(state),
    optical_reflection: reflection(state.mirror_deg, state.mirror_yaw_deg + state.column_deg),
    rigs: Object.fromEntries(['RIG_MeasuringSlide', 'RIG_Micrometer', '调焦手轮 -1', '调焦手轮 1', 'RIG_Focus', 'RIG_HalfMirror'].map(n => {
      const o = nodes.get(n);
      return [n, o ? {
        position: o.position.toArray(),
        world_position_m: o.getWorldPosition(new THREE.Vector3()).toArray(),
        euler: o.userData.liveEuler,
        shaft_direction_world: new THREE.Vector3(0, 0, 1).applyQuaternion(o.getWorldQuaternion(new THREE.Quaternion())).toArray()
      } : null];
    })),
    render_stats: {
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles
    }
  };
}
function registerTools() {
  const registry = document.modelContext;
  if (!registry?.registerTool) return;
  const controller = new AbortController();
  window.addEventListener('pagehide', () => controller.abort(), {
    once: true
  });
  const definitions = [{
    name: 'read_experiment',
    title: '读取实验状态',
    description: '读取当前仪器状态、读数、记录与计算结果。',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false
    },
    annotations: {
      readOnlyHint: true
    },
    execute: () => snapshot()
  }, {
    name: 'adjust_instrument',
    title: '调整仪器',
    description: '通过与页面相同的控件调整仪器。被锁紧的机构需要先松开锁紧轮。',
    inputSchema: {
      type: 'object',
      properties: {
        changes: {
          type: 'object',
          properties: Object.fromEntries(Object.entries(manifest.properties).map(([k, b]) => [k, {
            type: 'number',
            minimum: b.min,
            maximum: b.max
          }])),
          additionalProperties: false
        }
      },
      required: ['changes'],
      additionalProperties: false
    },
    execute: input => {
      if (!input?.changes || typeof input.changes !== 'object' || Array.isArray(input.changes)) throw Error('changes 必须是参数对象');
      for (const [k, v] of Object.entries(input.changes)) {
        const b = manifest.properties[k];
        if (!b || typeof v !== 'number' || !Number.isFinite(v) || v < b.min || v > b.max) throw Error('无效参数：' + k);
      }
      const candidate = {
        ...state,
        ...input.changes
      };
      for (const k of Object.keys(input.changes)) {
        if (k === 'arm_mm' && candidate.arm_lock > .5 || ['column_mm', 'column_deg'].includes(k) && candidate.column_lock > .5 || k === 'head_deg' && candidate.head_lock > .5) throw Error('机构仍处于锁紧状态');
      }
      for (const k of ['arm_lock', 'column_lock', 'head_lock']) if (k in input.changes) setState(k, input.changes[k]);
      for (const [k, v] of Object.entries(input.changes)) if (!k.includes('lock')) setState(k, v);
      return snapshot();
    }
  }, {
    name: 'record_measurement',
    title: '记录测量位置',
    description: '将当前位置记录为所选暗环的左侧或右侧读数。',
    inputSchema: {
      type: 'object',
      properties: {
        order: {
          type: 'integer',
          enum: [5, 10, 15, 20]
        },
        side: {
          type: 'string',
          enum: ['left', 'right']
        }
      },
      required: ['order', 'side'],
      additionalProperties: false
    },
    execute: i => {
      if (!i) throw Error('缺少参数');
      return record(i.side, i.order);
    }
  }, {
    name: 'calculate_radius',
    title: '计算曲率半径',
    description: '使用已经记录的两级暗环直径计算曲率半径。',
    inputSchema: {
      type: 'object',
      properties: {
        m: {
          type: 'integer',
          enum: [5, 10, 15, 20]
        },
        n: {
          type: 'integer',
          enum: [5, 10, 15, 20]
        }
      },
      required: ['m', 'n'],
      additionalProperties: false
    },
    execute: i => {
      if (!i || ![5, 10, 15, 20].includes(i.m) || ![5, 10, 15, 20].includes(i.n)) throw Error('无效环次');
      $('#m-order').value = i.m;
      $('#n-order').value = i.n;
      return calculate(i.m, i.n);
    }
  }];
  for (const t of definitions) {
    try {
      Promise.resolve(registry.registerTool({
        ...t,
        annotations: {
          readOnlyHint: false,
          untrustedContentHint: false,
          ...t.annotations
        }
      }, {
        signal: controller.signal
      })).catch(() => {});
    } catch {}
  }
}
function saveProgress() {
  try {
    if (!persistSession(sessionStorage, state, records)) {
      document.getElementById('session-status').textContent = '当前窗口无法保存进度，请及时导出 CSV。';
    }
  } catch {
    document.getElementById('session-status').textContent = '当前窗口无法保存进度，请及时导出 CSV。';
  }
}
try {
  const saved = restoreSession(sessionStorage);
  if (saved) {
    Object.assign(state, saved.state);
    for (const [order, row] of saved.records) records.set(order, row);
    $('#wavelength').value = state.wavelength_nm;
    $('#true-radius').value = state.radius_mm;
  }
} catch { /* Browser storage can be unavailable; CSV remains usable. */ }
sync();
resize();
animate();
load();

installPlatformBridge({lab:'jcd3',ready:()=>ready,
 applyConditions:conditions=>{
   const next=applyNewtonConditions(state,conditions),complete=completedRecords(records);
   Object.assign(state,next);records.clear();for(const [order,row] of complete)records.set(order,row);
   $('#wavelength').value=state.wavelength_nm;$('#true-radius').value=state.radius_mm;
   resetResult('已带入二维条件；已完成环径保留，旧条件记录请另存档或重测。');sync();renderRecords();
 },
 read:()=>({state:{...state},records:[...records],selection:{m:Number($('#m-order').value),n:Number($('#n-order').value)}}),
 restore:data=>{Object.assign(state,data.state);records.clear();for(const [n,row]of data.records)records.set(n,row);$('#m-order').value=data.selection.m;$('#n-order').value=data.selection.n;$('#wavelength').value=state.wavelength_nm;$('#true-radius').value=state.radius_mm;resetResult();sync();renderRecords();calculate(data.selection.m,data.selection.n);},
 render:()=>{drawEye();(presentation?presentation.renderSnapshot():renderer.render(scene,camera));},eye:'#eyepiece'});

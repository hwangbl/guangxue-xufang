// Layout only: move existing nodes without cloning controls or reloading the lab.
const query = matchMedia('(max-width:767px), (pointer:coarse) and (max-height:500px) and (max-width:1024px)');
const folds = [], remembered = new WeakMap(), presentations = new Map();
const path = location.pathname.split('/').filter(Boolean);
const lab = path[path.indexOf('labs') + 1];
if (/MicroMessenger/i.test(navigator.userAgent)) document.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target.closest('button,a') : null;
  if (!target || !(target.matches('a[download]') || /导出|下载|保存高清画面|保存实验\s*JSON/.test(target.textContent ?? ''))) return;
  event.preventDefault(); event.stopImmediatePropagation();
  let message = document.querySelector('#mobile-download-message');
  if (!message) {message = document.createElement('p');message.id='mobile-download-message';message.setAttribute('role','alert');document.body.prepend(message);}
  message.textContent='微信内置浏览器可能限制文件下载。当前实验保持不变。不同浏览器的记录不会自动同步，请在外部浏览器完成实验并导出。';
  message.scrollIntoView({block:'start'});
}, true);
function syncPresentation() {
  for (const panel of document.querySelectorAll('#scene > .product-render-controls')) {
    if (!query.matches) continue;
    const anchor = document.createComment('mobile-render-controls'); panel.before(anchor);
    const slot = document.createElement('div'); slot.className = 'mobile-render-slot';
    panel.parentElement.after(slot); slot.append(panel); presentations.set(panel, {anchor, slot});
  }
  if (!query.matches) for (const [panel, {anchor, slot}] of presentations) {anchor.replaceWith(panel);slot.remove();presentations.delete(panel);}
}
function fold(target, title, nodes = [...target.children], initiallyOpen = false) {
  if (!nodes.length) return;
  const details = document.createElement('details'); details.className = 'mobile-lab-fold';
  details.open = remembered.get(target) ?? initiallyOpen;
  const summary = document.createElement('summary'); summary.textContent = title;
  const body = document.createElement('div'); body.className = 'mobile-lab-fold-body';
  const positions = nodes.map(node => {const anchor = document.createComment('mobile-layout-position'); node.before(anchor); return {node, anchor};});
  positions[0].anchor.before(details); details.append(summary, body);
  for (const node of nodes) body.append(node);
  if (!initiallyOpen) {
    const back = document.createElement('button'); back.type = 'button'; back.textContent = '返回观察区 ↑';
    back.onclick = () => (document.querySelector('#eye, #eyepiece, .observation-panel, #scene') ?? document.body).scrollIntoView({block:'start', behavior:'smooth'});
    body.append(back);
  }
  details.addEventListener('toggle', () => {remembered.set(target, details.open); window.dispatchEvent(new Event('resize'));});
  folds.push(() => {remembered.set(target, details.open); for (const {node, anchor} of positions) {anchor.replaceWith(node);} details.remove();});
}
function update() {
  while (folds.length) folds.pop()();
  document.documentElement.dataset.mobile = String(query.matches);
  syncPresentation();
  if (document.documentElement.dataset.layout === 'unified') {
    if (query.matches) {
      for (const target of document.querySelectorAll('.lab-below:is(.records-section,.records,.lab-records,.analysis,.notebook,.measurement)')) {
        fold(target, '实验记录与结果', [...target.children]);
      }
    }
    return;
  }
  if (!query.matches) return;
  for (const aside of document.querySelectorAll('main aside:not(.result-card), .adjustments')) {
    if (aside.closest('.mobile-lab-fold')) continue;
    let nodes = [...aside.children];
    if (lab === 'lens') nodes = nodes.slice(nodes.findIndex((node, i) => i > 0 && node.classList.contains('sectiontitle')));
    if (lab === 'jones') nodes = nodes.filter(node => !node.matches('#eye,#reading,strong,#save-render') && !node.querySelector('[data-view],#render-quality'));
    if (lab === 'michelson') nodes = nodes.filter(node => !node.matches('.bar,#eye,#state,.reading,.readout-note'));
    fold(aside, '实验参数', nodes);
  }
  for (const target of document.querySelectorAll('.notebook,.records-section,.analysis')) {
    if (!target.closest('.mobile-lab-fold')) fold(target, '实验记录', [...target.children], true);
  }
  // Jones keeps its notebook outside main without a class.
  if (lab === 'jones') {const target = document.querySelector('body > section'); if (target) fold(target, '实验记录', [...target.children], true);}
  window.dispatchEvent(new Event('resize'));
}
query.addEventListener('change', update); update();
window.addEventListener('wx-lab-layout-updated', update);
const scene = document.querySelector('#scene');
const presentationObserver = new MutationObserver(syncPresentation);
if (scene) presentationObserver.observe(scene, {childList:true});
function dispose() {query.removeEventListener('change', update);window.removeEventListener('wx-lab-layout-updated', update);presentationObserver.disconnect();while(folds.length) folds.pop()();}
window.addEventListener('wx-3d-dispose', dispose, {once:true});
window.addEventListener('pagehide', event => {if (!event.persisted) dispose();});

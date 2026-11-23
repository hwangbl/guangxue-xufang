export function placeMeasurementPanel(pane, lab) {
  if (document.documentElement.dataset.layout !== 'unified') return;
  const side = document.querySelector('.lab-side');
  const grid = pane.querySelector('.measure-grid');
  pane.classList.add('lab-below');
  if (lab === 'polarimeter') {
    grid.classList.add('lab-live-observation');
    side.prepend(grid);
    pane.querySelector('h2').textContent = '旋光测量记录';
  }
  if (lab === 'gaussian') {
    const spot = grid.firstElementChild;
    spot.classList.add('lab-live-observation');
    side.prepend(spot);
    side.append(pane.querySelector('#record'));
  }
  window.dispatchEvent(new Event('wx-lab-layout-updated'));
}

// Preserve the original controls and canvas nodes while sharing one workspace layout.
const html = document.documentElement;
const main = document.querySelector('main');
const scene = document.querySelector('#scene');
if (html.dataset.layout === 'unified' && main && scene && !main.querySelector('.lab-operation-row')) {
  const existingRow = main.querySelector(':scope > .workbench');
  let model = scene.parentElement;
  if (scene.parentElement === main) {
    model = document.createElement('section');
    scene.before(model);
    model.append(scene);
  }
  model.classList.add('lab-model');
  html.dataset.lab = location.pathname.split('/').filter(Boolean).at(-2);
  const row = existingRow || document.createElement('div');
  row.classList.add('lab-operation-row');
  const side = existingRow?.querySelector('.observation-panel') || document.createElement('aside');
  side.classList.add('lab-side');
  if (!existingRow) {
    const controls = main.querySelector(':scope > aside');
    const observation = main.querySelector(':scope > .observation');
    model.before(row);
    row.append(model, side);
    const planes = model.querySelector('.planes');
    if (observation) side.append(observation);
    if (planes) side.append(planes);
    if (controls && controls !== side) side.append(controls);
  }
  for (const node of main.children) {
    if (node !== row && node.matches('section,details')) node.classList.add('lab-below');
  }
  // Records in older modules are siblings of main.
  for (const node of document.querySelectorAll('body > section')) node.classList.add('lab-below', 'lab-records');
  for (const adjustments of side.querySelectorAll('details.adjustments')) adjustments.open = false;
  const plots = [...side.querySelectorAll('#profile,#curve,#fan')];
  if (plots.length) {
    const details = document.createElement('details');
    details.className = 'lab-extra-observation';
    const title = document.createElement('summary');
    title.textContent = '曲线与剖面';
    plots[0].before(details);
    details.append(title, ...plots);
    const legend = side.querySelector('#curve-legend');
    if (legend) details.append(legend);
    details.addEventListener('toggle', () => window.dispatchEvent(new Event('resize')));
  }

  if (html.dataset.lab === 'jcd3') {
    const summary = document.createElement('div');
    summary.className = 'lab-observation-summary';
    const eyepiece = side.querySelector('.eyepiece-wrap');
    eyepiece.before(summary);
    for (const node of side.querySelectorAll('.eyepiece-wrap,.view-state,.readout')) summary.append(node);
    const recordActions = document.createElement('div');
    recordActions.className = 'lab-primary-records';
    const order = document.querySelector('#ring-order').closest('label');
    recordActions.append(order, document.querySelector('#record-left'), document.querySelector('#record-right'));
    side.querySelector('.measure-controls').append(recordActions);
    side.querySelector('.adjustments').open = false;
  }

  const toolbar = model.querySelector(':scope > .panel-top,:scope > .stagebar,:scope > nav,:scope > .bar') || document.createElement('div');
  toolbar.classList.add('lab-model-tools');
  const expand = document.createElement('button');
  expand.type = 'button';
  expand.textContent = '放大模型区';
  expand.setAttribute('aria-label', '放大模型区');
  expand.setAttribute('aria-expanded', 'false');
  toolbar.append(expand);
  if (!toolbar.parentElement) model.prepend(toolbar);
  if (html.dataset.lab === 'jones') {
    const views = side.querySelector('[data-view]')?.parentElement;
    if (views) toolbar.prepend(views);
    const near = document.createElement('button');
    near.type = 'button';
    near.textContent = '适应画面';
    near.addEventListener('click', () => scene.dispatchEvent(new Event('wx-frame-instrument')));
    toolbar.prepend(near);
  }
  const originalStyle = {overflow: document.body.style.overflow};
  let expanded = false;
  let lastFocus = null;
  function setExpanded(value) {
    expanded = value;
    model.classList.toggle('lab-expanded', value);
    expand.textContent = value ? '返回工作台' : '放大模型区';
    expand.setAttribute('aria-label', value ? '返回工作台' : '放大模型区');
    expand.setAttribute('aria-expanded', String(value));
    if (value) lastFocus = document.activeElement;
    document.body.style.overflow = value ? 'hidden' : originalStyle.overflow;
    syncSize();
    window.dispatchEvent(new Event('resize'));
    if (!value && lastFocus?.isConnected) lastFocus.focus({preventScroll: true});
  }
  expand.addEventListener('click', () => setExpanded(!expanded));
  const escape = event => {
    if (event.key === 'Escape' && expanded && !document.querySelector('dialog[open]')) setExpanded(false);
  };
  window.addEventListener('keydown', escape);

  // Embed-aware screen height keeps a phone's model at 45% of the actual screen.
  function syncSize() {
    let screenHeight = window.visualViewport?.height || innerHeight;
    try {
      if (parent !== window) screenHeight = parent.visualViewport?.height || parent.innerHeight;
    } catch { /* Standalone cross-origin embeds use their own viewport. */ }
    html.style.setProperty('--lab-screen-height', screenHeight + 'px');
    html.style.setProperty('--lab-window-height', innerHeight + 'px');
    html.style.setProperty('--lab-window-width', innerWidth + 'px');
    // Keep the entire independently scrolling sidebar inside this iframe's viewport.
    const rowTop = Math.max(0, row.getBoundingClientRect().top);
    html.style.setProperty('--lab-side-height', Math.max(180, innerHeight - rowTop - 12) + 'px');
    if (!expanded) expand.textContent = innerWidth < 768 || screenHeight < 500 ? '放大' : '放大模型区';
  }
  syncSize();
  const layoutFrame = requestAnimationFrame(syncSize);
  const headerObserver = new ResizeObserver(syncSize);
  for (const header of document.querySelectorAll('body > header,main > .intro')) headerObserver.observe(header);
  window.addEventListener('resize', syncSize);
  window.visualViewport?.addEventListener('resize', syncSize);
  let parentWindow;
  try {
    if (parent !== window && parent.location.origin === location.origin) {
      parentWindow = parent;
      parentWindow.addEventListener('resize', syncSize);
      parentWindow.visualViewport?.addEventListener('resize', syncSize);
    }
  } catch { /* Cross-origin embedding keeps local resize handling. */ }
  const attributeObserver = new MutationObserver(syncSize);
  attributeObserver.observe(html, {attributes: true, attributeFilter: ['data-workbench']});
  function cleanup() {
    if (expanded) document.body.style.overflow = originalStyle.overflow;
    window.removeEventListener('resize', syncSize);
    window.removeEventListener('keydown', escape);
    window.visualViewport?.removeEventListener('resize', syncSize);
    parentWindow?.removeEventListener('resize', syncSize);
    parentWindow?.visualViewport?.removeEventListener('resize', syncSize);
    attributeObserver.disconnect();
    headerObserver.disconnect();
    cancelAnimationFrame(layoutFrame);
  }
  window.addEventListener('wx-3d-dispose', cleanup, {once: true});
  window.addEventListener('pagehide', event => {if (!event.persisted) cleanup();});
}

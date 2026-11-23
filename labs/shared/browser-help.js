// Keep an actionable message visible if the browser cannot create or retain
// the graphics context. This does not bypass browser restrictions.
(() => {
  let shown = false;
  function show(message) {
    if (shown) return;
    shown = true;
    const panel = document.createElement('section');
    panel.setAttribute('role', 'alert');
    panel.style.cssText = 'position:fixed;inset:16px 16px auto;z-index:10000;max-width:640px;margin:auto;padding:20px;background:#fff;color:#172234;border:1px solid #b9c7d6;border-radius:12px;box-shadow:0 8px 32px #17223422;font:16px/1.6 system-ui';
    const title = document.createElement('strong');
    title.textContent = '三维视图暂时无法显示';
    const text = document.createElement('p');
    text.textContent = message;
    const reload = document.createElement('button');
    reload.textContent = '重新加载实验';
    reload.style.cssText = 'padding:9px 14px;font:inherit;background:#203a51;color:white;border:0;border-radius:6px;cursor:pointer';
    reload.onclick = () => location.reload();
    panel.append(title, text, reload);
    (document.body || document.documentElement).append(panel);
    const lab = location.pathname.match(/\/labs\/([^/]+)\//)?.[1];
    if (lab && parent !== window) {
      parent.postMessage({type: `${lab}-failed`, version: 1, lab}, location.origin);
    }
  }
  const initializationError = value => {
    const message = String(value?.message || value || '');
    if (/Error creating WebGL context|WebGL 2 is not available|WebGL2 is not supported/i.test(message)) {
      show('请在 Safari 或 Chrome 中打开本页，并确认浏览器允许图形加速。实验直接在浏览器内运行，无需安装 Python。');
    }
  };
  window.addEventListener('error', event => initializationError(event.error || event.message));
  window.addEventListener('unhandledrejection', event => initializationError(event.reason));
  document.addEventListener('webglcontextlost', () => {
    show('浏览器的三维绘图连接已中断。请关闭暂时不用的三维页面，再重新加载当前实验。');
  }, true);
})();

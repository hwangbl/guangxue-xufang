// Loading the isolated experiment also catches unsupported WebGL/module errors.
import('./app.js').catch(error => {
  console.error(error);
  const message = document.getElementById('model-loading');
  if (message) {
    message.replaceChildren();
    const label = document.createElement('p');
    label.textContent = '三维实验加载失败，请检查设备的 WebGL 支持或重新加载。';
    message.append(label);
  }
  window.parent.postMessage({type:'jcd3-failed'}, window.location.origin);
});

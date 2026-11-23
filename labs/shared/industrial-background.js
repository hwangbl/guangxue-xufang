// E: one gradient shared by instrument scenes and embedded scientific 3D views.
export function createIndustrialBackgroundCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 768;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法创建三维背景');
  const gradient = context.createRadialGradient(70, 30, 0, 150, 100, 1050);
  gradient.addColorStop(0, '#8a8e96');
  gradient.addColorStop(.32, '#4b5059');
  gradient.addColorStop(.68, '#272c34');
  gradient.addColorStop(1, '#11151b');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

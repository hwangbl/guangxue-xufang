import {GLTFLoader as BaseGLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from './vendor/meshopt_decoder.mjs';

// Same instrument hierarchy and geometry, with lossless transport compression.
// Keeping this in the shared loader also covers loadAsync and accessory models.
export class GLTFLoader extends BaseGLTFLoader {
  constructor(manager) {
    super(manager);
    this.setMeshoptDecoder(MeshoptDecoder);
  }

  load(url, onLoad, onProgress, onError) {
    let previous = -1;
    const progress = onProgress || (event => {
      if (!event.lengthComputable || !event.total) return;
      const percent = Math.min(100, Math.floor(event.loaded / event.total * 100));
      if (percent === previous) return;
      previous = percent;
      const label = document.getElementById('loading') || document.getElementById('model-loading');
      if (label && !label.hidden) {
        label.textContent = percent < 100 ? `正在加载仪器模型… ${percent}%` : '正在准备三维仪器…';
      }
    });
    return super.load(url, onLoad, progress, onError);
  }
}

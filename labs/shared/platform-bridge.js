import {normalizePayload} from './archive.mjs?v=jones-20260929';
import {setLabVisibility,isLabDisposed,flushLabUpdates,flushLabSaves} from './lab-runtime.js';

export function installPlatformBridge({lab,ready,read,restore,render,eye,stop=()=>{},applyConditions,beforeCapture=()=>{}}) {
  let mode='guided';
  const helpers={'liquid-crystal':['#hints','#hint-label'],'polarization-scan':['#hints','#hint-label'],aberration:['#hints','#hint-label'],microscope:['#hints','#hint-label'],telescope:['#hints','#hint-label'],resonator:['#hints','#hint-label'],fiber:['#hints','#hint-label'],diffraction:['#hints','#hint-label'],jones:['#presets'],lens:['#focus','#rays','#ray-helper'],fourier:[],gaussian:[],polarimeter:['#teaching-settings'],jcd3:[],michelson:['#align','#assist'],spectrometer:['#align','#find-image','#find-minimum'],grating:['#align','#find','#normal']};
  function setMode(value) {
    if(!['guided','independent'].includes(value))throw Error('未知练习模式。');
    stop();mode=value;
    for(const selector of helpers[lab]){const el=document.querySelector(selector);if(!el)continue;el.hidden=mode==='independent';if(el.type==='checkbox'&&mode==='independent'){el.checked=false;el.dispatchEvent(new Event('change'));}}
    document.documentElement.dataset.practiceMode=mode;
  }
  async function capture() {
    stop();
    await beforeCapture();
    if(isLabDisposed())throw Error('实验已关闭。');
    flushLabSaves();
    const payload=normalizePayload(lab,read());
    render();
    window.dispatchEvent(new Event('wx-lab-capture'));
    const scene=document.querySelector('#scene canvas'), observation=document.querySelector(eye);
    if(!scene||!observation)throw Error('视图尚未就绪，请稍后重试。');
    const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=520;
    const c=canvas.getContext('2d');c.fillStyle='#edf3ef';c.fillRect(0,0,1200,520);
    c.fillStyle='#285f4e';c.font='20px sans-serif';c.fillText('仪器视图',20,30);c.fillText('目镜 / 观察屏',820,30);
    const fit=(source,x,y,w,h)=>{const scale=Math.min(w/source.width,h/source.height);const a=source.width*scale,b=source.height*scale;c.drawImage(source,x+(w-a)/2,y+(h-b)/2,a,b);};
    fit(scene,10,45,785,460);fit(observation,805,60,385,420);
    return {payload,image:canvas.toDataURL('image/png'),mode};
  }
  const receive=async event=>{
    if(event.origin!==location.origin||event.source!==parent)return;
    const m=event.data;
    if(m?.type!=='wx-3d-request'||m.version!==1||m.lab!==lab||typeof m.id!=='string'||m.id.length>80)return;
    const reply={type:'wx-3d-response',version:1,lab,id:m.id};
    try {
      if(isLabDisposed())throw Error('实验已关闭。');
      flushLabUpdates();
      if(m.action==='visibility'){
        if(typeof m.visible!=='boolean')throw Error('无效的视图可见状态。');
        if(!m.visible)stop();setLabVisibility(m.visible);reply.value={visible:m.visible};
      }
      else if(m.action==='quality'){
        if(!['auto','high','fast'].includes(m.quality))throw Error('无效的画质设置。');
        window.dispatchEvent(new CustomEvent('wx-lab-quality',{detail:{value:m.quality}}));reply.value={quality:m.quality};
      }
      else {
      if(!ready())throw Error('请等待模型加载完成。');
      if(m.action==='capture')reply.value=await capture();
      else if(m.action==='read')reply.value={payload:normalizePayload(lab,read()),mode};
      else if(m.action==='conditions') {
        if(!applyConditions)throw Error('此实验暂不支持参数带入。');
        applyConditions(m.conditions);
        reply.value={payload:normalizePayload(lab,read()),mode};
      }
      else if(m.action==='suspend'){stop();reply.value={stopped:true};}
      else if(m.action==='focus') {
        const views={'liquid-crystal':{overall:'#overall',primary:'#driver-view',secondary:'#section-view'},'polarization-scan':{overall:'#overall',primary:'#sample-view',secondary:'#analyzer-view'},aberration:{overall:'#overall',primary:'#iris-view',secondary:'#screen-view'},microscope:{overall:'#overall',primary:'#stage-view',secondary:'#focus-view'},telescope:{overall:'#overall',primary:'#eye-view',secondary:'#side-view'},resonator:{overall:'#overall',primary:'#mirror-view',secondary:'#side-view'},fiber:{overall:'#overall',primary:'#coupler-view',secondary:'#detector-view'},diffraction:{overall:'#overall',primary:'#wheel-view',secondary:'#screen-view'},jones:{overall:'[data-view=overview]',primary:'[data-view=detail]',secondary:'[data-view=top]'},lens:{overall:'#overall',primary:'#side',secondary:'#screen-view'},gaussian:{overall:'[data-view="overall"]',primary:'[data-view="lens"]',secondary:'[data-view="screen"]'},polarimeter:{overall:'[data-view="overall"]',primary:'[data-view="front"]',secondary:'[data-view="tube"]'},spectrometer:{overall:'[data-view="hero"]',primary:'[data-view="vernier"]',secondary:'[data-view="prism"]'},grating:{overall:'[data-view="hero"]',primary:'[data-view="grating"]',secondary:'[data-view="top"]'},michelson:{overall:'#home',primary:'#mirror-view',secondary:'#screen-view'},fourier:{overall:'#overall',primary:'#filter-view',secondary:'#overall'}};
        const selector=Object.hasOwn(views[lab]||{},m.target)?views[lab][m.target]:null;
        const button=selector&&document.querySelector(selector);
        if(!button)throw Error('此观察视角暂不可用。');
        button.click();reply.value={focused:m.target};
      }
      else if(m.action==='restore') {
        const clean=normalizePayload(lab,m.payload);
        if(!['guided','independent'].includes(m.mode))throw Error('未知练习模式。');
        stop();restore(clean);setMode(m.mode);reply.value={restored:true};
      } else if(m.action==='mode'){setMode(m.mode);reply.value={mode};}
      else throw Error('不支持的操作。');
      }
    } catch(error){reply.error=error.message||'操作失败。';}
    parent.postMessage(reply,location.origin);
  };
  window.addEventListener('message',receive);
  const suspend=()=>stop();
  window.addEventListener('wx-lab-suspend',suspend);
  // Stop active motion before navigating away; old frames cannot answer a new frame's requests.
  function dispose(){stop();window.removeEventListener('wx-lab-suspend',suspend);window.removeEventListener('message',receive);window.removeEventListener('pagehide',dispose);window.removeEventListener('wx-3d-dispose',dispose);}
  window.addEventListener('pagehide',dispose,{once:true});
  window.addEventListener('wx-3d-dispose',dispose,{once:true});
}

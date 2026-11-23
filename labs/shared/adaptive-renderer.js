import {EffectComposer} from '../jones/vendor/postprocessing/EffectComposer.js';
import {RenderPass} from '../jones/vendor/postprocessing/RenderPass.js';
import {SSAOPass} from '../jones/vendor/postprocessing/SSAOPass.js';
import {OutputPass} from '../jones/vendor/postprocessing/OutputPass.js';
import {addLabCleanup,isLabVisible,isLabDisposed,invalidateLab} from './lab-runtime.js';

/** Defer expensive render targets until high quality is actually requested. */
export function createQualityRenderer(scene,camera,renderer,host,{scale=1,filename='光学实验-精细渲染.png',initialQuality='fast'}={}){
 let composer=null,ao=null,renderPass=null,output=null,width=1,height=1,mode='auto',quality='fast',frame=0,disposed=false,capturing=false,lastFrame=0,lastSwitch=performance.now(),sampleStart=0,activeUntil=0;
 let samples=[],dragging=false;
 const storageKey='wx-render-quality-v1:'+location.pathname;
 try{const saved=localStorage.getItem(storageKey);if(['auto','high','fast'].includes(saved))mode=saved;}catch{}
 quality=mode==='high'||(mode==='auto'&&initialQuality==='high')?'high':'fast';
 function highPipeline(){if(composer)return;composer=new EffectComposer(renderer);composer.renderTarget1.samples=4;composer.renderTarget2.samples=4;renderPass=new RenderPass(scene,camera);ao=new SSAOPass(scene,camera,1,1,16);ao.kernelRadius=.012*scale;ao.minDistance=.0002*scale;ao.maxDistance=.06*scale;output=new OutputPass();composer.addPass(renderPass);composer.addPass(ao);composer.addPass(output);composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(width,height);}
 function size(){if(disposed||isLabDisposed()||!host.clientWidth||!host.clientHeight)return;host.dataset.renderQuality=quality;host.dataset.renderMode=mode;width=host.clientWidth;height=host.clientHeight;const ratio=Math.min(devicePixelRatio,quality==='high'?2:1);renderer.shadowMap.enabled=quality==='high';renderer.setPixelRatio(ratio);renderer.setSize(width,height,false);if(composer){composer.setPixelRatio(ratio);composer.setSize(width,height);}}
 function adapt(time,submit){
  const gap=time-lastFrame;lastFrame=time;
  if(mode!=='auto'||(!dragging&&time>activeUntil)){samples=[];sampleStart=0;return;}
  if(!sampleStart)sampleStart=time;samples.push({gap,submit});
  if(time-sampleStart<2000||samples.length<(quality==='high'?6:30)||time-lastSwitch<8000)return;
  const p95=key=>samples.map(s=>s[key]).sort((a,b)=>a-b)[Math.floor(samples.length*.95)];
  const next=quality==='high'&&(p95('gap')>40||p95('submit')>25)?'fast':quality==='fast'&&p95('gap')<23&&p95('submit')<8?'high':quality;
  samples=[];sampleStart=0;if(next!==quality){quality=next;lastSwitch=time;size();invalidateLab();}
 }
 function renderNow(force=false){
  if(disposed||isLabDisposed()||capturing||!host.clientWidth||!host.clientHeight||(!force&&!isLabVisible()))return;
  const start=performance.now();if(quality==='high'){highPipeline();composer.render();}else renderer.render(scene,camera);adapt(start,performance.now()-start);
 }
 function render(){if(frame||disposed||capturing||!isLabVisible())return;frame=requestAnimationFrame(()=>{frame=0;renderNow();});}
 function cancel(){if(frame)cancelAnimationFrame(frame);frame=0;samples=[];sampleStart=0;lastFrame=0;dragging=false;}
 function setQuality(value){if(!['auto','high','fast'].includes(value))throw Error('无效的画质设置。');mode=value;quality=value==='high'?'high':'fast';lastSwitch=performance.now();cancel();size();try{localStorage.setItem(storageKey,value);}catch{}window.dispatchEvent(new CustomEvent('wx-lab-quality-changed',{detail:{value}}));render();}
 const interaction=()=>{activeUntil=performance.now()+250;};
 const down=()=>{dragging=true;interaction();},up=()=>{dragging=false;interaction();};
 const captureFrame=()=>renderNow(true);
 const setFromBridge=e=>setQuality(e.detail.value);
 for(const event of ['pointermove','pointerdown','wheel','input'])document.addEventListener(event,interaction,{passive:true});
 document.addEventListener('pointerdown',down,{passive:true});document.addEventListener('pointerup',up,{passive:true});document.addEventListener('pointercancel',up,{passive:true});
 window.addEventListener('wx-lab-suspend',cancel);window.addEventListener('wx-lab-resume',render);window.addEventListener('wx-lab-capture',captureFrame);window.addEventListener('wx-lab-quality',setFromBridge);
 function dispose(){if(disposed)return;disposed=true;cancel();ao?.dispose();renderPass?.dispose();output?.dispose();composer?.dispose();for(const event of ['pointermove','pointerdown','wheel','input'])document.removeEventListener(event,interaction);document.removeEventListener('pointerdown',down);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',up);window.removeEventListener('wx-lab-suspend',cancel);window.removeEventListener('wx-lab-resume',render);window.removeEventListener('wx-lab-capture',captureFrame);window.removeEventListener('wx-lab-quality',setFromBridge);}
 addLabCleanup(dispose);size();
 return {dispose,resize:size,render,renderNow:()=>renderNow(true),setQuality,getQuality:()=>mode,async capture(){
  if(disposed||isLabDisposed())throw Error('三维视图已关闭。');if(capturing)throw Error('高清画面正在生成。');capturing=true;cancel();
  try{highPipeline();const ratio=Math.min(3,4096/Math.max(width,height));renderer.shadowMap.enabled=true;renderer.setPixelRatio(ratio);renderer.setSize(width,height,false);composer.setPixelRatio(ratio);composer.setSize(width,height);composer.render();const blob=await new Promise(resolve=>renderer.domElement.toBlob(resolve,'image/png'));if(!blob)throw Error('截图生成失败');if(disposed||isLabDisposed())throw Error('三维视图已关闭。');const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);return {width:renderer.domElement.width,height:renderer.domElement.height};}finally{capturing=false;if(!disposed&&!isLabDisposed()){size();render();}}
 }};
}

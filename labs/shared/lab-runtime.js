// Shared lifetime for a single instrument iframe. Physics and measurement clocks stay in each lab.
import {createDeferredSessionStore} from './deferred-session.mjs';
let disposed=false,selected=true,until=0,frame=0,nextId=0;
const pending=new Map(),cleanups=new Set(),sources=new Map(),scenes=new WeakSet();
let sessionStore=null;
function sessions(){
 if(!sessionStore)sessionStore=createDeferredSessionStore(globalThis.sessionStorage,{reportError:()=>{const message=document.querySelector('#session-status,#message,#feedback,#record-message');if(message)message.textContent='自动暂存未成功，请保持窗口并导出实验档案或CSV。';}});
 return sessionStore;
}
export const labSessionStorage={getItem:key=>sessions().getItem(key),setItem:(key,value)=>{sessions().setItem(key,value);if(disposed||!isLabVisible())sessions().flush();},removeItem:key=>sessions().removeItem(key),clear:()=>sessions().clear()};
export const flushLabSaves=()=>sessionStore?.flush()??true;
let updateFrame=0;
const updates=new Map();
/** Evaluate arguments at input time; commit only the last update for each handler per frame. */
export function queueLabChange(change,...args){
 if(disposed)return;updates.set(change,args);
 if(!updateFrame&&isLabVisible())updateFrame=requestAnimationFrame(flushLabUpdates);
}
export function flushLabUpdates(){
 if(updateFrame)cancelAnimationFrame(updateFrame);updateFrame=0;
 const work=[...updates];updates.clear();for(const [change,args] of work)change(...args);
}
const now=()=>performance.now();
export const isLabDisposed=()=>disposed;
export const isLabVisible=()=>!disposed&&selected&&!globalThis.document?.hidden;
const moving=()=>[...sources.values()].some(test=>test());
function schedule(){if(!frame&&pending.size&&isLabVisible()&&(now()<until||moving()))frame=requestAnimationFrame(tick);}
function tick(time){frame=0;if(!isLabVisible())return;const work=[...pending.values()];pending.clear();for(const fn of work){if(disposed)break;fn(time);}schedule();}
export function invalidateLab(){if(disposed)return;until=now()+180;schedule();}
/** The recursive lab callback is retained while idle and awakened by interaction or visibility. */
export function scheduleLabFrame(fn,continuous=()=>false){
 if(disposed)return 0;const id=++nextId;pending.set(id,fn);sources.set(fn,continuous);schedule();return id;
}
export function setLabAnimationLoop(renderer,fn){
 if(!fn){pending.clear();sources.clear();return;}
 function loop(time){fn(time);scheduleLabFrame(loop);}
 scheduleLabFrame(loop);invalidateLab();
}
export function addLabCleanup(fn){if(disposed){fn();return()=>{};}cleanups.add(fn);return()=>cleanups.delete(fn);}
export function setLabVisibility(value){
 if(typeof value!=='boolean')throw Error('无效的视图可见状态。');
 flushLabUpdates();
 flushLabSaves();
 selected=value;
 if(!isLabVisible()){if(frame)cancelAnimationFrame(frame);frame=0;window.dispatchEvent(new Event('wx-lab-suspend'));}
 else{invalidateLab();window.dispatchEvent(new Event('wx-lab-resume'));}
}
export class LabResizeObserver {
 constructor(callback){this.observer=new ResizeObserver((entries)=>{if(isLabVisible()&&entries.some(e=>e.contentRect.width>0&&e.contentRect.height>0)){callback(entries,this);invalidateLab();}});addLabCleanup(()=>this.disconnect());}
 observe(...args){this.observer.observe(...args);}
 unobserve(...args){this.observer.unobserve(...args);}
 disconnect(){this.observer.disconnect();}
}
export function disposeLabTree(root){
 const resources=new Set();root?.traverse(o=>{if(o.isInstancedMesh)resources.add(o);if(o.geometry)resources.add(o.geometry);if(o.shadow)resources.add(o.shadow);for(const m of Array.isArray(o.material)?o.material:[o.material]){if(!m)continue;resources.add(m);for(const value of Object.values(m))if(value?.isTexture)resources.add(value);}});
 if(root?.environment)resources.add(root.environment);if(root?.background?.isTexture)resources.add(root.background);
 for(const resource of resources)resource.dispose();
}
export function manageLabScene({renderer,scene,controls,release=true}){
 if(scenes.has(renderer))return;scenes.add(renderer);
 controls?.addEventListener('change',invalidateLab);
 addLabCleanup(()=>{controls?.removeEventListener('change',invalidateLab);if(release){controls?.dispose();renderer.setAnimationLoop(null);disposeLabTree(scene);renderer.dispose();renderer.forceContextLoss();}});
 invalidateLab();
}
export function disposeLab(){
 if(disposed)return;flushLabUpdates();sessionStore?.dispose();disposed=true;if(frame)cancelAnimationFrame(frame);frame=0;pending.clear();sources.clear();
 for(const event of events)document.removeEventListener(event,invalidateLab,true);
 for(const event of flushEvents)document.removeEventListener(event,flushLabUpdates,true);
 document.removeEventListener('visibilitychange',visibility);
 window.removeEventListener('pagehide',disposeLab);window.removeEventListener('wx-3d-dispose',disposeLab);
 // Dependents (postprocessing targets) are released before the renderer/context.
 for(const fn of [...cleanups].reverse()){try{fn();}catch(error){console.error('实验资源释放失败',error);}}cleanups.clear();
}
const events=['pointerdown','pointermove','pointerup','wheel','keydown','input','change','click'];
const flushEvents=['pointerup','pointercancel','lostpointercapture','click','change'];
function visibility(){setLabVisibility(selected);}
if(typeof document!=='undefined'){
 for(const event of events)document.addEventListener(event,invalidateLab,true);
 for(const event of flushEvents)document.addEventListener(event,flushLabUpdates,true);
 document.addEventListener('visibilitychange',visibility);
 window.addEventListener('pagehide',disposeLab,{once:true});window.addEventListener('wx-3d-dispose',disposeLab,{once:true});
 invalidateLab();
}

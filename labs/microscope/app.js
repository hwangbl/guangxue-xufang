import {labSessionStorage as sessionStorage} from '../shared/lab-runtime.js';
import {queueLabChange,manageLabScene,LabResizeObserver,scheduleLabFrame,setLabAnimationLoop,isLabDisposed,disposeLabTree,addLabCleanup} from '../shared/lab-runtime.js';
import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from '../shared/optimized-gltf-loader.js';
import {installProductPresentation} from '../shared/product-presentation.js';
import {addExperimentTable,frameExperimentTable} from '../shared/experiment-table.js';
import {installPlatformBridge} from '../shared/platform-bridge.js';
import {installPartDrag} from '../shared/part-drag.js?v=20261117-scroll';
import {applyConditions} from './conditions.mjs';
import {MODEL,fresh,normalize,changeSettings,simulate,specimenPoint,record,report} from './physics.mjs';
import {paintRuler,paintPoints} from './observation.mjs';
const $=id=>document.getElementById(id),SESSION='wx-microscope-session-v1';
let state=fresh(),model,presentation,loaded=false,disposed=false,drawTimer=0,drag=null,lastView='overall',initialMessage='先预测，再观察调焦两侧的变化。';
try{const raw=sessionStorage.getItem(SESSION);if(raw){const v=JSON.parse(raw);if(v.version!==1)throw Error();state=normalize(v.state);}}catch{initialMessage='临时状态无法恢复，请导入实验JSON。原临时数据尚未改写。';}
const scene=new T.Scene(),renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.outputColorSpace=T.SRGBColorSpace;$('scene').append(renderer.domElement);
const camera=new T.PerspectiveCamera(35,1,.001,10),controls=new OrbitControls(camera,renderer.domElement);manageLabScene({renderer,scene,controls:controls,release:false});controls.minDistance=.07;controls.maxDistance=2;controls.maxPolarAngle=Math.PI*.49;
function disposeTree(root){const textures=new Set();root.traverse(o=>{o.geometry?.dispose();o.shadow?.dispose();for(const m of(Array.isArray(o.material)?o.material:[o.material])){if(!m)continue;for(const v of Object.values(m))if(v?.isTexture)textures.add(v);m.dispose();}});for(const t of textures)t.dispose();}
function render(){if(disposed||!loaded||document.hidden||!$('scene').clientWidth)return;clearTimeout(drawTimer);presentation?.render();drawTimer=setTimeout(()=>{if(!disposed&&!document.hidden&&$('scene').clientWidth)presentation?.render();},45);}
function view(which){lastView=which;if(which==='overall'){controls.target.set(0,.18,0);const half=Math.atan(Math.tan(T.MathUtils.degToRad(17.5))*Math.min(camera.aspect,1));camera.position.copy(controls.target).addScaledVector(new T.Vector3(.8,.35,1).normalize(),.23/Math.sin(half));}else if(which==='stage'){controls.target.set(0,.167,.02);camera.position.set(.20,.24,.27);}else{controls.target.set(.055,.11,-.07);camera.position.set(.26,.16,.13);}if(which==='overall')frameExperimentTable(scene,camera,controls);controls.update();render();}
for(const [id,v] of [['overall','overall'],['stage-view','stage'],['focus-view','focus']])$(id).onclick=()=>view(v);
function resize(){const r=$('scene').getBoundingClientRect();if(!r.width||!r.height||disposed)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();render();}
const observer=new LabResizeObserver(resize);observer.observe($('scene'));controls.addEventListener('change',render);
let observationKey='';
function update(persist=false){const r=simulate(state);
 for(const key of ['task','objective','sample','focusUm','stageXUm','stageYUm','prediction','conclusion'])if(document.activeElement!==$(key))$(key).value=state[key];$('focus-slider').value=state.focusUm;$('hints').checked=state.hints;
 $('magnification').textContent=r.totalMagnification.toFixed(1)+'×';$('focus-readout').textContent=state.focusUm.toFixed(1);$('field-readout').textContent=r.fieldUm.toFixed(1);
 $('reason').textContent=`物镜前端与样品间隙 ${r.workingGapMm.toFixed(4)} mm。改变物镜后应观察并重新确认调焦。`;
 $('instruction').textContent={focus:'记录焦点附近至少三个调焦位置；比较低倍与高倍的清晰范围。',measure:'选刻线样品，调清后在观察窗点击两点。建议跨多条刻线测量，再除以间隔数。',resolution:'选双点样品，对照10×/40×与不同调焦位置。放大窗锁定样品中心，尺度固定。'}[state.task];
 $('hint-text').textContent=state.hints?`理想焦点偏移0 μm；瑞利参考 ${r.rayleighUm.toFixed(3)} μm，Abbe参考 ${r.abbeUm.toFixed(3)} μm。`:'理论参考关闭；使用提示的标记会保留。';
 if(model){model.getObjectByName('FocusStage').position.y=.150+state.focusUm*1e-6;const xy=model.getObjectByName('SlideXY');xy.position.x=state.stageXUm*1e-6;xy.position.z=-state.stageYUm*1e-6;
  model.getObjectByName('Objective_low').visible=state.objective==='low';model.getObjectByName('Objective_high').visible=state.objective==='high';for(const name of ['FocusKnob','FocusKnobLeft'])model.getObjectByName(name).rotation.x=state.focusUm*Math.PI/20;
 }
 const key=JSON.stringify([state.objective,state.focusUm,state.stageXUm,state.stageYUm,state.sample,state.picks]);
 if(key!==observationKey){observationKey=key;if(state.sample==='ruler')paintRuler($('eye'),state);else paintPoints($('eye'),state);}
 $('observation-title').textContent=state.sample==='ruler'?'完整目镜视场':'双点放大观察';$('observation-scale').textContent=state.sample==='ruler'?`宽、高 ${r.fieldUm.toFixed(2)} μm`:'宽、高均4 μm · 两点间距0.8 μm';
 $('observation-note').textContent=state.sample==='ruler'?'10 μm周期刻线；蓝色虚线为样品原点注记。低倍屏幕可能无法逐条分辨，请换高倍。手动选点精度受屏幕像素限制。':'此窗是锁定样品中心的固定尺度分析放大窗，不是目镜完整视场；XY移动不会移动此细节窗，不能在此测量刻线。';
 $('clear-picks').disabled=state.sample!=='ruler'||!state.picks.length;
 if(state.picks.length===2){const a=specimenPoint(state,state.picks[0].nx,state.picks[0].ny),b=specimenPoint(state,state.picks[1].nx,state.picks[1].ny);$('measurement').textContent=`手动两点距离 ${Math.hypot(a.xUm-b.xUm,a.yUm-b.yUm).toFixed(3)} μm`;}else $('measurement').textContent=state.sample==='ruler'?`已选${state.picks.length}点；两点距离换算到实际物方尺度。`:'双点任务记录当前物镜与调焦条件。';
 const data=report(state);$('columns').replaceChildren(...data.columns.map(v=>{const e=document.createElement('th');e.textContent=v;return e;}));$('rows').replaceChildren(...data.rows.map(row=>{const tr=document.createElement('tr');for(const v of row){const td=document.createElement('td');td.textContent=v;tr.append(td);}return tr;}));$('count').textContent=state.records.length;$('empty').hidden=!!state.records.length;$('undo').disabled=!state.records.length;$('record').disabled=!loaded;$('statistics').textContent=data.summaries[0];render();
 if(persist)try{sessionStorage.setItem(SESSION,JSON.stringify({version:1,state}));}catch{$('message').textContent='临时保存失败，请导出实验JSON。';}
}
function change(p,message='当前条件已更新，历史记录保留。'){try{state=changeSettings(state,p);update(true);$('message').textContent=message;}catch(e){$('message').textContent=e.message;for(const key of Object.keys(p))if($(key))$(key).value=state[key];}}
for(const key of ['focusUm','stageXUm','stageYUm']){$(key).onchange=()=>change({[key]:$(key).value.trim()?Number($(key).value):NaN});$(key).onkeydown=e=>{if(e.key==='Enter')$(key).blur();};}
for(const key of ['objective','sample','prediction','conclusion'])$(key).onchange=()=>change({[key]:$(key).value});
$('task').onchange=()=>change({task:$('task').value,...($('task').value==='resolution'?{sample:'points'}:$('task').value==='measure'?{sample:'ruler'}:{})});
$('hints').onchange=()=>change({hints:$('hints').checked});$('focus-slider').oninput=()=>change({focusUm:Number($('focus-slider').value)});
const nudge=step=>change({focusUm:Math.max(-20,Math.min(20,state.focusUm+step))});document.querySelectorAll('[data-focus]').forEach(b=>b.onclick=()=>nudge(Number(b.dataset.focus)));
$('eye').onclick=e=>{if(state.sample!=='ruler')return;const r=$('eye').getBoundingClientRect();change({picks:[...(state.picks.length<2?state.picks:[]),{nx:(e.clientX-r.left)/r.width-.5,ny:(e.clientY-r.top)/r.height-.5}]});};$('clear-picks').onclick=()=>change({picks:[]});
$('record').onclick=()=>{try{state=record(state);update(true);$('message').textContent='已记录当前条件与原始选点。';}catch(e){$('message').textContent=e.message;}};$('undo').onclick=()=>change({records:state.records.slice(0,-1)});
function download(content,type,name){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('save').onclick=()=>download(JSON.stringify({version:1,lab:'microscope',model:MODEL,state:normalize(state)},null,2),'application/json','显微镜实验.json');$('csv').onclick=()=>{const d=report(state),quote=v=>'"'+String(v).replaceAll('"','""')+'"';download('\ufeff'+[d.columns,...d.rows].map(row=>row.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8','显微镜测量.csv');};
$('restore').onclick=()=>$('file').click();$('file').onchange=async()=>{const f=$('file').files[0];if(!f)return;try{if(f.size>2e6)throw Error('档案超过2 MB。');const v=JSON.parse(await f.text());if(v.version!==1||v.lab!=='microscope'||v.model!==MODEL)throw Error('身份或版本不支持。');state=normalize(v.state);update(true);$('message').textContent='实验已恢复。';}catch(e){$('message').textContent='导入失败：'+e.message;}finally{$('file').value='';}};
const caster=new T.Raycaster(),pointer=new T.Vector2();
renderer.domElement.addEventListener('pointerdown',e=>{if(!loaded||e.button!==0)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);camera.updateMatrixWorld();model.updateMatrixWorld(true);caster.setFromCamera(pointer,camera);
 let hit=caster.intersectObject(model,true).find(h=>{let n=h.object;while(n){if(!n.visible)return false;n=n.parent;}return true;})?.object;while(hit&&!['FocusKnob','FocusKnobLeft','SlideXY','StageXControl','StageYControl'].includes(hit.name))hit=hit.parent;if(!hit)return;
 drag={id:e.pointerId,x:e.clientX,y:e.clientY,focus:state.focusUm,sx:state.stageXUm,sy:state.stageYUm,kind:hit.name};controls.enabled=false;renderer.domElement.setPointerCapture(e.pointerId);e.stopImmediatePropagation();$('scene').focus();},true);
renderer.domElement.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y,limit=v=>Math.round(Math.max(-500,Math.min(500,v)));
 if(drag.kind.startsWith('Focus'))queueLabChange(change,{focusUm:Math.round(Math.max(-20,Math.min(20,drag.focus-dy*.1))*10)/10},'旋钮灵敏度0.1 μm/像素；机构实际行程保持微米尺度。');
 else queueLabChange(change,{stageXUm:drag.kind==='StageYControl'?drag.sx:limit(drag.sx+dx*2),stageYUm:drag.kind==='StageXControl'?drag.sy:limit(drag.sy-dy*2)},'样品移动：拖动灵敏度2 μm/像素。');
});
function stop(){if(drag&&renderer.domElement.hasPointerCapture(drag.id))renderer.domElement.releasePointerCapture(drag.id);drag=null;controls.enabled=true;if(disposed||document.hidden)clearTimeout(drawTimer);}
installPartDrag({renderer,camera,controls,model:()=>model,resolvePart(object){
 let node=object;while(node&&node.name!=='ObjectiveTurret')node=node.parent;if(!node)return null;
 return {click:()=>change({objective:state.objective==='low'?'high':'low'},'物镜已切换；请重新确认调焦，已有记录保留。')};
}});
renderer.domElement.title='点击物镜转换器切换10×/40×；拖动调焦旋钮和载物台进行调节。';
const turretHint=document.createElement('p');turretHint.className='fine';turretHint.textContent=renderer.domElement.title;$('scene').after(turretHint);
for(const ev of ['pointerup','pointercancel','lostpointercapture'])renderer.domElement.addEventListener(ev,stop);$('scene').onkeydown=e=>{if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();nudge((e.key==='ArrowUp'?1:-1)*(e.shiftKey?5:.5));}};
installPlatformBridge({lab:'microscope',ready:()=>loaded,read:()=>({state}),restore:p=>{state=normalize(p.state);update(true);},render:()=>{update();renderer.render(scene,camera);},eye:'#eye',stop,applyConditions:c=>{state=applyConditions(state,c);update(true);}});
new GLTFLoader().load('./assets/microscope.glb',g=>{if(isLabDisposed()){disposeLabTree(g.scene);return;}if(disposed){disposeTree(g.scene);return;}model=g.scene;scene.add(model);model.getObjectByName('Objective_high').visible=state.objective==='high';model.getObjectByName('Objective_low').visible=state.objective==='low';addExperimentTable(scene,model);presentation=installProductPresentation({scene,camera,renderer,model,controls,name:'microscope'});loaded=true;$('loading').hidden=true;resize();update();parent.postMessage({type:'microscope-ready',version:1,lab:'microscope'},location.origin);},undefined,()=>{if(!disposed){$('loading').textContent='模型加载失败，请重新打开实验。';parent.postMessage({type:'microscope-failed',version:1,lab:'microscope'},location.origin);}});
function dispose(){if(disposed)return;disposed=true;loaded=false;stop();observer.disconnect();controls.dispose();presentation?.dispose();disposeTree(scene);scene.environment?.dispose();scene.background?.dispose?.();renderer.dispose();renderer.forceContextLoss();window.removeEventListener('pagehide',dispose);window.removeEventListener('wx-3d-dispose',dispose);}
window.addEventListener('pagehide',dispose,{once:true});window.addEventListener('wx-3d-dispose',dispose,{once:true});document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else render();});view('overall');update();$('message').textContent=initialMessage;

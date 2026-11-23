import {labSessionStorage,manageLabScene,LabResizeObserver,scheduleLabFrame,setLabAnimationLoop,isLabDisposed,disposeLabTree,addLabCleanup,queueLabChange} from '../shared/lab-runtime.js';
import {installPartDrag} from '../shared/part-drag.js?v=20261117-scroll';
import {installRenderBenchmark} from '../shared/render-benchmark.js';
import {installInstrumentFraming} from '../shared/instrument-framing.js';
import {setupProductStudio,finishPolarizationModel,createQualityRenderer} from './product-studio.js';
import {addExperimentTable,frameExperimentTable} from '../shared/experiment-table.js';
import {applyConditions} from './conditions.mjs?v=jones-20260929';
import {setupExtensions,drawMicroscope} from './extensions.js?v=jones-20260929';
import {fresh,normalize,simulate,record,report} from './physics.mjs?v=jones-20260929';
import {installPlatformBridge} from '../shared/platform-bridge.js?v=jones-20260929';
let state=fresh();
const sessionKey='wx-jones-session-v1';
try{const raw=labSessionStorage.getItem(sessionKey);if(raw){const saved=JSON.parse(raw);if(saved.version!==1||saved.lab!=='jones')throw Error('不支持的暂存版本');state=normalize(saved.state);}}catch{document.getElementById('message').textContent='暂存无法恢复，已使用初始条件；已导出档案保持不变。';}
function saveSession(){try{labSessionStorage.setItem(sessionKey,JSON.stringify({version:1,lab:'jones',state}));}catch{document.getElementById('message').textContent='自动暂存不可用，请导出实验档案。';}}
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from '../shared/optimized-gltf-loader.js';
const container=document.getElementById('scene'),status=document.getElementById('status');
const scene=new THREE.Scene();scene.background=new THREE.Color('#353B44');
const camera=new THREE.PerspectiveCamera(34,1,.01,10),renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;container.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);manageLabScene({renderer,scene,controls:controls});controls.minDistance=.15;controls.maxDistance=3;controls.maxPolarAngle=Math.PI*.49;controls.enableDamping=false;
const floor=setupProductStudio(scene,renderer);
let productFinish, framing, framedMode;
let model=null;const nodes={},ids={p:'PolarizerRotor',r:'RetarderRotor',a:'AnalyzerRotor'};
const extensionUI=setupExtensions(scene,change);
const qualityRenderer=createQualityRenderer(scene,camera,renderer,container);
const qualitySelect=document.getElementById('render-quality');qualitySelect.insertAdjacentHTML('afterbegin','<option value="auto">自动</option>');qualitySelect.value=qualityRenderer.getQuality();
const syncQuality=e=>{qualitySelect.value=e.detail.value;};window.addEventListener('wx-lab-quality-changed',syncQuality);addLabCleanup(()=>window.removeEventListener('wx-lab-quality-changed',syncQuality));
installRenderBenchmark({camera,controls,quality:qualityRenderer,host:container,renderer});
const render=()=>qualityRenderer.render();controls.addEventListener('change',render);
function view(id){const target=id==='detail'?[.76,.1,.04]:[.6,.08,0];controls.target.set(...target);camera.position.set(...({overview:[.05,.72,1.6],bench:[.23,.53,1.35],rear:[1.35,.6,-1.05],top:[.6,1.5,.001],detail:[.49,.34,.4]}[id]));if(id==='overview')frameExperimentTable(scene,camera,controls);controls.update();render();}
function resize(){const {width,height}=container.getBoundingClientRect();camera.aspect=width/height;camera.updateProjectionMatrix();qualityRenderer.resize();render();}new LabResizeObserver(resize).observe(container);
function update(){
 const nextMode=state.extension?.mode||'bench';
 if(framing&&nextMode!==framedMode){framedMode=nextMode;requestAnimationFrame(()=>framing.frameInstrument());}
 saveSession();
 document.getElementById('bench-presets').hidden=!!state.extension;
 document.getElementById('experiment-title').textContent=state.extension?'调节光学条件，对照偏振计算。':'旋转偏振器，观察光的变化。';
 document.getElementById('record-help').textContent=state.extension?'每条读数保存当时的完整条件；不同模式分别记录，不连成同一条角度曲线。完整条件可在平台“实验工具 → 数据与报告”查看。':'同一组条件下改变检偏角，逐点记录；改变波长或波片条件后自动分组。档案与导出在平台“实验工具”中。';
 document.getElementById('mode-description').textContent=state.extension?'扩展光路与二维共享计算。I₀为本模式入射强度；示意元件不具有已标定的实物尺寸。':'起偏器 → 140 nm延迟片 → 检偏器。角度从水平轴起算，I₀为起偏器后的强度。';
 const q=simulate(state);productFinish?.update(state,q.intensity);extensionUI.update(state.extension);if(model)model.visible=!state.extension;document.getElementById('bench-controls').hidden=!!state.extension;document.getElementById('lift').parentElement.hidden=!!state.extension;document.getElementById('presets').hidden=!!state.extension||document.documentElement.dataset.practiceMode==='independent';status.textContent=state.extension?'三维计算光路示意 · 非实物复刻':'模型已就绪 · 拖动偏振盘调角；空白处转视角 / 滚轮缩放';
 for(const [id,name] of Object.entries(ids)){document.getElementById(id).value=state[id];document.getElementById(id+'-value').textContent=state[id]+'°';if(model)nodes[name].rotation.x=THREE.MathUtils.degToRad(state[id]-90);}
 if(model){nodes.EncoderPulley.rotation.x=nodes.AnalyzerRotor.rotation.x*(.042/.024);nodes.RetarderInsert.position.y=state.inserted?0:.15;}
 document.getElementById('lift').checked=!state.inserted;document.getElementById('source').checked=state.sourceOn;document.getElementById('wavelength').value=state.wavelength;
 document.getElementById('reading').textContent=state.sourceOn?`${q.kind} · ${state.extension?`DOP=${q.dop.toFixed(4)}`:`δ=${q.delta.toFixed(2)}°`} · I/I₀=${q.intensity.toFixed(6)}`:'光源关闭，无可观测偏振态';
 document.getElementById('record').disabled=!model||!state.sourceOn||(state.extension?.mode==='measurement'&&!state.extension.targetGenerated);
 const eye=document.getElementById('eye'),c=eye.getContext('2d');c.fillStyle='#f3f7f4';c.fillRect(0,0,480,400);c.fillStyle='#48685f';c.font='18px sans-serif';c.fillText(state.extension?'模式输出 · 偏振分量':'检偏器前 · 偏振椭圆',24,32);c.strokeStyle='#cbd9d1';c.beginPath();c.moveTo(60,185);c.lineTo(420,185);c.moveTo(240,60);c.lineTo(240,310);c.stroke();
 if(state.sourceOn){c.strokeStyle='#267a69';c.lineWidth=3;c.beginPath();q.ellipse.forEach((p,i)=>{const x=240+p.x*120,y=185-p.y*120;if(i)c.lineTo(x,y);else c.moveTo(x,y);});c.closePath();c.stroke();}
 if(state.extension?.mode==='microscope'&&state.sourceOn)drawMicroscope(c,state.extension);
 c.fillStyle='#294f47';c.font='24px sans-serif';c.fillText(`I / I₀ = ${q.intensity.toFixed(4)}`,110,355);c.font='14px sans-serif';c.fillText(state.sourceOn?(state.extension?'I₀为模式入射光强':'检偏器后光强 · 椭圆轴为水平/竖直'):'光源关闭',115,383);
 document.querySelector('thead tr').replaceChildren(...report(state).columns.map(value=>{const th=document.createElement('th');th.textContent=value;return th;}));
 document.getElementById('rows').replaceChildren(...report(state).rows.map(row=>{const tr=document.createElement('tr');for(const value of row){const td=document.createElement('td');td.style.padding='10px';td.textContent=value;tr.append(td);}return tr;}));document.getElementById('count').textContent=state.records.length;document.getElementById('undo').disabled=!state.records.length;
 for(const k of ['prediction','conclusion'])if(document.activeElement!==document.getElementById(k))document.getElementById(k).value=state[k];
 const chart=document.getElementById('chart'),cc=chart.getContext('2d');cc.clearRect(0,0,900,260);cc.fillStyle='#617b70';cc.font='14px sans-serif';cc.fillText('I/I₀',15,20);cc.fillText('1',25,32);cc.fillText('0.5',15,125);cc.fillText('0',25,220);cc.fillText('0°',45,248);cc.fillText('180°',440,248);cc.fillText('360°',830,248);cc.strokeStyle='#cad8d0';cc.strokeRect(50,25,800,195);const colors=['#27786b','#b57a29','#557cc3','#955d96'];report(state).series.forEach((series,index)=>{cc.fillStyle=colors[index%4];for(const p of series.points){cc.beginPath();cc.arc(50+p.x/360*800,220-p.y*195,4,0,Math.PI*2);cc.fill();}});
 document.getElementById('legend').replaceChildren(...report(state).series.map((series,index)=>{const item=document.createElement('div');item.style.color=colors[index%4];item.textContent='● '+series.title;return item;}));
 render();
}
function change(patch){try{state=normalize({...state,...patch});update();document.getElementById('message').textContent='条件已更新，已有记录保留。';}catch(e){document.getElementById('message').textContent=e.message;update();}}
renderer.domElement.title='拖动偏振盘旋转角度；拖动空白处转动视角，滚轮缩放。';
const dragHint=document.createElement('p');dragHint.textContent=renderer.domElement.title;dragHint.className='part-drag-hint';container.after(dragHint);
status.style.maxWidth='calc(100% - 36px)';
installPartDrag({renderer,camera,controls,model:()=>model,resolvePart(object){
 if(state.extension)return null;
 let node=object;
 while(node&&!Object.values(ids).includes(node.name))node=node.parent;
 if(!node)return null;
 const key=Object.keys(ids).find(key=>ids[key]===node.name);
 return {start(event,hit,ray){
  const center=node.getWorldPosition(new THREE.Vector3()),normal=new THREE.Vector3(1,0,0).transformDirection(node.matrixWorld);
  const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,center),point=new THREE.Vector3();
  if(!ray.ray.intersectPlane(plane,point))return null;
  const inverse=node.matrixWorld.clone().invert();
  point.applyMatrix4(inverse);
  let previous=Math.atan2(point.z,point.y),angle=state[key];
  return (event,ray)=>{
   if(!ray.ray.intersectPlane(plane,point))return;
   point.applyMatrix4(inverse);
   const next=Math.atan2(point.z,point.y),delta=Math.atan2(Math.sin(next-previous),Math.cos(next-previous));
   previous=next;angle+=THREE.MathUtils.radToDeg(delta);
   queueLabChange(change,{[key]:((Math.round(angle)%360)+360)%360});
  };
 }};
}});
for(const id of ['p','r','a'])document.getElementById(id).addEventListener('input',()=>change({[id]:Number(document.getElementById(id).value)}));
document.getElementById('lift').onchange=()=>change({inserted:!document.getElementById('lift').checked});document.getElementById('source').onchange=()=>change({sourceOn:document.getElementById('source').checked});document.getElementById('wavelength').onchange=()=>change({wavelength:Number(document.getElementById('wavelength').value)});
document.getElementById('wavelength').oninput=()=>{const value=Number(document.getElementById('wavelength').value);if(value>=400&&value<=700)change({wavelength:value});};
for(const k of ['prediction','conclusion'])document.getElementById(k).oninput=()=>{state[k]=document.getElementById(k).value;saveSession();};
document.getElementById('record').onclick=()=>{try{state=record(state);update();document.getElementById('message').textContent='已记录当前条件与光强。';}catch(e){document.getElementById('message').textContent=e.message;}};
document.getElementById('undo').onclick=()=>change({records:state.records.slice(0,-1)});
document.getElementById('reset').onclick=()=>{change({...fresh(),records:state.records,prediction:state.prediction,conclusion:state.conclusion,assisted:state.assisted});view('overview');};
document.getElementById('malus').onclick=()=>change({p:0,a:0,inserted:false,sourceOn:true,assisted:true});document.getElementById('circular').onclick=()=>change({p:0,r:45,a:0,wavelength:560,inserted:true,sourceOn:true,assisted:true});
installPlatformBridge({lab:'jones',ready:()=>!!model,read:()=>({state}),restore:p=>{state=normalize(p.state);update();},render:update,eye:'#eye',applyConditions:c=>{state=normalize(applyConditions(state,c));update();}});
document.getElementById('render-quality').onchange=e=>{qualityRenderer.setQuality(e.target.value);render();};
document.getElementById('save-render').onclick=async()=>{try{const size=await qualityRenderer.capture();status.textContent=`高清画面已生成 · ${size.width} × ${size.height}`;}catch(e){status.textContent=e.message;}};
for(const button of document.querySelectorAll('[data-view]'))button.onclick=()=>view(button.dataset.view);
new GLTFLoader().load('./assets/jones-product.glb',g=>{if(isLabDisposed()){disposeLabTree(g.scene);return;}model=g.scene;scene.add(model);productFinish=finishPolarizationModel(model);addExperimentTable(scene,model,{floor});framing=installInstrumentFraming({camera,controls,host:container,model:()=>state.extension?extensionUI.model:model,render});view('overview');for(const name of [...Object.values(ids),'EncoderPulley','RetarderInsert']){nodes[name]=model.getObjectByName(name);if(!nodes[name])throw Error('模型缺失运动节点：'+name);}status.textContent='模型已就绪 · 拖动偏振盘调角；空白处转视角 / 滚轮缩放';update();resize();view('overview');parent.postMessage({type:'jones-ready'},location.origin);},undefined,()=>{status.textContent='模型加载失败，请刷新重试。';parent.postMessage({type:'jones-failed'},location.origin);});view('overview');resize();

update();

import {labSessionStorage as sessionStorage} from '../shared/lab-runtime.js';
import {manageLabScene,LabResizeObserver,scheduleLabFrame,setLabAnimationLoop,isLabDisposed,disposeLabTree,addLabCleanup,queueLabChange} from '../shared/lab-runtime.js';
import {installPartDrag} from '../shared/part-drag.js?v=20261117-scroll';
import {installProductPresentation} from '../shared/product-presentation.js';
let presentation;
import {frameExperimentTable} from '../shared/experiment-table.js';
import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createFourierBench} from './model.mjs';
import {fresh,normalize,settings,simulate,cutoff,comparisonFeedback,PATTERNS,FILTERS,N,FIELD,LAMBDA,F} from './physics.mjs';
import {installPlatformBridge} from '../shared/platform-bridge.js';
const $=s=>document.querySelector(s),key='fourier-3d-session-v1';let state=fresh(),result;
try{const raw=sessionStorage.getItem(key);if(raw)state=normalize(JSON.parse(raw));}catch{}
function paint(canvas,values,spectrum=false,mask=null){const c=canvas.getContext('2d'),img=c.createImageData(N,N),max=spectrum?Math.max(...values):1;for(let i=0;i<values.length;i++){const v=Math.round(255*Math.max(0,Math.min(1,values[i]/(max||1)))),j=i*4;img.data[j]=v;img.data[j+1]=v;img.data[j+2]=v;if(mask&&mask[i]){img.data[j]=v*.72;img.data[j+1]=Math.max(25,v);img.data[j+2]=Math.max(25,v);}img.data[j+3]=255;}c.putImageData(img,0,0);}
try{
 const stage=$('#scene'),renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;stage.append(renderer.domElement);
 const scene=new T.Scene();scene.background=new T.Color('#353B44');const camera=new T.PerspectiveCamera(37,1,.01,10),orbit=new OrbitControls(camera,renderer.domElement);manageLabScene({renderer,scene,controls:orbit});orbit.enableDamping=true;orbit.minDistance=.1;orbit.maxDistance=2.5;
 const pm=new T.PMREMGenerator(renderer),room=new RoomEnvironment();scene.environment=pm.fromScene(room,.04).texture;room.dispose();pm.dispose();scene.add(new T.HemisphereLight(0xffffff,0x3b5054,1));const sun=new T.DirectionalLight(0xfff2dc,3);sun.position.set(-.6,1.3,.7);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-1,right:1,top:1,bottom:-1,near:.1,far:4});sun.shadow.normalBias=.0005;scene.add(sun);
 const model=createFourierBench();scene.add(model.root);presentation=installProductPresentation({scene,camera,renderer,model:model.root,controls:orbit,name:'fourier',experimentTable:{top:0,minWidth:1.35}});const textures=model.attach($('#object'),$('#image'));
 function view(detail=false){camera.position.set(detail?-.14:-.78,detail?.37:.65,detail?.30:.83);orbit.target.set(detail?.05:-.03,.15,0);if(!detail)frameExperimentTable(scene,camera,orbit);orbit.update();}
 $('#overall').onclick=()=>view();$('#filter-view').onclick=()=>view(true);
 function save(){try{sessionStorage.setItem(key,JSON.stringify(state));}catch{$('#feedback').textContent='自动暂存不可用，请在平台保存档案。';}}
 function update(){result=simulate(state);paint($('#object'),result.input);paint($('#spectrum'),result.spectrum,true,result.mask);paint($('#image'),result.output);model.update(state);textures.forEach(t=>t.needsUpdate=true);
  for(const k of ['pattern','filter','aperture','angle','offsetX','offsetY']){const e=$('#'+k);e.value=String(state[k]);const out=$('#'+k+'-value');if(out)out.value=String(state[k]);const number=$('#'+k+'-number');if(number&&document.activeElement!==number)number.value=String(state[k]);}
  $('#angle').disabled=state.filter!=='directional';for(const k of ['aperture','offsetX','offsetY'])$('#'+k).disabled=state.filter==='none';
  for(const k of ['aperture','angle','offsetX','offsetY'])$('#'+k+'-number').disabled=$('#'+k).disabled;$('#center').disabled=state.filter==='none';$('#rotate').disabled=state.filter!=='directional';
  $('#metrics').textContent=(state.filter==='none'?'无滤波：全频谱通过。':state.filter==='lowpass'?`圆孔频带半径 ${cutoff(state).toFixed(3)} mm⁻¹${state.offsetX||state.offsetY?'（偏心通带，不是中心低通）':''}。`:`狭缝法向半带宽 ${cutoff(state).toFixed(3)} mm⁻¹。`)+` 透过能量 ${(result.transmission*100).toFixed(2)}%。像面上下、左右均反转。`;save();}
 function feedback(){$('#feedback').textContent=comparisonFeedback(state).messages.join(' ');}
 renderer.domElement.title='先选择滤片，再拖动滤片平移；滤片上滚轮调孔径，Shift + 拖动狭缝旋转；空白处拖动转视角、滚轮缩放。';
 const dragHint=document.createElement('p');dragHint.textContent=renderer.domElement.title;dragHint.style.cssText='position:absolute;top:10px;left:12px;right:12px;z-index:2;color:#dce4ee;text-shadow:0 1px 3px #111;pointer-events:none;font-size:12px;line-height:1.6';stage.append(dragHint);
 const filterCarrier=model.root.getObjectByName('FourierFilter');
 function applyDrag(patch){Object.assign(state,patch);update();feedback();}
 installPartDrag({renderer,camera,controls:orbit,model:model.root,resolvePart(object){
  if(state.filter==='none')return null;
  let node=object;while(node&&node!==filterCarrier)node=node.parent;
  if(!node)return null;
  return {wheel(event){
   const aperture=Math.round(Math.max(.05,Math.min(2.5,state.aperture-Math.sign(event.deltaY)*.02))*100)/100;
   applyDrag({aperture});
  },start(event,hit,ray){
   const plane=new T.Plane(new T.Vector3(1,0,0),-.05),point=new T.Vector3();
   if(!ray.ray.intersectPlane(plane,point))return null;
   const origin=point.clone(),x=state.offsetX,y=state.offsetY,angle=state.angle,startX=event.clientX;
   const rotate=event.shiftKey&&state.filter==='directional';
   return (event,ray)=>{
    if(rotate){queueLabChange(applyDrag,{angle:((Math.round(angle+(event.clientX-startX)*.5)%180)+180)%180});return;}
    if(!ray.ray.intersectPlane(plane,point))return;
    const clamp=value=>Math.round(Math.max(-1,Math.min(1,value))*100)/100;
    queueLabChange(applyDrag,{offsetX:clamp(x+(point.z-origin.z)/.02),offsetY:clamp(y+(point.y-origin.y)/.02)});
   };
  }};
 }});
 function records(){const box=$('#comparisons');box.replaceChildren();state.records.forEach((r,i)=>{const card=document.createElement('article');card.className='comparison';const title=document.createElement('strong');title.textContent=`${i+1}. ${PATTERNS[r.pattern]} · ${FILTERS[r.filter]}`;const canvas=document.createElement('canvas');canvas.width=canvas.height=N;canvas.setAttribute('aria-label',`对照 ${i+1} 像面`);const v=simulate(r);paint(canvas,v.output);const p=document.createElement('p');p.textContent=`孔径 ${r.aperture} mm · ${r.angle}° · 偏移 (${r.offsetX}, ${r.offsetY}) mm · 能量 ${(v.transmission*100).toFixed(2)}%`;const recall=document.createElement('button');recall.textContent='重现条件';recall.onclick=()=>{Object.assign(state,r);update();records();};const del=document.createElement('button');del.textContent='删除此记录';del.onclick=()=>{state.records.splice(i,1);records();save();};card.append(title,canvas,p,recall,del);box.append(card);});
 feedback();}
 for(const k of ['pattern','filter','aperture','angle','offsetX','offsetY'])$('#'+k).oninput=e=>{state[k]=['pattern','filter'].includes(k)?e.target.value:Number(e.target.value);update();if(k==='pattern')records();};
 for(const k of ['prediction','conclusion']){$('#'+k).value=state[k];$('#'+k).oninput=e=>{state[k]=e.target.value;feedback();save();};}
 $('#record').onclick=()=>{const current=settings(state);if(state.records.some(r=>JSON.stringify(settings(r))===JSON.stringify(current))){$('#feedback').textContent='相同条件已记录；改变孔径、方向或位置后再记录。';return;}if(state.records.length>=30){$('#feedback').textContent='最多保留 30 条对照，请先保存档案。';return;}state.records.push(settings(state));records();save();};
 for(const k of ['aperture','angle','offsetX','offsetY']){const input=$('#'+k+'-number');input.oninput=()=>{if(input.value.trim()===''||!input.checkValidity())return;state[k]=Number(input.value);update();feedback();};input.onblur=()=>{if(input.value.trim()===''||!input.checkValidity())$('#feedback').textContent='请输入范围内且符合步长的数值，原参数已保留。';input.value=String(state[k]);};}
 $('#center').onclick=()=>{state.offsetX=state.offsetY=0;update();feedback();};
 $('#rotate').onclick=()=>{state.angle=(state.angle+90)%180;update();feedback();};
 const spectrum=$('#spectrum');
 function spectrumPoint(e){const r=spectrum.getBoundingClientRect(),size=Math.min(r.width,r.height),left=r.left+(r.width-size)/2,top=r.top+(r.height-size)/2;if(e.clientX<left||e.clientX>=left+size||e.clientY<top||e.clientY>=top+size)return null;const ix=Math.min(N-1,Math.floor((e.clientX-left)/size*N)),iy=Math.min(N-1,Math.floor((e.clientY-top)/size*N));return {x:(ix-N/2)/FIELD,y:-(iy-N/2)/FIELD};}
 spectrum.onpointermove=e=>{const p=spectrumPoint(e);if(p)$('#frequency-readout').textContent=`νx ${p.x.toFixed(2)}，νy ${p.y.toFixed(2)} mm⁻¹；傅里叶面 (${(p.x*LAMBDA*F).toFixed(3)}, ${(p.y*LAMBDA*F).toFixed(3)}) mm。`;};
 spectrum.onkeydown=e=>{if(state.filter==='none'||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const key=e.key==='ArrowLeft'||e.key==='ArrowRight'?'offsetX':'offsetY',delta=e.key==='ArrowRight'||e.key==='ArrowUp'?.01:-.01;state[key]=Math.round(Math.max(-1,Math.min(1,state[key]+delta))*100)/100;update();$('#frequency-readout').textContent=`滤片中心 (${state.offsetX}, ${state.offsetY}) mm。`;};
 spectrum.onclick=e=>{if(state.filter==='none'){$('#frequency-readout').textContent='先选择圆孔或狭缝，再点击频谱调整中心。';return;}const p=spectrumPoint(e);if(!p)return;for(const [key,v] of [['offsetX',p.x],['offsetY',p.y]])state[key]=Math.round(Math.max(-1,Math.min(1,v*LAMBDA*F))*100)/100;update();$('#frequency-readout').textContent=`滤片中心已移至 (${state.offsetX}, ${state.offsetY}) mm；超出行程时限制在 ±1 mm。`;};
 $('#reset').onclick=()=>{Object.assign(state,settings(fresh()));update();records();view();};
 installPlatformBridge({lab:'fourier',ready:()=>true,read:()=>({state}),restore:p=>{state=normalize(p.state);for(const k of ['prediction','conclusion'])$('#'+k).value=state[k];update();records();},render:()=>(presentation?presentation.renderSnapshot():renderer.render(scene,camera)),eye:'#image'});
 const resize=new LabResizeObserver(()=>{renderer.setSize(stage.clientWidth,stage.clientHeight);camera.aspect=stage.clientWidth/stage.clientHeight;camera.updateProjectionMatrix();});resize.observe(stage);view();update();records();$('#loading').remove();setLabAnimationLoop(renderer,()=>{if(!document.hidden){orbit.update();(presentation?presentation.render():renderer.render(scene,camera));}});parent.postMessage({type:'fourier-ready'},location.origin);
 window.addEventListener('pagehide',()=>{resize.disconnect();setLabAnimationLoop(renderer,null);orbit.dispose();model.dispose();scene.environment.dispose();renderer.dispose();});
}catch(e){$('#loading').textContent='装置加载失败：'+e.message;parent.postMessage({type:'fourier-failed'},location.origin);console.error(e);}

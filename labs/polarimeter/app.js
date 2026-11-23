import {manageLabScene,LabResizeObserver,scheduleLabFrame,setLabAnimationLoop,isLabDisposed,disposeLabTree,addLabCleanup,queueLabChange} from '../shared/lab-runtime.js';
import {installPartDrag} from '../shared/part-drag.js?v=20261117-scroll';
import {installProductPresentation} from '../shared/product-presentation.js';
let presentation;
import {addExperimentTable,frameExperimentTable} from '../shared/experiment-table.js?v=20261015';
import {fresh} from './physics.mjs?v=equal-dark';
import {installExperiment} from './experiment.js?v=equal-dark';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { createPolarimeter, DIMENSIONS } from './model.mjs?v=4';
const $=s=>document.querySelector(s), stage=$('#scene');
const state=fresh();
let updateExperiment=()=>{};
const views={overall:[[5.7,4.15,6.4],[0,1.34,0]],front:[[5.45,1.95,0],[1.88,1.95,0]],left:[[2.81,1.95,.61],[2.02,1.95,.61]],right:[[2.81,1.95,-.61],[2.02,1.95,-.61]],chamber:[[1,5.3,4.4],[0,1.8,0]],lamp:[[-.2,4.4,3.4],[-2,1.8,0]],tube:[[-.3,3.6,2.5],[-.1,1.95,0]],side:[[.1,2.6,8.7],[0,1.3,0]]};
// Follow the inclined assembly for close-ups, retaining the lamp's upright view.
const viewPivot=new T.Vector3(-1.83,DIMENSIONS.axisHeight,0);
for(const name of ['front','left','right','chamber','tube']) views[name]=views[name].map(p=>new T.Vector3(...p).sub(viewPivot).applyAxisAngle(new T.Vector3(0,0,1),T.MathUtils.degToRad(DIMENSIONS.axisTiltDegrees)).add(viewPivot).toArray());
views.side=[[.1,3.3,14],[0,1.9,0]];
let renderer;
try {
  renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;stage.prepend(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(36,1,.03,60),orbit=new OrbitControls(camera,renderer.domElement);manageLabScene({renderer,scene,controls:orbit});
  orbit.enableDamping=true;orbit.minDistance=.5;orbit.maxDistance=18;orbit.maxPolarAngle=Math.PI*.86;
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.04).texture;scene.environmentIntensity=.55;room.dispose();pmrem.dispose();
  scene.add(new T.HemisphereLight(0xf4f8ff,0x7d8c75,.95));
  const key=new T.DirectionalLight(0xfff1d8,2.4);key.position.set(0,7,5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.1,far:20});key.shadow.bias=-.00015;key.shadow.normalBias=.012;key.shadow.radius=4;scene.add(key);
  const fill=new T.DirectionalLight(0xddeeff,1.1);fill.position.set(-3,3,-4);scene.add(fill);
  const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.ShadowMaterial({opacity:.16}));floor.rotation.x=-Math.PI/2;floor.position.y=-.015;floor.receiveShadow=true;scene.add(floor);
  const font=new FontLoader().parse(await fetch('./assets/lettering.json').then(r=>{if(!r.ok)throw Error('字体资源载入失败');return r.json();}));if(!isLabDisposed()){
  const model=createPolarimeter(font);scene.add(model.root);
  // The 200 mm tube is represented by 2.84 units in the instrument model.
  addExperimentTable(scene,model.root,{floor,unitsPerMeter:2.84/.20});presentation=installProductPresentation({scene,camera,renderer,model:model.root,controls:orbit,upAxis:'y',name:'polarimeter',floor:floor});
  // Fine paint grain supplements the geometry at close range without adding polygons.
  const grainData=new Uint8Array(128*128*4);let seed=743;
  for(let i=0;i<grainData.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const n=100+(seed%90);grainData.set([n,n,n,255],i);}
  const grain=new T.DataTexture(grainData,128,128);grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.repeat.set(4,4);grain.magFilter=T.LinearFilter;grain.minFilter=T.LinearMipmapLinearFilter;grain.generateMipmaps=true;grain.needsUpdate=true;
  model.root.traverse(n=>{if(n.isMesh&&n.material.name==='Ivory powder coating'&&n.geometry.attributes.uv){n.material.bumpMap=grain;n.material.bumpScale=.006;n.material.needsUpdate=true;}});
  const lamp=new T.PointLight(0xffb01d,0,2.2,2);lamp.position.set(-1.9,1.95,0);scene.add(lamp);
  function view(name){const [p,t]=views[name];camera.position.set(...p);orbit.target.set(...t);if(name==='overall')frameExperimentTable(scene,camera,orbit);orbit.update();document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));(presentation?presentation.render():renderer.render(scene,camera));}
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>view(b.dataset.view)));view('overall');
  function apply(){model.setState(state);lamp.intensity=state.lampOn?.55:0;$('#angle-value').textContent=state.angle.toFixed(2)+'°';$('#angle').value=state.angle;(presentation?presentation.render():renderer.render(scene,camera));updateExperiment();}
  for(const [id,key]of [['lamp','lampOn'],['lid','lidOpen'],['inserted','inserted']])$( '#'+id).addEventListener('change',e=>{
    state[key]=e.target.checked;
    if(key==='inserted'){state.lidOpen=true;$('#lid').checked=true;}
    if(key==='lidOpen'&&!state.inserted){state.lidOpen=true;$('#lid').checked=true;$('#notice').textContent='请先将样品管装回，再关闭样品室。';}
    apply();
  });
  $('#tube').addEventListener('change',e=>{state.tubeLength=e.target.value;state.lidOpen=true;$('#lid').checked=true;apply();});
  $('#angle').addEventListener('input',e=>{state.angle=Number(e.target.value);apply();});
  $('#focus').addEventListener('input',e=>{state.focus=Number(e.target.value);apply();});
  document.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>{state.angle=Math.round(Math.max(-30,Math.min(30,state.angle+Number(b.dataset.step)))*100)/100;apply();}));
  $('#reset').addEventListener('click',()=>{Object.assign(state,{lampOn:false,lidOpen:true,inserted:true,tubeLength:'200',angle:0,focus:0});$('#lamp').checked=false;$('#lid').checked=true;$('#inserted').checked=true;$('#tube').value='200';$('#focus').value=0;apply();view('overall');});
  const descriptions={LampHousing:['钠灯灯罩','顶部五个通孔、侧面光口与导向边框独立建形。开启钠灯可观察暖色灯光。'],ChamberLid:['样品室弧形盖','弧形盖具有壁厚、拉柄和铰接件。开合路径为依据照片的近似，待实物运动资料校准。'],Tube200:['200 mm 样品管','独立玻璃管壁、偏置鼓泡与金属滚花端帽。200 mm 是光程规格，不等于端帽之间的外观总长。'],Tube100:['100 mm 样品管','短管靠光源端放置，保留空余腔段；端帽与鼓泡不随管长等比缩小。'],Eyepiece:['观察目镜','多级镜筒、调焦滚花、中央观察孔与两侧放大读数孔。调焦可见镜筒位移。'],AnalyzerHandwheel:['检偏调节手轮','手轮联动内部刻度盘，外壳固定。当前传动比例仅用于演示。'],AnalyzerHousing:['双游标读数装置','主尺逐度刻线，游标20格跨主尺19格，分度0.05°。刻线随检偏角移动；读数用于空白校正与样品浓度计算。'],PowerSwitch:['电源开关','带凹槽的翘板开关。点击可切换钠灯。']};
  function applyPart(patch){Object.assign(state,patch);$('#focus').value=state.focus;apply();}
  installPartDrag({renderer,camera,controls:orbit,model:model.root,resolvePart(object){
    let node=object;while(node&&!['AnalyzerHandwheel','Eyepiece'].includes(node.name))node=node.parent;
    if(!node)return null;
    const key=node.name==='AnalyzerHandwheel'?'angle':'focus';
    return {start(event){
      const y=event.clientY,value=state[key];
      $('#part').textContent=descriptions[node.name][0];$('#description').textContent=descriptions[node.name][1];
      return event=>{
        const next=key==='angle'?Math.round(Math.max(-30,Math.min(30,value+(y-event.clientY)*.05))*20)/20:Math.round(Math.max(0,Math.min(1,value+(y-event.clientY)*.01))*100)/100;
        queueLabChange(applyPart,{[key]:next});
      };
    }};
  }});
  renderer.domElement.title='拖动检偏手轮调角度、目镜调焦；拖动空白处旋转视角。';
  const partHint=document.createElement('p');partHint.className='fine';partHint.textContent=renderer.domElement.title;stage.after(partHint);
  const ray=new T.Raycaster(),pointer=new T.Vector2();let down;
  renderer.domElement.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});
  renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);const hits=ray.intersectObject(model.root,true).filter(h=>{let n=h.object;while(n){if(!n.visible)return false;n=n.parent;}return true;});let n=hits[0]?.object;while(n&&!descriptions[n.name])n=n.parent;if(n){const [title,description]=descriptions[n.name];$('#part').textContent=title;$('#description').textContent=description;if(n.name==='PowerSwitch'){$('#lamp').click();}}});
  $('#snapshot').addEventListener('click',()=>{(presentation?presentation.render():renderer.render(scene,camera));renderer.domElement.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='WXG-4-仪器.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});});
  const resize=new LabResizeObserver(()=>{renderer.setSize(stage.clientWidth,stage.clientHeight);camera.aspect=stage.clientWidth/stage.clientHeight;camera.updateProjectionMatrix();});resize.observe(stage);
  function sync(){for(const [id,k]of [['lamp','lampOn'],['lid','lidOpen'],['inserted','inserted']])$('#'+id).checked=state[k];$('#tube').value=state.tubeLength;$('#focus').value=state.focus;}
  updateExperiment=installExperiment(state,apply,sync,()=>presentation.renderSnapshot());
  apply();$('#loading').hidden=true;
  setLabAnimationLoop(renderer,()=>{if(document.hidden)return;orbit.update();(presentation?presentation.render():renderer.render(scene,camera));});
  setTimeout(()=>{$('#stats').textContent=`相对尺寸重建 · ${renderer.info.render.triangles.toLocaleString()} 个渲染三角面 · ${renderer.info.render.calls} 次绘制（含环境与阴影）`;},1000);
  window.addEventListener('pagehide',()=>{setLabAnimationLoop(renderer,null);resize.disconnect();orbit.dispose();scene.traverse(n=>{n.geometry?.dispose();const materials=Array.isArray(n.material)?n.material:[n.material];materials.filter(Boolean).forEach(m=>m.dispose());});scene.environment.dispose();renderer.dispose();});
}
} catch(error){$('#loading').textContent='模型载入失败：'+error.message+'。请刷新页面重试。';parent.postMessage({type:'polarimeter-failed'},location.origin);console.error(error);}

import {installRenderBenchmark} from './render-benchmark.js';
import * as T from 'three';
import {addExperimentTable} from './experiment-table.js';
import {setupProductStudio,createQualityRenderer} from '../jones/product-studio.js';
import {LabResizeObserver,addLabCleanup} from './lab-runtime.js';
import {installInstrumentFraming} from './instrument-framing.js';

// One presentation layer; no changes to component transforms, physics or functional lights.
export function installProductPresentation({scene,camera,renderer,model,focusModel,controls,floor,upAxis='y',name='光学实验',backdrop='industrial',experimentTable=false,configureScene,initialQuality='fast'}){
 const roots=Array.isArray(model)?model:[model],box=new T.Box3();
 for(const root of roots){root.updateWorldMatrix(true,true);box.union(new T.Box3().setFromObject(root));}
 const local=box.clone();if(upAxis==='z')local.applyMatrix4(new T.Matrix4().makeRotationX(-Math.PI/2));
 const size=local.getSize(new T.Vector3()),center=local.getCenter(new T.Vector3()),scale=Math.max(size.x,size.y,size.z,.05)/1.2;
 const bench=experimentTable?addExperimentTable(scene,roots,{upAxis,...experimentTable}):null;
 const table=scene.getObjectByName('EXPERIMENT_TABLE');
 const tableBounds=table?new T.Box3().setFromObject(table):null;
 if(tableBounds&&upAxis==='z')tableBounds.applyMatrix4(new T.Matrix4().makeRotationX(-Math.PI/2));
 const studioSize=tableBounds?tableBounds.clone().union(local).getSize(new T.Vector3()):size;
 const studioScale=Math.max(studioSize.x,studioSize.y,studioSize.z,.05)/1.2;
 scene.traverse(o=>{if(o.isDirectionalLight||o.isHemisphereLight||o.isRectAreaLight)o.visible=false;});
 scene.fog=null;scene.environment?.dispose();
 const ground=setupProductStudio(scene,renderer),lights=scene.getObjectByName('IndustrialStudio');
 if(backdrop==='light'){
  scene.background?.dispose?.();scene.background=new T.Color('#eef0f2');scene.userData.backgroundTheme='precision-light';
  ground.material.alphaMap?.dispose();ground.material.bumpMap?.dispose();ground.material.dispose();ground.material=new T.ShadowMaterial({opacity:.14,depthWrite:false});
  renderer.toneMappingExposure=.88;scene.environmentIntensity=.8;
 }
 // Pale instrument housings need less illumination than the dark optical benches.
 if(backdrop!=='light'&&['jcd3','microscope','aberration'].includes(name)){
  renderer.toneMappingExposure=.78;
  scene.environmentIntensity=.55;
  lights.traverse(light=>{if(light.isLight)light.intensity*=.62;});
 }
 lights.position.set(center.x,local.min.y,center.z);lights.scale.setScalar(scale);
 const key=lights.children.find(o=>o.isDirectionalLight);key.shadow.normalBias=.0003*scale;
 Object.assign(key.shadow.camera,{left:-1.4*studioScale,right:1.4*studioScale,top:1.4*studioScale,bottom:-1.4*studioScale,near:.05*scale,far:20*studioScale});key.shadow.camera.updateProjectionMatrix();
 key.target.position.set(center.x,center.y,center.z);scene.add(key.target);
 let groundHeight=backdrop==='light'?local.min.y:local.min.y-scale*.8;
 if(floor){groundHeight=floor.position[upAxis];floor.visible=false;}
 if(tableBounds)groundHeight=tableBounds.min.y;
 ground.position.set(center.x,groundHeight-.0005*scale,center.z);ground.scale.setScalar(studioScale);
 if(upAxis==='z'){
 lights.rotation.x=Math.PI/2;lights.position.set(center.x,-center.z,local.min.y);
 key.target.position.set(center.x,-center.z,center.y);
 ground.rotation.x=0;ground.position.set(center.x,-center.z,groundHeight-.0005*scale);
 }
 if(['fiber','resonator'].includes(name)){renderer.toneMappingExposure=.86;scene.environmentIntensity=.75;}
 const seen=new Set();
 for(const root of roots)root.traverse(o=>{if(!o.isMesh)return;const materials=Array.isArray(o.material)?o.material:[o.material];
 o.castShadow=materials.every(m=>!m.transparent&&!m.transmission&&!m.isMeshBasicMaterial);o.receiveShadow=true;
 for(const m of materials){if(seen.has(m))continue;seen.add(m);if(!m.isMeshStandardMaterial||m.map||m.emissiveMap||m.transparent||m.transmission)continue;
 if(m.metalness>.45){m.roughness=Math.max(.23,Math.min(.48,m.roughness));m.envMapIntensity=1.05;}
 }
 });
 const disposeConfiguration=configureScene?.({scene,renderer,model,ground,lights,table,scale});
 const host=renderer.domElement.parentElement;for(const caption of host.querySelectorAll('.scene-caption,.stamp')){caption.style.color='#d5dce5';caption.style.textShadow='0 1px 3px #111';}
 const quality=createQualityRenderer(scene,camera,renderer,host,{scale,filename:name+'-精细渲染.png',initialQuality});
 const panel=document.createElement('div');panel.className='product-render-controls';panel.style.cssText='display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 12px;background:var(--lab-panel);color:var(--lab-body);border-radius:8px;font:12px system-ui';
 const label=document.createElement('label');label.textContent='画质 ';label.style.margin='0';
 const select=document.createElement('select');select.setAttribute('aria-label','渲染画质');select.innerHTML='<option value="auto">自动</option><option value="high">精细</option><option value="fast">流畅</option>';select.value=quality.getQuality();label.append(select);
 const near=document.createElement('button');near.textContent='仪器近景';const save=document.createElement('button');save.textContent='保存高清画面';
 const status=document.createElement('span');status.setAttribute('role','status');
 panel.append(label,near,save,status);panel.style.position='absolute';panel.style.bottom='10px';panel.style.left='10px';panel.style.zIndex='4';if(getComputedStyle(host).position==='static')host.style.position='relative';host.append(panel);panel.addEventListener('pointerdown',e=>e.stopPropagation());
 // A separate observer keeps postprocessing targets in sync with existing layout handlers.
 const observer=new LabResizeObserver(()=>{quality.resize();quality.render();});observer.observe(host);quality.resize();
 let capturing=false;
 select.onchange=()=>{quality.setQuality(select.value);quality.render();};
 const syncQuality=e=>{select.value=e.detail.value;};window.addEventListener('wx-lab-quality-changed',syncQuality);
 const framing=document.documentElement.dataset.layout==='unified'?installInstrumentFraming({camera,controls,host,model:focusModel||model,render:()=>quality.render()}):null;
 near.onclick=()=>{if(framing){framing.frameInstrument();return;}const focusBox=focusModel?new T.Box3().setFromObject(focusModel):box,sphere=focusBox.getBoundingSphere(new T.Sphere()),dir=camera.position.clone().sub(controls.target).normalize();const fov=Math.atan(Math.tan(T.MathUtils.degToRad(camera.fov/2))*Math.min(1,camera.aspect));controls.target.copy(sphere.center);camera.position.copy(sphere.center).addScaledVector(dir,sphere.radius/Math.sin(fov)*1.08);controls.update();quality.render();};
 save.onclick=async()=>{save.disabled=true;capturing=true;try{const result=await quality.capture();status.textContent=`已生成 ${result.width} × ${result.height}`;}catch(e){status.textContent=e.message;}finally{save.disabled=false;capturing=false;}};
 installRenderBenchmark({camera,controls,quality,host,renderer});
 let disposed=false;
 function dispose(){if(disposed)return;disposed=true;observer.disconnect();disposeConfiguration?.();bench?.userData.dispose();quality.dispose();ground.geometry.dispose();ground.material.alphaMap?.dispose();ground.material.bumpMap?.dispose();ground.material.dispose();scene.background?.dispose?.();panel.remove();window.removeEventListener('wx-lab-quality-changed',syncQuality);window.removeEventListener('pagehide',dispose);}
 window.addEventListener('pagehide',dispose,{once:true});
 addLabCleanup(dispose);
 return {dispose,frameInstrument:near.onclick,renderSnapshot(){if(disposed)throw Error('三维视图已关闭。');if(capturing)throw Error('高清画面正在生成，请稍后重试。');quality.renderNow();},render(){if(disposed||capturing)return;quality.render();}};
}

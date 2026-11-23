import * as T from 'three';
import {addIndustrialStudio,createIndustrialFloor} from '../design-review/industrial-studio.js';

export function setupProductStudio(scene,renderer){
 renderer.toneMapping=T.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;
 const pm=new T.PMREMGenerator(renderer),room=new T.Scene();room.background=new T.Color('#727984');
 for(const [position,size,intensity] of [[[-2,2,2],[3,2],5],[[2,1,-2],[1,2],3],[[0,3,0],[3,2],2]]){
 const panel=new T.Mesh(new T.PlaneGeometry(...size),new T.MeshBasicMaterial({color:new T.Color().setScalar(intensity),side:T.DoubleSide}));panel.position.set(...position);panel.lookAt(0,0,0);room.add(panel);
 }
 scene.environment=pm.fromScene(room,.04).texture;pm.dispose();room.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
 const studio=addIndustrialStudio(scene,renderer);studio.lights.position.x=.6;
 const key=studio.lights.children.find(o=>o.isDirectionalLight);key.shadow.mapSize.set(2048,2048);key.shadow.normalBias=.0003;
 Object.assign(key.shadow.camera,{left:-1.1,right:1.1,top:1.1,bottom:-1.1});key.shadow.camera.updateProjectionMatrix();
 scene.environmentIntensity=.95;
 const floor=createIndustrialFloor();scene.add(floor);return floor;
}
export function finishPolarizationModel(model){
 const materials=new Map();
 const data=new Uint8Array(64*64*4);let seed=19;
 for(let i=0;i<data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const n=115+seed%26;data.set([n,n,n,255],i);}
 const grain=new T.DataTexture(data,64,64);grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.repeat.set(5,40);grain.needsUpdate=true;
 model.traverse(o=>{if(!o.isMesh)return;
 o.material=(Array.isArray(o.material)?o.material:[o.material]).map(original=>{
 if(materials.has(original))return materials.get(original);
 const m=original.clone(),name=m.name;
 if(name==='Anodized aluminum'||name==='Molded graphite'){m.color.set('#252a30');m.metalness=.8;m.roughness=.32;m.bumpMap=grain;m.bumpScale=.000025;}
 if(name==='Stainless steel'||name==='Metric ruler'){m.color.set('#b8c0c9');m.metalness=.92;m.roughness=.27;m.bumpMap=grain;m.bumpScale=.000015;}
 if(name==='Sensor blue polymer'){m.roughness=.38;m.metalness=.12;}
 if(name.includes('film')){
 const glass=new T.MeshPhysicalMaterial({name,color:'#c5d3e1',metalness:0,roughness:.13,transmission:.65,thickness:.0008,ior:1.48,iridescence:.13,iridescenceIOR:1.3,iridescenceThicknessRange:[100,180],side:T.DoubleSide});
 materials.set(original,glass);return glass;
 }
 materials.set(original,m);return m;
 });
 if(o.material.length===1)o.material=o.material[0];
 o.castShadow=!((Array.isArray(o.material)?o.material:[o.material]).some(m=>m.transmission>0||m.transparent));o.receiveShadow=true;
 });
 // Teaching overlay in original metre coordinates; it never changes the optical calculation.
 const beam=new T.Group();beam.name='POLARIZATION_TEACHING_BEAM';
 const segments=[];
 for(const [start,end] of [[.154,.327],[.327,.527],[.527,.747],[.747,.948]]){
 const material=new T.MeshBasicMaterial({color:'#ff3024',transparent:true,opacity:.7,depthWrite:false,toneMapped:false});
 const line=new T.Mesh(new T.CylinderGeometry(.0007,.0007,end-start,12),material);
 line.rotation.z=-Math.PI/2;line.position.set((start+end)/2,.13,0);beam.add(line);segments.push(line);
 }
 model.add(beam);
 return {update(state,intensity){beam.visible=state.sourceOn&&!state.extension;const last=segments[3];last.visible=intensity>1e-6;last.material.opacity=.8*Math.sqrt(Math.max(0,intensity));}};
}

export {createQualityRenderer} from '../shared/adaptive-renderer.js';

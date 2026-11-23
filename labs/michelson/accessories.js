import * as THREE from 'three';
import {GLTFLoader} from '../shared/optimized-gltf-loader.js';

// GLB uses metres, Y-up. Original instrument local millimetres convert at its root.
export async function installAccessories(scene,model,canvas){
 const data=await new GLTFLoader().loadAsync('assets/accessories-product.glb');
 const group=data.scene;scene.add(group);
 const expander=group.getObjectByName('EXPANDER_ASSEMBLY');
 const emitter=group.getObjectByName('LASER_EMITTER');
 if(!expander||!emitter)throw Error('附件模型缺少操作节点');
 emitter.material=emitter.material.clone();
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,toneMapped:false});
 const screen=new THREE.Mesh(new THREE.CircleGeometry(.0445,96),material);
 screen.name='LIVE_OBSERVATION_SCREEN';screen.position.set(-.035,.293,.1865);scene.add(screen);
 model.traverse(o=>{if(o.name.startsWith('观察屏网格'))o.visible=false;});
 const rayMat=new THREE.MeshBasicMaterial({color:0xf54b35,transparent:true,opacity:.55,depthWrite:false});
 const paths=new THREE.Group();paths.name='TEACHING_BEAM_PATH';scene.add(paths);
 function beam(a,b){const d=new THREE.Vector3().subVectors(b,a);const o=new THREE.Mesh(new THREE.CylinderGeometry(.0006,.0006,1,12),rayMat);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize());o.scale.y=d.length;paths.add(o);return o;}
 beam(new THREE.Vector3(-.287,.293,0),new THREE.Vector3(-.035,.293,0));
 const moving=beam(new THREE.Vector3(-.035,.293,0),new THREE.Vector3(.11625,.293,0));
 beam(new THREE.Vector3(-.035,.293,0),new THREE.Vector3(-.035,.293,-.07925));
 beam(new THREE.Vector3(-.035,.293,0),new THREE.Vector3(-.035,.293,.184));
 return {
  group,
  update(state,showPath){
   expander.position.z=state.expanded?0:.12;
   emitter.material.emissive.setHex(state.lamp?0xff2109:0x000000);emitter.material.emissiveIntensity=state.lamp?2:0;
   paths.visible=state.lamp&&showPath;
   // Mirror front is 8.75 mm toward the splitter from its carriage origin.
   const end=(75+state.x-8.75)*.001;moving.position.x=(-.035+end)/2;moving.scale.y=end+.035;
   texture.needsUpdate=true;
  }
 };
}

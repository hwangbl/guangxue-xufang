import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {disposeLabTree} from './lab-runtime.js';

const pitch=.025, height=.8;
const toYUp=new T.Matrix4().makeRotationX(-Math.PI/2);

// One tile of the recessed 25 mm grid used by the resonator and fiber benches.
function perforatedTile(){
 const positions=[],indices=[],segments=8;
 for(const [radius,level] of [[null,0],[.003,0],[.0025,-.00065],[.0025,-.0045]]){
  for(let i=0;i<segments;i++){
   const angle=2*Math.PI*i/segments,x=Math.cos(angle),z=-Math.sin(angle);
   const r=radius??(pitch/2/Math.max(Math.abs(x),Math.abs(z)));
   positions.push(r*x,level,r*z);
  }
 }
 for(let layer=0;layer<3;layer++){
  for(let i=0;i<segments;i++){
   const a=layer*segments+i,b=layer*segments+(i+1)%segments;
   indices.push(a,b,b+segments,a,b+segments,a+segments);
  }
 }
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 geometry.setIndex(indices);geometry.computeVertexNormals();
 return geometry;
}

export function addExperimentTable(scene,instruments,{floor,upAxis='y',top,minWidth=1.2,unitsPerMeter=1,topFinish}={}){
 const instrumentBounds=new T.Box3();
 for(const object of Array.isArray(instruments)?instruments:[instruments]){
  object.updateWorldMatrix(true,true);
  instrumentBounds.union(new T.Box3().setFromObject(object));
 }
 if(instrumentBounds.isEmpty())throw new Error('实验桌需要有效的仪器边界');
 const local=instrumentBounds.clone();
 if(upAxis==='z')local.applyMatrix4(toYUp);
 const size=local.getSize(new T.Vector3()).divideScalar(unitsPerMeter),center=local.getCenter(new T.Vector3());
 const cols=Math.max(48,Math.ceil(Math.max(minWidth,size.x+.10)/pitch));
 const rows=Math.max(30,Math.ceil((size.z+.10)/pitch));
 const width=cols*pitch,depth=rows*pitch;
 const group=new T.Group();
 group.name='EXPERIMENT_TABLE';
 group.userData.instrumentBounds=instrumentBounds;
 group.userData.presentationOnly=true;
 group.userData.holePitch=pitch;
 group.position.set(center.x,top??local.min.y,center.z);
 group.scale.setScalar(unitsPerMeter);
 if(upAxis==='z'){
  group.position.applyMatrix4(toYUp.clone().invert());
  group.rotation.x=Math.PI/2;
 }
 const black=new T.MeshStandardMaterial({color:new T.Color(.025,.032,.04),metalness:.7,roughness:.35});
 const steel=new T.MeshStandardMaterial({color:new T.Color(.5,.55,.6),metalness:.85,roughness:.28});
 const surface=topFinish?new T.MeshStandardMaterial(topFinish):steel;
 const rubber=new T.MeshStandardMaterial({color:new T.Color(.007,.009,.012),metalness:.1,roughness:.65});
 function add(mesh,x,y,z){
  mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
 }
 const box=(w,h,d,x,y,z,material,radius)=>add(new T.Mesh(new RoundedBoxGeometry(w,h,d,2,radius),material),x,y,z);
 const cylinder=(r,h,x,y,z,material)=>add(new T.Mesh(new T.CylinderGeometry(r,r,h,24),material),x,y,z);

 box(width,.096,depth,0,-.052,0,black,.009);
 const skin=new T.InstancedMesh(perforatedTile(),surface,(cols-1)*(rows-1));
 skin.name='Perforated stainless skin';
 const matrix=new T.Matrix4();let index=0;
 for(let x=1;x<cols;x++)for(let z=1;z<rows;z++)skin.setMatrixAt(index++,matrix.makeTranslation(x*pitch-width/2,0,z*pitch-depth/2));
 skin.instanceMatrix.needsUpdate=true;add(skin,0,0,0);
 for(const side of [-1,1]){
  box(width,.004,pitch/2,0,-.002,side*(depth/2-pitch/4),surface,.0015);
  box(pitch/2,.004,depth-pitch,side*(width/2-pitch/4),-.002,0,surface,.0015);
 }
 const legX=width/2-.075,legZ=depth/2-.075;
 for(const side of [-1,1]){
  const x=side*legX,z=side*legZ;
  for(const end of [-1,1]){
   const p=end*legZ;
   cylinder(.061,.032,x,-.115,p,black);
   cylinder(.048,.60,x,-.43,p,black);
   for(const y of [-.145,-.715])cylinder(.049,.012,x,y,p,steel);
   cylinder(.013,.055,x,-.754,p,steel);
   cylinder(.037,.030,x,-.785,p,black);
   cylinder(.035,.002,x,-.799,p,rubber);
   for(const dx of [-.04,.04])cylinder(.004,.004,x+dx,-.100,p,steel);
  }
  box(legX*2,.065,.04,0,-.60,z,black,.003);
  box(.04,.065,legZ*2,x,-.60,0,black,.003);
 }
 const label=document.createElement('canvas');
 label.width=512;label.height=40;
 const ctx=label.getContext('2d');
 ctx.fillStyle='#dfe5eb';ctx.font='bold 29px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.fillText('PRECISION OPTICAL TABLE',256,20);
 const texture=new T.CanvasTexture(label);texture.colorSpace=T.SRGBColorSpace;
 const caption=new T.Mesh(new T.PlaneGeometry(.212,.0166),new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));
 caption.position.set(0,-.044,depth/2+.0006);group.add(caption);
 scene.add(group);
 if(floor){floor.position[upAxis]=(top??local.min.y)-height*unitsPerMeter;floor.receiveShadow=true;}
 group.userData.dispose=()=>{group.removeFromParent();disposeLabTree(group);};
 return group;
}

export function frameExperimentTable(scene,camera,controls){
 const table=scene.getObjectByName('EXPERIMENT_TABLE');if(!table)return;
 const box=new T.Box3().setFromObject(table).union(table.userData.instrumentBounds);
 const center=box.getCenter(new T.Vector3());
 const direction=camera.position.clone().sub(controls.target).normalize();
 const right=new T.Vector3().crossVectors(camera.up,direction).normalize();
 if(right.lengthSq()===0)right.set(1,0,0);
 const up=new T.Vector3().crossVectors(direction,right).normalize();
 const extent=box.getSize(new T.Vector3()).length();
 // Keep the nearest leveling foot above the quality controls along the lower edge.
 center.addScaledVector(up,-extent*.04);
 const vertical=Math.tan(T.MathUtils.degToRad(camera.getEffectiveFOV()/2));
 const horizontal=vertical*camera.aspect*.88;
 const offset=new T.Vector3();let distance=0;
 for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
  offset.set(x,y,z).sub(center);
  const screenY=offset.dot(up);
  distance=Math.max(distance,offset.dot(direction)+Math.max(Math.abs(offset.dot(right))/horizontal,Math.abs(screenY)/(vertical*(screenY<0?.72:.88))));
 }
 const range=distance+extent;
 if(camera.far<range){camera.far=range;camera.updateProjectionMatrix();}
 if(scene.fog?.isFog){scene.fog.near=Math.max(scene.fog.near,range);scene.fog.far=Math.max(scene.fog.far,range*2);}
 controls.maxDistance=Math.max(controls.maxDistance,distance*1.5);
 controls.target.copy(center);camera.position.copy(center).addScaledVector(direction,distance);
}

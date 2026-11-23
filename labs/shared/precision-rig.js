import * as T from 'three';
import {telescopeMechanics,irisLeafVertices} from './precision-mechanics.mjs';

export function installPrecisionRig(model,{lab}){
 const required=name=>{const n=model.getObjectByName(name);if(!n)throw Error('模型缺少机构：'+name);return n;};
 const mask=required(lab==='telescope'?'Aperture':'IrisMask'),leaves=[];
 const cutaway=[];model.traverse(o=>{if(o.userData.cutaway)cutaway.push(o);if(Number.isInteger(o.userData.irisLeaf))leaves.push(o);});
 if(leaves.length!==10)throw Error('光阑叶片数量不正确');
 for(const leaf of leaves){leaf.material=leaf.material.clone();leaf.material.color.offsetHSL(0,0,(leaf.userData.irisLeaf%3-1)*.012);leaf.material.side=T.DoubleSide;}
 const eye=lab==='telescope'?required('Eyepiece'):null;
 const sleeve1=eye?required('Sleeve1'):null,sleeve2=eye?required('Sleeve2'):null,focus=eye?required('FocusRing'):null;
 const screen=eye?null:required('ScreenCarrier'),micrometer=eye?null:required('ScreenKnob'),spindle=eye?null:required('ScreenSpindle');
 const spindleScale=spindle?.scale.clone(),spindleQuaternion=spindle?.quaternion.clone();
 let previousAperture=null,isCutaway=false;
 function aperture(mm){
  if(mm===previousAperture)return;previousAperture=mm;const radius=mm/2000;
  mask.geometry.dispose();mask.geometry=new T.RingGeometry(radius,mask.userData.irisOuter,160);
  mask.geometry.rotateY(Math.PI/2);mask.geometry.translate(mask.userData.irisX,0,0);mask.material.side=T.DoubleSide;
  for(const leaf of leaves){
   const {points,indices}=irisLeafVertices(leaf.userData.irisLeaf,radius,leaf.userData.irisOuter,leaf.userData.irisX);
   leaf.geometry.dispose();leaf.geometry=new T.BufferGeometry();leaf.geometry.setAttribute('position',new T.Float32BufferAttribute(points,3));leaf.geometry.setIndex(indices);leaf.geometry.computeVertexNormals();leaf.geometry.computeBoundingSphere();
  }
 }
 return {
  setCutaway(value){isCutaway=Boolean(value);for(const n of cutaway)n.visible=!isCutaway;},
  update(state){
   aperture(state.apertureMm);
   if(eye){
    const pose=telescopeMechanics(state.lengthMm);eye.position.x=pose.eyeX;sleeve1.position.x=pose.sleeve1X;sleeve2.position.x=pose.sleeve2X;
    // Keep the section aligned while cut open; complete exterior shows ring rotation.
    focus.rotation.x=isCutaway?0:(state.lengthMm-230)*Math.PI/20;
    for(const key of ['positive50','positive40','negative50'])required('Eye_'+key).visible=state.eyepiece===key;
   }else{
    const delta=state.screenOffsetMm/1000;
    screen.position.x=.34+delta;micrometer.rotation.x=state.screenOffsetMm*Math.PI*4;micrometer.position.x=.413+delta;
    // Spindle is authored along local Z with a quaternion to world X. Its front
    // end follows the slide while the rear end remains inside the sleeve.
    spindle.position.x=.376+delta/2;spindle.scale.copy(spindleScale);spindle.scale.z*=1-delta/.061;spindle.quaternion.copy(spindleQuaternion);
    const src=required('FieldSource');src.position.z=.125*state.field*.01;src.rotation.y=Math.atan(state.field*.01);
    required('FieldKnob').rotation.z=-state.field*Math.PI;
    required('ApertureLever').rotation.x=(20-state.apertureMm)*Math.PI/32;
   }
  }
 };
}

// Raycaster does not skip descendants of invisible groups by itself.
export function visibleHit(intersections){return intersections.find(({object})=>{for(let n=object;n;n=n.parent)if(!n.visible)return false;return true;});}

export function frameInstrument(camera,controls,model,direction){
 const box=new T.Box3().setFromObject(model),center=box.getCenter(new T.Vector3());
 const back=direction.clone().normalize(),right=new T.Vector3().crossVectors(new T.Vector3(0,1,0),back).normalize(),up=new T.Vector3().crossVectors(back,right);
 const tan=Math.tan(T.MathUtils.degToRad(camera.fov/2));let distance=0;
 for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
  const p=new T.Vector3(x,y,z).sub(center),depth=p.dot(back);
  distance=Math.max(distance,depth+Math.abs(p.dot(right))/(tan*camera.aspect),depth+Math.abs(p.dot(up))/tan);
 }
 // Reserve a little breathing space for view controls without hiding the instrument.
 controls.target.copy(center);camera.position.copy(center).addScaledVector(back,distance*1.15);controls.update();
}

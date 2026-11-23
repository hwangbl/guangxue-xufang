import * as T from 'three';

// Follow the ideal moving contact planes while the micrometer bearings stay fixed.
// This is visual linkage geometry, not a second optical or elastic solver.
export function updateAngularSpindles(model){
 model.updateMatrixWorld(true);
 const holder=model.getObjectByName('FiberStage'),rotation=holder.getWorldQuaternion(new T.Quaternion());
 for(const [name,anchor,axis] of [['KnobPitch','PitchContact',[0,1,0]],['KnobYaw','YawContact',[0,0,1]]]){
  const mount=model.getObjectByName(name+'Mount'),rod=model.getObjectByName(name+'Spindle');
  const origin=mount.localToWorld(new T.Vector3(-.0285,0,0));
  const direction=new T.Vector3(-1,0,0).transformDirection(mount.matrixWorld);
  const normal=new T.Vector3(...axis).applyQuaternion(rotation);
  const point=model.getObjectByName(anchor).getWorldPosition(new T.Vector3());
  const distance=point.sub(origin).dot(normal)/direction.dot(normal);
  const end=mount.worldToLocal(origin.addScaledVector(direction,distance)).x;
  rod.position.x=(-.0285+end)/2;rod.scale.x=-.0285-end;
 }
 model.updateMatrixWorld(true);
}

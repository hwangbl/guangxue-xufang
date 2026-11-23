import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as T from 'three';

// Editable photo reconstruction. Units are relative, not surveyed millimetres.
export const DIMENSIONS = { baseLength: 5.3, baseWidth: 1.55, axisHeight: 1.95, axisTiltDegrees: 20, chamberLength: 3.25, dialRadius: .83 };
export function createPolarimeter(font) {
  const root = new T.Group(); root.name = 'WXG4';
  root.userData = { reference: 'User photographs 01–11; WXG-4 manual, printed page 5 (20 degree optical axis)', dimensionalAccuracy: 'photo approximation', revision: 4 };
  // Tilt the complete optical train about the lamp port; the lamp and feet stay upright.
  const axisTilt = T.MathUtils.degToRad(DIMENSIONS.axisTiltDegrees);
  const lampPort = new T.Vector3(-1.83, DIMENSIONS.axisHeight, 0);
  const opticalPoint = (x,y=0,z=0) => new T.Vector3(x-lampPort.x,y,z).applyAxisAngle(new T.Vector3(0,0,1),axisTilt).add(lampPort);
  const nodes = {};
  const mat = (name, color, metalness, roughness, extra = {}) => new T.MeshStandardMaterial({ name, color, metalness, roughness, ...extra });
  const ivory = mat('Ivory powder coating', 0xe3e1cc, .07, .54);
  const black = mat('Black enamel', 0x212325, .24, .38);
  const rubber = mat('Rubber and seals', 0x111415, .05, .77);
  const chrome = mat('Brushed nickel', 0xc9c6af, .88, .26);
  const ink = mat('Scale engraving', 0xe3e5d7, .1, .6);
  const glass = new T.MeshPhysicalMaterial({ name: 'Borosilicate glass', color: 0xdceeed, metalness: 0, roughness: .09, transmission: .96, thickness: .045, ior: 1.47, transparent: true, opacity: 1, depthWrite: false });
  const glow = mat('Sodium lamp glow', 0x362914, .05, .5, { emissive: 0xff9400, emissiveIntensity: 0 });
  function group(name, parent = root, position = [0, 0, 0]) { const g = new T.Group(); g.name = name; g.position.set(...position); parent.add(g); nodes[name] = g; return g; }
  function mesh(name, geometry, material, parent = root, pos = [0, 0, 0]) { const m = new T.Mesh(geometry, material); m.name = name; m.position.set(...pos); m.castShadow = material !== glass; m.receiveShadow = true; parent.add(m); return m; }
  function box(name, size, material, parent, pos) { return mesh(name, new RoundedBoxGeometry(...size,3,Math.min(...size)*.025), material, parent, pos); }
  function cylinder(name, radius, length, material, parent, pos, axis = 'x', top = radius) { const m = mesh(name, new T.CylinderGeometry(top, radius, length, 64), material, parent, pos); if (axis === 'x') m.rotation.z = -Math.PI / 2; if (axis === 'z') m.rotation.x = Math.PI / 2; return m; }
  function diskShape(radius) { const s = new T.Shape(); s.absarc(0, 0, radius, 0, Math.PI * 2, false); return s; }
  function hole(shape, x, y, r) { const p = new T.Path(); p.absarc(x, y, r, 0, Math.PI * 2, true); shape.holes.push(p); }
  function extrude(name, shape, depth, material, parent, pos, bevel = .015) { return mesh(name, new T.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, steps: 1, curveSegments: 32 }), material, parent, pos); }
  function ring(name, outer, inner, length, material, parent, pos) { const s = diskShape(outer); hole(s, 0, 0, inner); const m = extrude(name, s, length, material, parent, pos, .005); m.rotation.y = Math.PI / 2; return m; }
  function arc(name, radius, thickness, length, start, end, material, parent, pos) { const s = new T.Shape(); s.absarc(0, 0, radius, start, end, false); s.absarc(0, 0, radius - thickness, end, start, true); s.closePath(); const m = extrude(name, s, length, material, parent, pos, .002); m.rotation.y = Math.PI / 2; return m; }
  function label(text, size, parent, position, material = ink) { if (!font) return; const geo = new T.ShapeGeometry(font.generateShapes(text, size), 3); geo.computeBoundingBox(); const b = geo.boundingBox; geo.translate(-(b.max.x + b.min.x) / 2, -(b.max.y + b.min.y) / 2, 0); return mesh('Engraving_' + text, geo, material, parent, position); }
  function knurl(name, radius, length, material, parent, pos, count = 96, axis = 'x') {
    const g = group(name, parent, pos); cylinder('Core', radius - .006, length, material, g, [0,0,0], axis);
    const geo = new T.BoxGeometry(length * .94, .009, .012), inst = new T.InstancedMesh(geo, material, count); inst.name = 'Knurled ridges'; inst.castShadow = true;
    const o = new T.Object3D();
    for(let i=0;i<count;i++) { const a=i/count*Math.PI*2; o.position.set(0,Math.cos(a)*radius,Math.sin(a)*radius); o.rotation.set(a,0,0); if(axis==='y') { o.position.set(Math.cos(a)*radius,0,Math.sin(a)*radius); o.rotation.set(0,-a,Math.PI/2); } o.updateMatrix(); inst.setMatrixAt(i,o.matrix); } g.add(inst); return g;
  }
  function screw(parent, position, axis = 'x') { const g = group('Screw_' + parent.children.length, parent, position); cylinder('Round screw head', .027, .015, chrome, g, [0,0,0], axis); if(axis==='x') {box('Slot horizontal',[.002,.006,.034],black,g,[.009,0,0]);box('Slot vertical',[.002,.034,.006],black,g,[.009,0,0]);} else {box('Slot',[.034,.002,.005],black,g,[0,.009,0]);} return g; }

  // Extruded, curved pedestal profile, with a broad raised support at the eyepiece end.
  const supportRear=opticalPoint(1.26,-.34),supportFront=opticalPoint(1.58,-.34);
  const profile = new T.Shape(); profile.moveTo(-2.58,.09); profile.lineTo(2.62,.09); profile.lineTo(2.62,.23); profile.bezierCurveTo(2.5,.5,1.83,.55,supportFront.x,supportFront.y); profile.lineTo(supportRear.x,supportRear.y); profile.bezierCurveTo(1.12,.61,.85,.35,.2,.31); profile.lineTo(-2.58,.31); profile.closePath();
  const pedestal=extrude('Cast pedestal',profile,1.32,ivory,root,[0,0,-.66],.07);
  pedestal.updateMatrixWorld(true);
  function mountOnPedestal(part,x,localNormal,offset){
    const ray=new T.Raycaster(new T.Vector3(x,5,0),new T.Vector3(0,-1,0));
    const hit=ray.intersectObject(pedestal)[0];
    if(hit){const normal=hit.face.normal.clone().transformDirection(pedestal.matrixWorld);part.position.copy(hit.point).addScaledVector(normal,offset);part.quaternion.setFromUnitVectors(localNormal,normal);}
  }
  for(const x of [-2.2,2.2]) for(const z of [-.5,.5]) cylinder('Rubber foot',.13,.09,rubber,root,[x,.045,z],'y');
  const plaque = group('Nameplate',root,[2.13,.69,0]);
  box('Plate',[.48,.2,.012],black,plaque,[0,0,0]); label('WXG-4',.076,plaque,[0,0,.009]);
  mountOnPedestal(plaque,2.12,new T.Vector3(0,0,1),.012);
  // Lettering runs across the base; its top edge points uphill on the sloped face.
  const plateNormal=new T.Vector3(0,0,1).applyQuaternion(plaque.quaternion);
  const plateRight=new T.Vector3(0,0,-1);
  const plateUp=new T.Vector3().crossVectors(plateNormal,plateRight).normalize();
  plaque.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(plateRight,plateUp,plateNormal));
  const toggle=group('PowerSwitch',root,[2.43,.44,0]); toggle.rotation.z=-.55;
  box('Switch recess',[.20,.035,.24],black,toggle,[0,0,0]); const rocker=box('Rocker',[.15,.045,.18],rubber,toggle,[0,.026,0]); rocker.rotation.z=.13;
  const mark=label('I  O',.045,toggle,[0,.055,0]); if(mark) mark.rotation.x=-Math.PI/2;
  mountOnPedestal(toggle,2.45,new T.Vector3(0,1,0),.025);

  const lamp=group('LampHousing',root,[-2.08,.34,0]);
  cylinder('Foot flange',.39,.12,ivory,lamp,[0,.06,0],'y');
  // Hollow body with an actual rectangular side port, formed as an extruded unwrapped wall.
  const wall = new T.BufferGeometry(), verts=[], normals=[], indices=[];
  for(let row=0;row<=3;row++) { const h=[.12,1.24,2.07,2.34][row]; for(let i=0;i<=128;i++) {const a=i/128*2*Math.PI; verts.push(Math.cos(a)*.33,h,Math.sin(a)*.33);normals.push(Math.cos(a),0,Math.sin(a));} }
  for(let row=0;row<3;row++)for(let i=0;i<128;i++){if(row===1&&(i<12||i>=116))continue;const n=row*129+i;indices.push(n,n+129,n+1,n+1,n+129,n+130);}
  wall.setAttribute('position',new T.Float32BufferAttribute(verts,3));wall.setAttribute('normal',new T.Float32BufferAttribute(normals,3));wall.setIndex(indices);
  const lampCoat=ivory.clone(); lampCoat.side=T.DoubleSide;mesh('Lamp body with port',wall,lampCoat,lamp);
  const top = diskShape(.33); for(const [u,v] of [[0,0],[-.19,0],[.19,0],[0,-.19],[0,.19]])hole(top,u,v,.054);
  const cap=extrude('Five ventilation holes',top,.048,ivory,lamp,[0,2.34,0],.007);cap.rotation.x=-Math.PI/2;
  cylinder('Lamp inner emitter',.22,1.65,glow,lamp,[0,1.29,0],'y');
  cylinder('Ventilation glow diffuser',.30,.014,glow,lamp,[0,2.25,0],'y');
  for(const z of [-.195,.195])box('Port guide',[.06,.92,.027],ivory,lamp,[.29,1.66,z]);
  for(const h of [1.21,2.1])box('Port rim',[.055,.03,.42],ivory,lamp,[.29,h,0]);
  const axis=group('OpticalAssembly',root,opticalPoint(0).toArray());
  axis.rotation.z=axisTilt;
  ring('Black light connector',.22,.13,.25,black,axis,[-1.83,0,0]);
  ring('Polarizer collar',.35,.235,.15,ivory,axis,[-1.67,0,0]);ring('Polarizer cell',.29,.14,.12,black,axis,[-1.61,0,0]);
  arc('Sample chamber',.305,.025,3.15,Math.PI,2*Math.PI,black,axis,[-1.50,0,0]);
  for(const x of [-1.49,1.56]) {ring('Chamber end ring',.35,.27,.08,ivory,axis,[x,0,0]);}
  for(const z of [-.305,.305])box('Chamber edge',[3.12,.026,.022],ivory,axis,[.07,0,z]);
  // The end caps, rather than the optical glass, bear on the seats. The
  // central seat serves the short tube and clears the body of the long one.
  const tubeStart = -1.36;
  for (const x of [tubeStart, tubeStart + 1.42, tubeStart + 2.84]) {
    const support = arc('Tube saddle', .281, .093, .028, Math.PI, 2*Math.PI, rubber, axis, [x-.019,0,0]);
    support.userData.role = 'support';
    screw(axis, [x+.065,-.273,0], 'y');
  }
  const lid=group('ChamberLid',axis,[0,0,.31]);
  arc('Curved cover',.326,.020,3.14,0,Math.PI,black,lid,[-1.49,0,-.31]);
  cylinder('Lid pull',.025,.14,chrome,lid,[.04,.31,-.31],'y');
  for(const x of [-1.12,1.21])cylinder('Hinge knuckle',.034,.18,chrome,axis,[x,0,.31]);

  function tube(name, opticalLength, start) {
    const g=group(name,axis,[start,0,0]); const len=opticalLength;
    // Each cross-section grows toward the top only. The straight lower wall
    // keeps the eccentric trap above the optical axis in either tube.
    const sections = [0, .08, ...Array.from({length: 25}, (_, i) => len - .52 + i * .36 / 24), len - .12, len];
    const rise = x => {
      const t = (len - x - .16) / .36;
      return t > 0 && t < 1 ? .12 * Math.sin(Math.PI * t) ** 2 : 0;
    };
    const profile = sections.map(x => new T.Vector2(.092 + rise(x) / 2, x));
    const inside = profile.slice().reverse().map(p => new T.Vector2(p.x - .009, p.y));
    const wall = new T.LatheGeometry([...profile, ...inside, profile[0]], 48);
    const positions = wall.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      positions.setX(i, positions.getX(i) - rise(positions.getY(i)) / 2);
    }
    wall.computeVertexNormals();
    const body = mesh('Hollow glass and bubble trap',wall,glass,g);
    body.rotation.z = -Math.PI / 2;
    for(const x of [0,len]) { ring('Sealing gasket',.135,.082,.025,rubber,g,[x-.012,0,0]);ring('Nickel cap shoulder',.183,.088,.038,chrome,g,[x-.025,0,0]);
      const cap=group('TubeCap_'+x,g,[x,0,0]);ring('Open cap',.171,.083,.092,chrome,cap,[-.046,0,0]);
      const inst=new T.InstancedMesh(new T.BoxGeometry(.081,.009,.012),chrome,96);const o=new T.Object3D();for(let i=0;i<96;i++){const a=i/96*Math.PI*2;o.position.set(0,.17*Math.cos(a),.17*Math.sin(a));o.rotation.x=a;o.updateMatrix();inst.setMatrixAt(i,o.matrix);}cap.add(inst);
      cylinder('End optical window',.084,.01,glass,g,[x,0,0]); }
    const lettering=group('Tube marking',g,[Math.min(.85,len*.6),.033,.09]);label(name==='Tube200'?'SGW-200P':'SGW-100P',.043,lettering,[0,0,0],mat('Tube blue printing',0x366a91,0,.65));
    return g;
  }
  tube('Tube200',2.84,tubeStart);tube('Tube100',1.42,tubeStart);
  ring('Analyzer rear collar',.38,.17,.22,ivory,axis,[1.63,0,0]);
  const head=group('AnalyzerHousing',axis,[1.88,0,0]);
  // Front plate is perforated: two capsule windows and the eyepiece bore.
  function capsule(shape,x,y,w,h) { const p=new T.Path(); const r=w/2,d=h/2-r;p.moveTo(x-r,y-d);p.lineTo(x-r,y+d);p.absarc(x,y+d,r,Math.PI,0,true);p.lineTo(x+r,y-d);p.absarc(x,y-d,r,0,-Math.PI,true);shape.holes.push(p); }
  const face=diskShape(.83);hole(face,0,0,.225);capsule(face,-.61,0,.235,.54);capsule(face,.61,0,.235,.54);
  const front=extrude('Perforated faceplate',face,.065,ivory,head,[.14,0,0],.018);front.rotation.y=Math.PI/2;
  ring('Rear circular housing',.81,.24,.15,ivory,head,[-.035,0,0]);ring('Case seam',.825,.79,.012,black,head,[.12,0,0]);
  const dial=group('GraduatedDial',head,[.133,0,0]);dial.rotation.y=Math.PI/2;
  const scaleSurface=ring('Scale substrate',.775,.36,.014,black,head,[.105,0,0]);
  scaleSurface.userData.role='fixed backing';
  // Center the 19-degree vernier span in each window. Its first line is
  // the reference for both scales, and the dial moves beneath the fixed index.
  const indexAngle = -9.5;
  function tickSeries(name, count, parent) {
    const ticks = new T.InstancedMesh(new T.BoxGeometry(1,1,1), ink, count);
    ticks.name = name;
    parent.add(ticks);
    return ticks;
  }
  const stamp = new T.Object3D();
  function placeTick(series, i, angle, radius, length, width) {
    stamp.position.set(radius * Math.cos(angle), radius * Math.sin(angle), .004);
    stamp.rotation.z = angle;
    stamp.scale.set(length, width, .001);
    stamp.updateMatrix();
    series.setMatrixAt(i, stamp.matrix);
  }
  const degrees = tickSeries('Degree ticks', 360, dial);
  for (let degree = 0; degree < 360; degree++) {
    const angle = T.MathUtils.degToRad(indexAngle + degree);
    const major = degree % 5 === 0;
    placeTick(degrees, degree, angle, .637, major ? .064 : .043, .0026);
    if (major) {
      const signed = (degree + 90) % 180 - 90;
      const number = label(String(signed), .030, dial, [.696*Math.cos(angle), .696*Math.sin(angle), .006]);
      if (number) number.rotation.z = angle - Math.PI/2;
    }
  }
  const verniers = group('DualVerniers', head, [.133,0,0]);
  verniers.rotation.y = Math.PI/2;
  const vernierTicks = tickSeries('Vernier ticks', 42, verniers);
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i <= 20; i++) {
      const angle = T.MathUtils.degToRad(side*180 + indexAngle + .95*i);
      placeTick(vernierTicks, side*21+i, angle, .59, i%2 === 0 ? .037 : .027, .0024);
      if (i%4 === 0) {
        const number = label(String(i/2), .027, verniers, [.55*Math.cos(angle), .55*Math.sin(angle), .006]);
        if (number) number.rotation.z = angle - Math.PI/2;
      }
    }
  }
  for(const y of [-.25,.25])for(const z of [-.32,.32])screw(head,[.224,y,z]);
  const eyepiece=group('Eyepiece',head,[.21,0,0]);ring('Eyepiece mount',.232,.10,.105,black,eyepiece,[0,0,0]);
  const focusRing=knurl('FocusRing',.202,.18,black,eyepiece,[.20,0,0]);ring('Focus ring bore',.203,.10,.018,black,eyepiece,[.30,0,0]);
  ring('Eyepiece barrel',.18,.08,.24,black,eyepiece,[.30,0,0]);
  const cup=diskShape(.35);hole(cup,0,0,.028);hole(cup,-.235,0,.060);hole(cup,.235,0,.060);
  const eyecup=extrude('Three aperture eyecup',cup,.045,black,eyepiece,[.55,0,0],.012);eyecup.rotation.y=Math.PI/2;
  ring('Eyecup rim',.364,.342,.055,black,eyepiece,[.55,0,0]);
  ring('Central sight boss',.124,.028,.026,black,eyepiece,[.593,0,0]);
  for(const z of [-.235,.235]){ring('Magnifier rim',.069,.052,.027,black,eyepiece,[.597,0,z]);cylinder('Magnifier glass',.05,.008,glass,eyepiece,[.60,0,z]);}
  cylinder('Handwheel spindle',.07,.24,chrome,head,[0,-.88,0],'y');
  knurl('AnalyzerHandwheel',.385,.084,black,head,[0,-1.0,0],128,'y');
  cylinder('Handwheel hub',.13,.13,black,head,[0,-1.08,0],'y');
  const cableCurve=new T.CatmullRomCurve3([new T.Vector3(-2.3,.34,-.25),new T.Vector3(-2.68,.12,-.38),new T.Vector3(-2.9,.08,-.8),new T.Vector3(-2.2,.07,-1.05),new T.Vector3(-1.7,.06,-.86)]);
  mesh('Power cable',new T.TubeGeometry(cableCurve,48,.025,10,false),rubber);
  function setState({ lidOpen=true, lampOn=false, tubeLength='200', inserted=true, angle=0, focus=0 }={}) {
    lid.rotation.x=lidOpen?Math.PI:0;glow.emissiveIntensity=lampOn?3:0;glow.color.set(lampOn?0xffb523:0x362914);
    nodes.Tube200.visible=tubeLength==='200';nodes.Tube100.visible=tubeLength==='100';
    for(const name of ['Tube200','Tube100']) { nodes[name].position.y=inserted?0:.65;nodes[name].position.z=inserted?0:-.8; }
    dial.rotation.z=-angle*Math.PI/180;nodes.AnalyzerHandwheel.rotation.y=angle*Math.PI/180*4;
    focusRing.rotation.x=focus*2;eyepiece.position.x=.21+focus*.045;rocker.rotation.z=lampOn?-.13:.13;
  }
  setState();root.updateMatrixWorld(true);
  return { root,nodes,setState,materials:{ivory,black,glass,glow} };
}

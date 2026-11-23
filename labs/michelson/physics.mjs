export const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export function ready(s){return s.lamp&&s.expanded&&Math.hypot(s.pitch,s.yaw)<.15;}
export function result(a,b,n){
 if(![a,b].every(Number.isFinite)||a<0||a>100||b<0||b>100)throw Error('起止位置必须在0–100 mm内。');
 if(a===b)throw Error('起止读数不能相同，请继续同向微调。');
 if(!Number.isSafeInteger(n)||n<=0)throw Error('条纹数必须为可安全表示的正整数。');
 return 2*Math.abs(b-a)*1e6/n;
}
export function advance(s,dx){if(!Number.isFinite(dx))return;const x=clamp(Math.round((s.x+dx)*1e8)/1e8,0,100);const d=Math.sign(x-s.x);if(s.start!==null&&d){if(s.direction&&s.direction!==d)s.reversed=true;s.direction=d;}s.x=x;}
export function intensity(x,y,s){const wave=.0006328;const e=.8+s.x-50;const theta=Math.hypot(x,y)*.06;const phase=2*Math.PI*(2*e*Math.cos(theta)+.035*(s.yaw*x+s.pitch*y))/wave;return (.5+.5*Math.cos(phase))*Math.exp(-1.3*(x*x+y*y));}

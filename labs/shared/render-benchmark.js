// Opt-in local QA: absent from the normal experiment UI.
export function installRenderBenchmark({camera,controls,quality,host,renderer}){
 if(new URLSearchParams(location.search).get('benchmark')!=='1')return;
 const panel=document.createElement('section');panel.style.cssText='position:fixed;right:8px;top:8px;z-index:10000;padding:12px;background:#fff;color:#123;border:1px solid #abc;max-width:430px;font:12px monospace';
 const button=document.createElement('button');button.textContent='测试两档流畅度';const output=document.createElement('pre');output.id='render-benchmark-result';output.style.cssText='white-space:pre-wrap;max-height:220px;overflow:auto';output.textContent='就绪';panel.append(button,output);document.body.append(panel);
 const original=quality.render.bind(quality);let sample=null;
 quality.render=()=>{const start=performance.now();original();if(sample){sample.frames.push(start);sample.submit.push(performance.now()-start);}};
 const percentile=(a,p)=>{const sorted=[...a].sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))]||0;};
 button.onclick=async()=>{
 button.disabled=true;const results=[],select=document.querySelector('#render-quality')||host.querySelector('[aria-label="渲染画质"]'),previous=select.value,pos=camera.position.clone(),target=controls.target.clone(),offset=pos.clone().sub(target),up=camera.up.clone(),enabled=controls.enabled;
 controls.enabled=false;
 try{
 for(const mode of ['high','fast']){
 select.value=mode;select.dispatchEvent(new Event('change'));output.textContent=mode+'：预热并旋转测试…';
 let start=null;sample=null;
 await new Promise((resolve,reject)=>{
 function frame(now){if(document.hidden){reject(Error('页面失去可见状态，测试已中止'));return;}if(start===null)start=now;
 const elapsed=now-start;
 camera.position.copy(target).add(offset.clone().applyAxisAngle(up,Math.sin(elapsed/1500)*.24));controls.update();
 if(elapsed>=1500&&!sample)sample={frames:[],submit:[]};
 if(elapsed<7500)requestAnimationFrame(frame);else resolve();
 }requestAnimationFrame(frame);
 });
 const frames=sample.frames,submit=sample.submit;sample=null;const gaps=frames.slice(1).map((v,i)=>v-frames[i]).filter(v=>v>2);
 results.push({mode,frames:frames.length,seconds:6,fps:+(gaps.length/(gaps.reduce((a,b)=>a+b,0)/1000)).toFixed(1),p95FrameMs:+percentile(gaps,.95).toFixed(1),over50msPct:+(100*gaps.filter(v=>v>50).length/Math.max(1,gaps.length)).toFixed(1),medianSubmitMs:+percentile(submit,.5).toFixed(2),p95SubmitMs:+percentile(submit,.95).toFixed(2),pixels:[renderer.domElement.width,renderer.domElement.height]});
 }
 const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
 output.textContent=JSON.stringify({lab:location.pathname,visibility:document.visibilityState,viewport:[innerWidth,innerHeight],devicePixelRatio,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),results},null,2);
 output.dataset.complete='true';
 }catch(e){sample=null;output.textContent=e.message;output.dataset.complete='error';}finally{select.value=previous;select.dispatchEvent(new Event('change'));camera.position.copy(pos);controls.target.copy(target);controls.enabled=enabled;controls.update();quality.render();button.disabled=false;}
 };
}

import {labSessionStorage as sessionStorage} from '../shared/lab-runtime.js';
import {placeMeasurementPanel} from '../shared/unified-layout.js?v=20261117-scroll';
import {fields,isEqualDark,issues,result,normalize} from './physics.mjs?v=equal-dark';
import {installPlatformBridge} from '../shared/platform-bridge.js';
import {reportData,toCsv} from '../shared/archive.mjs';
export function installExperiment(state,apply,sync,renderSnapshot){
  const $=s=>document.querySelector(s);
  const pane=document.createElement('section');pane.className='measurement';
  pane.innerHTML=`<h2>半荫视场与测量</h2><div class="measure-grid"><div><canvas id="eye" width="360" height="360" aria-label="三分半荫视场"></canvas><p id="conditions" role="status"></p></div><div><label class="field">当前液体<select id="solution"><option value="blank">空白 · 蒸馏水</option><option value="sample">样品 · 蔗糖溶液</option></select></label><p>20°C · 钠黄光 589.3 nm · 比旋光度 +66.5°/(dm·g/mL)</p><label class="field">精调读数 / °<input id="exact-angle" type="number" min="-30" max="30" step=".05" value="0"></label><p>调节至中央与两侧暗且等亮，再记录。每次记录后主动偏转手轮，重新寻找等亮位置。</p><button id="record">记录当前读数</button> <button id="csv">导出 CSV</button><p id="record-message" role="status"></p><details id="teaching-settings"><summary>教学样品设置</summary><label class="field">蔗糖浓度 / g/mL<input id="concentration" type="number" min=".01" max=".2" step=".01" value=".1"></label><button id="sample-apply">应用并清空本轮记录</button><p>更换浓度会清空记录。浓度结果使用记录读数计算。</p></details></div></div><div class="table-wrap"><table><thead><tr><th>序号</th><th>液体</th><th>光程 / mm</th><th>读数 / °</th><th>操作</th></tr></thead><tbody id="rows"></tbody></table></div><p id="result"></p><button id="clear-records">清空测量记录</button>`;
  document.querySelector('main').after(pane);
  const conditions = pane.querySelector('#conditions');
  placeMeasurementPanel(pane,'polarimeter');
  const c=$('#eye').getContext('2d');
  function update(){
    const problems=issues(state),f=fields(state),lit=state.lampOn&&state.inserted&&!state.lidOpen;
    c.clearRect(0,0,360,360);c.fillStyle='#101817';c.fillRect(0,0,360,360);c.save();c.beginPath();c.arc(180,180,155,0,Math.PI*2);c.clip();
    const color=i=>{const b=lit?Math.min(245,15+Math.sqrt(i)*400):3;return `rgb(${b},${b*.76},${b*.15})`;};
    c.fillStyle=color(f.left);c.fillRect(0,0,360,360);c.filter=`blur(${state.focus*15}px)`;c.fillStyle=color(f.center);c.fillRect(145,0,70,360);c.restore();
    const equalDark = problems.length === 0 && isEqualDark(state);
    const status = problems.join('；') || (equalDark
      ? '已等暗 · 中央与两侧等亮，可以记录读数'
      : '尚未等暗 · 转动手轮，使中央与两侧等亮');
    if (conditions.textContent !== status) conditions.textContent = status;
    conditions.dataset.state = equalDark ? 'equal' : 'pending';
    if(document.activeElement!==$('#exact-angle'))$('#exact-angle').value=state.angle.toFixed(2);$('#solution').value=state.solution;
    $('#rows').replaceChildren();state.records.forEach((r,i)=>{const tr=document.createElement('tr');for(const text of [i+1,r.solution==='blank'?'空白':'蔗糖',r.length,r.angle.toFixed(2)]){const td=document.createElement('td');td.textContent=text;tr.append(td);}const td=document.createElement('td'),b=document.createElement('button');b.textContent='删除';b.onclick=()=>{state.records.splice(i,1);update();};td.append(b);tr.append(td);$('#rows').append(tr);});
    $('#result').textContent=['100','200'].map(l=>{const r=result(state.records,l);return r?`${l} mm：空白均值 ${r.blank.toFixed(3)}°，样品均值 ${r.sample.toFixed(3)}°，旋光角 ${r.rotation.toFixed(3)}°，浓度 ${r.concentration.toFixed(5)} g/mL。`:`${l} mm：空白 ${state.records.filter(r=>r.length===l&&r.solution==='blank').length}/5，样品 ${state.records.filter(r=>r.length===l&&r.solution==='sample').length}/5。`;}).join(' ');
    try{sessionStorage.setItem('wxg4-session',JSON.stringify({state}));}catch{$('#record-message').textContent='自动暂存不可用，请保存档案或导出记录。';}
  }
  $('#solution').onchange=e=>{state.solution=e.target.value;state.lidOpen=true;sync();apply();};
  $('#exact-angle').oninput=e=>{const n=Number(e.target.value);if(!Number.isFinite(n)||n< -30||n>30){e.target.value=state.angle;return;}state.angle=Math.round(n*20)/20;apply();};
  $('#record').onclick=()=>{const p=issues(state);if(p.length){$('#record-message').textContent=p.join('；');return;}if(state.records.length>=200){$('#record-message').textContent='已达到200条记录，请导出后清空。';return;}state.records.push({angle:state.angle,length:state.tubeLength,solution:state.solution});update();$('#record-message').textContent='读数已记录，请偏转手轮后重新判断等亮位置。';};
  $('#sample-apply').onclick=()=>{const n=Number($('#concentration').value);if(!Number.isFinite(n)||n<.01||n>.2){$('#record-message').textContent='浓度范围为0.01～0.20 g/mL。';return;}state.concentration=n;state.records=[];state.solution='blank';sync();apply();};
  $('#clear-records').onclick=()=>{state.records=[];update();};
  $('#csv').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob(['\ufeff'+toCsv(reportData('polarimeter',{state}))],{type:'text/csv;charset=utf-8'}));a.href=url;a.download='旋光仪测量.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  try{const raw=sessionStorage.getItem('wxg4-session');if(raw){Object.assign(state,normalize(JSON.parse(raw)).state);sync();}}catch{$('#record-message').textContent='暂存数据无效，已使用初始状态。';}
  $('#concentration').value=state.concentration;
  installPlatformBridge({lab:'polarimeter',ready:()=>true,read:()=>({state}),restore:p=>{Object.assign(state,p.state);$('#concentration').value=state.concentration;sync();apply();},render:()=>{apply();update();renderSnapshot();},eye:'#eye'});
  parent.postMessage({type:'polarimeter-ready'},location.origin);
  return update;
}

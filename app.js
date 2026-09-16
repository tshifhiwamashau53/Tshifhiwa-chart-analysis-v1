const input = document.getElementById('fileInput');
const upload = document.getElementById('uploadBtn');
const fileName = document.getElementById('fileName');
const workspace = document.getElementById('workspace');
const result = document.getElementById('result');
const canvas = document.getElementById('chartCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const direction = document.getElementById('direction');
const saveBtn = document.getElementById('saveBtn');
const reasoning = document.getElementById('reasoning');
const trailTitle = document.getElementById('trailTitle');
const trailStatus = document.getElementById('trailStatus');
const trailSteps = document.getElementById('trailSteps');
const trailExplanation = document.getElementById('trailExplanation');
let image = null;
let originalName = 'chart';
let lastAnalysis = null;
window.lastAnalysis = null;

upload.onclick = () => input.click();
input.onchange = () => {
  const file = input.files?.[0];
  if (!file) return;
  originalName = file.name.replace(/\.[^.]+$/, '') || 'chart';
  fileName.textContent = file.name;
  const reader = new FileReader();
  reader.onload = e => {
    image = new Image();
    image.onload = () => {
      workspace.classList.remove('hidden');
      result.classList.add('hidden');
      drawBase();
    };
    image.src = e.target.result;
  };
  reader.readAsDataURL(file);
};

function fit() {
  const max = Math.min(window.innerWidth * 0.94, 1400);
  const scale = Math.min(1, max / image.width);
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  return scale;
}
function drawBase() {
  fit();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
}
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function median(a){ if(!a.length)return 0; const x=[...a].sort((m,n)=>m-n); return x[Math.floor(x.length/2)]; }
function classifyPixel(r,g,b){
  const bullish = g > r * 1.12 && g > b * 1.06 && g > 85;
  const bearish = r > g * 1.12 && r > b * 1.05 && r > 85;
  return bullish ? 1 : bearish ? -1 : 0;
}

function detectCandles(){
  const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  const W=canvas.width,H=canvas.height;
  const minY=Math.round(H*.06), maxY=Math.round(H*.92);
  const scores=[];
  for(let x=0;x<W;x++){
    let bull=0,bear=0;
    for(let y=minY;y<maxY;y++){
      const i=(y*W+x)*4,c=classifyPixel(data[i],data[i+1],data[i+2]);
      if(c>0)bull++; else if(c<0)bear++;
    }
    scores.push({x,bull,bear,total:bull+bear});
  }
  const active=scores.filter(s=>s.total>=Math.max(2,H*.006));
  if(active.length<8)return [];
  const groups=[]; let group=[active[0]];
  for(let i=1;i<active.length;i++){
    if(active[i].x-group[group.length-1].x<=Math.max(5,W*.012)) group.push(active[i]);
    else { groups.push(group); group=[active[i]]; }
  }
  groups.push(group);
  const candles=[];
  for(const g of groups){
    if(g.length<2)continue;
    const x=Math.round(g.reduce((s,v)=>s+v.x,0)/g.length);
    const xs=g.map(v=>v.x),ys=[]; let bull=0,bear=0;
    for(const p of g){
      bull+=p.bull; bear+=p.bear;
      for(let y=minY;y<maxY;y++){
        const i=(y*W+p.x)*4,c=classifyPixel(data[i],data[i+1],data[i+2]);
        if(c)ys.push(y);
      }
    }
    if(ys.length<3)continue;
    const top=Math.min(...ys),bottom=Math.max(...ys),body=Math.max(2,Math.round((bottom-top)*.5));
    candles.push({x,left:Math.min(...xs),right:Math.max(...xs),top,bottom,range:bottom-top,bull,bear,body,dir:bull>=bear?'bullish':'bearish'});
  }
  const cleaned=[];
  for(const c of candles){
    const prev=cleaned[cleaned.length-1];
    if(prev && c.x-prev.x<Math.max(8,W*.018)){
      if(c.range>prev.range)cleaned[cleaned.length-1]=c;
    }else cleaned.push(c);
  }
  return cleaned.slice(-80);
}

function swingPoints(candles){
  const highs=[],lows=[];
  for(let i=2;i<candles.length-2;i++){
    const c=candles[i];
    if(c.top<=candles[i-1].top&&c.top<=candles[i-2].top&&c.top<=candles[i+1].top&&c.top<=candles[i+2].top)highs.push(i);
    if(c.bottom>=candles[i-1].bottom&&c.bottom>=candles[i-2].bottom&&c.bottom>=candles[i+1].bottom&&c.bottom>=candles[i+2].bottom)lows.push(i);
  }
  return {highs,lows};
}

function analyseCandlePatterns(c){
  const patterns=[];
  if(c.length<3)return patterns;
  const last=c[c.length-1],prev=c[c.length-2],p2=c[c.length-3];
  const avg=median(c.slice(-12).map(x=>x.range))||last.range;
  if(last.range>avg*1.45)patterns.push('displacement candle');
  if(last.dir!==prev.dir&&last.top<=prev.top&&last.bottom>=prev.bottom)patterns.push('engulfing structure');
  if(last.dir!==prev.dir&&Math.abs(last.range-prev.range)<avg*.65)patterns.push('rejection / reversal candle');
  if(last.range<avg*.55&&prev.range<avg*.7)patterns.push('compression / inside-range behaviour');
  if(p2.dir===prev.dir&&prev.dir!==last.dir)patterns.push('short-term momentum shift');
  return patterns;
}

function strategyEvidence(candles){
  const {highs,lows}=swingPoints(candles);
  const last=candles[candles.length-1];
  let bull=0,bear=0;
  const evidence=[];
  if(highs.length>=2&&lows.length>=2){
    const h1=candles[highs[highs.length-2]],h2=candles[highs[highs.length-1]];
    const l1=candles[lows[lows.length-2]],l2=candles[lows[lows.length-1]];
    if(h2.top<h1.top&&l2.bottom<l1.bottom){bear+=2;evidence.push('lower-high / lower-low structure');}
    if(h2.top>h1.top&&l2.bottom>l1.bottom){bull+=2;evidence.push('higher-high / higher-low structure');}
    if(last.top<h2.top&&last.bottom>l2.bottom)evidence.push('price is inside a recent swing range');
  }
  const patterns=analyseCandlePatterns(candles);
  for(const p of patterns){
    if(/displacement|engulfing|momentum shift/.test(p)){if(last.dir==='bullish')bull++;else bear++;}
    if(/rejection|compression/.test(p))evidence.push(p);
  }
  if(candles.length>=6){
    const a=candles[candles.length-5],b=candles[candles.length-4],d=candles[candles.length-2],e=candles[candles.length-1];
    const avg=median(candles.slice(-12).map(x=>x.range))||1;
    if(b.bottom>a.bottom&&d.dir==='bullish'&&d.range>avg*1.25){bull+=2;evidence.push('possible sell-side liquidity sweep followed by bullish displacement');}
    if(b.top<a.top&&d.dir==='bearish'&&d.range>avg*1.25){bear+=2;evidence.push('possible buy-side liquidity sweep followed by bearish displacement');}
    if(Math.abs(e.top-d.top)<Math.max(3,canvas.height*.008))evidence.push('possible equal-high liquidity');
    if(Math.abs(e.bottom-d.bottom)<Math.max(3,canvas.height*.008))evidence.push('possible equal-low liquidity');
  }
  const total=bull+bear;
  const bias=total?bull>bear?'bullish':bear>bull?'bearish':'mixed':'mixed';
  return {bull,bear,bias,evidence,patterns};
}

function drawLine(y,label,kind){
  const x=canvas.width*.035,w=canvas.width*.93;
  ctx.save();ctx.lineWidth=Math.max(2,canvas.width/600);ctx.setLineDash([10,7]);
  ctx.strokeStyle=kind==='watch'?'#3d6df2':kind==='target'?'#17865a':'#c94747';
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w,y);ctx.stroke();ctx.setLineDash([]);
  ctx.font='700 13px system-ui';ctx.fillStyle=ctx.strokeStyle;ctx.fillText(label,x+8,clamp(y-9,18,canvas.height-8));ctx.restore();
}
function drawZone(y1,y2,label,kind){
  const x=canvas.width*.035,w=canvas.width*.93;
  const c=kind==='watch'?'#3d6df2':kind==='target'?'#17865a':'#c94747';
  ctx.save();ctx.globalAlpha=.10;ctx.fillStyle=c;ctx.fillRect(x,Math.min(y1,y2),w,Math.abs(y2-y1));ctx.globalAlpha=1;ctx.restore();
  drawLine((y1+y2)/2,label,kind);
}

function annotate(candles,bias){
  if(!candles.length){const h=canvas.height;return {watch:h*.5,target:bias==='bullish'?h*.2:h*.8,invalidation:bias==='bullish'?h*.75:h*.25};}
  const last=candles[candles.length-1],recent=candles.slice(-Math.min(18,candles.length));
  const top=Math.min(...recent.map(c=>c.top)),bottom=Math.max(...recent.map(c=>c.bottom)),range=Math.max(20,bottom-top);
  if(bias==='bullish')return {watch:clamp(last.bottom-range*.08,top+range*.28,bottom-range*.18),target:clamp(top+range*.12,0,canvas.height),invalidation:clamp(bottom+range*.10,0,canvas.height)};
  if(bias==='bearish')return {watch:clamp(last.top+range*.08,top+range*.18,bottom-range*.28),target:clamp(bottom-range*.12,0,canvas.height),invalidation:clamp(top-range*.10,0,canvas.height)};
  return {watch:(top+bottom)/2,target:top+range*.12,invalidation:bottom-range*.12};
}

function drawArrow(x1,y1,x2,y2,label,kind='path'){
  const stroke=kind==='confirm'?'#3d6df2':kind==='risk'?'#c94747':'#555';
  ctx.save();ctx.strokeStyle=stroke;ctx.fillStyle=stroke;ctx.lineWidth=Math.max(2,canvas.width/650);ctx.setLineDash([9,6]);
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.setLineDash([]);
  const ang=Math.atan2(y2-y1,x2-x1),size=Math.max(7,canvas.width*.012);
  ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x2-size*Math.cos(ang-.45),y2-size*Math.sin(ang-.45));ctx.lineTo(x2-size*Math.cos(ang+.45),y2-size*Math.sin(ang+.45));ctx.closePath();ctx.fill();
  if(label){ctx.font='700 12px system-ui';ctx.fillText(label,clamp((x1+x2)/2-30,6,canvas.width-90),clamp((y1+y2)/2-8,18,canvas.height-8));}
  ctx.restore();
}

function drawMarketTrail(candles,bias,levels,ev){
  if(!candles.length)return {confirmed:false,breakSeen:false,retestSeen:false};
  const last=candles[candles.length-1];
  const recent=candles.slice(-Math.min(22,candles.length));
  const range=Math.max(20,Math.max(...recent.map(c=>c.bottom))-Math.min(...recent.map(c=>c.top)));
  const sw=swingPoints(candles);
  const lastHigh=sw.highs.length?candles[sw.highs[sw.highs.length-1]]:null;
  const lastLow=sw.lows.length?candles[sw.lows[sw.lows.length-1]]:null;
  const breakSeen=bias==='bullish'&&lastHigh?last.top<lastHigh.top:false || bias==='bearish'&&lastLow?last.bottom>lastLow.bottom:false;
  const pullbackDistance=range*.16;
  const retestSeen=bias==='bullish' ? last.bottom>levels.watch-pullbackDistance : bias==='bearish' ? last.top<levels.watch+pullbackDistance : false;
  const confirmation=(bias!=='mixed')&&(ev.patterns.some(p=>/displacement|engulfing|momentum/.test(p)) || ev.evidence.some(x=>/displacement/.test(x)));
  const x0=last.x;
  const x1=clamp(x0+canvas.width*.08,x0+20,canvas.width*.38);
  const x2=clamp(x0+canvas.width*.18,x1+20,canvas.width*.58);
  const x3=clamp(x0+canvas.width*.30,x2+20,canvas.width*.75);
  const x4=clamp(x0+canvas.width*.42,x3+20,canvas.width*.92);
  const y0=last.top+(last.bottom-last.top)*.5;
  const liquidityY=bias==='bullish'?Math.min(...recent.map(c=>c.bottom)):bias==='bearish'?Math.max(...recent.map(c=>c.top)):y0;
  const breakY=bias==='bullish'?Math.max(0,liquidityY-range*.35):bias==='bearish'?Math.min(canvas.height,liquidityY+range*.35):y0;
  const retestY=levels.watch;
  const targetY=levels.target;
  ctx.save();
  ctx.globalAlpha=.18;ctx.lineWidth=Math.max(8,canvas.width/90);ctx.strokeStyle=bias==='bullish'?'#3d6df2':bias==='bearish'?'#c94747':'#777';
  ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,liquidityY);ctx.lineTo(x2,breakY);ctx.lineTo(x3,retestY);ctx.lineTo(x4,targetY);ctx.stroke();ctx.restore();
  drawArrow(x0,y0,x1,liquidityY,'liquidity');
  drawArrow(x1,liquidityY,x2,breakY,'break');
  drawArrow(x2,breakY,x3,retestY,'retest / watch','confirm');
  drawArrow(x3,retestY,x4,targetY,'possible continuation');
  drawLine(retestY,'CONFIRMATION / WATCH','watch');
  drawLine(targetY,'POTENTIAL TARGET AREA','target');
  drawLine(levels.invalidation,'INVALIDATION','risk');
  return {confirmed:confirmation,breakSeen,retestSeen};
}

function buildTrailText(bias,state){
  if(bias==='mixed')return 'Mixed evidence: the trail stays conditional. Wait for a clear structural break and retest before treating the highlighted area as confirmation.';
  const side=bias==='bullish'?'upward':'downward';
  if(state.confirmed) return `Hypothetical ${side} path: current area → liquidity → structure break → pullback → confirmation/watch zone → possible continuation. The highlighted zone is where confirmation would be studied, not a command to enter a real trade.`;
  return `Hypothetical ${side} path: current area → liquidity → possible structure break → pullback/retest → confirmation/watch zone → possible continuation. Confirmation is not yet strong enough to treat the path as established.`;
}

function buildExplanation(bias,evidence,patterns,candles){
  const parts=[];
  if(evidence.length)parts.push(evidence.slice(0,5).join('; ')+'.');
  if(patterns.length)parts.push('Candle reading detected: '+patterns.join(', ')+'.');
  parts.push(`The image produced approximately ${candles.length} usable candle regions; this is a visual estimate, so screenshot quality can affect detection.`);
  if(bias==='mixed')parts.push('Signals conflict, so the analyzer keeps the scenario mixed instead of forcing a direction.');
  else parts.push(`${bias==='bullish'?'Bullish':'Bearish'} evidence is stronger in the visible structure, but technical patterns cannot guarantee what the market will do next.`);
  return parts.join(' ');
}

function analyse(){
  if(!image)return;
  drawBase();
  const candles=detectCandles();
  const ev=strategyEvidence(candles);
  let mode=direction.value;
  if(mode==='auto')mode=ev.bias;
  const levels=annotate(candles,mode);
  const recent=candles.length?candles.slice(-Math.min(18,candles.length)):[{top:canvas.height*.25,bottom:canvas.height*.75}];
  const range=Math.max(16,Math.max(...recent.map(c=>c.bottom))-Math.min(...recent.map(c=>c.top)));
  drawZone(levels.watch-range*.025,levels.watch+range*.025,'CONFIRMATION / WATCH','watch');
  drawZone(levels.target-range*.025,levels.target+range*.025,'POTENTIAL TARGET','target');
  drawZone(levels.invalidation-range*.025,levels.invalidation+range*.025,'INVALIDATION','risk');
  const sw=swingPoints(candles);
  ctx.save();ctx.setLineDash([4,5]);ctx.lineWidth=1;ctx.strokeStyle='rgba(80,80,80,.45)';
  for(const i of sw.highs.slice(-3)){ctx.beginPath();ctx.moveTo(candles[i].left,candles[i].top);ctx.lineTo(candles[i].right,candles[i].top);ctx.stroke();}
  for(const i of sw.lows.slice(-3)){ctx.beginPath();ctx.moveTo(candles[i].left,candles[i].bottom);ctx.lineTo(candles[i].right,candles[i].bottom);ctx.stroke();}
  ctx.restore();
  const trailState=drawMarketTrail(candles,mode,levels,ev);
  const total=ev.bull+ev.bear;
  const confidence=total?Math.round(50+Math.min(45,Math.abs(ev.bull-ev.bear)/(total+2)*45)):0;
  document.getElementById('setupTitle').textContent=mode==='bullish'?'Bullish scenario':mode==='bearish'?'Bearish scenario':'Mixed / conflicting evidence';
  document.getElementById('confidence').textContent=`Visual evidence ${confidence}%`;
  reasoning.textContent=buildExplanation(mode,ev.evidence,ev.patterns,candles);
  trailStatus.textContent=mode==='mixed'?'WAIT':trailState.confirmed?'CONFIRMATION DETECTED':'WAIT FOR CONFIRMATION';
  trailTitle.textContent=mode==='mixed'?'No clean path — evidence conflicts':mode==='bullish'?'Possible bullish path':'Possible bearish path';
  trailExplanation.textContent=buildTrailText(mode,trailState);
  trailSteps.innerHTML=mode==='mixed'
    ? '<span>Current area</span><i>→</i><span>Range</span><i>→</i><span>Wait</span><i>→</i><span>Break</span><i>→</i><span>Retest</span><i>→</i><span>Confirm</span>'
    : `<span>Current area</span><i>→</i><span>Liquidity</span><i>→</i><span>Break</span><i>→</i><span>Retest</span><i>→</i><span>Confirmation</span><i>→</i><span>Continuation</span>`;
  const detail=document.getElementById('strategyDetails');
  if(detail)detail.innerHTML=`<div><b>ICT / SMC</b><span>${ev.evidence.filter(x=>/liquidity|equal-|structure/.test(x)).join(' • ')||'No strong visual confirmation'}</span></div><div><b>Candles</b><span>${ev.patterns.join(' • ')||'No high-confidence candle pattern detected'}</span></div><div><b>Wyckoff / Price Action</b><span>${ev.evidence.filter(x=>/range|compression|rejection|momentum/.test(x)).join(' • ')||'No strong visual confirmation'}</span></div><div><b>Pattern engine</b><span>Major swing, break, retest and range relationships are checked from the uploaded image.</span></div>`;
  lastAnalysis={mode,candles,ev,levels,trailState};
  window.lastAnalysis=lastAnalysis;
  result.classList.remove('hidden');
  result.scrollIntoView({behavior:'smooth',block:'start'});
}

document.getElementById('analyzeBtn').onclick=analyse;
document.getElementById('resetBtn').onclick=()=>{if(image){drawBase();result.classList.add('hidden');lastAnalysis=null;window.lastAnalysis=null;}};

async function saveAnnotatedChart(){
  if(!image)return;
  const filename=`${originalName}-analysis.png`;
  canvas.toBlob(async blob=>{
    if(!blob)return;
    const file=new File([blob],filename,{type:'image/png'});
    try{if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({title:'Chart Analysis',text:'Annotated educational chart analysis',files:[file]});return;}}catch(err){if(err?.name==='AbortError')return;}
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  },'image/png');
}
saveBtn.onclick=saveAnnotatedChart;
window.onresize=()=>{if(image&&!result.classList.contains('hidden'))analyse();else if(image)drawBase();};

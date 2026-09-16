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
let image = null;
let originalName = 'chart';
let lastAnalysis = null;

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
function drawBase() { fit(); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height); }
function luminance(r,g,b){ return .2126*r+.7152*g+.0722*b; }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function median(a){ if(!a.length)return 0; const x=[...a].sort((m,n)=>m-n); return x[Math.floor(x.length/2)]; }

// Finds coloured candle pixels. This deliberately avoids reading a fabricated price scale.
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
      const i=(y*W+x)*4, c=classifyPixel(data[i],data[i+1],data[i+2]);
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
    const xs=g.map(v=>v.x);
    const ys=[]; let bull=0,bear=0;
    for(const p of g){ bull+=p.bull; bear+=p.bear; for(let y=minY;y<maxY;y++){const i=(y*W+p.x)*4,c=classifyPixel(data[i],data[i+1],data[i+2]);if(c)ys.push(y);} }
    if(ys.length<3)continue;
    const top=Math.min(...ys),bottom=Math.max(...ys), body=Math.max(2,Math.round((bottom-top)*.5));
    candles.push({x,left:Math.min(...xs),right:Math.max(...xs),top,bottom,range:bottom-top,bull,bear,body,dir:bull>=bear?'bullish':'bearish'});
  }
  // Remove very close detections so a single wide candle does not become several candles.
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
    if(c.top<=candles[i-1].top&&c.top<=candles[i-2].top&&c.top<=candles[i+1].top&&c.top<=candles[i+2].top) highs.push(i);
    if(c.bottom>=candles[i-1].bottom&&c.bottom>=candles[i-2].bottom&&c.bottom>=candles[i+1].bottom&&c.bottom>=candles[i+2].bottom) lows.push(i);
  }
  return {highs,lows};
}

function analyseCandlePatterns(c){
  const patterns=[];
  if(c.length<3)return patterns;
  const last=c[c.length-1], prev=c[c.length-2], p2=c[c.length-3];
  const avg=median(c.slice(-12).map(x=>x.range))||last.range;
  if(last.range>avg*1.45)patterns.push('displacement candle');
  if(last.dir!==prev.dir && last.top<=prev.top && last.bottom>=prev.bottom)patterns.push('engulfing structure');
  if(last.dir!==prev.dir && Math.abs(last.range-prev.range)<avg*.65)patterns.push('rejection / reversal candle');
  if(last.range<avg*.55 && prev.range<avg*.7)patterns.push('compression / inside-range behaviour');
  if(p2.dir===prev.dir && prev.dir!==last.dir)patterns.push('short-term momentum shift');
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
    const recentHigh=h2.top,recentLow=l2.bottom;
    if(last.top<recentHigh&&last.bottom>recentLow){
      evidence.push('price is inside a recent swing range');
    }
  }
  const patterns=analyseCandlePatterns(candles);
  for(const p of patterns){
    if(/displacement|engulfing|momentum shift/.test(p)){ if(last.dir==='bullish')bull++;else bear++; }
    if(/rejection|compression/.test(p))evidence.push(p);
  }
  // ICT/SMC-style visual heuristics: sweep followed by displacement.
  if(candles.length>=6){
    const a=candles[candles.length-5],b=candles[candles.length-4],d=candles[candles.length-2],e=candles[candles.length-1];
    if(b.bottom>a.bottom && d.dir==='bullish' && d.range>median(candles.slice(-12).map(x=>x.range))*1.25){bull+=2;evidence.push('possible sell-side liquidity sweep followed by bullish displacement');}
    if(b.top<a.top && d.dir==='bearish' && d.range>median(candles.slice(-12).map(x=>x.range))*1.25){bear+=2;evidence.push('possible buy-side liquidity sweep followed by bearish displacement');}
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
  ctx.strokeStyle=kind==='entry'?'#3d6df2':kind==='tp'?'#17865a':'#c94747';
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w,y);ctx.stroke();ctx.setLineDash([]);
  ctx.font='700 13px system-ui';ctx.fillStyle=ctx.strokeStyle;ctx.fillText(label,x+8,clamp(y-9,18,canvas.height-8));ctx.restore();
}
function drawZone(y1,y2,label,kind){
  const x=canvas.width*.035,w=canvas.width*.93;const c=kind==='entry'?'#3d6df2':kind==='tp'?'#17865a':'#c94747';
  ctx.save();ctx.globalAlpha=.10;ctx.fillStyle=c;ctx.fillRect(x,Math.min(y1,y2),w,Math.abs(y2-y1));ctx.globalAlpha=1;ctx.restore();drawLine((y1+y2)/2,label,kind);
}

function annotate(candles,bias){
  if(!candles.length){
    const h=canvas.height;return {entry:h*.5,tp:bias==='bullish'?h*.2:h*.8,sl:bias==='bullish'?h*.75:h*.25};
  }
  const last=candles[candles.length-1];
  const recent=candles.slice(-Math.min(18,candles.length));
  const top=Math.min(...recent.map(c=>c.top)),bottom=Math.max(...recent.map(c=>c.bottom));
  const range=Math.max(20,bottom-top);
  if(bias==='bullish') return {entry:clamp(last.bottom-range*.08,top+range*.28,bottom-range*.18),tp:clamp(top+range*.12,0,canvas.height),sl:clamp(bottom+range*.10,0,canvas.height)};
  if(bias==='bearish') return {entry:clamp(last.top+range*.08,top+range*.18,bottom-range*.28),tp:clamp(bottom-range*.12,0,canvas.height),sl:clamp(top-range*.10,0,canvas.height)};
  return {entry:(top+bottom)/2,tp:top+range*.12,sl:bottom-range*.12};
}

function buildExplanation(bias,evidence,patterns,candles){
  const count=candles.length;
  const lead=bias==='bullish'?'Bullish':'bearish';
  const parts=[];
  if(evidence.length)parts.push(evidence.slice(0,5).join('; ')+'.');
  if(patterns.length)parts.push('Candle reading detected: '+patterns.join(', ')+'.');
  parts.push(`The image produced approximately ${count} usable candle regions; this is a visual estimate, so screenshot quality can affect detection.`);
  if(bias==='mixed')parts.push('Signals conflict, so the analyzer keeps the scenario mixed instead of forcing a direction.');
  else parts.push(`${lead} evidence is stronger in the visible structure, but this is an educational chart interpretation rather than a guaranteed market outcome.`);
  return parts.join(' ');
}

function analyse(){
  if(!image)return;
  drawBase();
  const candles=detectCandles();
  const ev=strategyEvidence(candles);
  let mode=direction.value;
  if(mode==='auto')mode=ev.bias;
  if(mode==='mixed')mode='mixed';
  const levels=annotate(candles,mode);
  const recent=candles.slice(-Math.min(18,candles.length));
  const range=Math.max(16,(Math.max(...recent.map(c=>c.bottom),canvas.height*.55)-Math.min(...recent.map(c=>c.top),canvas.height*.45)));
  drawZone(levels.entry-range*.025,levels.entry+range*.025,'ENTRY ZONE','entry');
  drawZone(levels.tp-range*.025,levels.tp+range*.025,'TP ZONE','tp');
  drawZone(levels.sl-range*.025,levels.sl+range*.025,'SL ZONE','sl');
  // Mark detected swing areas without writing prices.
  const sw=swingPoints(candles);
  ctx.save();ctx.setLineDash([4,5]);ctx.lineWidth=1;
  ctx.strokeStyle='rgba(80,80,80,.45)';
  for(const i of sw.highs.slice(-3)){ctx.beginPath();ctx.moveTo(candles[i].left, candles[i].top);ctx.lineTo(candles[i].right, candles[i].top);ctx.stroke();}
  for(const i of sw.lows.slice(-3)){ctx.beginPath();ctx.moveTo(candles[i].left, candles[i].bottom);ctx.lineTo(candles[i].right, candles[i].bottom);ctx.stroke();}
  ctx.restore();
  const total=ev.bull+ev.bear;const confidence=total?Math.round(50+Math.min(45,Math.abs(ev.bull-ev.bear)/(total+2)*45)):0;
  document.getElementById('setupTitle').textContent=mode==='bullish'?'Bullish scenario':mode==='bearish'?'Bearish scenario':'Mixed / conflicting evidence';
  document.getElementById('confidence').textContent=`Visual evidence ${confidence}%`;
  reasoning.textContent=buildExplanation(mode,ev.evidence,ev.patterns,candles);
  const detail=document.getElementById('strategyDetails');
  if(detail) detail.innerHTML=`<div><b>ICT / SMC</b><span>${ev.evidence.filter(x=>/liquidity|equal-|structure/.test(x)).join(' • ')||'No strong visual confirmation'}</span></div><div><b>Candles</b><span>${ev.patterns.join(' • ')||'No high-confidence candle pattern detected'}</span></div><div><b>Wyckoff / Price Action</b><span>${ev.evidence.filter(x=>/range|compression|rejection|momentum/.test(x)).join(' • ')||'No strong visual confirmation'}</span></div><div><b>Pattern engine</b><span>Major swing and range relationships are checked from the uploaded image.</span></div>`;
  lastAnalysis={mode,candles,ev,levels};
  result.classList.remove('hidden');result.scrollIntoView({behavior:'smooth',block:'start'});
}

document.getElementById('analyzeBtn').onclick=analyse;
document.getElementById('resetBtn').onclick=()=>{if(image){drawBase();result.classList.add('hidden');lastAnalysis=null;}};

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
saveBtn.onclick=saveAnnotatedChart;saveBtn.textContent='Save / Share chart';
window.onresize=()=>{if(image&&!result.classList.contains('hidden'))analyse();else if(image)drawBase();};

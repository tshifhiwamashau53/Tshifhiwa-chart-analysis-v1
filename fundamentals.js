(() => {
  const panel = document.querySelector('.fundamentals-panel');
  const explanation = document.getElementById('fundamentalExplanation');
  const grid = document.getElementById('fundamentalGrid');
  if (!panel || !explanation || !grid) return;

  const head = panel.querySelector('.fund-head');
  const controls = document.createElement('div');
  controls.className = 'macro-controls';
  controls.innerHTML = `<label for="marketSelect">Market news</label><select id="marketSelect"><option value="gold">Gold / XAUUSD</option><option value="eurusd">EURUSD</option><option value="gbpusd">GBPUSD</option><option value="usdjpy">USDJPY</option><option value="bitcoin">Bitcoin</option><option value="usindices">US indices</option><option value="general">General macro</option></select><button id="refreshNews" class="secondary" type="button">Refresh news</button>`;
  head.insertAdjacentElement('afterend', controls);

  const queries = {
    gold: 'gold XAUUSD Federal Reserve inflation dollar oil geopolitics',
    eurusd: 'EUR USD euro dollar ECB Federal Reserve inflation',
    gbpusd: 'GBP USD pound dollar Bank of England inflation',
    usdjpy: 'USD JPY yen dollar Bank of Japan Federal Reserve',
    bitcoin: 'Bitcoin BTC crypto ETF regulation interest rates',
    usindices: 'US stocks S&P 500 Nasdaq Federal Reserve inflation earnings',
    general: 'Federal Reserve inflation interest rates oil dollar markets'
  };
  const up = {
    gold:['rate cut','lower yields','weaker dollar','safe haven','geopolitical','war','tension','uncertainty'],
    eurusd:['ecb hawkish','eurozone growth','strong euro','dollar weak','fed dovish'],
    gbpusd:['boe hawkish','uk growth','pound strong','dollar weak','fed dovish'],
    usdjpy:['fed hawkish','higher yields','boj dovish','dollar strong'],
    bitcoin:['etf inflow','institutional','adoption','rate cut','liquidity'],
    usindices:['rate cut','lower yields','soft landing','earnings beat','growth']
  };
  const down = {
    gold:['rate hike','higher yields','stronger dollar','hawkish fed','inflation','oil surge'],
    eurusd:['fed hawkish','ecb dovish','eurozone recession','dollar strong'],
    gbpusd:['boe dovish','uk recession','pound weak','dollar strong'],
    usdjpy:['boj hawkish','boj hike','yen strong','fed dovish'],
    bitcoin:['regulation','outflow','risk off','higher yields','rate hike'],
    usindices:['rate hike','higher yields','inflation','recession','earnings miss','oil surge']
  };
  const esc = s => String(s || '').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  const clean = s => String(s || '').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();

  function parseRSS(xml){
    const doc = new DOMParser().parseFromString(xml,'text/xml');
    return [...doc.querySelectorAll('item')].slice(0,8).map(item => ({
      title:clean(item.querySelector('title')?.textContent),
      link:item.querySelector('link')?.textContent?.trim() || '#',
      date:item.querySelector('pubDate')?.textContent?.trim() || ''
    })).filter(x=>x.title);
  }

  async function fetchRSS(q){
    const target=`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-ZA&gl=ZA&ceid=ZA:en`;
    for(const url of [`https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,target]){
      try{
        const r=await fetch(url,{cache:'no-store'});
        if(!r.ok) continue;
        const items=parseRSS(await r.text());
        if(items.length)return items;
      }catch(e){}
    }
    throw new Error('News unavailable');
  }

  function newsScore(items,market){
    let score=0;
    for(const item of items){
      const t=item.title.toLowerCase();
      for(const w of (up[market]||up.gold))if(t.includes(w))score++;
      for(const w of (down[market]||down.gold))if(t.includes(w))score--;
    }
    return score;
  }

  function technicalScore(a){return a?.ev ? (a.ev.bull||0)-(a.ev.bear||0) : 0;}

  function render(items,market){
    const a=window.__chartAnalysis||null;
    const ns=newsScore(items,market);
    const ts=technicalScore(a);
    const combined=ts+Math.max(-3,Math.min(3,ns));
    const label=combined>=3?'BUY BIAS':combined<=-3?'SELL BIAS':'WAIT';
    const text=combined>=3?'Technical and recent headline evidence currently lean in the same bullish direction.':combined<=-3?'Technical and recent headline evidence currently lean in the same bearish direction.':'Technical and macro evidence is mixed or too weak to force a directional bias.';
    const driver=market==='gold'?'For gold, the main macro channels are the US dollar, Treasury yields, Federal Reserve expectations, inflation, oil and geopolitical demand for safety.':'The main macro channels are central-bank expectations, inflation, growth, yields, risk appetite and major headlines.';
    explanation.innerHTML=`<div><b>Educational bias: ${label}</b> — ${esc(text)}</div><div><b>Why a sudden reversal can happen:</b> ${esc(driver)} A surprise release or changed policy expectation can quickly invalidate a technical scenario.</div><div><b>Evidence mix:</b> technical ${ts>0?'bullish':ts<0?'bearish':'mixed'}; headline keyword balance ${ns>0?'bullish':ns<0?'bearish':'mixed'}.</div>`;
    grid.innerHTML=items.slice(0,6).map(item=>`<article class="fund-card"><span class="fund-tag">RECENT HEADLINE</span><h4>${esc(item.title)}</h4><p>${item.date?esc(new Date(item.date).toLocaleString()):'Date not supplied'}</p><strong><a href="${esc(item.link)}" target="_blank" rel="noopener noreferrer">Read source</a></strong></article>`).join('');
    const status=panel.querySelector('.macro-status');
    if(status)status.textContent=`${label} • LIVE FEED`;
  }

  async function refresh(){
    const market=document.getElementById('marketSelect').value;
    const status=panel.querySelector('.macro-status');
    if(status)status.textContent='LOADING NEWS';
    explanation.innerHTML='<div><b>Reading recent headlines and macro drivers…</b> Fetching a public news feed.</div>';
    grid.innerHTML='';
    try{
      const items=await fetchRSS(queries[market]);
      window.__fundamentalData={market,items,updatedAt:Date.now(),score:newsScore(items,market)};
      render(items,market);
    }catch(e){
      if(status)status.textContent='NEWS UNAVAILABLE';
      explanation.innerHTML='<div><b>Live news feed could not be reached.</b> Technical analysis still works. No headlines are invented or substituted.</div>';
      grid.innerHTML='<article class="fund-card"><span class="fund-tag">NO LIVE DATA</span><h4>Public news feed unavailable</h4><p>Tap Refresh news when the connection is available.</p></article>';
    }
  }

  document.getElementById('refreshNews').onclick=refresh;
  document.getElementById('marketSelect').onchange=refresh;

  const analyzeBtn=document.getElementById('analyzeBtn');
  const originalAnalyze=analyzeBtn.onclick;
  analyzeBtn.onclick=async()=>{
    originalAnalyze?.();
    window.__chartAnalysis=window.lastAnalysis||null;
    if(window.__fundamentalData)render(window.__fundamentalData.items,window.__fundamentalData.market);
    else await refresh();
  };
  setTimeout(refresh,250);
})();

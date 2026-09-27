(() => {
  const panel=document.querySelector('.fundamentals-panel');
  if(!panel)return;
  const status=panel.querySelector('.macro-status');
  if(status)status.textContent='NO LIVE FEED';
  // Standalone mode: deliberately no fetch(), API, external news feed or market-data dependency.
  // Macro/news context is displayed as a manual consideration only.
})();
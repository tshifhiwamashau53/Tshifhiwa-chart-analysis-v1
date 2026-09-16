document.addEventListener('DOMContentLoaded', () => {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const trail = document.querySelector('.trail-panel');
  const chartLabel = document.querySelector('.chart-label');
  const saveBtn = document.getElementById('saveBtn');
  const sub = document.querySelector('.sub');

  if (trail) trail.remove();
  if (chartLabel) chartLabel.textContent = 'SOURCE CHART';
  if (saveBtn) saveBtn.textContent = 'Save chart';
  if (sub) sub.textContent = 'Upload a chart screenshot and get technical analysis covering market structure, liquidity, candle behaviour, momentum, break and retest, ICT / SMC concepts, Wyckoff and price action. No predicted drawing is placed over your chart.';

  if (analyzeBtn && typeof analyse === 'function') {
    analyzeBtn.onclick = () => {
      analyse();
      requestAnimationFrame(() => drawBase());
    };
  }
});

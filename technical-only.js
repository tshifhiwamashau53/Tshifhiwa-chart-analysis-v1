/* Technical chart annotations only.
   No future/projection trail, TP/SL path, or invented price levels.
   Annotations are drawn only inside the chart plotting area. */

document.addEventListener('DOMContentLoaded', () => {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const trail = document.querySelector('.trail-panel');
  const chartLabel = document.querySelector('.chart-label');
  const saveBtn = document.getElementById('saveBtn');
  const sub = document.querySelector('.sub');

  if (trail) trail.remove();
  if (chartLabel) chartLabel.textContent = 'TECHNICAL CHART';
  if (saveBtn) saveBtn.textContent = 'Save chart';
  if (sub) sub.textContent = 'Upload a chart screenshot and get technical analysis with order blocks, fair value gaps, liquidity, structure, BOS, CHoCH, support, resistance and candle behaviour.';

  function label(x, y, text, stroke) {
    ctx.save();
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillStyle = stroke;
    ctx.strokeStyle = 'rgba(255,255,255,.92)';
    ctx.lineWidth = 4;
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function zone(x1, y1, x2, y2, text, stroke) {
    const left = Math.max(getPlotLeft(), Math.min(x1, x2));
    const right = Math.min(getPlotRight(), Math.max(x1, x2));
    const top = clamp(Math.min(y1, y2), 2, canvas.height - 2);
    const bottom = clamp(Math.max(y1, y2), 2, canvas.height - 2);
    if (right <= left || bottom <= top) return;
    ctx.save();
    ctx.fillStyle = stroke;
    ctx.globalAlpha = .12;
    ctx.fillRect(left, top, right - left, bottom - top);
    ctx.globalAlpha = .72;
    ctx.lineWidth = Math.max(1.5, canvas.width / 900);
    ctx.strokeStyle = stroke;
    ctx.strokeRect(left, top, right - left, bottom - top);
    ctx.restore();
    label(left + 5, clamp(top - 6, 15, canvas.height - 8), text, stroke);
  }

  function markTechnical(candles) {
    if (!candles || candles.length < 5) return;

    const right = getPlotRight() - 4;
    const start = Math.max(0, candles.length - 24);
    const recent = candles.slice(start);
    const avg = median(candles.slice(-12).map(c => c.range)) || 1;

    // Order blocks: last opposite candle before a strong displacement move.
    for (let i = Math.max(2, start + 2); i < candles.length; i++) {
      const impulse = candles[i];
      if (impulse.range < avg * 1.35) continue;
      const origin = candles[i - 1];
      const bullishOB = impulse.dir === 'bullish' && origin.dir === 'bearish';
      const bearishOB = impulse.dir === 'bearish' && origin.dir === 'bullish';
      if (!bullishOB && !bearishOB) continue;
      zone(origin.left, origin.top, right, origin.bottom,
        bullishOB ? 'BULLISH ORDER BLOCK' : 'BEARISH ORDER BLOCK',
        bullishOB ? '#17865a' : '#c94747');
    }

    // Fair value gaps: three-candle displacement imbalance.
    for (let i = Math.max(2, start + 2); i < candles.length; i++) {
      const a = candles[i - 2], c = candles[i];
      if (c.bottom < a.top - 2) {
        zone(a.right, c.bottom, right, a.top, 'BULLISH FVG', '#3d6df2');
      } else if (c.top > a.bottom + 2) {
        zone(a.right, a.bottom, right, c.top, 'BEARISH FVG', '#8b4bb3');
      }
    }

    // Recent swing liquidity and structure labels.
    const sw = swingPoints(candles);
    const highIdx = sw.highs.slice(-3);
    const lowIdx = sw.lows.slice(-3);
    highIdx.forEach(i => {
      const c = candles[i];
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = '#555';
      ctx.globalAlpha = .55;
      ctx.beginPath(); ctx.moveTo(Math.max(getPlotLeft(), c.left), c.top); ctx.lineTo(right, c.top); ctx.stroke();
      ctx.restore();
      label(Math.max(getPlotLeft() + 4, c.left), clamp(c.top - 6, 15, canvas.height - 8), 'BUY-SIDE LIQUIDITY', '#555');
    });
    lowIdx.forEach(i => {
      const c = candles[i];
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = '#555';
      ctx.globalAlpha = .55;
      ctx.beginPath(); ctx.moveTo(Math.max(getPlotLeft(), c.left), c.bottom); ctx.lineTo(right, c.bottom); ctx.stroke();
      ctx.restore();
      label(Math.max(getPlotLeft() + 4, c.left), clamp(c.bottom + 15, 15, canvas.height - 6), 'SELL-SIDE LIQUIDITY', '#555');
    });

    // BOS / CHoCH: compare the latest candle with the latest confirmed swing.
    const last = candles[candles.length - 1];
    const prevHigh = highIdx.length ? candles[highIdx[highIdx.length - 1]] : null;
    const prevLow = lowIdx.length ? candles[lowIdx[lowIdx.length - 1]] : null;
    if (prevHigh && last.top < prevHigh.top) {
      label(clamp(last.x + 5, getPlotLeft(), right - 70), clamp(last.top - 12, 15, canvas.height - 8), 'BOS / CHoCH', '#3d6df2');
    }
    if (prevLow && last.bottom > prevLow.bottom) {
      label(clamp(last.x + 5, getPlotLeft(), right - 70), clamp(last.bottom + 18, 15, canvas.height - 8), 'BOS / CHoCH', '#c94747');
    }

    // Keep annotation count readable on small phone screenshots.
    if (recent.length) {
      const strongest = recent.reduce((a, b) => b.range > a.range ? b : a, recent[0]);
      if (strongest.range > avg * 1.45) {
        label(clamp(strongest.left, getPlotLeft(), right - 100), clamp(strongest.top - 8, 15, canvas.height - 8), 'DISPLACEMENT', strongest.dir === 'bullish' ? '#17865a' : '#c94747');
      }
    }
  }

  if (analyzeBtn && typeof analyse === 'function') {
    analyzeBtn.onclick = () => {
      analyse();
      requestAnimationFrame(() => {
        drawBase();
        const candles = detectCandles();
        markTechnical(candles);
      });
    };
  }
});

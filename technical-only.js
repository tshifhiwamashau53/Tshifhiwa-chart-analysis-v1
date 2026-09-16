/* Technical analysis annotations.
   No projected future path. The original chart stays visible.
   Technical labels stay inside the plotting area and leave the price scale untouched. */

document.addEventListener('DOMContentLoaded', () => {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const chartLabel = document.querySelector('.chart-label');
  const saveBtn = document.getElementById('saveBtn');
  const sub = document.querySelector('.sub');

  if (chartLabel) chartLabel.textContent = 'TECHNICAL CHART';
  if (saveBtn) saveBtn.textContent = 'Save annotated chart';
  if (sub) sub.textContent = 'Upload a chart screenshot and get technical analysis using ICT, SMC, order blocks, fair value gaps, liquidity, BOS, CHoCH, Wyckoff and price action.';

  function label(x, y, text, stroke) {
    ctx.save();
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillStyle = stroke;
    ctx.strokeStyle = 'rgba(255,255,255,.94)';
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

  function horizontal(y, text, stroke) {
    const left = getPlotLeft();
    const right = getPlotRight() - 4;
    const yy = clamp(y, 4, canvas.height - 4);
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(1.8, canvas.width / 800);
    ctx.setLineDash([9, 6]);
    ctx.beginPath();
    ctx.moveTo(left, yy);
    ctx.lineTo(right, yy);
    ctx.stroke();
    ctx.restore();
    label(left + 7, clamp(yy - 7, 15, canvas.height - 8), text, stroke);
  }

  function findOrderBlocks(candles, start, avg) {
    const blocks = [];
    for (let i = Math.max(1, start + 1); i < candles.length; i++) {
      const impulse = candles[i];
      const origin = candles[i - 1];
      if (impulse.range < avg * 1.35) continue;
      if (impulse.dir === 'bullish' && origin.dir === 'bearish') {
        blocks.push({ type: 'bullish', candle: origin, impulse });
      }
      if (impulse.dir === 'bearish' && origin.dir === 'bullish') {
        blocks.push({ type: 'bearish', candle: origin, impulse });
      }
    }
    return blocks.slice(-3);
  }

  function findFVGs(candles, start) {
    const gaps = [];
    for (let i = Math.max(2, start + 2); i < candles.length; i++) {
      const a = candles[i - 2], c = candles[i];
      if (c.bottom < a.top - 2) {
        gaps.push({ type: 'bullish', left: a.right, top: c.bottom, bottom: a.top });
      } else if (c.top > a.bottom + 2) {
        gaps.push({ type: 'bearish', left: a.right, top: a.bottom, bottom: c.top });
      }
    }
    return gaps.slice(-3);
  }

  function drawEntryTpSl(candles, bias, blocks) {
    if (!candles.length || bias === 'mixed') return;

    const recent = candles.slice(-Math.min(18, candles.length));
    const top = Math.min(...recent.map(c => c.top));
    const bottom = Math.max(...recent.map(c => c.bottom));
    const range = Math.max(20, bottom - top);
    const last = candles[candles.length - 1];

    const sameSide = blocks.filter(b => b.type === bias);
    const block = sameSide.length ? sameSide[sameSide.length - 1].candle : null;

    // Entry is a chart location near the latest valid order block / reaction area.
    const entry = block
      ? (block.top + block.bottom) / 2
      : bias === 'bullish'
        ? last.bottom - range * .05
        : last.top + range * .05;

    // TP/SL are locations only. No prices are generated.
    const tp = bias === 'bullish'
      ? Math.max(top, top + range * .08)
      : Math.min(bottom, bottom - range * .08);
    const sl = bias === 'bullish'
      ? Math.min(canvas.height - 4, (block ? block.bottom : last.bottom) + range * .10)
      : Math.max(4, (block ? block.top : last.top) - range * .10);

    horizontal(entry, 'ENTRY', '#3d6df2');
    horizontal(tp, 'TP', '#17865a');
    horizontal(sl, 'SL', '#c94747');

    if (block) {
      zone(
        block.left,
        block.top,
        getPlotRight() - 5,
        block.bottom,
        bias === 'bullish' ? 'ENTRY • BULLISH ORDER BLOCK' : 'ENTRY • BEARISH ORDER BLOCK',
        bias === 'bullish' ? '#17865a' : '#c94747'
      );
    }
  }

  function markTechnical(candles) {
    if (!candles || candles.length < 5) return;

    const right = getPlotRight() - 4;
    const start = Math.max(0, candles.length - 30);
    const recent = candles.slice(start);
    const avg = median(candles.slice(-12).map(c => c.range)) || 1;
    const ev = strategyEvidence(candles);
    const bias = ev.bias;

    // ICT / SMC order blocks: opposite candle immediately before displacement.
    const blocks = findOrderBlocks(candles, start, avg);
    blocks.forEach(b => {
      zone(
        b.candle.left,
        b.candle.top,
        right,
        b.candle.bottom,
        b.type === 'bullish' ? 'BULLISH ORDER BLOCK' : 'BEARISH ORDER BLOCK',
        b.type === 'bullish' ? '#17865a' : '#c94747'
      );
    });

    // ICT fair value gaps / imbalances.
    const gaps = findFVGs(candles, start);
    gaps.forEach(g => {
      zone(g.left, g.top, right, g.bottom,
        g.type === 'bullish' ? 'BULLISH FVG' : 'BEARISH FVG',
        '#3d6df2');
    });

    // Liquidity resting around confirmed swing highs/lows.
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

    // Structural break markers.
    const last = candles[candles.length - 1];
    const prevHigh = highIdx.length ? candles[highIdx[highIdx.length - 1]] : null;
    const prevLow = lowIdx.length ? candles[lowIdx[lowIdx.length - 1]] : null;
    if (prevHigh && last.top < prevHigh.top) {
      label(clamp(last.x + 5, getPlotLeft(), right - 75), clamp(last.top - 12, 15, canvas.height - 8), 'BOS / CHoCH', '#3d6df2');
    }
    if (prevLow && last.bottom > prevLow.bottom) {
      label(clamp(last.x + 5, getPlotLeft(), right - 75), clamp(last.bottom + 18, 15, canvas.height - 8), 'BOS / CHoCH', '#c94747');
    }

    // Displacement is important to ICT order-block validity.
    const strongest = recent.reduce((a, b) => b.range > a.range ? b : a, recent[0]);
    if (strongest && strongest.range > avg * 1.45) {
      label(clamp(strongest.left, getPlotLeft(), right - 105), clamp(strongest.top - 8, 15, canvas.height - 8), 'DISPLACEMENT', strongest.dir === 'bullish' ? '#17865a' : '#c94747');
    }

    // Easy-to-read chart locations requested by the user.
    drawEntryTpSl(candles, bias, blocks);
  }

  if (analyzeBtn && typeof analyse === 'function') {
    analyzeBtn.onclick = () => {
      analyse();
      requestAnimationFrame(() => {
        drawBase();
        markTechnical(detectCandles());
      });
    };
  }
});

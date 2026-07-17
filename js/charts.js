// Motor de gráficos SVG vanilla JS — sem bibliotecas externas.
// Expõe window.Charts = { lineChart, barChart, rankList, fmt }

(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';

  // ---------------------------------------------------------------------
  // Formatação (pt-BR)
  // ---------------------------------------------------------------------
  const fmtCompact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
  const fmtFull = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  const fmtFull1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

  const fmt = {
    compact(n) { return n == null || isNaN(n) ? '—' : fmtCompact.format(n); },
    full(n) { return n == null || isNaN(n) ? '—' : fmtFull.format(n); },
    full1(n) { return n == null || isNaN(n) ? '—' : fmtFull1.format(n); },
    usd(n) { return n == null || isNaN(n) ? '—' : 'US$ ' + fmtCompact.format(n); },
    brl(n) { return n == null || isNaN(n) ? '—' : 'R$ ' + fmtCompact.format(n); },
    mwh(n) { return n == null || isNaN(n) ? '—' : fmtCompact.format(n) + ' MWh'; },
    pct(n, signed) {
      if (n == null || isNaN(n)) return '—';
      const s = (signed && n > 0 ? '+' : '') + fmtFull1.format(n) + '%';
      return s;
    }
  };

  // ---------------------------------------------------------------------
  // Tooltip singleton
  // ---------------------------------------------------------------------
  let ttEl = null;
  function tooltip() {
    if (!ttEl) {
      ttEl = document.createElement('div');
      ttEl.className = 'chart-tooltip';
      document.body.appendChild(ttEl);
    }
    return ttEl;
  }
  function showTooltip(x, y, titleText, rows) {
    const el = tooltip();
    el.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'tt-title';
    title.textContent = titleText;
    el.appendChild(title);
    rows.forEach(r => {
      const row = document.createElement('div');
      row.className = 'tt-row';
      if (r.color) {
        const key = document.createElement('span');
        key.className = 'tt-key';
        key.style.background = r.color;
        row.appendChild(key);
      }
      const label = document.createElement('span');
      label.textContent = r.label;
      row.appendChild(label);
      const val = document.createElement('span');
      val.className = 'tt-val';
      val.textContent = r.value;
      row.appendChild(val);
      el.appendChild(row);
    });
    el.classList.add('visible');
    positionTooltip(x, y);
  }
  function positionTooltip(x, y) {
    const el = tooltip();
    const pad = 14;
    let left = x + pad, top = y + pad;
    const rect = el.getBoundingClientRect();
    if (left + rect.width > window.innerWidth - 8) left = x - rect.width - pad;
    if (top + rect.height > window.innerHeight - 8) top = y - rect.height - pad;
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  }
  function hideTooltip() {
    if (ttEl) ttEl.classList.remove('visible');
  }

  function svgEl(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  function niceTicks(min, max, count) {
    if (min === max) { min -= 1; max += 1; }
    const span = max - min;
    const step0 = span / count;
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const norm = step0 / mag;
    let step;
    if (norm < 1.5) step = 1 * mag;
    else if (norm < 3) step = 2 * mag;
    else if (norm < 7) step = 5 * mag;
    else step = 10 * mag;
    const niceMin = Math.floor(min / step) * step;
    const niceMax = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = niceMin; v <= niceMax + step * 0.001; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
    return ticks;
  }

  function roundedBarPath(x, w, yBase, yVal, r) {
    const up = yVal <= yBase;
    const top = up ? yVal : yBase;
    const bottom = up ? yBase : yVal;
    r = Math.min(r, w / 2, Math.max(0, bottom - top));
    if (r <= 0.6 || bottom - top <= 1) {
      return `M${x},${top} H${x + w} V${bottom} H${x} Z`;
    }
    if (up) {
      return `M${x},${bottom} V${top + r} A${r},${r} 0 0 1 ${x + r},${top} H${x + w - r} A${r},${r} 0 0 1 ${x + w},${top + r} V${bottom} Z`;
    }
    return `M${x},${top} H${x + w} V${bottom - r} A${r},${r} 0 0 1 ${x + w - r},${bottom} H${x + r} A${r},${r} 0 0 1 ${x},${bottom - r} V${top} Z`;
  }

  // ---------------------------------------------------------------------
  // Legend (HTML, ao lado/abaixo do gráfico)
  // ---------------------------------------------------------------------
  function renderLegend(container, items) {
    if (items.length < 2) return;
    const leg = document.createElement('div');
    leg.className = 'legend';
    items.forEach(it => {
      const el = document.createElement('div');
      el.className = 'legend-item';
      const sw = document.createElement('span');
      sw.className = 'legend-swatch' + (it.area ? ' area' : '');
      sw.style.background = it.color;
      el.appendChild(sw);
      const txt = document.createElement('span');
      txt.textContent = it.label;
      el.appendChild(txt);
      leg.appendChild(el);
    });
    container.appendChild(leg);
  }

  // ---------------------------------------------------------------------
  // Line chart — várias séries, eixo X categórico (ano ou ano-mês)
  // opts: { series:[{label,color,values:[num|null], area?}], categories:[str],
  //         formatY, formatX, height, yMin0 }
  // ---------------------------------------------------------------------
  function lineChart(container, opts) {
    container.innerHTML = '';
    const { series, categories, formatY = fmt.compact, formatX = (s => s), height = 220 } = opts;
    const n = categories.length;
    if (!n || !series.some(s => s.values.some(v => v != null))) {
      container.innerHTML = '<div class="empty-note">Sem dados disponíveis para o período selecionado.</div>';
      return;
    }
    const width = 600;
    const margin = { top: 14, right: 14, bottom: 26, left: 48 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    let vmin = Infinity, vmax = -Infinity;
    series.forEach(s => s.values.forEach(v => { if (v != null) { vmin = Math.min(vmin, v); vmax = Math.max(vmax, v); } }));
    if (opts.yMin0) vmin = Math.min(0, vmin);
    if (!isFinite(vmin)) { vmin = 0; vmax = 1; }
    const ticks = niceTicks(vmin, vmax, 4);
    const yLo = ticks[0], yHi = ticks[ticks.length - 1];
    const yScale = v => margin.top + innerH - ((v - yLo) / (yHi - yLo || 1)) * innerH;
    const xScale = i => n === 1 ? margin.left + innerW / 2 : margin.left + (i * innerW) / (n - 1);

    const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart-svg', role: 'img' });

    // gridlines + y labels
    ticks.forEach(t => {
      const y = yScale(t);
      svg.appendChild(svgEl('line', { x1: margin.left, x2: width - margin.right, y1: y, y2: y, class: t === 0 ? 'baseline' : 'gridline' }));
      const lbl = svgEl('text', { x: margin.left - 6, y: y + 3, 'text-anchor': 'end', class: 'axis-label' });
      lbl.textContent = formatY(t);
      svg.appendChild(lbl);
    });

    // x labels (subset to avoid crowding)
    const maxLabels = Math.max(2, Math.floor(innerW / 56));
    const step = Math.max(1, Math.ceil(n / maxLabels));
    for (let i = 0; i < n; i += step) {
      const lbl = svgEl('text', { x: xScale(i), y: height - 6, 'text-anchor': 'middle', class: 'axis-label' });
      lbl.textContent = formatX(categories[i]);
      svg.appendChild(lbl);
    }

    // crosshair (hidden by default)
    const crosshair = svgEl('line', { x1: 0, x2: 0, y1: margin.top, y2: margin.top + innerH, class: 'gridline', style: 'display:none' });
    svg.appendChild(crosshair);

    series.forEach(s => {
      // build segments split by nulls
      let segStart = null;
      let d = '';
      s.values.forEach((v, i) => {
        if (v == null) { segStart = null; return; }
        const x = xScale(i), y = yScale(v);
        d += (segStart === null ? 'M' : 'L') + x + ',' + y + ' ';
        segStart = i;
      });
      if (s.area) {
        // fill area under line (only contiguous run supported simply)
        const pts = [];
        s.values.forEach((v, i) => { if (v != null) pts.push([xScale(i), yScale(v)]); });
        if (pts.length > 1) {
          const areaD = 'M' + pts[0][0] + ',' + yScale(yLo) + ' ' + pts.map(p => 'L' + p[0] + ',' + p[1]).join(' ') + ' L' + pts[pts.length - 1][0] + ',' + yScale(yLo) + ' Z';
          svg.appendChild(svgEl('path', { d: areaD, fill: s.color, opacity: 0.1, stroke: 'none' }));
        }
      }
      svg.appendChild(svgEl('path', { d: d.trim(), fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));

      // end marker on last non-null point
      for (let i = s.values.length - 1; i >= 0; i--) {
        if (s.values[i] != null) {
          svg.appendChild(svgEl('circle', { cx: xScale(i), cy: yScale(s.values[i]), r: 4, fill: s.color, stroke: 'var(--surface-card)', 'stroke-width': 2 }));
          break;
        }
      }
    });

    // hit columns
    const colW = innerW / n;
    for (let i = 0; i < n; i++) {
      const hit = svgEl('rect', {
        x: margin.left + i * colW - (i === 0 ? 0 : 0), y: margin.top, width: Math.max(colW, 4), height: innerH,
        class: 'hit-area', tabindex: 0
      });
      hit.style.cursor = 'crosshair';
      const onEnter = (evt) => {
        crosshair.setAttribute('x1', xScale(i)); crosshair.setAttribute('x2', xScale(i));
        crosshair.style.display = '';
        const rows = series
          .filter(s => s.values[i] != null)
          .map(s => ({ label: s.label, color: s.color, value: formatY(s.values[i]) }));
        if (!rows.length) return;
        const pos = clientPosFromEvent(evt, hit);
        showTooltip(pos.x, pos.y, formatX(categories[i], true), rows);
      };
      hit.addEventListener('pointerenter', onEnter);
      hit.addEventListener('pointermove', onEnter);
      hit.addEventListener('pointerleave', () => { crosshair.style.display = 'none'; hideTooltip(); });
      hit.addEventListener('focus', onEnter);
      hit.addEventListener('blur', () => { crosshair.style.display = 'none'; hideTooltip(); });
      svg.appendChild(hit);
    }

    container.appendChild(svg);
    renderLegend(container, series.map(s => ({ label: s.label, color: s.color, area: s.area })));
  }

  function clientPosFromEvent(evt, svgNode) {
    if (evt.clientX != null) return { x: evt.clientX, y: evt.clientY };
    const r = svgNode.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top };
  }

  // ---------------------------------------------------------------------
  // Bar chart — categorias no eixo X, 1+ séries agrupadas, ou divergente
  // opts: { series:[{label,color,values}], categories, formatY, height, diverging }
  // ---------------------------------------------------------------------
  function barChart(container, opts) {
    container.innerHTML = '';
    const { series, categories, formatY = fmt.compact, formatX = (s => s), height = 220 } = opts;
    const n = categories.length;
    if (!n || !series.some(s => s.values.some(v => v != null))) {
      container.innerHTML = '<div class="empty-note">Sem dados disponíveis para o período selecionado.</div>';
      return;
    }
    const width = 600;
    const margin = { top: 14, right: 14, bottom: 26, left: 48 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    let vmin = 0, vmax = -Infinity;
    series.forEach(s => s.values.forEach(v => { if (v != null) { vmin = Math.min(vmin, v); vmax = Math.max(vmax, v); } }));
    if (!isFinite(vmax)) vmax = 1;
    const ticks = niceTicks(vmin, vmax, 4);
    const yLo = ticks[0], yHi = ticks[ticks.length - 1];
    const yScale = v => margin.top + innerH - ((v - yLo) / (yHi - yLo || 1)) * innerH;
    const yBase = yScale(0);

    const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart-svg', role: 'img' });

    ticks.forEach(t => {
      const y = yScale(t);
      svg.appendChild(svgEl('line', { x1: margin.left, x2: width - margin.right, y1: y, y2: y, class: t === 0 ? 'baseline' : 'gridline' }));
      const lbl = svgEl('text', { x: margin.left - 6, y: y + 3, 'text-anchor': 'end', class: 'axis-label' });
      lbl.textContent = formatY(t);
      svg.appendChild(lbl);
    });

    const maxLabels = Math.max(2, Math.floor(innerW / 56));
    const catStep = Math.max(1, Math.ceil(n / maxLabels));
    const slotW = innerW / n;
    const nSeries = series.length;
    const gap = 2;
    const barW = Math.min(24, (slotW - gap * (nSeries + 1)) / nSeries);

    for (let i = 0; i < n; i++) {
      const slotX = margin.left + i * slotW;
      if (i % catStep === 0) {
        const lbl = svgEl('text', { x: slotX + slotW / 2, y: height - 6, 'text-anchor': 'middle', class: 'axis-label' });
        lbl.textContent = formatX(categories[i]);
        svg.appendChild(lbl);
      }
      const groupW = nSeries * barW + (nSeries - 1) * gap;
      let bx = slotX + (slotW - groupW) / 2;
      const rows = [];
      series.forEach(s => {
        const v = s.values[i];
        if (v != null) {
          const y = yScale(v);
          const path = svgEl('path', { d: roundedBarPath(bx, barW, yBase, y, 4), fill: s.color, class: 'bar-mark' });
          svg.appendChild(path);
          rows.push({ label: s.label, color: s.color, value: formatY(v) });
        }
        bx += barW + gap;
      });
      // hit area spans whole slot
      const hit = svgEl('rect', { x: slotX, y: margin.top, width: slotW, height: innerH, class: 'hit-area', tabindex: 0 });
      hit.style.cursor = 'pointer';
      const onEnter = (evt) => {
        if (!rows.length) return;
        const pos = clientPosFromEvent(evt, hit);
        showTooltip(pos.x, pos.y, formatX(categories[i], true), rows);
      };
      hit.addEventListener('pointerenter', onEnter);
      hit.addEventListener('pointermove', onEnter);
      hit.addEventListener('pointerleave', hideTooltip);
      hit.addEventListener('focus', onEnter);
      hit.addEventListener('blur', hideTooltip);
      svg.appendChild(hit);
    }

    container.appendChild(svg);
    renderLegend(container, series.map(s => ({ label: s.label, color: s.color })));
  }

  // ---------------------------------------------------------------------
  // Lista ranqueada (barras horizontais em HTML) — países, UFs, categorias
  // ---------------------------------------------------------------------
  function rankList(container, items, opts) {
    container.innerHTML = '';
    const { formatVal = fmt.compact, color = 'var(--series-1)' } = opts || {};
    if (!items.length) {
      container.innerHTML = '<div class="empty-note">Sem dados disponíveis.</div>';
      return;
    }
    const max = Math.max(...items.map(i => Math.abs(i.value || 0)), 1);
    const ul = document.createElement('ul');
    ul.className = 'rank-list';
    items.forEach(it => {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.className = 'rank-name';
      name.textContent = it.label;
      name.title = it.label;
      const barWrap = document.createElement('span');
      barWrap.className = 'rank-bar-wrap';
      const bar = document.createElement('span');
      bar.className = 'rank-bar';
      bar.style.width = Math.max(2, (Math.abs(it.value || 0) / max) * 100) + '%';
      bar.style.background = it.color || color;
      barWrap.appendChild(bar);
      const val = document.createElement('span');
      val.className = 'rank-val';
      val.textContent = formatVal(it.value);
      li.appendChild(name); li.appendChild(barWrap); li.appendChild(val);
      ul.appendChild(li);
    });
    container.appendChild(ul);
  }

  window.Charts = { lineChart, barChart, rankList, fmt, hideTooltip };
})();

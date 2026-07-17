(function () {
  'use strict';
  const { lineChart, barChart, dualAxisLineChart, waterfallChart, donutChart, dataTable, rankList, fmt } = window.Charts;
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const CURRENT_YEAR = new Date().getFullYear();
  const CORES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)',
                 'var(--series-5)', 'var(--series-6)', 'var(--series-7)', 'var(--series-8)'];

  // Recessões do Brasil (datação CODACE/FGV-IBRE), usadas como faixas de contexto.
  const RECESSOES = [
    { from: 200301, to: 200306, label: '2003' },
    { from: 200308, to: 200901, label: 'Crise financeira 2008–09' },
    { from: 201403, to: 201612, label: 'Recessão 2014–16' },
    { from: 202002, to: 202006, label: 'Covid-19 2020' },
  ];

  const state = { sector: '2451', view: '2451', lo: 2016, hi: 2026, uf: 'ALL', data: null };
  const $ = (sel, root) => (root || document).querySelector(sel);
  const MINUSC = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'com', 'para', 'a', 'o', 'no', 'na']);
  function titleCasePt(s) {
    return s.toLowerCase().split(' ').map((w, i) => {
      if (i > 0 && MINUSC.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');
  }

  // ---------------------------------------------------------------------
  // Helpers de dados
  // ---------------------------------------------------------------------
  function pctChange(now, before) {
    if (now == null || before == null || before === 0) return null;
    return ((now - before) / Math.abs(before)) * 100;
  }
  function filterAnnual(rows, lo, hi) { return rows.filter(r => r.ano >= lo && r.ano <= hi); }
  function filterMonthly(rows, lo, hi) { return rows.filter(r => r.ano >= lo && r.ano <= hi); }
  function monthLabel(k, long) {
    const ano = Math.floor(k / 100), mes = k % 100;
    return long ? MESES[mes - 1] + ' de ' + ano : MESES[mes - 1] + '/' + String(ano).slice(2);
  }
  function annualCategories(rowsArrays) {
    const keys = new Set();
    rowsArrays.forEach(rows => rows.forEach(r => keys.add(r.ano)));
    return Array.from(keys).sort((a, b) => a - b);
  }
  function monthlyCategories(rowsArrays) {
    const keys = new Set();
    rowsArrays.forEach(rows => rows.forEach(r => keys.add(r.ano * 100 + r.mes)));
    return Array.from(keys).sort((a, b) => a - b);
  }
  function seriesAnnual(rows, field, categories) {
    const map = new Map(rows.map(r => [r.ano, r[field]]));
    return categories.map(k => (map.has(k) ? map.get(k) : null));
  }
  function seriesMonthly(rows, field, categories) {
    const map = new Map(rows.map(r => [r.ano * 100 + r.mes, r[field]]));
    return categories.map(k => (map.has(k) ? map.get(k) : null));
  }
  function last(arr) { return arr.length ? arr[arr.length - 1] : null; }
  function findAt(arr, idxFromEnd) { return arr.length > idxFromEnd ? arr[arr.length - 1 - idxFromEnd] : null; }
  function csS() { return state.data.sectors[state.sector]; }
  function shared() { return state.data.shared; }
  function ufName(uf) {
    const found = state.data.meta.uf_lista.find(u => u.uf === uf);
    return found ? found.nome : uf;
  }

  // ---------------------------------------------------------------------
  // 01 — Produção física
  // ---------------------------------------------------------------------
  function renderProducao() {
    const sh = shared();

    const ag = filterMonthly(sh.producao.aco_gusa, state.lo, state.hi);
    const catAg = ag.map(r => r.ano * 100 + r.mes);
    lineChart($('#chart-producao-acogusa'), {
      categories: catAg, formatX: monthLabel, formatY: fmt.compact, height: 280,
      series: [
        { label: 'Aço bruto', color: 'var(--series-1)', values: ag.map(r => r.aco_bruto), area: true },
        { label: 'Ferro-gusa', color: 'var(--series-5)', values: ag.map(r => r.ferro_gusa) },
        { label: 'Laminados', color: 'var(--series-3)', values: ag.map(r => r.laminados) },
      ]
    });

    const dessaz = filterMonthly(sh.producao.aco_gusa_dessaz, state.lo, state.hi);
    const catDz = monthlyCategories([ag, dessaz]);
    lineChart($('#chart-producao-dessaz'), {
      categories: catDz, formatX: monthLabel, formatY: fmt.compact, height: 280,
      series: [
        { label: 'Observado', color: 'var(--series-2)', values: seriesMonthly(ag, 'aco_bruto', catDz) },
        { label: 'Dessazonalizado', color: 'var(--series-3)', values: seriesMonthly(dessaz, 'aco_bruto', catDz) },
      ]
    });

    const idx = filterMonthly(sh.producao.metalurgia_indice, state.lo, state.hi);
    const catIdx = idx.map(r => r.ano * 100 + r.mes);
    lineChart($('#chart-producao-indice'), {
      categories: catIdx, formatX: monthLabel, formatY: fmt.full1, height: 280, bands: RECESSOES,
      series: [
        { label: 'Índice bruto', color: 'var(--series-2)', values: idx.map(r => r.indice_bruto) },
        { label: 'Dessazonalizado', color: 'var(--series-3)', values: idx.map(r => r.indice_dessaz) }
      ]
    });

    const razao = ag.map(r => (r.laminados != null && r.aco_bruto) ? (r.laminados / r.aco_bruto) * 100 : null);
    lineChart($('#chart-producao-razao'), {
      categories: catAg, formatX: monthLabel, formatY: n => fmt.pct(n), height: 280,
      series: [{ label: 'Laminados / aço bruto', color: 'var(--series-1)', values: razao, area: true }]
    });

    const latest = last(sh.producao.aco_gusa), prev12 = findAt(sh.producao.aco_gusa, 12);
    const growth = prev12 ? pctChange(latest.aco_bruto, prev12.aco_bruto) : null;
    $('#producao-narrative').textContent = growth == null
      ? 'Acompanhe abaixo a evolução mensal da produção física de aço, ferro-gusa e laminados no Brasil, com contexto de recessões e sazonalidade.'
      : `Nos últimos 12 meses, a produção de aço bruto no Brasil ${growth >= 0 ? 'cresceu' : 'caiu'} ${fmt.full1(Math.abs(growth))}%. O índice geral da metalurgia acompanha o mesmo ritmo da atividade industrial nacional, e as faixas sombreadas marcam as últimas recessões (CODACE/FGV).`;
  }

  // ---------------------------------------------------------------------
  // 02 — Financeiro
  // ---------------------------------------------------------------------
  function renderFinanceiro() {
    // Série PIA é curta (2007–2023, ~17 pontos anuais) — sempre mostra o
    // histórico completo, sem responder à régua de período (feita para
    // séries longas: produção mensal, RAIS, CAGED, comex/comtrade).
    const sh = shared();
    const finF = sh.financeiro.fundicao_24_5;
    const finM = sh.financeiro.metalurgia_24;
    const catFin = finF.map(r => r.ano);

    dualAxisLineChart($('#chart-financeiro-vbpi-vti'), {
      categories: catFin, formatYLeft: fmt.brl, formatYRight: fmt.brl, height: 280,
      seriesLeft: { label: 'VBPI', color: 'var(--series-2)', values: finF.map(r => r.vbpi != null ? r.vbpi * 1000 : null) },
      seriesRight: { label: 'VTI', color: 'var(--series-3)', values: finF.map(r => r.vti != null ? r.vti * 1000 : null) },
    });

    const catsPart = annualCategories([finF, finM]);
    const participacao = catsPart.map(ano => {
      const f = finF.find(r => r.ano === ano), m = finM.find(r => r.ano === ano);
      return (f && m && m.receita_liquida_total) ? (f.receita_liquida_total / m.receita_liquida_total) * 100 : null;
    });
    lineChart($('#chart-financeiro-participacao'), {
      categories: catsPart, formatY: n => fmt.pct(n), height: 280,
      series: [{ label: '% da Metalurgia', color: 'var(--series-3)', values: participacao, area: true }]
    });

    const produtividade = finF.map(r => (r.vti != null && r.pessoal_ocupado) ? (r.vti * 1000) / r.pessoal_ocupado : null);
    lineChart($('#chart-financeiro-produtividade'), {
      categories: catFin, formatY: fmt.brl, height: 280,
      series: [{ label: 'VTI / pessoal ocupado', color: 'var(--series-2)', values: produtividade }]
    });

    barChart($('#chart-financeiro-receita-custos'), {
      categories: catFin, formatY: fmt.brl, height: 280,
      series: [
        { label: 'Receita líquida', color: 'var(--series-4)', values: finF.map(r => r.receita_liquida_total * 1000) },
        { label: 'Custos e despesas', color: 'var(--series-6)', values: finF.map(r => r.custos_despesas_totais * 1000) }
      ]
    });

    const latestFin = last(sh.financeiro.fundicao_24_5);
    $('#financeiro-waterfall-title').textContent = 'Decomposição de custos de ' + latestFin.ano;
    const materiasPrimas = latestFin.consumo_materias_primas || 0;
    const pessoal = latestFin.gastos_pessoal_total || 0;
    const custoTotal = latestFin.custos_despesas_totais || 0;
    const outros = custoTotal - materiasPrimas - pessoal;
    waterfallChart($('#chart-financeiro-waterfall'), {
      formatY: fmt.brl, height: 280,
      items: [
        { label: 'Matérias-primas', value: materiasPrimas * 1000 },
        { label: 'Pessoal', value: pessoal * 1000 },
        { label: 'Outros', value: outros * 1000 },
        { label: 'Custo total', value: custoTotal * 1000, isTotal: true },
      ]
    });

    const latestPia = last(sh.financeiro.fundicao_24_5), prevPia = findAt(sh.financeiro.fundicao_24_5, 1);
    const growth = prevPia ? pctChange(latestPia.receita_liquida_total, prevPia.receita_liquida_total) : null;
    $('#financeiro-narrative').textContent = `Em ${latestPia.ano}, o grupo Fundição faturou ${fmt.brl(latestPia.receita_liquida_total * 1000)}${growth != null ? ' (' + fmt.pct(growth, true) + ' vs ' + prevPia.ano + ')' : ''}. VBPI, VTI, participação na Metalurgia e produtividade dão o contexto por trás da margem operacional (receita menos custos) e da decomposição de custos ao lado.`;
  }

  // ---------------------------------------------------------------------
  // 03 — Emprego formal (RAIS)
  // ---------------------------------------------------------------------
  function renderEmprego() {
    const s = csS();
    const ufSel = state.uf;

    let raisRows, raisLabel;
    if (ufSel === 'ALL') {
      raisRows = s.rais.uf_yearly_total; raisLabel = 'Vínculos (Brasil)';
    } else {
      raisRows = s.rais.uf_yearly.filter(r => r.uf === ufSel).map(r => ({ ano: r.ano, vinculos: r.vinculos }));
      raisLabel = 'Vínculos (' + ufSel + ')';
    }
    raisRows = filterAnnual(raisRows, state.lo, state.hi);
    lineChart($('#chart-emprego-rais'), {
      categories: raisRows.map(r => r.ano), formatY: fmt.full, height: 280,
      series: [{ label: raisLabel, color: 'var(--series-2)', values: raisRows.map(r => r.vinculos), area: true }]
    });

    const tamRows = filterAnnual(s.rais.tamanho_yearly, state.lo, state.hi);
    const catsTam = annualCategories([tamRows]);
    const faixas = Array.from(new Set(tamRows.map(r => r.faixa)));
    const seriesTam = faixas.map((faixa, i) => ({
      label: faixa, color: CORES[i % CORES.length],
      values: catsTam.map(ano => { const row = tamRows.find(r => r.ano === ano && r.faixa === faixa); return row ? row.vinculos : 0; })
    }));
    barChart($('#chart-emprego-tamanho'), { categories: catsTam, formatY: fmt.full, height: 280, stacked: true, series: seriesTam });

    const totalLatest = last(s.rais.uf_yearly_total);
    const ufRanking = s.rais.uf_yearly.filter(r => r.ano === totalLatest.ano).sort((a, b) => b.vinculos - a.vinculos).slice(0, 8);
    $('#emprego-uf-sub').textContent = 'Ano de ' + totalLatest.ano;
    rankList($('#rank-emprego-uf'), ufRanking.map(r => ({
      label: r.nome_uf, value: r.vinculos, color: r.uf === state.uf ? 'var(--series-3)' : 'var(--series-2)'
    })), { formatVal: fmt.full });

    const razaoRows = filterAnnual(s.rais.uf_yearly_total, state.lo, state.hi);
    lineChart($('#chart-emprego-razao'), {
      categories: razaoRows.map(r => r.ano), formatY: fmt.full1, height: 280,
      series: [{ label: 'Vínculos por estabelecimento', color: 'var(--series-2)', values: razaoRows.map(r => r.estabelecimentos ? r.vinculos / r.estabelecimentos : null) }]
    });

    const escRows = filterAnnual(s.rais.escolaridade_yearly, state.lo, state.hi);
    const catEsc = annualCategories([escRows]);
    const categoriasEsc = Array.from(new Set(escRows.map(r => r.categoria)));
    const seriesEsc = categoriasEsc.map((cat, i) => ({
      label: titleCasePt(cat), color: CORES[i % CORES.length],
      values: catEsc.map(ano => { const row = escRows.find(r => r.ano === ano && r.categoria === cat); return row ? row.frequencia : 0; })
    }));
    lineChart($('#chart-emprego-escolaridade-evolucao'), { categories: catEsc, formatY: fmt.full, height: 280, stacked: true, series: seriesEsc });

    const esc = s.rais.escolaridade_latest;
    $('#emprego-escolaridade-sub').textContent = 'Retrato de ' + esc.ano;
    rankList($('#rank-emprego-escolaridade'), esc.items.slice(0, 8).map(i => ({ label: titleCasePt(i.categoria), value: i.frequencia })), { formatVal: fmt.full, color: 'var(--series-2)' });

    const ocup = s.rais.ocupacao_agrupada_latest;
    $('#emprego-ocupacao-sub').textContent = 'Retrato de ' + ocup.ano;
    rankList($('#rank-emprego-ocupacao'), ocup.items.slice(0, 8).map(i => ({ label: titleCasePt(i.categoria), value: i.frequencia })), { formatVal: fmt.full, color: 'var(--series-2)' });

    const top8 = ocup.items.slice(0, 8);
    const totalOcup = ocup.items.reduce((a, i) => a + i.frequencia, 0);
    const outrasOcup = Math.max(0, totalOcup - top8.reduce((a, i) => a + i.frequencia, 0));
    donutChart($('#chart-emprego-ocupacao-donut'), {
      formatVal: fmt.full, size: 200,
      items: [...top8.map((i, idx) => ({ label: titleCasePt(i.categoria), value: i.frequencia, color: CORES[idx % CORES.length] })),
      { label: 'Outras ocupações', value: outrasOcup, color: 'var(--baseline)' }]
    });

    const ORDEM_TEMPO = ['Ate 2,9 meses', '3,0 a 5,9 meses', '6,0 a 11,9 meses', '12,0 a 23,9 meses',
      '24,0 a 35,9 meses', '36,0 a 59,9 meses', '60,0 a 119,9 meses', '120,0 meses ou mais'];
    const CURTA = new Set(['Ate 2,9 meses', '3,0 a 5,9 meses', '6,0 a 11,9 meses']);
    const LABELS_TEMPO = {
      'Ate 2,9 meses': '< 3m', '3,0 a 5,9 meses': '3–6m', '6,0 a 11,9 meses': '6–12m',
      '12,0 a 23,9 meses': '1–2a', '24,0 a 35,9 meses': '2–3a', '36,0 a 59,9 meses': '3–5a',
      '60,0 a 119,9 meses': '5–10a', '120,0 meses ou mais': '10a+',
    };
    const tempo = s.rais.tempo_emprego_latest;
    const itemsTempo = ORDEM_TEMPO.map(cat => tempo.items.find(i => i.categoria === cat)).filter(Boolean);
    barChart($('#chart-emprego-tempo'), {
      categories: itemsTempo.map(i => LABELS_TEMPO[i.categoria] || i.categoria), formatY: fmt.full, height: 280,
      series: [{ label: 'Vínculos', color: 'var(--series-2)', values: itemsTempo.map(i => CURTA.has(i.categoria) ? -i.frequencia : i.frequencia) }]
    });

    const sh = shared();
    function ipcaDezembro(ano) {
      const row = sh.macro.find(r => r.ano === ano && r.mes === 12);
      return row ? row.ipca : null;
    }
    const massaRows = filterAnnual(s.rais.massa_nacional_yearly, state.lo, state.hi);
    const anoRefMassa = last(massaRows) ? last(massaRows).ano : null;
    const ipcaRef = ipcaDezembro(anoRefMassa);
    const remReal = massaRows.map(r => {
      const ipcaAno = ipcaDezembro(r.ano);
      return (r.remuneracao_media_nominal != null && ipcaAno && ipcaRef) ? r.remuneracao_media_nominal * (ipcaRef / ipcaAno) : null;
    });
    lineChart($('#chart-emprego-remuneracao'), {
      categories: massaRows.map(r => r.ano), formatY: fmt.brl, height: 280,
      series: [
        { label: 'Nominal', color: 'var(--series-2)', values: massaRows.map(r => r.remuneracao_media_nominal) },
        { label: 'Real (preços de ' + (anoRefMassa || '') + ')', color: 'var(--series-3)', values: remReal },
      ]
    });

    const ufCount = new Set(s.rais.uf_yearly.filter(r => r.ano === totalLatest.ano && r.estabelecimentos > 0).map(r => r.uf)).size;
    $('#emprego-narrative').textContent = `Em ${totalLatest.ano}, o setor empregava ${fmt.full(totalLatest.vinculos)} pessoas, distribuídas por ${ufCount} estados. Os gráficos ao lado detalham composição por porte, UF, escolaridade, ocupação, tempo de emprego e remuneração.`;
  }

  // ---------------------------------------------------------------------
  // 04 — CAGED
  // ---------------------------------------------------------------------
  function renderCaged() {
    const s = csS();

    $('#caged-coverage-note').textContent = `Granularidade mensal (admissões/desligamentos), que a RAIS não oferece. Cobertura: ${s.caged.coverage.inicio} a ${s.caged.coverage.fim}.`;

    const saldoRows = filterMonthly(s.caged.saldo_monthly_national, state.lo, state.hi);
    lineChart($('#chart-caged-saldo'), {
      categories: saldoRows.map(r => r.ano * 100 + r.mes), formatX: monthLabel, formatY: fmt.full, height: 280,
      series: [{ label: 'Saldo líquido', color: 'var(--series-2)', values: saldoRows.map(r => r.saldo), area: true }]
    });

    const tipoMonthly = filterMonthly(s.caged.tipo_movimentacao_monthly, state.lo, state.hi);
    lineChart($('#chart-caged-movimentacao'), {
      categories: tipoMonthly.map(r => r.ano * 100 + r.mes), formatX: monthLabel, formatY: fmt.compact, height: 280, stacked: true,
      series: [
        { label: 'Admissões', color: 'var(--series-4)', values: tipoMonthly.map(r => r.admissoes) },
        { label: 'Desligamentos', color: 'var(--series-6)', values: tipoMonthly.map(r => r.desligamentos) },
      ]
    });

    const tipoBreak = s.caged.tipo_movimentacao_breakdown_total.filter(t => /desligamento/i.test(t.tipo)).slice(0, 8);
    barChart($('#chart-caged-tipo'), {
      categories: tipoBreak.map(t => t.tipo.replace(/^Desligamento\s*/i, '')), formatY: fmt.full, height: 280,
      series: [{ label: 'Quantidade', color: 'var(--series-6)', values: tipoBreak.map(t => t.quantidade) }]
    });

    const salarioRows = filterMonthly(s.caged.salario_monthly_national, state.lo, state.hi);
    lineChart($('#chart-caged-massa-salarial'), {
      categories: salarioRows.map(r => r.ano * 100 + r.mes), formatX: monthLabel, formatY: fmt.brl, height: 280,
      series: [{ label: 'Massa salarial', color: 'var(--series-3)', values: salarioRows.map(r => r.massa_salarial) }]
    });

    const saldoUfRows = s.caged.saldo_uf_yearly.filter(r => r.ano >= state.lo && r.ano <= state.hi);
    const saldoPorUf = {};
    saldoUfRows.forEach(r => { saldoPorUf[r.uf] = (saldoPorUf[r.uf] || 0) + r.saldo; });
    const rankSaldoUf = Object.entries(saldoPorUf).map(([uf, saldo]) => ({ uf, saldo }))
      .sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo)).slice(0, 8);
    rankList($('#rank-caged-saldo-uf'), rankSaldoUf.map(r => ({
      label: ufName(r.uf), value: r.saldo, color: r.saldo >= 0 ? 'var(--series-4)' : 'var(--series-6)'
    })), { formatVal: fmt.full });

    const latestSaldo = last(saldoRows);
    $('#caged-narrative').textContent = latestSaldo
      ? `O saldo líquido mensal de admissões menos desligamentos, a composição de desligamentos por tipo e a massa salarial mostram o pulso de curto prazo do mercado de trabalho do setor, mês a mês.`
      : 'Explore abaixo a dinâmica mensal de admissões e desligamentos do setor.';
  }

  // ---------------------------------------------------------------------
  // 05 — Comércio exterior
  // ---------------------------------------------------------------------
  function renderComex() {
    const s = csS();
    const ufAvailable = new Set(s.comex.uf_yearly.map(r => r.uf));
    let rows, note = '';
    if (state.uf === 'ALL' || !ufAvailable.has(state.uf)) {
      rows = filterAnnual(s.comex.yearly, state.lo, state.hi);
      if (state.uf !== 'ALL') note = 'Estado sem dado detalhado nesta base; mostrando total nacional do setor.';
    } else {
      const ufRows = s.comex.uf_yearly.filter(r => r.uf === state.uf);
      const years = annualCategories([ufRows]);
      rows = years.map(ano => {
        const exp = ufRows.find(r => r.ano === ano && r.fluxo === 'Exportação');
        const imp = ufRows.find(r => r.ano === ano && r.fluxo === 'Importação');
        return { ano, exportacao_usd: exp ? exp.valor_usd : 0, importacao_usd: imp ? imp.valor_usd : 0 };
      });
      rows = filterAnnual(rows, state.lo, state.hi);
    }
    $('#comex-uf-note') && ($('#comex-uf-note').textContent = note);
    const cat = rows.map(r => r.ano);
    barChart($('#chart-comex-brasil'), {
      categories: cat, formatY: fmt.usd, height: 280,
      series: [
        { label: 'Exportação', color: 'var(--series-4)', values: rows.map(r => r.exportacao_usd) },
        { label: 'Importação', color: 'var(--series-6)', values: rows.map(r => -r.importacao_usd) }
      ]
    });

    const rowsKg = filterAnnual(s.comex.yearly, state.lo, state.hi);
    barChart($('#chart-comex-brasil-kg'), {
      categories: rowsKg.map(r => r.ano), formatY: n => fmt.compact(n) + ' kg', height: 280,
      series: [
        { label: 'Exportação', color: 'var(--series-4)', values: rowsKg.map(r => r.exportacao_kg) },
        { label: 'Importação', color: 'var(--series-6)', values: rowsKg.map(r => -r.importacao_kg) }
      ]
    });

    const topY = s.comex.top_paises_yearly;
    const filteredYearly = topY.yearly.filter(r => r.ano >= state.lo && r.ano <= state.hi);
    const seriesTopPaises = topY.paises.map((pais, i) => ({
      label: pais, color: CORES[i % CORES.length], values: filteredYearly.map(r => r[pais] || 0)
    }));
    seriesTopPaises.push({ label: 'Outros', color: 'var(--baseline)', values: filteredYearly.map(r => r.Outros || 0) });
    barChart($('#chart-comex-top-paises-tempo'), {
      categories: filteredYearly.map(r => r.ano), formatY: fmt.usd, height: 280, stacked: true, series: seriesTopPaises
    });

    const ctBr = filterAnnual(s.comtrade.brazil_yearly, state.lo, state.hi);
    const ctWorld = filterAnnual(s.comtrade.world_yearly, state.lo, state.hi);
    const catCt = annualCategories([ctBr, ctWorld]);
    lineChart($('#chart-comex-mundo'), {
      categories: catCt, formatY: fmt.usd, height: 280,
      series: [
        { label: 'Exportação do Brasil', color: 'var(--series-1)', values: seriesAnnual(ctBr, 'export_usd', catCt) },
        { label: 'Exportação mundial (contexto)', color: 'var(--series-8)', values: seriesAnnual(ctWorld, 'export_usd', catCt) }
      ]
    });

    const participacaoMundo = catCt.map(ano => {
      const b = ctBr.find(r => r.ano === ano), w = ctWorld.find(r => r.ano === ano);
      return (b && w && w.export_usd) ? (b.export_usd / w.export_usd) * 100 : null;
    });
    lineChart($('#chart-comex-participacao-mundial'), {
      categories: catCt, formatY: n => fmt.pct(n), height: 280,
      series: [{ label: 'Participação do Brasil', color: 'var(--series-4)', values: participacaoMundo, area: true }]
    });

    const top = s.comex.top_paises_latest;
    $('#comex-paises-sub').textContent = 'Exportação de ' + top.ano;
    rankList($('#rank-comex-paises'), top.exportacao.slice(0, 8).map(i => ({ label: i.pais, value: i.valor_usd })), { formatVal: fmt.usd, color: 'var(--series-4)' });

    const anoRef = top.ano;
    const rowRef = s.comex.yearly.find(r => r.ano === anoRef);
    const saldo = rowRef ? rowRef.exportacao_usd - rowRef.importacao_usd : null;
    const ctRefBr = s.comtrade.brazil_yearly.find(r => r.ano === s.comtrade.top_partners_latest.ano);
    const ctRefWorld = s.comtrade.world_yearly.find(r => r.ano === s.comtrade.top_partners_latest.ano);
    const share = ctRefBr && ctRefWorld && ctRefWorld.export_usd ? (ctRefBr.export_usd / ctRefWorld.export_usd) * 100 : null;
    $('#comex-narrative').textContent = rowRef
      ? `Em ${anoRef}, o setor exportou ${fmt.usd(rowRef.exportacao_usd)} e importou ${fmt.usd(rowRef.importacao_usd)}: ${saldo >= 0 ? 'superávit' : 'déficit'} de ${fmt.usd(Math.abs(saldo))}.` +
        (share != null ? ` No comércio mundial desses produtos, o Brasil responde por cerca de ${fmt.full1(share)}%.` : '')
      : 'Explore a evolução do comércio exterior do setor abaixo.';
  }

  // ---------------------------------------------------------------------
  // 06 — Energia
  // ---------------------------------------------------------------------
  function renderEnergia() {
    const s = csS(), sh = shared();
    const exato = filterMonthly(s.energia.exato_monthly, state.lo, state.hi);
    const aprox = filterMonthly(sh.energia_metalurgia_aproximado, state.lo, state.hi);
    const cat = monthlyCategories([exato, aprox]);
    lineChart($('#chart-energia'), {
      categories: cat, formatX: monthLabel, formatY: fmt.mwh, height: 280,
      series: [
        { label: 'Consumo do setor (ACL)', color: 'var(--series-5)', values: seriesMonthly(exato, 'consumo_acl_mwh', cat), area: true },
        { label: 'Metalurgia (contexto, categoria mais ampla)', color: 'var(--series-8)', values: seriesMonthly(aprox, 'consumo_livre_acl', cat) }
      ]
    });

    lineChart($('#chart-energia-livre-autoprodutor'), {
      categories: aprox.map(r => r.ano * 100 + r.mes), formatX: monthLabel, formatY: fmt.mwh, height: 280, stacked: true,
      series: [
        { label: 'Livre (ACL)', color: 'var(--series-5)', values: aprox.map(r => r.consumo_livre_acl) },
        { label: 'Autoprodutor', color: 'var(--series-7)', values: aprox.map(r => r.consumo_autoprodutor_acl) },
      ]
    });

    const rows = s.energia.exato_monthly;
    const latest = last(rows), prev12 = findAt(rows, 12);
    const growth = prev12 ? pctChange(latest.consumo_acl_mwh, prev12.consumo_acl_mwh) : null;
    $('#energia-narrative').textContent = growth == null
      ? `O consumo de energia no mercado livre do setor foi de ${fmt.mwh(latest.consumo_acl_mwh)} em ${monthLabel(latest.ano * 100 + latest.mes, true)}.`
      : `O consumo de energia no mercado livre do setor foi de ${fmt.mwh(latest.consumo_acl_mwh)} em ${monthLabel(latest.ano * 100 + latest.mes, true)}, uma variação de ${fmt.pct(growth, true)} em 12 meses. Ao lado, a quebra entre mercado Livre e Autoprodutor (nível nacional "Metalurgia", contexto).`;
  }

  // ---------------------------------------------------------------------
  // 07 — BNDES
  // ---------------------------------------------------------------------
  const PORTES_ORDEM = ['GRANDE', 'MÉDIA', 'PEQUENA', 'MICRO'];
  const CORES_PORTE = { GRANDE: 'var(--series-6)', 'MÉDIA': 'var(--series-8)', PEQUENA: 'var(--series-4)', MICRO: 'var(--series-2)' };

  function renderBndes() {
    const s = csS();
    const bndesY = filterAnnual(s.bndes.yearly, state.lo, state.hi);
    barChart($('#chart-bndes-ano'), {
      categories: bndesY.map(r => r.ano), formatY: fmt.brl, height: 280,
      series: [{ label: 'Desembolsado', color: 'var(--series-8)', values: bndesY.map(r => r.valor_desembolsado) }]
    });

    rankList($('#rank-bndes-uf'), s.bndes.uf_total.slice(0, 8).map(i => ({
      label: i.nome_uf, value: i.valor_desembolsado, color: i.uf === state.uf ? 'var(--series-3)' : 'var(--series-8)'
    })), { formatVal: fmt.brl });

    // Desembolso por porte ao longo do tempo (barra empilhada) + concentração (donut) —
    // as duas leituras que a tabela de 200+ linhas não deixa claras de cara.
    const bndesTableFiltrado = s.bndes.table.filter(r => r.ano >= state.lo && r.ano <= state.hi);
    const catsPorte = Array.from(new Set(bndesTableFiltrado.map(r => r.ano))).sort((a, b) => a - b);
    const seriesPorte = PORTES_ORDEM.filter(p => bndesTableFiltrado.some(r => r.porte === p)).map(porte => ({
      label: titleCasePt(porte), color: CORES_PORTE[porte] || 'var(--series-1)',
      values: catsPorte.map(ano => bndesTableFiltrado
        .filter(r => r.ano === ano && r.porte === porte)
        .reduce((a, r) => a + (r.valor_desembolsado || 0), 0))
    }));
    barChart($('#chart-bndes-porte'), { categories: catsPorte, formatY: fmt.brl, height: 280, stacked: true, series: seriesPorte });

    const totalPorte = {};
    bndesTableFiltrado.forEach(r => { totalPorte[r.porte] = (totalPorte[r.porte] || 0) + (r.valor_desembolsado || 0); });
    const totalGeral = Object.values(totalPorte).reduce((a, v) => a + v, 0);
    const grandePct = totalGeral ? ((totalPorte.GRANDE || 0) / totalGeral) * 100 : null;
    $('#bndes-concentracao-sub').textContent = grandePct != null
      ? `Grande porte: ${fmt.full1(grandePct)}% do desembolsado no período`
      : 'Acumulado no período selecionado';
    donutChart($('#chart-bndes-concentracao'), {
      formatVal: fmt.brl, size: 200,
      items: PORTES_ORDEM.filter(p => totalPorte[p]).map(p => ({ label: titleCasePt(p), value: totalPorte[p], color: CORES_PORTE[p] }))
    });

    dataTable($('#table-bndes'), {
      columns: [
        { key: 'ano', label: 'Ano' },
        { key: 'porte', label: 'Porte' },
        { key: 'instrumento', label: 'Instrumento' },
        { key: 'valor_contratado', label: 'Contratado', align: 'right', format: fmt.brl },
        { key: 'valor_desembolsado', label: 'Desembolsado', align: 'right', format: fmt.brl },
      ],
      rows: s.bndes.table,
      pageSize: 10,
    });

    const totalDesembolsado = bndesY.reduce((a, r) => a + (r.valor_desembolsado || 0), 0);
    $('#bndes-narrative').textContent = `No período selecionado, o BNDES desembolsou ${fmt.brl(totalDesembolsado)} para o segmento. Ao lado, quem recebeu (porte) e onde (UF); a tabela abaixo abre por ano, porte e instrumento de crédito.`;
  }

  // ---------------------------------------------------------------------
  // 08 — DECOM
  // ---------------------------------------------------------------------
  function classifyDecomStatus(status) {
    const s = String(status || '');
    if (/sem medida/i.test(s)) return { emoji: '⚫', label: 'Sem medida' };
    if (/encerrad/i.test(s)) return { emoji: '🔴', label: 'Encerrado' };
    if (/históric|investigad/i.test(s)) return { emoji: '🟡', label: 'Histórico' };
    if (/prorrogad|em vigor|compensat|antidumping|salvaguarda/i.test(s)) return { emoji: '🟢', label: 'Medida ativa' };
    return { emoji: '⚪', label: s };
  }

  function renderDecom() {
    const sh = shared();
    const wrap = $('#decom-wrap'), note = $('#decom-not-available');
    if (state.sector !== '2451') {
      wrap.style.display = 'none';
      note.style.display = '';
      return;
    }
    wrap.style.display = '';
    note.style.display = 'none';
    dataTable($('#table-decom'), {
      columns: [
        { key: 'ncm', label: 'NCM' },
        { key: 'pais', label: 'País' },
        { key: 'status', label: 'Status', format: raw => { const c = classifyDecomStatus(raw); return c.emoji + ' ' + c.label; } },
        { key: 'aliquota', label: 'Alíquota' },
        { key: 'data_resolucao', label: 'Resolução' },
        { key: 'circular', label: 'Referência' },
      ],
      rows: sh.decom,
    });

    const ativas = sh.decom.filter(d => classifyDecomStatus(d.status).label === 'Medida ativa').length;
    $('#decom-highlight').innerHTML = `<strong>${ativas}</strong> medida${ativas === 1 ? '' : 's'} ativa${ativas === 1 ? '' : 's'} hoje · <strong>${sh.decom.length}</strong> processo${sh.decom.length === 1 ? '' : 's'} no histórico`;
  }

  // ---------------------------------------------------------------------
  // Gargalos do setor
  // ---------------------------------------------------------------------
  function renderGargalos() {
    const s = csS(), sh = shared();
    const cards = [];

    {
      const esc = s.rais.escolaridade_latest;
      const total = esc.items.reduce((a, i) => a + i.frequencia, 0);
      const baixaEsc = esc.items.filter(i => /analfabeto|fundamental|5ª/i.test(i.categoria)).reduce((a, i) => a + i.frequencia, 0);
      const pct = total ? (baixaEsc / total) * 100 : null;
      cards.push({
        title: 'Mão de obra qualificada é escassa',
        text: 'Boa parte da força de trabalho do setor ainda não completou o ensino médio, o que limita a adoção de processos mais técnicos e automatizados.',
        evidence: pct != null ? `<strong>${fmt.full1(pct)}%</strong> dos trabalhadores (${esc.ano}) têm no máximo o ensino fundamental completo.` : ''
      });
    }
    {
      const items = s.caged.tipo_movimentacao_breakdown_total;
      const total = items.reduce((a, i) => a + i.quantidade, 0);
      const rotatividade = items.filter(i => /reemprego|a pedido|prazo det/i.test(i.tipo)).reduce((a, i) => a + i.quantidade, 0);
      const pct = total ? (rotatividade / total) * 100 : null;
      cards.push({
        title: 'Alta rotatividade de mão de obra',
        text: 'Muitas contratações e desligamentos são de curto prazo ou por decisão do próprio trabalhador, sinal de dificuldade em reter equipe treinada.',
        evidence: pct != null ? `<strong>${fmt.full1(pct)}%</strong> das movimentações registradas (${s.caged.coverage.inicio} a ${s.caged.coverage.fim}) foram reempregos, contratos por prazo determinado ou pedidos de desligamento.` : ''
      });
    }
    {
      const portes = s.bndes.porte_total;
      const total = portes.reduce((a, i) => a + i.valor_desembolsado, 0);
      const grande = portes.find(i => i.porte === 'GRANDE');
      const pct = grande && total ? (grande.valor_desembolsado / total) * 100 : null;
      const top3 = s.bndes.uf_total.slice(0, 3).reduce((a, i) => a + i.valor_desembolsado, 0);
      const pctUf = total ? (top3 / total) * 100 : null;
      cards.push({
        title: 'Acesso a crédito concentrado',
        text: 'O crédito do BNDES para o setor está concentrado em poucas empresas e estados, deixando fabricantes menores e de outras regiões com menos acesso a financiamento.',
        evidence: (pct != null ? `<strong>${fmt.full1(pct)}%</strong> dos desembolsos do BNDES foram para empresas de grande porte. ` : '') +
          (pctUf != null ? `Os 3 principais estados concentram <strong>${fmt.full1(pctUf)}%</strong> do total.` : '')
      });
    }
    {
      const anoRef = s.comex.top_paises_latest.ano;
      const row = s.comex.yearly.find(r => r.ano === anoRef);
      const saldo = row ? row.exportacao_usd - row.importacao_usd : null;
      const medidas = sh.decom.filter(d => /medida compensat|antidumping|prorrogad/i.test(d.status)).length;
      cards.push({
        title: 'Concorrência com produtos importados',
        text: saldo != null && saldo < 0
          ? 'O Brasil compra mais desse tipo de produto do exterior do que vende, o que pressiona os preços e a competitividade da produção nacional.'
          : 'Mesmo com saldo comercial favorável, o setor convive com medidas de defesa comercial contra práticas desleais de importação.',
        evidence: (saldo != null ? `Saldo comercial de <strong>${fmt.usd(Math.abs(saldo))}</strong> (${saldo < 0 ? 'déficit' : 'superávit'}) em ${anoRef}. ` : '') +
          (state.sector === '2451'
            ? (medidas > 0 ? `Há <strong>${medidas}</strong> medida(s) de defesa comercial ativa(s) contra importados (fonte: DECOM/GECEX).` : 'Não há medidas de defesa comercial ativas registradas nesta base.')
            : 'Não há processos de defesa comercial catalogados para não ferrosos (2452) nesta base.')
      });
    }

    $('#gargalos-grid').innerHTML = cards.map((c, i) => `
      <div class="gargalo-row">
        <div class="gargalo-num">${String(i + 1).padStart(2, '0')}</div>
        <div>
          <h3>${c.title}</h3>
          <p>${c.text}</p>
          <div class="gargalo-evidence">${c.evidence}</div>
        </div>
      </div>
    `).join('');
  }

  // ---------------------------------------------------------------------
  // Referências: fontes e metodologia (estático, montado uma vez)
  // ---------------------------------------------------------------------
  function renderReferencias(data) {
    const cagedCov = data.sectors['2451'].caged.coverage;
    const energiaCov = data.sectors['2451'].energia.coverage;
    const rows = [
      ['Produção física', 'Instituto Aço Brasil (IBS) + IBGE, PIM-PF (Metalurgia geral e Aço/Ferro-gusa)', '1980–2026 (mensal)', 'Nível "metalurgia"/produto, não é exclusivo de 2451/2452.'],
      ['Emprego formal', 'RAIS (vínculos, faixa de tamanho, escolaridade, ocupação, tempo de emprego, massa salarial)', '2006–2025 (anual)', 'Quebra metodológica em 2022 (eSocial) nos perfis detalhados.'],
      ['CAGED', 'CAGED (saldo, salário, tipo de movimentação por UF/CNAE)', `${cagedCov.inicio} a ${cagedCov.fim} (mensal)`, 'Cobertura calculada dinamicamente a partir da base carregada.'],
      ['Financeiro', 'IBGE, PIA-Empresa (Metalurgia e Fundição 24.5)', '2007–2023 (anual)', 'Valores em R$ mil convertidos para R$ na exibição. Fundição 24.5 combina 2451+2452.'],
      ['Comércio exterior', 'MDIC, Comex Stat (exportação/importação por país e UF)', '2006/2016–2026 (anual)', 'Dado oficial brasileiro, específico por CNAE.'],
      ['Comércio exterior', 'UN Comtrade (comércio mundial por código HS)', '2015–2024 (anual)', 'Proxy por HS (não existe CNAE em bases internacionais); usado só para contexto Brasil x Mundo.'],
      ['Energia', 'CCEE, consumo no mercado livre (exato por CNAE)', `${energiaCov.inicio} a ${energiaCov.fim} (mensal)`, 'Janela curta: histórico só existe a partir dessa data.'],
      ['Energia', 'CCEE, consumo "Metalurgia e Produtos de Metal" (aproximado, com quebra Livre/Autoprodutor)', `${energiaCov.inicio} a ${energiaCov.fim} (mensal)`, 'Categoria mais ampla que 2451/2452, única fonte disponível para a quebra Livre/Autoprodutor.'],
      ['BNDES', 'BNDES, desembolsos por UF/porte/instrumento', '2002–2026 (anual)', 'Específico por CNAE (2451/2452).'],
      ['DECOM', 'DECOM/GECEX, processos de defesa comercial', 'Histórico (datas variáveis)', 'Base específica de ferro e aço (2451); sem processos catalogados para 2452.'],
      ['Contexto', 'Indicadores macro (IPCA, dólar, IPP metalurgia)', '1990–2026 (mensal)', 'IPCA usado para deflacionar a remuneração real (bloco Emprego formal); demais indicadores só como pano de fundo.']
    ];
    $('#referencias-table tbody').innerHTML = rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td class="mono">${r[2]}</td><td>${r[3]}</td></tr>`).join('');
  }

  // ---------------------------------------------------------------------
  // Filtros: UF select, sector switch, period slider
  // ---------------------------------------------------------------------
  function populateUfSelect() {
    const sel = $('#uf-select');
    state.data.meta.uf_lista.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.uf; opt.textContent = u.nome;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => { state.uf = sel.value; renderAll(); });
  }

  // 4 abas mutuamente exclusivas: 2451 e 2452 mostram o painel de dados
  // (trocando o setor); PD&I e Referências trocam para uma página estática,
  // escondendo o painel de dados e a barra de filtros (não fazem sentido ali).
  function setupViewTabs() {
    const btns = document.querySelectorAll('#view-tabs button');
    const dataView = $('#data-view');
    const filterRow = $('#filter-row');
    const pdiView = $('#pdi-view');
    const referenciasView = $('#referencias-view');

    function applyVisibility() {
      const isData = state.view === '2451' || state.view === '2452';
      dataView.hidden = !isData;
      filterRow.hidden = !isData;
      pdiView.hidden = state.view !== 'pdi';
      referenciasView.hidden = state.view !== 'referencias';
    }

    btns.forEach(b => b.addEventListener('click', () => {
      if (b.dataset.view === state.view) return;
      btns.forEach(x => { x.classList.remove('active'); x.setAttribute('aria-selected', 'false'); });
      b.classList.add('active'); b.setAttribute('aria-selected', 'true');
      state.view = b.dataset.view;
      if (state.view === '2451' || state.view === '2452') {
        state.sector = state.view;
        renderAll();
      }
      applyVisibility();
    }));

    applyVisibility();
  }

  function setupPeriodSlider() {
    const def = state.data.meta.periodo_slider_padrao;
    state.lo = def.inicio; state.hi = def.fim;
    const mount = $('#period-slider-mount');
    const labels = $('#period-labels');
    labels.textContent = state.lo + ' – ' + state.hi;
    createRangeSlider(mount, {
      min: 1980, max: CURRENT_YEAR, valueMin: state.lo, valueMax: state.hi,
      onChange(lo, hi) {
        state.lo = lo; state.hi = hi;
        labels.textContent = lo + ' – ' + hi;
        renderCharts();
      }
    });
  }

  function renderCharts() {
    renderProducao(); renderFinanceiro(); renderEmprego(); renderCaged();
    renderComex(); renderEnergia(); renderBndes(); renderDecom();
  }
  function renderAll() {
    renderCharts();
    renderGargalos();
  }

  // ---------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------
  fetch('data/data.json')
    .then(r => r.json())
    .then(data => {
      state.data = data;
      populateUfSelect();
      setupViewTabs();
      setupPeriodSlider();
      renderReferencias(data);
      renderCharts();
      renderGargalos();
    })
    .catch(err => {
      document.querySelector('.wrap').innerHTML = '<p style="padding:40px;color:var(--bad)">Não foi possível carregar os dados (data/data.json). Detalhe: ' + err.message + '</p>';
      console.error(err);
    });
})();

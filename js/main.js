(function () {
  'use strict';
  const { lineChart, barChart, hBarChart, dualAxisLineChart, waterfallChart, donutChart, dataTable, rankList, fmt } = window.Charts;
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

  const state = { sector: '2451', view: 'home', data: null };
  // Filtro por bloco: cada seção tem sua própria cobertura real de dado
  // (Produção vai de 1980, RAIS de 2006, Comex varia até por setor — 2451
  // só tem exportação registrada a partir de 2016, 2452 desde 2006) — um
  // filtro único no topo não tinha como representar isso direito. lo/hi de
  // cada bloco nascem da cobertura real (calculada em initBlocks()), não de
  // um valor arbitrário compartilhado.
  const blocks = { producao: {}, emprego: {}, caged: {}, comex: {} };
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
  function csS() { return state.data.sectors[state.sector]; }
  function shared() { return state.data.shared; }
  function ufName(uf) {
    if (uf === 'BR') return 'Brasil';
    const found = state.data.meta.uf_lista.find(u => u.uf === uf);
    return found ? found.nome : uf;
  }
  // "BR" é um pseudo-estado (agregado nacional já calculado nas séries do
  // pipeline, não soma dos estados reais) selecionável junto dos 27 estados
  // reais, igual ao padrão já usado em Energia Industrial.
  function ufFiltroLista() { return [{ uf: 'BR', nome: 'Brasil' }, ...state.data.meta.uf_lista]; }
  function ufsOrdenadas(ufsSet) { return ufFiltroLista().map(u => u.uf).filter(uf => ufsSet.has(uf)); }
  // Exclui BR das linhas de tendência quando estados reais também estão
  // selecionados: BR é o agregado nacional, magnitude bem maior que 1 estado
  // sozinho, e esmaga as linhas menores perto de zero num eixo linear
  // compartilhado (mesmo problema já corrigido em Energia Industrial). As
  // tabelas completas não são filtradas por estado, então BR sumir do
  // gráfico não tira informação de lugar nenhum. Só mantém BR no gráfico
  // quando é a única seleção (visão nacional pura, comportamento padrão).
  function combosParaGrafico(combos, ufsSel) {
    return (ufsSel.includes('BR') && ufsSel.length > 1) ? combos.filter(c => c.uf !== 'BR') : combos;
  }

  // ---------------------------------------------------------------------
  // Filtro por bloco: período (com os limites reais de cada bloco) e,
  // onde aplicável, estado. Widgets minimalistas, embutidos em cada seção
  // (não mais uma barra fixa no topo da página).
  // ---------------------------------------------------------------------
  function yearBounds(rowArrays) {
    let lo = Infinity, hi = -Infinity;
    rowArrays.forEach(rows => rows.forEach(r => { if (r.ano < lo) lo = r.ano; if (r.ano > hi) hi = r.ano; }));
    return isFinite(lo) ? { lo, hi } : { lo: CURRENT_YEAR, hi: CURRENT_YEAR };
  }

  function fillYearOptions(sel, lo, hi, selected) {
    const years = []; for (let y = lo; y <= hi; y++) years.push(y);
    sel.innerHTML = years.map(y => `<option value="${y}"${y === selected ? ' selected' : ''}>${y}</option>`).join('');
  }

  function wireBlockPeriod(bs, loSel, hiSel, onChange) {
    fillYearOptions(loSel, bs.boundsLo, bs.boundsHi, bs.lo);
    fillYearOptions(hiSel, bs.boundsLo, bs.boundsHi, bs.hi);
    loSel.addEventListener('change', () => { bs.lo = Math.min(Number(loSel.value), bs.hi); loSel.value = bs.lo; onChange(); });
    hiSel.addEventListener('change', () => { bs.hi = Math.max(Number(hiSel.value), bs.lo); hiSel.value = bs.hi; onChange(); });
  }

  // Multi-select de estado por bloco (Emprego/CAGED) — mesmo padrão de
  // renderEnergiaIndustrial, parametrizado pelo blockState e pelos
  // elementos DOM daquele bloco. Retorna {render, sync} pra outros pontos
  // do mesmo bloco (ex.: clique num ranking) atualizarem o widget depois
  // de mexer em bs.ufs/bs.focoUf por fora.
  function wireBlockUf(bs, btnEl, panelEl, wrapEl, onChange) {
    function render() {
      panelEl.innerHTML = ufFiltroLista().map(u => `
        <label class="multiselect-option">
          <input type="checkbox" value="${u.uf}"${bs.ufs.has(u.uf) ? ' checked' : ''}>
          ${u.nome}
        </label>`).join('');
      panelEl.querySelectorAll('input').forEach(inp => inp.addEventListener('change', () => {
        if (inp.checked) { bs.ufs.add(inp.value); bs.focoUf = inp.value; }
        else if (bs.ufs.size > 1) {
          bs.ufs.delete(inp.value);
          if (bs.focoUf === inp.value) bs.focoUf = ufsOrdenadas(bs.ufs)[0];
        } else inp.checked = true; // sempre pelo menos 1 estado selecionado
        sync();
        onChange();
      }));
    }
    function sync() {
      const sel = ufsOrdenadas(bs.ufs);
      btnEl.textContent = sel.length <= 2 ? sel.map(uf => ufName(uf)).join(', ') : sel.length + ' estados';
    }
    btnEl.addEventListener('click', () => {
      const abrir = panelEl.hidden;
      panelEl.hidden = !abrir;
      btnEl.setAttribute('aria-expanded', String(abrir));
    });
    document.addEventListener('click', (evt) => {
      if (!wrapEl.contains(evt.target)) { panelEl.hidden = true; btnEl.setAttribute('aria-expanded', 'false'); }
    });
    render();
    sync();
    return { render, sync };
  }

  // Comex só usa 1 estado por vez (o gráfico de barras não compara vários
  // ao mesmo tempo) — um <select> simples é mais minimalista que o
  // dropdown de checkboxes usado em Emprego/CAGED.
  function wireComexUfSelect(bs, selEl, onChange) {
    selEl.innerHTML = ufFiltroLista().map(u => `<option value="${u.uf}">${u.nome}</option>`).join('');
    selEl.value = bs.focoUf;
    selEl.addEventListener('change', () => { bs.focoUf = selEl.value; onChange(); });
  }

  function initBlocks() {
    const sh = shared();
    const s1 = state.data.sectors['2451'], s2 = state.data.sectors['2452'];

    const prod = yearBounds([sh.producao.aco_gusa, sh.producao.metalurgia_indice]);
    blocks.producao = { lo: prod.lo, hi: prod.hi, boundsLo: prod.lo, boundsHi: prod.hi };

    const emp = yearBounds([s1.rais.uf_yearly_total, s2.rais.uf_yearly_total]);
    blocks.emprego = { lo: emp.lo, hi: emp.hi, boundsLo: emp.lo, boundsHi: emp.hi, ufs: new Set(['BR']), focoUf: 'BR' };

    const cagedLo = Math.min(Number(s1.caged.coverage.inicio.slice(0, 4)), Number(s2.caged.coverage.inicio.slice(0, 4)));
    const cagedHi = Math.max(Number(s1.caged.coverage.fim.slice(0, 4)), Number(s2.caged.coverage.fim.slice(0, 4)));
    blocks.caged = { lo: cagedLo, hi: cagedHi, boundsLo: cagedLo, boundsHi: cagedHi, ufs: new Set(['BR']), focoUf: 'BR' };

    const comex = yearBounds([s1.comex.yearly, s2.comex.yearly]);
    blocks.comex = { lo: comex.lo, hi: comex.hi, boundsLo: comex.lo, boundsHi: comex.hi, focoUf: 'BR' };
  }

  // ---------------------------------------------------------------------
  // 01 — Produção física
  // ---------------------------------------------------------------------
  function renderProducao() {
    const sh = shared();
    const bs = blocks.producao;

    const ag = filterMonthly(sh.producao.aco_gusa, bs.lo, bs.hi);
    const catAg = ag.map(r => r.ano * 100 + r.mes);
    lineChart($('#chart-producao-acogusa'), {
      categories: catAg, formatX: monthLabel, formatY: fmt.compact, height: 280,
      series: [
        { label: 'Aço bruto', color: 'var(--series-1)', values: ag.map(r => r.aco_bruto), area: true },
        { label: 'Ferro-gusa', color: 'var(--series-5)', values: ag.map(r => r.ferro_gusa) },
        { label: 'Laminados', color: 'var(--series-3)', values: ag.map(r => r.laminados) },
      ]
    });

    const dessaz = filterMonthly(sh.producao.aco_gusa_dessaz, bs.lo, bs.hi);
    const catDz = monthlyCategories([ag, dessaz]);
    lineChart($('#chart-producao-dessaz'), {
      categories: catDz, formatX: monthLabel, formatY: fmt.compact, height: 280,
      series: [
        { label: 'Observado', color: 'var(--series-2)', values: seriesMonthly(ag, 'aco_bruto', catDz) },
        { label: 'Dessazonalizado', color: 'var(--series-3)', values: seriesMonthly(dessaz, 'aco_bruto', catDz) },
      ]
    });

    const idx = filterMonthly(sh.producao.metalurgia_indice, bs.lo, bs.hi);
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

    const producaoTableRows = [...sh.producao.aco_gusa].sort((a, b) => (b.ano * 100 + b.mes) - (a.ano * 100 + a.mes));
    dataTable($('#table-producao'), {
      columns: [
        { key: 'k', label: 'Mês', format: monthLabel },
        { key: 'aco_bruto', label: 'Aço bruto (t)', align: 'right', format: fmt.full },
        { key: 'ferro_gusa', label: 'Ferro-gusa (t)', align: 'right', format: fmt.full },
        { key: 'laminados', label: 'Laminados (t)', align: 'right', format: fmt.full },
        { key: 'semi_acabados', label: 'Semiacabados (t)', align: 'right', format: fmt.full },
      ],
      rows: producaoTableRows.map(r => ({ ...r, k: r.ano * 100 + r.mes })),
      pageSize: 12,
    });
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

    dataTable($('#table-financeiro'), {
      columns: [
        { key: 'ano', label: 'Ano' },
        { key: 'numero_empresas', label: 'Nº empresas', align: 'right', format: fmt.full },
        { key: 'pessoal_ocupado', label: 'Pessoal ocupado', align: 'right', format: fmt.full },
        { key: 'vbpi', label: 'VBPI', align: 'right', format: n => fmt.brlFull(n * 1000) },
        { key: 'vti', label: 'VTI', align: 'right', format: n => fmt.brlFull(n * 1000) },
        { key: 'receita_liquida_total', label: 'Receita líquida', align: 'right', format: n => fmt.brlFull(n * 1000) },
        { key: 'custos_despesas_totais', label: 'Custos totais', align: 'right', format: n => fmt.brlFull(n * 1000) },
        { key: 'margem', label: 'Margem operacional', align: 'right', format: n => fmt.pct(n) },
      ],
      rows: [...sh.financeiro.fundicao_24_5].reverse().map(r => ({
        ...r,
        margem: (r.receita_liquida_total && r.custos_despesas_totais != null)
          ? ((r.receita_liquida_total - r.custos_despesas_totais) / r.receita_liquida_total) * 100 : null,
      })),
      pageSize: 20,
    });
  }

  // ---------------------------------------------------------------------
  // 03 — Emprego formal (RAIS)
  // ---------------------------------------------------------------------
  function renderEmprego() {
    const s = csS();
    const bs = blocks.emprego;

    // Combos: 1 linha por estado marcado no filtro (BR usa o total nacional
    // já calculado no pipeline, não a soma dos estados reais selecionados) —
    // mesmo padrão de renderEnergiaIndustrial, aplicado aqui às 2 séries
    // anuais que já têm abertura por UF na fonte (vínculos e estabelecimentos).
    const ufsSel = ufsOrdenadas(bs.ufs);
    const combos = ufsSel.map(uf => {
      const rows = uf === 'BR'
        ? s.rais.uf_yearly_total
        : s.rais.uf_yearly.filter(r => r.uf === uf);
      return { uf, nome: ufName(uf), rows: filterAnnual(rows, bs.lo, bs.hi) };
    });
    const combosGrafico = combosParaGrafico(combos, ufsSel);
    const catRais = annualCategories(combosGrafico.map(c => c.rows));
    lineChart($('#chart-emprego-rais'), {
      categories: catRais, formatY: fmt.full, height: 280,
      series: combosGrafico.map((c, i) => ({
        label: c.nome, color: CORES[i % CORES.length],
        values: seriesAnnual(c.rows, 'vinculos', catRais), area: combosGrafico.length === 1,
      })),
    });

    const tamRows = filterAnnual(s.rais.tamanho_yearly, bs.lo, bs.hi);
    const catsTam = annualCategories([tamRows]);
    const faixas = Array.from(new Set(tamRows.map(r => r.faixa)));
    const seriesTam = faixas.map((faixa, i) => ({
      label: faixa, color: CORES[i % CORES.length],
      values: catsTam.map(ano => { const row = tamRows.find(r => r.ano === ano && r.faixa === faixa); return row ? row.vinculos : 0; })
    }));
    barChart($('#chart-emprego-tamanho'), { categories: catsTam, formatY: fmt.full, height: 280, stacked: true, series: seriesTam });

    // Ranking: todos os estados com dado no ano mais recente (sem linha de
    // referência — vínculos é um total absoluto, e o "Brasil" é a soma dos
    // estados, não uma taxa comparável como o custo de energia). Estados
    // marcados no filtro ficam destacados; clicar numa barra adiciona aquele
    // estado ao filtro.
    const totalLatest = last(s.rais.uf_yearly_total);
    const ufRanking = s.rais.uf_yearly.filter(r => r.ano === totalLatest.ano).sort((a, b) => b.vinculos - a.vinculos);
    $('#emprego-uf-sub').textContent = 'Ano de ' + totalLatest.ano + ', clique numa barra para adicionar ao filtro';
    hBarChart($('#rank-emprego-uf'), {
      items: ufRanking.map(r => ({ uf: r.uf, label: r.nome_uf, value: r.vinculos, color: bs.ufs.has(r.uf) ? 'var(--series-3)' : 'var(--series-2)' })),
      formatVal: fmt.full,
      onClick: (it) => { bs.ufs.add(it.uf); bs.focoUf = it.uf; empregoUfCtl.render(); empregoUfCtl.sync(); renderEmprego(); },
    });

    lineChart($('#chart-emprego-razao'), {
      categories: catRais, formatY: fmt.full1, height: 280,
      series: combosGrafico.map((c, i) => ({
        label: c.nome, color: CORES[i % CORES.length],
        values: catRais.map(ano => { const r = c.rows.find(x => x.ano === ano); return r && r.estabelecimentos ? r.vinculos / r.estabelecimentos : null; }),
      })),
    });

    const escRows = filterAnnual(s.rais.escolaridade_yearly, bs.lo, bs.hi);
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
    const massaRows = filterAnnual(s.rais.massa_nacional_yearly, bs.lo, bs.hi);
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

    $('#emprego-uf-table-sub').textContent = 'Ano de ' + totalLatest.ano + ', todas as UFs com dado';
    const ufTableRows = s.rais.uf_yearly.filter(r => r.ano === totalLatest.ano).sort((a, b) => b.vinculos - a.vinculos);
    dataTable($('#table-emprego-uf'), {
      columns: [
        { key: 'nome_uf', label: 'UF' },
        { key: 'estabelecimentos', label: 'Estabelecimentos', align: 'right', format: fmt.full },
        { key: 'vinculos', label: 'Vínculos', align: 'right', format: fmt.full },
        { key: 'razao', label: 'Vínculos / estabelecimento', align: 'right', format: fmt.full1 },
      ],
      rows: ufTableRows.map(r => ({ ...r, razao: r.estabelecimentos ? r.vinculos / r.estabelecimentos : null })),
      pageSize: 10,
    });

    const ocupDet = s.rais.ocupacao_detalhada_latest;
    $('#emprego-ocupacao-detalhada-sub').textContent = 'RAIS, sem agrupamento, retrato de ' + ocupDet.ano + '. Clique no cabeçalho para ordenar.';
    dataTable($('#table-emprego-ocupacao-detalhada'), {
      columns: [
        { key: 'categoria', label: 'Ocupação', format: titleCasePt },
        { key: 'frequencia', label: 'Vínculos', align: 'right', format: fmt.full },
      ],
      rows: ocupDet.items,
      pageSize: 15,
    });
  }

  // ---------------------------------------------------------------------
  // 04 — CAGED
  // ---------------------------------------------------------------------
  function renderCaged() {
    const s = csS();
    const bs = blocks.caged;

    $('#caged-coverage-note').textContent = `Granularidade mensal (admissões/desligamentos), que a RAIS não oferece. Cobertura: ${s.caged.coverage.inicio} a ${s.caged.coverage.fim}. Clique numa barra do ranking por UF para adicionar aquele estado ao filtro abaixo.`;

    // Combos: 1 linha por estado marcado no filtro (mesmo padrão de
    // renderEmprego/renderEnergiaIndustrial), usando as séries mensais por
    // UF do CAGED (BR usa o total nacional já existente).
    const ufsSel = ufsOrdenadas(bs.ufs);
    const combosSaldo = ufsSel.map(uf => {
      const rows = uf === 'BR' ? s.caged.saldo_monthly_national : s.caged.saldo_uf_monthly.filter(r => r.uf === uf);
      return { uf, nome: ufName(uf), rows: filterMonthly(rows, bs.lo, bs.hi) };
    });
    const combosSaldoGrafico = combosParaGrafico(combosSaldo, ufsSel);
    const catSaldo = monthlyCategories(combosSaldoGrafico.map(c => c.rows));
    lineChart($('#chart-caged-saldo'), {
      categories: catSaldo, formatX: monthLabel, formatY: fmt.full, height: 280,
      series: combosSaldoGrafico.map((c, i) => ({
        label: c.nome, color: CORES[i % CORES.length],
        values: seriesMonthly(c.rows, 'saldo', catSaldo), area: combosSaldoGrafico.length === 1,
      })),
    });

    const tipoMonthly = filterMonthly(s.caged.tipo_movimentacao_monthly, bs.lo, bs.hi);
    lineChart($('#chart-caged-movimentacao'), {
      categories: tipoMonthly.map(r => r.ano * 100 + r.mes), formatX: monthLabel, formatY: fmt.compact, height: 280, stacked: true,
      series: [
        { label: 'Admissões', color: 'var(--series-4)', values: tipoMonthly.map(r => r.admissoes) },
        { label: 'Desligamentos', color: 'var(--series-6)', values: tipoMonthly.map(r => r.desligamentos) },
      ]
    });

    // Rótulos curtos: a categoria completa ("Desligamento por demissão sem
    // justa causa, térm de contrato prz det, térm contrato") não cabe como
    // rótulo de gráfico — usa uma versão resumida, igual ao padrão já usado
    // em LABELS_TEMPO mais abaixo.
    const LABELS_DESLIGAMENTO = {
      'Desligamento por demissão sem justa causa, térm de contrato prz det, térm contrato': 'Sem justa causa / fim de contrato',
      'Desligamento a pedido': 'A pedido do empregado',
      'Desligamento por demissão com justa causa': 'Com justa causa',
      'Desligamento por morte': 'Óbito',
      'Desligamento por acordo empregado e empregador': 'Acordo mútuo',
      'Desligamento por aposentadoria': 'Aposentadoria',
    };
    const tipoBreak = s.caged.tipo_movimentacao_breakdown_total.filter(t => /desligamento/i.test(t.tipo))
      .sort((a, b) => b.quantidade - a.quantidade);
    hBarChart($('#chart-caged-tipo'), {
      items: tipoBreak.map(t => ({ label: LABELS_DESLIGAMENTO[t.tipo] || t.tipo, value: t.quantidade, color: 'var(--series-6)' })),
      formatVal: fmt.full,
    });

    const combosSalario = ufsSel.map(uf => {
      const rows = uf === 'BR' ? s.caged.salario_monthly_national : s.caged.salario_uf_monthly.filter(r => r.uf === uf);
      return { uf, nome: ufName(uf), rows: filterMonthly(rows, bs.lo, bs.hi) };
    });
    const combosSalarioGrafico = combosParaGrafico(combosSalario, ufsSel);
    const catSalario = monthlyCategories(combosSalarioGrafico.map(c => c.rows));
    lineChart($('#chart-caged-massa-salarial'), {
      categories: catSalario, formatX: monthLabel, formatY: fmt.brl, height: 280,
      series: combosSalarioGrafico.map((c, i) => ({
        label: c.nome, color: CORES[i % CORES.length],
        values: seriesMonthly(c.rows, 'massa_salarial', catSalario),
      })),
    });

    // Ranking: soma do saldo no período selecionado, todos os estados com
    // dado. Referência em zero é natural aqui (positivo = contratou líquido,
    // negativo = demitiu líquido) — diferente de vínculos/desembolso, que
    // são totais absolutos sem um "zero" comparável.
    const saldoUfRows = s.caged.saldo_uf_monthly.filter(r => r.ano >= bs.lo && r.ano <= bs.hi);
    const saldoPorUf = {};
    saldoUfRows.forEach(r => { saldoPorUf[r.uf] = (saldoPorUf[r.uf] || 0) + r.saldo; });
    const saldoUfSorted = Object.entries(saldoPorUf).map(([uf, saldo]) => ({ uf, saldo }))
      .sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo));
    hBarChart($('#rank-caged-saldo-uf'), {
      items: saldoUfSorted.map(r => ({
        uf: r.uf, label: ufName(r.uf), value: r.saldo,
        color: bs.ufs.has(r.uf) ? 'var(--series-3)' : (r.saldo >= 0 ? 'var(--good)' : 'var(--bad)'),
      })),
      formatVal: fmt.full,
      reference: { value: 0, label: 'Zero' },
      onClick: (it) => { bs.ufs.add(it.uf); bs.focoUf = it.uf; cagedUfCtl.render(); cagedUfCtl.sync(); renderCaged(); },
    });

    dataTable($('#table-caged-uf'), {
      columns: [
        { key: 'uf_nome', label: 'UF' },
        { key: 'saldo', label: 'Saldo acumulado', align: 'right', format: fmt.full },
      ],
      rows: saldoUfSorted.map(r => ({ uf_nome: ufName(r.uf), saldo: r.saldo })),
      pageSize: 10,
    });
  }

  // ---------------------------------------------------------------------
  // 05 — Comércio exterior
  // ---------------------------------------------------------------------
  function renderComex() {
    const s = csS();
    const bs = blocks.comex;
    const ufAvailable = new Set(s.comex.uf_yearly.map(r => r.uf));
    let rows, note = '';
    if (bs.focoUf === 'BR' || !ufAvailable.has(bs.focoUf)) {
      rows = filterAnnual(s.comex.yearly, bs.lo, bs.hi);
      if (bs.focoUf !== 'BR') note = 'Estado sem dado detalhado nesta base; mostrando total nacional do setor.';
    } else {
      const ufRows = s.comex.uf_yearly.filter(r => r.uf === bs.focoUf);
      const years = annualCategories([ufRows]);
      rows = years.map(ano => {
        const exp = ufRows.find(r => r.ano === ano && r.fluxo === 'Exportação');
        const imp = ufRows.find(r => r.ano === ano && r.fluxo === 'Importação');
        return { ano, exportacao_usd: exp ? exp.valor_usd : 0, importacao_usd: imp ? imp.valor_usd : 0 };
      });
      rows = filterAnnual(rows, bs.lo, bs.hi);
    }
    $('#comex-uf-note') && ($('#comex-uf-note').textContent = note);
    $('#comex-foco-sub').textContent = 'US$ FOB por ano, ' + ufName(bs.focoUf);
    const cat = rows.map(r => r.ano);
    barChart($('#chart-comex-brasil'), {
      categories: cat, formatY: fmt.usd, height: 280,
      series: [
        { label: 'Exportação', color: 'var(--series-4)', values: rows.map(r => r.exportacao_usd) },
        { label: 'Importação', color: 'var(--series-6)', values: rows.map(r => -r.importacao_usd) }
      ]
    });

    const rowsKg = filterAnnual(s.comex.yearly, bs.lo, bs.hi);
    barChart($('#chart-comex-brasil-kg'), {
      categories: rowsKg.map(r => r.ano), formatY: n => fmt.compact(n) + ' kg', height: 280,
      series: [
        { label: 'Exportação', color: 'var(--series-4)', values: rowsKg.map(r => r.exportacao_kg) },
        { label: 'Importação', color: 'var(--series-6)', values: rowsKg.map(r => -r.importacao_kg) }
      ]
    });

    const topY = s.comex.top_paises_yearly;
    const filteredYearly = topY.yearly.filter(r => r.ano >= bs.lo && r.ano <= bs.hi);
    const seriesTopPaises = topY.paises.map((pais, i) => ({
      label: pais, color: CORES[i % CORES.length], values: filteredYearly.map(r => r[pais] || 0)
    }));
    seriesTopPaises.push({ label: 'Outros', color: 'var(--baseline)', values: filteredYearly.map(r => r.Outros || 0) });
    barChart($('#chart-comex-top-paises-tempo'), {
      categories: filteredYearly.map(r => r.ano), formatY: fmt.usd, height: 280, stacked: true, series: seriesTopPaises
    });

    const ctBr = filterAnnual(s.comtrade.brazil_yearly, bs.lo, bs.hi);
    const ctWorld = filterAnnual(s.comtrade.world_yearly, bs.lo, bs.hi);
    const catCt = annualCategories([ctBr, ctWorld]);
    // Eixos independentes: exportação do Brasil é ordens de grandeza menor
    // que a mundial (milhões x bilhões) — no mesmo eixo linear, a linha do
    // Brasil ficava achatada perto de zero e só a linha mundial aparecia.
    dualAxisLineChart($('#chart-comex-mundo'), {
      categories: catCt, formatYLeft: fmt.usd, formatYRight: fmt.usd, height: 280,
      seriesLeft: { label: 'Exportação do Brasil', color: 'var(--series-1)', values: seriesAnnual(ctBr, 'export_usd', catCt) },
      seriesRight: { label: 'Exportação mundial (contexto)', color: 'var(--series-8)', values: seriesAnnual(ctWorld, 'export_usd', catCt) },
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

    const ufAnoMax = Math.max(...s.comex.uf_yearly.map(r => r.ano));
    const rankExpUf = Array.from(new Set(s.comex.uf_yearly.map(r => r.uf))).map(uf => {
      const exp = s.comex.uf_yearly.find(r => r.uf === uf && r.ano === ufAnoMax && r.fluxo === 'Exportação');
      return exp ? { uf, label: exp.nome_uf, value: exp.valor_usd } : null;
    }).filter(Boolean).sort((a, b) => b.value - a.value);
    $('#comex-uf-rank-sub').textContent = 'UF de origem do produto, exportação de ' + ufAnoMax + '. Clique numa barra para trocar o foco.';
    hBarChart($('#rank-comex-uf'), {
      items: rankExpUf.map(r => ({ uf: r.uf, label: r.label, value: r.value, color: r.uf === bs.focoUf ? 'var(--series-3)' : 'var(--series-4)' })),
      formatVal: fmt.usd,
      onClick: (it) => { bs.focoUf = it.uf; $('#comex-uf-select').value = it.uf; renderComex(); },
    });
    $('#comex-uf-table-sub').textContent = 'Ano de ' + ufAnoMax + ', principais UFs produtoras';
    const ufNomes = Array.from(new Set(s.comex.uf_yearly.map(r => r.nome_uf)));
    const ufTableRows = ufNomes.map(nome_uf => {
      const exp = s.comex.uf_yearly.find(r => r.nome_uf === nome_uf && r.ano === ufAnoMax && r.fluxo === 'Exportação');
      const imp = s.comex.uf_yearly.find(r => r.nome_uf === nome_uf && r.ano === ufAnoMax && r.fluxo === 'Importação');
      return { nome_uf, exportacao_usd: exp ? exp.valor_usd : 0, importacao_usd: imp ? imp.valor_usd : 0 };
    }).sort((a, b) => b.exportacao_usd - a.exportacao_usd);
    dataTable($('#table-comex-uf'), {
      columns: [
        { key: 'nome_uf', label: 'UF' },
        { key: 'exportacao_usd', label: 'Exportação', align: 'right', format: fmt.usdFull },
        { key: 'importacao_usd', label: 'Importação', align: 'right', format: fmt.usdFull },
      ],
      rows: ufTableRows,
      pageSize: 8,
    });
  }

  // ---------------------------------------------------------------------
  // 06 — BNDES
  // ---------------------------------------------------------------------
  const PORTES_ORDEM = ['GRANDE', 'MÉDIA', 'PEQUENA', 'MICRO'];
  const CORES_PORTE = { GRANDE: 'var(--series-6)', 'MÉDIA': 'var(--series-8)', PEQUENA: 'var(--series-4)', MICRO: 'var(--series-2)' };

  function renderBndes() {
    const s = csS();

    // BNDES não responde ao filtro de período nem ao de estado nestes 3
    // exhibits (desembolso anual, porte ao longo do tempo, concentração):
    // dado anual e esparso, cortar pelo período padrão (2016-2026) escondia
    // a maior parte do histórico (2002-2026) — mesmo motivo pelo qual
    // Financeiro (PIA) também é exibido sempre em série completa. Comparar
    // por estado não faz sentido aqui (desembolso não é distribuído
    // uniformemente Brasil afora); quem quer ver por estado usa o ranking
    // abaixo, que já é o lugar certo pra isso.
    lineChart($('#chart-bndes-ano'), {
      categories: s.bndes.yearly.map(r => r.ano), formatY: fmt.brl, height: 280,
      series: [{ label: 'Desembolsado', color: 'var(--series-8)', values: s.bndes.yearly.map(r => r.valor_desembolsado), area: true }],
    });

    // Ranking: todos os estados com dado, acumulado no histórico completo.
    // Sem linha de referência (desembolso é um total absoluto, Brasil = soma
    // dos estados) e sem clique (BNDES não tem filtro nesta seção — ver nota
    // acima; o ranking já é o retrato completo, não uma seleção recortável).
    hBarChart($('#rank-bndes-uf'), {
      items: s.bndes.uf_total.map(i => ({ uf: i.uf, label: i.nome_uf, value: i.valor_desembolsado, color: 'var(--series-8)' })),
      formatVal: fmt.brl,
    });

    // Desembolso por porte ao longo do tempo (barra empilhada) + concentração (donut) —
    // as duas leituras que a tabela de 200+ linhas não deixa claras de cara.
    const catsPorte = Array.from(new Set(s.bndes.table.map(r => r.ano))).sort((a, b) => a - b);
    const seriesPorte = PORTES_ORDEM.filter(p => s.bndes.table.some(r => r.porte === p)).map(porte => ({
      label: titleCasePt(porte), color: CORES_PORTE[porte] || 'var(--series-1)',
      values: catsPorte.map(ano => s.bndes.table
        .filter(r => r.ano === ano && r.porte === porte)
        .reduce((a, r) => a + (r.valor_desembolsado || 0), 0))
    }));
    barChart($('#chart-bndes-porte'), { categories: catsPorte, formatY: fmt.brl, height: 280, stacked: true, series: seriesPorte });

    const totalPorte = {};
    s.bndes.table.forEach(r => { totalPorte[r.porte] = (totalPorte[r.porte] || 0) + (r.valor_desembolsado || 0); });
    const totalGeral = Object.values(totalPorte).reduce((a, v) => a + v, 0);
    const grandePct = totalGeral ? ((totalPorte.GRANDE || 0) / totalGeral) * 100 : null;
    $('#bndes-concentracao-sub').textContent = grandePct != null
      ? `Grande porte: ${fmt.full1(grandePct)}% do desembolsado (todo o histórico)`
      : 'Acumulado no histórico completo';
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

    dataTable($('#table-bndes-uf'), {
      columns: [
        { key: 'nome_uf', label: 'UF' },
        { key: 'valor_desembolsado', label: 'Desembolsado (acumulado)', align: 'right', format: fmt.brlFull },
      ],
      rows: s.bndes.uf_total,
      pageSize: 10,
    });
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
    const AMBOS = 'Ferro e aço (2451) e Não ferrosos (2452)';
    const rows = [
      [AMBOS, 'Produção física', 'Instituto Aço Brasil (IBS) + IBGE, PIM-PF (Metalurgia geral e Aço/Ferro-gusa)', '1980–2026 (mensal)', 'Nível "metalurgia"/produto, não é exclusivo de 2451/2452.'],
      [AMBOS, 'Emprego formal', 'RAIS (vínculos, faixa de tamanho, escolaridade, ocupação, tempo de emprego, massa salarial)', '2006–2025 (anual)', 'Quebra metodológica em 2022 (eSocial) nos perfis detalhados.'],
      [AMBOS, 'CAGED', 'CAGED (saldo, salário, tipo de movimentação por UF/CNAE)', `${cagedCov.inicio} a ${cagedCov.fim} (mensal)`, 'Cobertura calculada dinamicamente a partir da base carregada.'],
      [AMBOS, 'Financeiro', 'IBGE, PIA-Empresa (Metalurgia e Fundição 24.5)', '2007–2023 (anual)', 'Valores em R$ mil convertidos para R$ na exibição. Fundição 24.5 combina 2451+2452.'],
      [AMBOS, 'Comércio exterior', 'MDIC, Comex Stat (exportação/importação por país e UF)', '2006/2016–2026 (anual)', 'Dado oficial brasileiro, específico por CNAE.'],
      [AMBOS, 'Comércio exterior', 'UN Comtrade (comércio mundial por código HS)', '2015–2024 (anual)', 'Proxy por HS (não existe CNAE em bases internacionais); usado só para contexto Brasil x Mundo.'],
      [AMBOS, 'BNDES', 'BNDES, desembolsos por UF/porte/instrumento', '2002–2026 (anual)', 'Específico por CNAE (2451/2452).'],
      ['Ferro e aço (2451)', 'DECOM', 'DECOM/GECEX, processos de defesa comercial', 'Histórico (datas variáveis)', 'Base específica de ferro e aço (2451); sem processos catalogados para 2452.'],
      [AMBOS, 'Contexto', 'Indicadores macro (IPCA, dólar, IPP metalurgia)', '1990–2026 (mensal)', 'IPCA usado para deflacionar a remuneração real (bloco Emprego formal); demais indicadores só como pano de fundo.'],
      ['Energia Industrial (aba própria)', 'Consumo e custo de energia da indústria de transformação, Brasil e São Paulo', '2012–2026 (mensal)', 'Nível de divisão CNAE (24 divisões), não é exclusivo de 2451/2452; custo e gasto são estimativas por cenário (baixo/médio/alto). Abrangência geográfica limitada a Brasil x São Paulo nesta fonte (sem abertura para as demais UFs).'],
    ];
    $('#referencias-table tbody').innerHTML = rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td class="mono">${r[3]}</td><td>${r[4]}</td></tr>`).join('');
  }

  // ---------------------------------------------------------------------
  // PD&I: case setorial de fundição, montado uma vez com dados já
  // carregados (sem filtro, é um material de apoio de venda, não um
  // dashboard exploratório). Combina os dois CNAEs onde faz sentido tratar
  // "fundição" como um setor só (escolaridade, saldo de contratações,
  // BNDES); mantém 2451 e 2452 separados onde a diferença entre os dois é
  // o próprio ponto (comércio exterior).
  // ---------------------------------------------------------------------
  function renderPdi(data) {
    const s1 = data.sectors['2451'], s2 = data.sectors['2452'];

    // Importação vinda da China, % do total, por CNAE.
    const rowsChina1 = s1.comex.importacao_china_resto_yearly;
    const rowsChina2 = s2.comex.importacao_china_resto_yearly;
    // 2016 em diante: é a partir daí que o 2451 tem dado de comex, então é a
    // janela onde a comparação entre os dois CNAEs realmente existe.
    const catChina = annualCategories([rowsChina1, rowsChina2]).filter(ano => ano >= 2016);
    const pctChina = (rows) => catChina.map(ano => {
      const r = rows.find(x => x.ano === ano);
      if (!r) return null;
      const total = r.china_usd + r.resto_usd;
      return total ? (r.china_usd / total) * 100 : null;
    });
    lineChart($('#pdi-chart-china'), {
      categories: catChina, formatY: n => fmt.pct(n), height: 260,
      series: [
        { label: 'Ferro e aço (2451)', color: 'var(--series-6)', values: pctChina(rowsChina1) },
        { label: 'Não ferrosos (2452)', color: 'var(--series-4)', values: pctChina(rowsChina2) },
      ],
    });

    // Exportação: ferro/aço x não ferrosos.
    const catExp = annualCategories([s1.comex.yearly, s2.comex.yearly]).filter(ano => ano >= 2016);
    lineChart($('#pdi-chart-exportacao'), {
      categories: catExp, formatY: fmt.usd, height: 260,
      series: [
        { label: 'Ferro e aço (2451)', color: 'var(--series-1)', values: seriesAnnual(s1.comex.yearly, 'exportacao_usd', catExp) },
        { label: 'Não ferrosos (2452)', color: 'var(--series-4)', values: seriesAnnual(s2.comex.yearly, 'exportacao_usd', catExp) },
      ],
    });

    // Participação do Brasil no comércio mundial (Comtrade), por CNAE.
    function participacaoMundial(sec, cat) {
      const br = new Map(sec.comtrade.brazil_yearly.map(r => [r.ano, r.export_usd]));
      const wd = new Map(sec.comtrade.world_yearly.map(r => [r.ano, r.export_usd]));
      return cat.map(ano => {
        const b = br.get(ano), w = wd.get(ano);
        return (b != null && w) ? (b / w) * 100 : null;
      });
    }
    const catMundial = annualCategories([s1.comtrade.brazil_yearly, s2.comtrade.brazil_yearly]);
    lineChart($('#pdi-chart-mundial'), {
      categories: catMundial, formatY: n => fmt.pct(n), height: 260,
      series: [
        { label: 'Ferro e aço (2451)', color: 'var(--series-1)', values: participacaoMundial(s1, catMundial) },
        { label: 'Não ferrosos (2452)', color: 'var(--series-4)', values: participacaoMundial(s2, catMundial) },
      ],
    });

    // Custo da energia na metalurgia (CNAE 24) em SP, média anual. Reaproveita
    // o mesmo arquivo lazy da aba Energia Industrial (fetch avulso, sem
    // filtro nem cache compartilhado, é a única vez que essa página usa).
    fetch('data/energia/serie-cnae-24.json').then(r => r.json()).then(obj => {
      const sp = obj['SP'] || [];
      const porAno = {};
      sp.forEach(([ano, , , custo]) => { if (custo != null) (porAno[ano] = porAno[ano] || []).push(custo); });
      const anos = Object.keys(porAno).map(Number).sort((a, b) => a - b);
      const vals = anos.map(a => porAno[a].reduce((x, y) => x + y, 0) / porAno[a].length);
      lineChart($('#pdi-chart-energia'), {
        categories: anos, formatY: n => fmt.brl(n) + '/MWh', height: 260,
        series: [{ label: 'Custo médio', color: 'var(--series-8)', values: vals, area: true }],
      });
    });

    // Escolaridade combinada (2451+2452), agrupada em 3 faixas, % dos vínculos por ano.
    function baldeEscolaridade(categoria) {
      if (/analfabeto|fundamental|5[ºª]/i.test(categoria)) return 'Fundamental ou menos';
      if (/m[ée]dio/i.test(categoria)) return 'Médio';
      if (/superior/i.test(categoria)) return 'Superior';
      return null;
    }
    const escPorAno = {};
    [s1, s2].forEach(sec => sec.rais.escolaridade_yearly.forEach(r => {
      const balde = baldeEscolaridade(r.categoria);
      if (!balde) return;
      escPorAno[r.ano] = escPorAno[r.ano] || {};
      escPorAno[r.ano][balde] = (escPorAno[r.ano][balde] || 0) + r.frequencia;
    }));
    const anosEsc = Object.keys(escPorAno).map(Number).sort((a, b) => a - b);
    const BALDES = ['Fundamental ou menos', 'Médio', 'Superior'];
    const CORES_BALDE = { 'Fundamental ou menos': 'var(--series-6)', 'Médio': 'var(--series-8)', 'Superior': 'var(--series-4)' };
    lineChart($('#pdi-chart-escolaridade'), {
      categories: anosEsc, formatY: n => fmt.pct(n), height: 260, stacked: true,
      series: BALDES.map(b => ({
        label: b, color: CORES_BALDE[b],
        values: anosEsc.map(a => {
          const total = BALDES.reduce((acc, bb) => acc + (escPorAno[a][bb] || 0), 0);
          return total ? ((escPorAno[a][b] || 0) / total) * 100 : 0;
        }),
      })),
    });

    // Saldo de contratações (admissões menos desligamentos) por ano, fundição combinada.
    const saldoPorAno = {};
    [s1, s2].forEach(sec => sec.caged.tipo_movimentacao_monthly.forEach(r => {
      saldoPorAno[r.ano] = (saldoPorAno[r.ano] || 0) + (r.admissoes || 0) - (r.desligamentos || 0);
    }));
    const anosSaldo = Object.keys(saldoPorAno).map(Number).sort((a, b) => a - b);
    barChart($('#pdi-chart-saldo'), {
      categories: anosSaldo, formatY: fmt.full, height: 260,
      series: [{ label: 'Saldo de contratações', color: 'var(--series-2)', values: anosSaldo.map(a => saldoPorAno[a]) }],
    });

    // Margem operacional da Fundição 24.5 (já combina 2451+2452 na fonte).
    const finF = data.shared.financeiro.fundicao_24_5;
    lineChart($('#pdi-chart-margem'), {
      categories: finF.map(r => r.ano), formatY: n => fmt.pct(n), height: 260,
      series: [{
        label: 'Margem operacional', color: 'var(--series-3)', area: true,
        values: finF.map(r => (r.receita_liquida_total && r.custos_despesas_totais != null)
          ? ((r.receita_liquida_total - r.custos_despesas_totais) / r.receita_liquida_total) * 100 : null),
      }],
    });

    // BNDES por porte, concentração combinada (2451+2452), histórico completo.
    const portePorTotal = {};
    [s1, s2].forEach(sec => sec.bndes.porte_total.forEach(p => {
      portePorTotal[p.porte] = (portePorTotal[p.porte] || 0) + p.valor_desembolsado;
    }));
    donutChart($('#pdi-chart-bndes'), {
      formatVal: fmt.brl, size: 190,
      items: PORTES_ORDEM.filter(p => portePorTotal[p]).map(p => ({ label: titleCasePt(p), value: portePorTotal[p], color: CORES_PORTE[p] })),
    });

    // Funil ilustrativo: não é dado real de nenhuma empresa, é um modelo pra
    // ancorar a conversa (a legenda no HTML já deixa isso explícito).
    waterfallChart($('#pdi-chart-funil'), {
      formatY: n => fmt.pct(n), height: 260,
      items: [
        { label: 'Margem atual (referência baixa do setor)', value: 5 },
        { label: 'Eficiência energética', value: 2 },
        { label: 'Redução de refugo', value: 2 },
        { label: 'Ligas / produtos especiais', value: 4 },
        { label: 'Margem com projeto de PD&I', value: 13, isTotal: true },
      ],
    });

    // Índice de setores de PD&I: vive na barra lateral (#pdi-section-nav),
    // igual ao "Nesta seção" que já existe pra dentro de um setor. Hoje só
    // Fundição; cada setor novo vira mais um botão ali.
    $('#pdi-section-nav').querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => scrollToBlock(btn.dataset.target));
    });
  }

  // ---------------------------------------------------------------------
  // Energia Industrial: consumo/custo de energia da indústria de
  // transformação inteira — 27 estados + Brasil, 24 divisões CNAE.
  // Filtros: estados (multi-select), setor (CNAE, single-select) e período
  // (mês inicial/final). A série completa por divisão x UF (~115 mil
  // linhas) é grande demais para embutir tudo no data.json principal, então
  // fica em 24 arquivos (data/energia/serie-cnae-N.json) carregados sob
  // demanda ao trocar de setor, com cache em memória depois do 1º fetch.
  // Clicar numa barra do ranking (gráfico 2) adiciona aquele estado ao
  // filtro; clicar numa barra da composição (gráfico 3) remove.
  // ---------------------------------------------------------------------
  function renderEnergiaIndustrial(data) {
    const ei = data.energia_industrial;
    const cache = {};
    const cacheComposicao = {};
    const anoMesLo0 = Number(ei.coverage.inicio.replace('-', ''));
    const anoMesHi0 = Number(ei.coverage.fim.replace('-', ''));
    const meses = [];
    for (let k = anoMesLo0; k <= anoMesHi0;) {
      meses.push(k);
      const a = Math.floor(k / 100), m = k % 100;
      k = m === 12 ? (a + 1) * 100 + 1 : k + 1;
    }

    const stateEI = {
      ufs: new Set(['SP', 'BR']), cnaes: new Set([10]),
      focoUf: 'SP', focoCnae: 10, lo: anoMesLo0, hi: anoMesHi0,
    };
    const ufInfo = {}; ei.ufs.forEach(u => { ufInfo[u.uf] = u.nome; });
    const divInfo = {}; ei.divisoes.forEach(d => { divInfo[d.cnae] = d; });
    const ufsOrdenadas = () => ei.ufs.map(u => u.uf).filter(uf => stateEI.ufs.has(uf));
    const cnaesOrdenadas = () => ei.divisoes.map(d => d.cnae).filter(c => stateEI.cnaes.has(c));

    async function ensureCnae(cnae) {
      if (!cache[cnae]) cache[cnae] = await fetch(`data/energia/serie-cnae-${cnae}.json`).then(r => r.json());
      return cache[cnae];
    }
    async function ensureComposicaoUf(uf) {
      if (!cacheComposicao[uf]) cacheComposicao[uf] = await fetch(`data/energia/composicao-uf-${uf}.json`).then(r => r.json());
      return cacheComposicao[uf];
    }

    // ---- Estados: multi-select em dropdown de checkboxes ----
    const ufBtn = $('#ei-uf-btn'), ufPanel = $('#ei-uf-panel');
    function renderUfPanel() {
      ufPanel.innerHTML = ei.ufs.map(u => `
        <label class="multiselect-option">
          <input type="checkbox" value="${u.uf}"${stateEI.ufs.has(u.uf) ? ' checked' : ''}>
          ${u.nome}
        </label>`).join('');
      ufPanel.querySelectorAll('input').forEach(inp => inp.addEventListener('change', () => {
        if (inp.checked) { stateEI.ufs.add(inp.value); stateEI.focoUf = inp.value; }
        else if (stateEI.ufs.size > 1) {
          stateEI.ufs.delete(inp.value);
          if (stateEI.focoUf === inp.value) stateEI.focoUf = ufsOrdenadas()[0];
        } else inp.checked = true; // sempre pelo menos 1 estado selecionado
        syncUfBtn();
        update();
      }));
    }
    function syncUfBtn() {
      const sel = ufsOrdenadas();
      ufBtn.textContent = sel.length <= 3 ? sel.map(uf => ufInfo[uf]).join(', ') : sel.length + ' estados selecionados';
    }
    ufBtn.addEventListener('click', () => {
      const abrir = ufPanel.hidden;
      ufPanel.hidden = !abrir;
      ufBtn.setAttribute('aria-expanded', String(abrir));
    });
    document.addEventListener('click', (evt) => {
      if (!$('#ei-uf-multiselect').contains(evt.target)) {
        ufPanel.hidden = true; ufBtn.setAttribute('aria-expanded', 'false');
      }
    });
    renderUfPanel();
    syncUfBtn();

    // ---- Setores (CNAE): multi-select em dropdown de checkboxes, mesmo
    // widget dos estados — dá pra comparar setor igual dá pra comparar UF.
    const cnaeBtn = $('#ei-cnae-btn'), cnaePanel = $('#ei-cnae-panel');
    function renderCnaePanel() {
      cnaePanel.innerHTML = ei.divisoes.map(d => `
        <label class="multiselect-option">
          <input type="checkbox" value="${d.cnae}"${stateEI.cnaes.has(d.cnae) ? ' checked' : ''}>
          ${d.cnae} · ${titleCasePt(d.descricao)}
        </label>`).join('');
      cnaePanel.querySelectorAll('input').forEach(inp => inp.addEventListener('change', () => {
        const cnae = Number(inp.value);
        if (inp.checked) { stateEI.cnaes.add(cnae); stateEI.focoCnae = cnae; }
        else if (stateEI.cnaes.size > 1) {
          stateEI.cnaes.delete(cnae);
          if (stateEI.focoCnae === cnae) stateEI.focoCnae = cnaesOrdenadas()[0];
        } else inp.checked = true; // sempre pelo menos 1 setor selecionado
        syncCnaeBtn();
        update();
      }));
    }
    function syncCnaeBtn() {
      const sel = cnaesOrdenadas();
      cnaeBtn.textContent = sel.length <= 2 ? sel.map(c => titleCasePt(divInfo[c].descricao)).join(', ') : sel.length + ' setores selecionados';
    }
    cnaeBtn.addEventListener('click', () => {
      const abrir = cnaePanel.hidden;
      cnaePanel.hidden = !abrir;
      cnaeBtn.setAttribute('aria-expanded', String(abrir));
    });
    document.addEventListener('click', (evt) => {
      if (!$('#ei-cnae-multiselect').contains(evt.target)) {
        cnaePanel.hidden = true; cnaeBtn.setAttribute('aria-expanded', 'false');
      }
    });
    renderCnaePanel();
    syncCnaeBtn();

    // ---- Período: mês/ano inicial e final ----
    const loSel = $('#ei-period-lo-select'), hiSel = $('#ei-period-hi-select');
    function fillMonthOptions(sel, selected) {
      sel.innerHTML = meses.map(k => `<option value="${k}"${k === selected ? ' selected' : ''}>${monthLabel(k)}</option>`).join('');
    }
    fillMonthOptions(loSel, stateEI.lo);
    fillMonthOptions(hiSel, stateEI.hi);
    loSel.addEventListener('change', () => { stateEI.lo = Math.min(Number(loSel.value), stateEI.hi); loSel.value = stateEI.lo; update(); });
    hiSel.addEventListener('change', () => { stateEI.hi = Math.max(Number(hiSel.value), stateEI.lo); hiSel.value = stateEI.hi; update(); });

    // ---- Limpar filtros: volta ao estado padrão (SP+Brasil, 1ª divisão CNAE, período completo) ----
    $('#ei-clear-filters').addEventListener('click', () => {
      stateEI.ufs = new Set(['SP', 'BR']);
      stateEI.cnaes = new Set([10]);
      stateEI.focoUf = 'SP';
      stateEI.focoCnae = 10;
      stateEI.lo = anoMesLo0;
      stateEI.hi = anoMesHi0;
      renderUfPanel(); syncUfBtn();
      renderCnaePanel(); syncCnaeBtn();
      fillMonthOptions(loSel, stateEI.lo);
      fillMonthOptions(hiSel, stateEI.hi);
      update();
    });

    async function update() {
      const cnaesSel = cnaesOrdenadas();
      const cnaesAlvo = cnaesSel.join(',');
      const seriesPorCnae = {};
      await Promise.all(cnaesSel.map(async c => { seriesPorCnae[c] = await ensureCnae(c); }));
      if (cnaesOrdenadas().join(',') !== cnaesAlvo) return; // usuário trocou de novo antes do fetch voltar
      const ufsSel = ufsOrdenadas();
      const inRange = rows => rows.filter(r => (r[0] * 100 + r[1]) >= stateEI.lo && (r[0] * 100 + r[1]) <= stateEI.hi);
      const multiCnae = cnaesSel.length > 1;
      const nomesSelecionados = cnaesSel.map(c => titleCasePt(divInfo[c].descricao)).join(', ');

      // Combinações estado x setor selecionados — 1 linha por combinação
      // nos gráficos de tendência (se só 1 setor estiver marcado, o rótulo
      // fica só o nome do estado, igual antes).
      const combos = [];
      ufsSel.forEach(uf => {
        cnaesSel.forEach(cnae => {
          const rows = inRange((seriesPorCnae[cnae] && seriesPorCnae[cnae][uf]) || []);
          combos.push({ uf, cnae, rows, label: multiCnae ? `${ufInfo[uf]} · ${titleCasePt(divInfo[cnae].descricao)}` : ufInfo[uf] });
        });
      });

      // Brasil fica de fora das 2 linhas de tendência: é o agregado
      // nacional, com magnitude bem maior que qualquer estado sozinho —
      // numa mesma escala linear, ele esmaga as linhas dos estados lá
      // embaixo perto de zero. Continua disponível na tabela e como
      // referência no ranking de custo.
      const combosGrafico = combos.filter(c => c.uf !== 'BR');
      const catTempo = combosGrafico.length ? combosGrafico[0].rows.map(r => r[0] * 100 + r[1]) : [];

      $('#ei-consumo-sub').textContent = `MWh por mês, ${nomesSelecionados}${combos.length !== combosGrafico.length ? ' (Brasil fora do gráfico, ver tabela)' : ''}`;
      lineChart($('#chart-ei-consumo'), {
        categories: catTempo, formatX: monthLabel, formatY: fmt.mwh, height: 280,
        series: combosGrafico.map((c, i) => ({ label: c.label, color: CORES[i % CORES.length], values: c.rows.map(r => r[2]), area: i === 0 })),
      });

      $('#ei-custo-tempo-sub').textContent = `R$/MWh, ${nomesSelecionados}${combos.length !== combosGrafico.length ? ' (Brasil fora do gráfico, ver tabela)' : ''}`;
      lineChart($('#chart-ei-custo-tempo'), {
        categories: catTempo, formatX: monthLabel, formatY: fmt.brl, height: 280,
        series: combosGrafico.map((c, i) => ({ label: c.label, color: CORES[i % CORES.length], values: c.rows.map(r => r[3]) })),
      });

      // Ranking: todos os 27 estados (sem Brasil, que é o agregado), custo
      // do setor em foco (o último marcado/clicado nos setores), no mês
      // final do período selecionado, do mais barato ao mais caro. Linha
      // tracejada marca o valor do Brasil como referência: mais barato que
      // a média nacional fica verde, mais caro fica vermelho. Estados
      // marcados no filtro ficam na cor de destaque, fora dessa escala —
      // assim o ranking mostra direto onde estão os estados escolhidos.
      const divisaoFoco = divInfo[stateEI.focoCnae];
      const serieFoco = seriesPorCnae[stateEI.focoCnae];
      const estados = ei.ufs.filter(u => u.uf !== 'BR');
      const rowsBrCusto = serieFoco['BR'] || [];
      const refCustoRow = rowsBrCusto.find(r => (r[0] * 100 + r[1]) === stateEI.hi) || rowsBrCusto[rowsBrCusto.length - 1];
      const refCusto = refCustoRow ? refCustoRow[3] : null;
      const itemsRanking = estados.map(u => {
        const rows = serieFoco[u.uf] || [];
        const row = rows.find(r => (r[0] * 100 + r[1]) === stateEI.hi) || rows[rows.length - 1];
        return row ? { uf: u.uf, label: u.nome, value: row[3] } : null;
      }).filter(Boolean).sort((a, b) => a.value - b.value);
      $('#ei-ranking-custo-title').textContent = 'Ranking de estados por custo de energia: ' + titleCasePt(divisaoFoco.descricao);
      $('#ei-ranking-custo-sub').textContent = `R$/MWh, ${monthLabel(stateEI.hi, true)}, estados marcados no filtro em destaque`;
      hBarChart($('#rank-ei-custo-estados'), {
        items: itemsRanking.map(it => ({
          uf: it.uf, label: it.label, value: it.value,
          color: stateEI.ufs.has(it.uf) ? 'var(--series-3)' : (refCusto != null && it.value <= refCusto ? 'var(--good)' : 'var(--bad)'),
        })),
        formatVal: n => fmt.brl(n) + '/MWh',
        reference: refCusto != null ? { value: refCusto, label: 'Brasil: ' + fmt.brl(refCusto) + '/MWh' } : null,
        tooltipExtra: () => [{ label: 'Fator de carga (premissa)', value: fmt.full1(divisaoFoco.fator_carga) }],
        onClick: (it) => { stateEI.ufs.add(it.uf); stateEI.focoUf = it.uf; renderUfPanel(); syncUfBtn(); update(); },
      });

      // Composição setorial de um estado por vez (o foco: o último estado
      // marcado/clicado) — top 7 divisões + outras. Evita empilhar muitos
      // estados juntos (virava um mosaico difícil de comparar); um estado
      // de cada vez com só 8 fatias é limpo. Divisões marcadas no filtro
      // de setores ficam destacadas, e clicar numa fatia marca esse setor.
      const focoUfAlvo = stateEI.focoUf;
      const composicaoUf = await ensureComposicaoUf(focoUfAlvo);
      if (focoUfAlvo !== stateEI.focoUf || cnaesOrdenadas().join(',') !== cnaesAlvo) return; // mudou de novo antes do fetch voltar
      const linhaComposicao = composicaoUf[String(stateEI.hi)];
      const itemsComposicao = ei.divisoes.map((d, idx) => ({
        cnae: d.cnae, label: titleCasePt(d.descricao), value: (linhaComposicao && linhaComposicao[idx]) || 0,
      })).sort((a, b) => b.value - a.value);
      const top7 = itemsComposicao.slice(0, 7);
      const outras = itemsComposicao.slice(7).reduce((a, it) => a + it.value, 0);
      const itemsComposicaoFinal = [...top7, { cnae: null, label: 'Outras divisões', value: outras }];
      $('#ei-composicao-title').textContent = 'Composição setorial: ' + ufInfo[stateEI.focoUf];
      $('#ei-composicao-sub').textContent = `% do consumo industrial por divisão CNAE, ${monthLabel(stateEI.hi, true)}. Clique num estado do ranking ou numa divisão aqui pra mudar o foco.`;
      rankList($('#rank-ei-composicao'), itemsComposicaoFinal.map((it, i) => ({
        cnae: it.cnae, label: it.label, value: it.value,
        color: it.cnae != null && stateEI.cnaes.has(it.cnae) ? 'var(--series-3)' : CORES[i % CORES.length],
      })), {
        formatVal: n => fmt.pct(n),
        onClick: (it) => {
          if (it.cnae == null) return; // "Outras divisões" não é 1 setor clicável
          stateEI.cnaes.add(it.cnae); stateEI.focoCnae = it.cnae;
          renderCnaePanel(); syncCnaeBtn(); update();
        },
      });

      // Tabela filtrada: estado x setor x mês, para tudo que está marcado.
      const linhas = [];
      combos.forEach(c => {
        c.rows.forEach(r => {
          linhas.push({
            uf: c.uf, uf_nome: ufInfo[c.uf], setor: titleCasePt(divInfo[c.cnae].descricao), k: r[0] * 100 + r[1],
            consumo_mwh: r[2], custo_rs_mwh: r[3], gasto_rs: r[2] * r[3], participacao_pct: r[4],
          });
        });
      });
      linhas.sort((a, b) => b.k - a.k);
      dataTable($('#table-ei-dados'), {
        columns: [
          { key: 'uf_nome', label: 'UF' },
          { key: 'setor', label: 'Setor' },
          { key: 'k', label: 'Mês', format: monthLabel },
          { key: 'consumo_mwh', label: 'Consumo', align: 'right', format: fmt.mwh },
          { key: 'custo_rs_mwh', label: 'Custo', align: 'right', format: n => fmt.brl(n) + '/MWh' },
          { key: 'gasto_rs', label: 'Gasto', align: 'right', format: fmt.brlFull },
          { key: 'participacao_pct', label: 'Participação', align: 'right', format: n => fmt.pct(n) },
        ],
        rows: linhas,
        pageSize: 20,
      });
    }

    update();
  }

  // ---------------------------------------------------------------------
  // Filtros por bloco: Produção (só período), Emprego/CAGED (período +
  // multi-select de estado), Comex (período + estado único). Cada bloco
  // re-renderiza só a si mesmo quando o filtro muda — não precisa mais de
  // renderAll(), já que os filtros não são mais globais.
  // ---------------------------------------------------------------------
  let empregoUfCtl, cagedUfCtl;

  function setupBlockFilters() {
    wireBlockPeriod(blocks.producao, $('#producao-lo-select'), $('#producao-hi-select'), renderProducao);
    $('#producao-clear').addEventListener('click', () => {
      const bs = blocks.producao;
      bs.lo = bs.boundsLo; bs.hi = bs.boundsHi;
      $('#producao-lo-select').value = bs.lo; $('#producao-hi-select').value = bs.hi;
      renderProducao();
    });

    wireBlockPeriod(blocks.emprego, $('#emprego-lo-select'), $('#emprego-hi-select'), renderEmprego);
    empregoUfCtl = wireBlockUf(blocks.emprego, $('#emprego-uf-btn'), $('#emprego-uf-panel'), $('#emprego-uf-multiselect'), renderEmprego);
    $('#emprego-clear').addEventListener('click', () => {
      const bs = blocks.emprego;
      bs.lo = bs.boundsLo; bs.hi = bs.boundsHi; bs.ufs = new Set(['BR']); bs.focoUf = 'BR';
      $('#emprego-lo-select').value = bs.lo; $('#emprego-hi-select').value = bs.hi;
      empregoUfCtl.render(); empregoUfCtl.sync();
      renderEmprego();
    });

    wireBlockPeriod(blocks.caged, $('#caged-lo-select'), $('#caged-hi-select'), renderCaged);
    cagedUfCtl = wireBlockUf(blocks.caged, $('#caged-uf-btn'), $('#caged-uf-panel'), $('#caged-uf-multiselect'), renderCaged);
    $('#caged-clear').addEventListener('click', () => {
      const bs = blocks.caged;
      bs.lo = bs.boundsLo; bs.hi = bs.boundsHi; bs.ufs = new Set(['BR']); bs.focoUf = 'BR';
      $('#caged-lo-select').value = bs.lo; $('#caged-hi-select').value = bs.hi;
      cagedUfCtl.render(); cagedUfCtl.sync();
      renderCaged();
    });

    wireBlockPeriod(blocks.comex, $('#comex-lo-select'), $('#comex-hi-select'), renderComex);
    wireComexUfSelect(blocks.comex, $('#comex-uf-select'), renderComex);
    $('#comex-clear').addEventListener('click', () => {
      const bs = blocks.comex;
      bs.lo = bs.boundsLo; bs.hi = bs.boundsHi; bs.focoUf = 'BR';
      $('#comex-lo-select').value = bs.lo; $('#comex-hi-select').value = bs.hi;
      $('#comex-uf-select').value = 'BR';
      renderComex();
    });
  }

  // Duas listas de botões: sector-tabs (2451/2452) e view-tabs (home) + foot-tabs
  // (pdi/relatorios/referencias) formam juntas as 6 "vistas" mutuamente exclusivas.
  // home fica vazia (reservada para conteúdo futuro); 2451/2452 mostram o
  // painel de dados (trocando o setor); pdi/relatorios/referencias trocam para
  // uma página estática.
  function setupViewTabs() {
    const allBtns = Array.from(document.querySelectorAll('#view-tabs button, #sector-tabs button, #foot-tabs button'));
    const homeView = $('#home-view');
    const dataView = $('#data-view');
    const sectionNav = $('#section-nav-label'), sectionNavList = $('#section-nav');
    const pdiSectionNav = $('#pdi-section-nav-label'), pdiSectionNavList = $('#pdi-section-nav');
    const energiaIndustrialView = $('#energia-industrial-view');
    const pdiView = $('#pdi-view');
    const relatoriosView = $('#relatorios-view');
    const referenciasView = $('#referencias-view');

    function applyVisibility() {
      const isData = state.view === '2451' || state.view === '2452';
      const isPdi = state.view === 'pdi';
      homeView.hidden = state.view !== 'home';
      dataView.hidden = !isData;
      sectionNav.style.display = isData ? '' : 'none';
      sectionNavList.style.display = isData ? '' : 'none';
      pdiSectionNav.style.display = isPdi ? '' : 'none';
      pdiSectionNavList.style.display = isPdi ? '' : 'none';
      energiaIndustrialView.hidden = state.view !== 'energia-industrial';
      pdiView.hidden = !isPdi;
      relatoriosView.hidden = state.view !== 'relatorios';
      referenciasView.hidden = state.view !== 'referencias';
    }

    allBtns.forEach(b => b.addEventListener('click', () => {
      if (b.dataset.view === state.view) return;
      allBtns.forEach(x => { x.classList.remove('active'); x.setAttribute('aria-selected', 'false'); });
      b.classList.add('active'); b.setAttribute('aria-selected', 'true');
      state.view = b.dataset.view;
      if (state.view === '2451' || state.view === '2452') {
        state.sector = state.view;
        renderAll();
      }
      applyVisibility();
    }));

    setupSectionNav();
    applyVisibility();
  }

  function scrollToBlock(id) {
    const target = document.getElementById(id);
    if (!target) return;
    const headerH = document.querySelector('.site-header').offsetHeight + document.querySelector('.filter-row').offsetHeight;
    const top = target.getBoundingClientRect().top + window.scrollY - headerH - 16;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  // Navegação "nesta seção" na sidebar: clique rola até o bloco (sem usar
  // scrollIntoView, para não afetar o resto da página) e o botão ativo
  // acompanha a posição de leitura via IntersectionObserver.
  function setupSectionNav() {
    const btns = Array.from(document.querySelectorAll('#section-nav button'));
    const headerH = document.querySelector('.site-header').offsetHeight + document.querySelector('.filter-row').offsetHeight;
    btns.forEach(b => b.addEventListener('click', () => scrollToBlock(b.dataset.target)));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const btn = btns.find(b => b.dataset.target === entry.target.id);
        if (!btn) return;
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    }, { rootMargin: `-${headerH + 20}px 0px -70% 0px` });
    btns.forEach(b => { const el = document.getElementById(b.dataset.target); if (el) observer.observe(el); });
  }

  // ---------------------------------------------------------------------
  // Resumo do setor: KPIs de destaque + lista clicável para cada dado
  // ---------------------------------------------------------------------
  const SECTION_META = [
    { target: 'block-producao', num: '01', title: 'Produção física', sub: 'Aço bruto, ferro-gusa e laminados, mensal.' },
    { target: 'block-financeiro', num: '02', title: 'Financeiro', sub: 'VBPI, VTI, receita e custos, PIA/IBGE.' },
    { target: 'block-emprego', num: '03', title: 'Emprego formal', sub: 'Vínculos, escolaridade, ocupação e remuneração (RAIS).' },
    { target: 'block-caged', num: '04', title: 'CAGED', sub: 'Admissões e desligamentos mensais.' },
    { target: 'block-comex', num: '05', title: 'Comércio exterior', sub: 'Exportação e importação, Comex e Comtrade.' },
    { target: 'block-bndes', num: '06', title: 'BNDES', sub: 'Desembolsos por UF, porte e instrumento.' },
    { target: 'block-decom', num: '07', title: 'DECOM', sub: 'Medidas de defesa comercial em vigor.' },
    { target: 'block-estudos-especiais', num: '08', title: 'Estudos especiais', sub: 'Em construção.' },
    { target: 'block-gargalos', num: '·', title: 'Gargalos do setor', sub: 'Pontos identificados a partir dos dados.' },
  ];
  function renderSectorSummary() {
    $('#sector-section-list').innerHTML = SECTION_META.map(sec => `<button type="button" class="sector-section-row" data-target="${sec.target}"><span class="ssr-num">${sec.num}</span><span class="ssr-text"><span class="ssr-title">${sec.title}</span><span class="ssr-sub">${sec.sub}</span></span><span class="ssr-arrow">↓</span></button>`).join('');
    $('#sector-section-list').querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => scrollToBlock(btn.dataset.target)));
  }

  function renderCharts() {
    renderProducao(); renderFinanceiro(); renderEmprego(); renderCaged();
    renderComex(); renderBndes(); renderDecom();
  }
  function renderAll() {
    renderCharts();
    renderGargalos();
    renderSectorSummary();
  }

  // ---------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------
  fetch('data/data.json')
    .then(r => r.json())
    .then(data => {
      state.data = data;
      initBlocks();
      setupBlockFilters();
      setupViewTabs();
      renderReferencias(data);
      renderPdi(data);
      renderEnergiaIndustrial(data);
      renderAll();
    })
    .catch(err => {
      document.querySelector('.wrap').innerHTML = '<p style="padding:40px;color:var(--bad)">Não foi possível carregar os dados (data/data.json). Detalhe: ' + err.message + '</p>';
      console.error(err);
    });
})();

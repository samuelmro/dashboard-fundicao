(function () {
  'use strict';
  const { lineChart, barChart, rankList, fmt } = window.Charts;
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const CURRENT_YEAR = new Date().getFullYear();

  const state = { sector: '2451', lo: 2016, hi: 2026, uf: 'ALL', data: null };
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

  function tileHTML(label, value, delta, deltaGood, context) {
    const deltaCls = delta == null ? '' : (deltaGood ? 'up' : 'down');
    return `<div class="stat-tile">
      <div class="stat-label">${label}</div>
      <div class="stat-value">${value}</div>
      ${delta != null ? `<div class="stat-delta ${deltaCls}">${delta}</div>` : ''}
      ${context ? `<div class="stat-context">${context}</div>` : ''}
    </div>`;
  }

  // ---------------------------------------------------------------------
  // Big numbers (sempre o dado mais recente disponível, não usam slider/UF)
  // ---------------------------------------------------------------------
  function renderBigNumbers() {
    const s = csS(), sh = shared();
    const el = $('#big-numbers');
    let html = '';

    // Produção (compartilhado)
    {
      const rows = sh.producao.aco_gusa;
      const latest = last(rows), prev12 = findAt(rows, 12);
      const growth = prev12 ? pctChange(latest.aco_bruto, prev12.aco_bruto) : null;
      html += tileHTML(
        '🏭 Produção de aço bruto',
        fmt.compact(latest.aco_bruto) + ' t',
        growth != null ? fmt.pct(growth, true) + ' em 12 meses' : null,
        growth != null && growth >= 0,
        monthLabel(latest.ano * 100 + latest.mes, true) + ' · dado nacional'
      );
    }
    // Emprego (setor)
    {
      const rows = s.rais.uf_yearly_total;
      const latest = last(rows), prev = findAt(rows, 1);
      const growth = prev ? pctChange(latest.vinculos, prev.vinculos) : null;
      html += tileHTML(
        '👷 Emprego no setor',
        fmt.full(latest.vinculos) + ' vínculos',
        growth != null ? fmt.pct(growth, true) + ' vs ' + prev.ano : null,
        growth != null && growth >= 0,
        latest.ano + ' · ' + fmt.full(latest.estabelecimentos) + ' estabelecimentos (RAIS)'
      );
    }
    // Financeiro (compartilhado, PIA em R$ mil -> exibido em R$)
    {
      const rows = sh.financeiro.fundicao_24_5;
      const latest = last(rows), prev = findAt(rows, 1);
      const growth = prev ? pctChange(latest.receita_liquida_total, prev.receita_liquida_total) : null;
      html += tileHTML(
        '💰 Receita líquida do setor',
        fmt.brl(latest.receita_liquida_total * 1000),
        growth != null ? fmt.pct(growth, true) + ' vs ' + prev.ano : null,
        growth != null && growth >= 0,
        latest.ano + ' · grupo Fundição (24.5), IBGE/PIA'
      );
    }
    // Comércio exterior (setor) - último ano completo
    {
      const anoRef = s.comex.top_paises_latest.ano;
      const row = s.comex.yearly.find(r => r.ano === anoRef) || last(s.comex.yearly);
      const saldo = row.exportacao_usd - row.importacao_usd;
      html += tileHTML(
        '🌎 Saldo comercial',
        fmt.usd(Math.abs(saldo)),
        (saldo >= 0 ? 'Superávit' : 'Déficit'),
        saldo >= 0,
        row.ano + ' · exportou ' + fmt.usd(row.exportacao_usd) + ', importou ' + fmt.usd(row.importacao_usd)
      );
    }
    // Energia (setor)
    {
      const rows = s.energia.exato_monthly;
      const latest = last(rows), prev12 = findAt(rows, 12);
      const growth = prev12 ? pctChange(latest.consumo_acl_mwh, prev12.consumo_acl_mwh) : null;
      html += tileHTML(
        '⚡ Consumo de energia (livre)',
        fmt.mwh(latest.consumo_acl_mwh),
        growth != null ? fmt.pct(growth, true) + ' em 12 meses' : null,
        growth != null && growth <= 0,
        monthLabel(latest.ano * 100 + latest.mes, true)
      );
    }
    el.innerHTML = html;
  }

  // ---------------------------------------------------------------------
  // Bloco 1 — Produção física
  // ---------------------------------------------------------------------
  function renderProducao() {
    const sh = shared();
    const idx = filterMonthly(sh.producao.metalurgia_indice, state.lo, state.hi);
    const catIdx = idx.map(r => r.ano * 100 + r.mes);
    lineChart($('#chart-producao-indice'), {
      categories: catIdx, formatX: monthLabel, formatY: fmt.full1, height: 220,
      series: [
        { label: 'Índice bruto', color: 'var(--series-1)', values: idx.map(r => r.indice_bruto) },
        { label: 'Dessazonalizado', color: 'var(--series-8)', values: idx.map(r => r.indice_dessaz) }
      ]
    });

    const ag = filterMonthly(sh.producao.aco_gusa, state.lo, state.hi);
    const catAg = ag.map(r => r.ano * 100 + r.mes);
    lineChart($('#chart-producao-acogusa'), {
      categories: catAg, formatX: monthLabel, formatY: fmt.compact, height: 220,
      series: [
        { label: 'Aço bruto', color: 'var(--series-1)', values: ag.map(r => r.aco_bruto), area: true },
        { label: 'Ferro-gusa', color: 'var(--series-5)', values: ag.map(r => r.ferro_gusa) }
      ]
    });

    const latest = last(sh.producao.aco_gusa), prev12 = findAt(sh.producao.aco_gusa, 12);
    const growth = prev12 ? pctChange(latest.aco_bruto, prev12.aco_bruto) : null;
    $('#producao-narrative').textContent = growth == null
      ? 'Acompanhe abaixo a evolução mensal da produção física de aço, ferro-gusa e do índice geral da metalurgia no Brasil.'
      : `Nos últimos 12 meses, a produção de aço bruto no Brasil ${growth >= 0 ? 'cresceu' : 'caiu'} ${fmt.full1(Math.abs(growth))}%. O índice geral da metalurgia (linha abaixo) acompanha o mesmo ritmo da atividade industrial nacional.`;
  }

  // ---------------------------------------------------------------------
  // Bloco 2 — Emprego e salários
  // ---------------------------------------------------------------------
  function renderEmprego() {
    const s = csS();
    const ufSel = state.uf;

    // RAIS: nacional ou UF selecionada
    let raisRows, raisLabel;
    if (ufSel === 'ALL') {
      raisRows = s.rais.uf_yearly_total; raisLabel = 'Vínculos (Brasil)';
    } else {
      raisRows = s.rais.uf_yearly.filter(r => r.uf === ufSel).map(r => ({ ano: r.ano, vinculos: r.vinculos }));
      raisLabel = 'Vínculos (' + ufSel + ')';
    }
    raisRows = filterAnnual(raisRows, state.lo, state.hi);
    const catRais = raisRows.map(r => r.ano);
    lineChart($('#chart-emprego-rais'), {
      categories: catRais, formatY: fmt.full, height: 200,
      series: [{ label: raisLabel, color: 'var(--series-2)', values: raisRows.map(r => r.vinculos), area: true }]
    });

    // CAGED: admissões x desligamentos (nacional, sempre, 2008-2019)
    const cagedRows = filterMonthly(s.caged.tipo_movimentacao_monthly, state.lo, state.hi);
    const catCaged = cagedRows.map(r => r.ano * 100 + r.mes);
    barChart($('#chart-emprego-caged'), {
      categories: catCaged, formatX: monthLabel, formatY: fmt.compact, height: 200,
      series: [
        { label: 'Admissões', color: 'var(--series-2)', values: cagedRows.map(r => r.admissoes) },
        { label: 'Desligamentos', color: 'var(--series-6)', values: cagedRows.map(r => -r.desligamentos) }
      ]
    });

    // Escolaridade / ocupação (retrato do último ano, não depende de slider/UF)
    const esc = s.rais.escolaridade_latest;
    $('#emprego-escolaridade-sub').textContent = 'Retrato de ' + esc.ano;
    rankList($('#chart-emprego-escolaridade'), esc.items.slice(0, 8).map(i => ({ label: titleCasePt(i.categoria), value: i.frequencia })), { formatVal: fmt.full, color: 'var(--series-2)' });

    const ocup = s.rais.ocupacao_agrupada_latest;
    $('#emprego-ocupacao-sub').textContent = 'Retrato de ' + ocup.ano;
    rankList($('#chart-emprego-ocupacao'), ocup.items.slice(0, 8).map(i => ({ label: titleCasePt(i.categoria), value: i.frequencia })), { formatVal: fmt.full, color: 'var(--series-2)' });

    const totalLatest = last(s.rais.uf_yearly_total);
    const ufCount = new Set(s.rais.uf_yearly.filter(r => r.ano === totalLatest.ano && r.estabelecimentos > 0).map(r => r.uf)).size;
    $('#emprego-narrative').textContent = `Em ${totalLatest.ano}, o setor empregava ${fmt.full(totalLatest.vinculos)} pessoas, distribuídas por ${ufCount} estados. Entre 2008 e 2019 (janela coberta pelo CAGED), dá para ver o ritmo mensal de contratações e desligamentos.`;
  }

  // ---------------------------------------------------------------------
  // Bloco 3 — Financeiro
  // ---------------------------------------------------------------------
  function renderFinanceiro() {
    const sh = shared(), s = csS();
    const pia = filterAnnual(sh.financeiro.fundicao_24_5, state.lo, state.hi);
    const catPia = pia.map(r => r.ano);
    lineChart($('#chart-financeiro-pia'), {
      categories: catPia, formatY: fmt.brl, height: 220,
      series: [
        { label: 'Receita líquida', color: 'var(--series-3)', values: pia.map(r => r.receita_liquida_total * 1000) },
        { label: 'Custos e despesas', color: 'var(--series-6)', values: pia.map(r => r.custos_despesas_totais * 1000) }
      ]
    });

    const bndesY = filterAnnual(s.bndes.yearly, state.lo, state.hi);
    const catBndes = bndesY.map(r => r.ano);
    barChart($('#chart-financeiro-bndes'), {
      categories: catBndes, formatY: fmt.brl, height: 180,
      series: [{ label: 'Desembolsado', color: 'var(--series-8)', values: bndesY.map(r => r.valor_desembolsado) }]
    });

    rankList($('#rank-financeiro-bndes-uf'), s.bndes.uf_total.slice(0, 8).map(i => ({
      label: i.nome_uf, value: i.valor_desembolsado, color: i.uf === state.uf ? 'var(--series-6)' : 'var(--series-8)'
    })), { formatVal: fmt.brl });

    const latestPia = last(sh.financeiro.fundicao_24_5), prevPia = findAt(sh.financeiro.fundicao_24_5, 1);
    const growth = prevPia ? pctChange(latestPia.receita_liquida_total, prevPia.receita_liquida_total) : null;
    const margem = latestPia.receita_liquida_total ? ((latestPia.receita_liquida_total - latestPia.custos_despesas_totais) / latestPia.receita_liquida_total) * 100 : null;
    $('#financeiro-narrative').textContent = `Em ${latestPia.ano}, o grupo Fundição faturou ${fmt.brl(latestPia.receita_liquida_total * 1000)}${growth != null ? ' (' + fmt.pct(growth, true) + ' vs ' + prevPia.ano + ')' : ''}. A distância entre receita e custos no gráfico mostra a margem operacional do setor.`;
  }

  // ---------------------------------------------------------------------
  // Bloco 4 — Comércio exterior
  // ---------------------------------------------------------------------
  function renderComex() {
    const s = csS();
    const ufAvailable = new Set(s.comex.uf_yearly.map(r => r.uf));
    let rows, note = '';
    if (state.uf === 'ALL' || !ufAvailable.has(state.uf)) {
      rows = filterAnnual(s.comex.yearly, state.lo, state.hi);
      if (state.uf !== 'ALL') note = 'Estado sem dado detalhado nesta base — mostrando total nacional do setor.';
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
      categories: cat, formatY: fmt.usd, height: 220,
      series: [
        { label: 'Exportação', color: 'var(--series-4)', values: rows.map(r => r.exportacao_usd) },
        { label: 'Importação', color: 'var(--series-6)', values: rows.map(r => -r.importacao_usd) }
      ]
    });

    const ctBr = filterAnnual(s.comtrade.brazil_yearly, state.lo, state.hi);
    const ctWorld = filterAnnual(s.comtrade.world_yearly, state.lo, state.hi);
    const catCt = annualCategories([ctBr, ctWorld]);
    lineChart($('#chart-comex-mundo'), {
      categories: catCt, formatY: fmt.usd, height: 220,
      series: [
        { label: 'Exportação do Brasil', color: 'var(--series-1)', values: seriesAnnual(ctBr, 'export_usd', catCt) },
        { label: 'Exportação mundial (contexto)', color: 'var(--series-8)', values: seriesAnnual(ctWorld, 'export_usd', catCt) }
      ]
    });

    const top = s.comex.top_paises_latest;
    $('#comex-paises-sub').textContent = 'Exportação — ' + top.ano;
    rankList($('#rank-comex-paises'), top.exportacao.slice(0, 8).map(i => ({ label: i.pais, value: i.valor_usd })), { formatVal: fmt.usd, color: 'var(--series-4)' });

    const anoRef = top.ano;
    const rowRef = s.comex.yearly.find(r => r.ano === anoRef);
    const saldo = rowRef ? rowRef.exportacao_usd - rowRef.importacao_usd : null;
    const ctRefBr = s.comtrade.brazil_yearly.find(r => r.ano === s.comtrade.top_partners_latest.ano);
    const ctRefWorld = s.comtrade.world_yearly.find(r => r.ano === s.comtrade.top_partners_latest.ano);
    const share = ctRefBr && ctRefWorld && ctRefWorld.export_usd ? (ctRefBr.export_usd / ctRefWorld.export_usd) * 100 : null;
    $('#comex-narrative').textContent = rowRef
      ? `Em ${anoRef}, o setor exportou ${fmt.usd(rowRef.exportacao_usd)} e importou ${fmt.usd(rowRef.importacao_usd)} — ${saldo >= 0 ? 'superávit' : 'déficit'} de ${fmt.usd(Math.abs(saldo))}.` +
        (share != null ? ` No comércio mundial desses produtos, o Brasil responde por cerca de ${fmt.full1(share)}%.` : '')
      : 'Explore a evolução do comércio exterior do setor abaixo.';
  }

  // ---------------------------------------------------------------------
  // Bloco 5 — Energia
  // ---------------------------------------------------------------------
  function renderEnergia() {
    const s = csS(), sh = shared();
    const exato = filterMonthly(s.energia.exato_monthly, state.lo, state.hi);
    const aprox = filterMonthly(sh.energia_metalurgia_aproximado, state.lo, state.hi);
    const cat = monthlyCategories([exato, aprox]);
    lineChart($('#chart-energia'), {
      categories: cat, formatX: monthLabel, formatY: fmt.mwh, height: 240,
      series: [
        { label: 'Consumo do setor (ACL)', color: 'var(--series-5)', values: seriesMonthly(exato, 'consumo_acl_mwh', cat), area: true },
        { label: 'Metalurgia (contexto, categoria mais ampla)', color: 'var(--series-8)', values: seriesMonthly(aprox, 'consumo_livre_acl', cat) }
      ]
    });

    const rows = s.energia.exato_monthly;
    const latest = last(rows), prev12 = findAt(rows, 12);
    const growth = prev12 ? pctChange(latest.consumo_acl_mwh, prev12.consumo_acl_mwh) : null;
    $('#energia-narrative').textContent = growth == null
      ? `O consumo de energia no mercado livre do setor foi de ${fmt.mwh(latest.consumo_acl_mwh)} em ${monthLabel(latest.ano * 100 + latest.mes, true)}.`
      : `O consumo de energia no mercado livre do setor foi de ${fmt.mwh(latest.consumo_acl_mwh)} em ${monthLabel(latest.ano * 100 + latest.mes, true)}, uma variação de ${fmt.pct(growth, true)} em 12 meses — um bom termômetro de custo de energia para quem está no mercado livre.`;
  }

  // ---------------------------------------------------------------------
  // Gargalos do setor
  // ---------------------------------------------------------------------
  function renderGargalos() {
    const s = csS(), sh = shared();
    const cards = [];

    // 1. Mão de obra qualificada
    {
      const esc = s.rais.escolaridade_latest;
      const total = esc.items.reduce((a, i) => a + i.frequencia, 0);
      const baixaEsc = esc.items.filter(i => /analfabeto|fundamental|5ª/i.test(i.categoria)).reduce((a, i) => a + i.frequencia, 0);
      const pct = total ? (baixaEsc / total) * 100 : null;
      cards.push({
        title: '🎓 Mão de obra qualificada é escassa',
        text: 'Boa parte da força de trabalho do setor ainda não completou o ensino médio, o que limita a adoção de processos mais técnicos e automatizados.',
        evidence: pct != null ? `<strong>${fmt.full1(pct)}%</strong> dos trabalhadores (${esc.ano}) têm no máximo o ensino fundamental completo.` : ''
      });
    }
    // 2. Rotatividade
    {
      const items = s.caged.tipo_movimentacao_breakdown_total;
      const total = items.reduce((a, i) => a + i.quantidade, 0);
      const rotatividade = items.filter(i => /reemprego|a pedido|prazo det/i.test(i.tipo)).reduce((a, i) => a + i.quantidade, 0);
      const pct = total ? (rotatividade / total) * 100 : null;
      cards.push({
        title: '🔄 Alta rotatividade de mão de obra',
        text: 'Muitas contratações e desligamentos são de curto prazo ou por decisão do próprio trabalhador — sinal de dificuldade em reter equipe treinada.',
        evidence: pct != null ? `<strong>${fmt.full1(pct)}%</strong> das movimentações registradas entre 2008–2019 foram reempregos, contratos por prazo determinado ou pedidos de desligamento.` : ''
      });
    }
    // 3. Acesso a crédito concentrado
    {
      const portes = s.bndes.porte_total;
      const total = portes.reduce((a, i) => a + i.valor_desembolsado, 0);
      const grande = portes.find(i => i.porte === 'GRANDE');
      const pct = grande && total ? (grande.valor_desembolsado / total) * 100 : null;
      const top3 = s.bndes.uf_total.slice(0, 3).reduce((a, i) => a + i.valor_desembolsado, 0);
      const pctUf = total ? (top3 / total) * 100 : null;
      cards.push({
        title: '🏦 Acesso a crédito concentrado',
        text: 'O crédito do BNDES para o setor está concentrado em poucas empresas e estados, deixando fabricantes menores e de outras regiões com menos acesso a financiamento.',
        evidence: (pct != null ? `<strong>${fmt.full1(pct)}%</strong> dos desembolsos do BNDES (2002–2026) foram para empresas de grande porte. ` : '') +
          (pctUf != null ? `Os 3 principais estados concentram <strong>${fmt.full1(pctUf)}%</strong> do total.` : '')
      });
    }
    // 4. Concorrência com importados
    {
      const anoRef = s.comex.top_paises_latest.ano;
      const row = s.comex.yearly.find(r => r.ano === anoRef);
      const saldo = row ? row.exportacao_usd - row.importacao_usd : null;
      const medidas = sh.decom.filter(d => /medida compensat|antidumping|prorrogad/i.test(d.status)).length;
      cards.push({
        title: '🌐 Concorrência com produtos importados',
        text: saldo != null && saldo < 0
          ? 'O Brasil compra mais desse tipo de produto do exterior do que vende, o que pressiona os preços e a competitividade da produção nacional.'
          : 'Mesmo com saldo comercial favorável, o setor convive com medidas de defesa comercial contra práticas desleais de importação.',
        evidence: (saldo != null ? `Saldo comercial de <strong>${fmt.usd(Math.abs(saldo))}</strong> (${saldo < 0 ? 'déficit' : 'superávit'}) em ${anoRef}. ` : '') +
          (medidas > 0 ? `Há <strong>${medidas}</strong> medida(s) de defesa comercial ativa(s) contra importados (fonte: DECOM/GECEX).` : 'Não há medidas de defesa comercial ativas registradas nesta base.')
      });
    }

    $('#gargalos-grid').innerHTML = cards.map(c => `
      <div class="gargalo-card">
        <h3>${c.title}</h3>
        <p>${c.text}</p>
        <div class="gargalo-evidence">${c.evidence}</div>
      </div>
    `).join('');
  }

  // ---------------------------------------------------------------------
  // P&D / metodologia (estático, montado uma vez)
  // ---------------------------------------------------------------------
  function renderPdi() {
    const rows = [
      ['Produção física', 'IBGE — PIM-PF (Metalurgia geral e Aço/Ferro-gusa)', '1980–2026 (mensal)', 'Nível "metalurgia"/produto, não é exclusivo de 2451/2452.'],
      ['Emprego e salários', 'RAIS (vínculos, escolaridade, ocupação, tempo de emprego, massa salarial)', '2006–2025 (anual)', 'Quebra metodológica em 2022 (eSocial) nos perfis detalhados.'],
      ['Emprego e salários', 'CAGED (saldo, salário, tipo de movimentação por UF/CNAE)', '2008–2019 (mensal)', 'Base não inclui o Novo CAGED (pós-2020).'],
      ['Financeiro', 'IBGE — PIA-Empresa (Metalurgia e Fundição 24.5)', '2007–2023 (anual)', 'Valores em R$ mil convertidos para R$ na exibição. Fundição 24.5 combina 2451+2452.'],
      ['Financeiro', 'BNDES — desembolsos por UF/porte/instrumento', '2002–2026 (anual)', 'Específico por CNAE (2451/2452).'],
      ['Comércio exterior', 'MDIC — Comex Stat (exportação/importação por país e UF)', '2006/2016–2026 (anual)', 'Dado oficial brasileiro, específico por CNAE.'],
      ['Comércio exterior', 'UN Comtrade (comércio mundial por código HS)', '2015–2024 (anual)', 'Proxy por HS (não existe CNAE em bases internacionais); usado só para contexto Brasil x Mundo.'],
      ['Energia', 'CCEE — consumo no mercado livre (exato por CNAE)', 'abr/2024–mai/2026 (mensal)', 'Janela curta: histórico só existe a partir dessa data.'],
      ['Energia', 'CCEE — consumo "Metalurgia e Produtos de Metal" (aproximado)', 'abr/2024–mai/2026 (mensal)', 'Categoria mais ampla que 2451/2452, usada como contexto.'],
      ['Contexto/gargalos', 'DECOM/GECEX — processos de defesa comercial', 'Histórico (datas variáveis)', 'Tabela estática de medidas antidumping/compensatórias/salvaguarda.'],
      ['Contexto', 'Indicadores macro (IPCA, dólar, IPP metalurgia)', '1990–2026 (mensal)', 'Usado como pano de fundo, não como indicador setorial direto.']
    ];
    $('#pdi-table tbody').innerHTML = rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td class="mono">${r[2]}</td><td>${r[3]}</td></tr>`).join('');
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
    sel.addEventListener('change', () => { state.uf = sel.value; renderAll(false); });
  }

  function setupSectorSwitch() {
    const btns = document.querySelectorAll('#sector-switch button');
    btns.forEach(b => b.addEventListener('click', () => {
      if (b.dataset.sector === state.sector) return;
      btns.forEach(x => { x.classList.remove('active'); x.setAttribute('aria-selected', 'false'); });
      b.classList.add('active'); b.setAttribute('aria-selected', 'true');
      state.sector = b.dataset.sector;
      renderAll(true);
    }));
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
    renderProducao(); renderEmprego(); renderFinanceiro(); renderComex(); renderEnergia();
  }
  function renderAll(includeBigNumbers) {
    if (includeBigNumbers) renderBigNumbers();
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
      setupSectorSwitch();
      setupPeriodSlider();
      renderPdi();
      renderBigNumbers();
      renderCharts();
      renderGargalos();
    })
    .catch(err => {
      document.querySelector('.wrap').innerHTML = '<p style="padding:40px;color:#b3261e">Não foi possível carregar os dados (data/data.json). Detalhe: ' + err.message + '</p>';
      console.error(err);
    });
})();

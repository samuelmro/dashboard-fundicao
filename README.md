# Painel do Setor de Fundição — CNAE 2451/2452

Painel executivo estático (sem framework, sem build step de JS) sobre o setor de
fundição de ferro/aço (CNAE 2451) e de metais não ferrosos (CNAE 2452) no
Brasil: produção física, financeiro, emprego formal (RAIS), CAGED, comércio
exterior, energia (CCEE), BNDES e DECOM.

## Estrutura

```
3_Dados_Tratados_CSV/   CSVs brutos tratados (uma linha por ano/mês/UF/categoria)
build_data.py           Lê os CSVs e gera data/data.json
data/data.json          Dado consolidado que o dashboard consome via fetch()
index.html              Estrutura das seções do painel
css/style.css           Estilo (paleta vermelho/navy, layout de duas colunas)
js/charts.js            Motor de gráficos SVG vanilla (sem libs externas)
js/main.js              Lógica de filtros, cálculos derivados e wiring dos gráficos
js/range-slider.js       Slider de período (dois handles)
tests/test_build_data.py Testes de fumaça do pipeline (pytest)
serve.ps1               Servidor HTTP estático simples (PowerShell), porta 8791
```

Os dados de 2451 e 2452 vivem no mesmo `data.json`, em `sectors["2451"]` e
`sectors["2452"]` — o switch de setor no topo do painel só troca qual chave é
lida, sem novo fetch. Dados que não variam por segmento (produção física
nacional, financeiro PIA, energia aproximada, macro, DECOM) ficam em `shared`.

## Como regenerar os dados

Pré-requisito: Python 3.10+ (já configurado em `.venv/` neste projeto).

```powershell
.venv\Scripts\pip install -r requirements.txt   # só na primeira vez / ao mudar requirements.txt
.venv\Scripts\python build_data.py
```

Isso lê tudo em `3_Dados_Tratados_CSV/` e regrava `data/data.json`. Rode de
novo sempre que um CSV for atualizado ou adicionado.

## Como rodar localmente

```powershell
pwsh -File serve.ps1
```

Abre em `http://localhost:8791`. É um servidor estático puro — não faz build,
só serve os arquivos como estão.

## Testes

```powershell
.venv\Scripts\python -m pytest
```

Os testes rodam `build_data.py` contra os CSVs reais (não há mocks) e checam:
schema de alto nível, simetria entre `sectors.2451` e `sectors.2452`, e a
presença de campos-chave usados pelos gráficos (ex.: `laminados`,
`consumo_materias_primas`).

## Adicionando um CSV novo ou um indicador novo

1. Coloque o CSV em `3_Dados_Tratados_CSV/`.
2. Se for uma fonte nova, adicione a leitura em `build_data.py` (siga o padrão
   das funções `build_producao`, `read_financeiro`, `build_sector`, etc.) e
   exponha o campo dentro de `shared` (dado nacional) ou dentro do retorno de
   `build_sector` (dado específico de 2451/2452).
3. Rode `pytest` e `build_data.py` para confirmar que o schema não quebrou.
4. Adicione o gráfico/tabela em `js/main.js` (uma função `render*()` por
   seção) e o contêiner correspondente em `index.html`.

## Fontes de dados

| Bloco | Base | Cobertura |
|---|---|---|
| Produção física | Instituto Aço Brasil (IBS) + IBGE/PIM-PF | 1980–2026 (mensal) |
| Financeiro | IBGE — PIA-Empresa (Metalurgia 24 e Fundição 24.5) | 2007–2023 (anual) |
| Emprego formal | RAIS | 2006–2025 (anual) |
| CAGED | CAGED (saldo, salário, tipo de movimentação) | calculada dinamicamente a partir da base (ver painel) |
| Comércio exterior | MDIC — Comex Stat | 2006/2016–2026 (anual) |
| Comércio exterior (contexto mundial) | UN Comtrade (proxy por HS) | 2015–2024 (anual) |
| Energia | CCEE (exato por CNAE + aproximado "Metalurgia") | a partir de abr/2024 (mensal) |
| BNDES | Desembolsos por UF/porte/instrumento | 2002–2026 (anual) |
| DECOM | Processos de defesa comercial (só 2451) | histórico |

Detalhes de cobertura e limitações metodológicas de cada fonte estão na seção
"Pesquisa, Desenvolvimento & Inovação" no rodapé do próprio painel — ela é
gerada a partir do mesmo `data.json`, então nunca fica dessincronizada.

## Publicando no GitHub Pages

Este repositório já inclui `.github/workflows/build.yml`, que roda os testes,
regenera `data/data.json` e publica o site em GitHub Pages a cada push que
toque nos CSVs ou no código do painel. Para ativar depois de criar o
repositório remoto:

1. `git remote add origin <url-do-seu-repositório>` e `git push -u origin master`.
2. No GitHub, em **Settings → Pages**, defina a fonte ("Source") como
   **GitHub Actions**.
3. O próximo push (ou rodar o workflow manualmente em **Actions**) publica o
   site.

# Painel do Setor de Fundição — contexto para o Claude Code

Painel estático (HTML + JS puro, sem framework e sem build de JS) sobre a
fundição no Brasil: CNAE 2451 (ferro e aço) e 2452 (não ferrosos). Feito para o
SIFESP, em parceria com FIESP e CIESP. Publicado em
https://samuelmro.github.io/dashboard-fundicao/ via GitHub Pages.

Leia também: `README.md` (estrutura e comandos), `ATUALIZACAO.md` (rotina de
dados por fonte) e `PASSAGEM.md` (guia de passagem para quem assume o painel).

## Como o projeto funciona

```
CSVs em 3_Dados_Tratados_CSV/  ->  build_data.py  ->  data/data.json  ->  index.html + js/main.js
                               ->  build_downloads.py -> data/downloads/*.xlsx
```

- `js/charts.js`: motor de gráficos em SVG, sem bibliotecas. Gráfico novo entra
  aqui como função genérica e é exportado em `window.Charts`.
- `js/main.js`: uma função `render*()` por seção, lendo `state.data` (o
  `data.json`). As abas são "vistas" trocadas em `setupViewTabs()`.
- `data.json`: `sectors["2451"|"2452"]` (o que varia por segmento), `shared`
  (o que não varia), `energia_industrial` e `cadeia`.
- CSVs: separador `;`, decimal `,`, UTF-8 com BOM (helper `read_csv` em
  `build_data.py`).

## Comandos (Windows, PowerShell)

```powershell
.venv\Scripts\python -m pytest            # testes (rodam build_data.py nos CSVs reais)
.venv\Scripts\python build_data.py        # regera data/data.json
.venv\Scripts\python build_downloads.py   # regera as planilhas de download
pwsh -File serve.ps1 -Port 8792           # servidor local (está em .claude/launch.json como "dashboard-serve")
```

Use PowerShell para rodar o Python do `.venv`. Pelo Git Bash, o acento de
"Siderúrgico" no caminho faz o Python do venv não achar os pacotes.

## Publicação

`git push` no `master` dispara `.github/workflows/build.yml`: roda os testes,
regera `data.json` e as planilhas e publica só `index.html css js assets data`.
O workflow tem filtro de `paths`: só dispara quando muda CSV, os scripts de build,
`requirements.txt`, `index.html`, `css/`, `js/` ou `assets/`. Mudar só um `.md`
não republica o site.

CSS, JS e `data.json` são referenciados com `?v=dev`; o workflow troca isso
pelo hash do commit para furar o cache do navegador (o Pages guarda os
arquivos por ~10 min). Arquivo novo carregado pelo `index.html` ou fetch novo
que mude a cada deploy precisa do mesmo `?v=dev` e entrar no `sed` do workflow.

Commit e push só quando o usuário pedir. O push deixa a mudança pública no site.

## Dados fora do repositório (importante)

`Setor Siderúrgico/` está no `.gitignore` de propósito. Ela guarda os scripts R
de coleta (`2_Scripts/`), as planilhas brutas (`1_Dados_Manuais_XLS/`) e
`RUNBOOK_ACESSOS.md`, que tem a chave da API do UN Comtrade e o procedimento de
login das fontes manuais. Nunca copie o conteúdo dessa pasta para dentro do
repositório, que é público.

## Aba Cadeia Produtiva

- Fonte: IBGE, Tabelas de Recursos e Usos (TRU) nível 68, 2010–2021 (a mais
  recente nesse detalhe), mais a Matriz Insumo-Produto 2015 nível 67 (a última
  publicada). A MIP entra só no multiplicador de produção e na parcela
  importada dos insumos.
- `extrair_cadeia.py` lê os `.xls` do IBGE em `Setor Siderúrgico/1_Dados_Manuais_XLS/`
  e gera `3_Dados_Tratados_CSV/Cadeia_*.csv`. Só precisa rodar quando o IBGE
  publicar TRU ou MIP novas. Precisa do pacote `xlrd`.
- O diagrama **não é uma MIP completa**. É a matriz de fluxos setor × setor
  da TRU (produto → atividade pela matriz de participação na produção), a preço
  de consumidor, com importados e margens embutidos. Para virar MIP faltaria
  passar a preço básico, separar o importado por comprador e calcular a
  inversa de Leontief de 2021 (método Guilhoto–Sesso).
- O IBGE não separa os insumos da fundição: o lado "de onde vem" usa a
  estrutura de custos da atividade 2492 (metalurgia de não ferrosos +
  fundição), proporcional à produção de peças fundidas (produto 24922).
- A TRU de 2016 grava os códigos de produto como número (`24922.0`);
  `ler_produtos()` já trata isso.
- A seção "Doze anos de peças fundidas" (série 2010–2021, áreas empilhadas e
  fatia importada) foi tirada a pedido do usuário. O código está no commit
  `1596944`, se for voltar.

## Preferências de visual (feedback do usuário)

- Visual sóbrio de relatório ou infográfico de jornal: fundo branco, texto
  direto, números no meio do texto, fios finos separando partes.
- O usuário rejeitou o que chamou de "cara de IA": painel escuro com brilho,
  pontinhos ou partículas animadas, ícones decorativos, degradês, frases de
  efeito e grades de cartões. Evite.
- Cores só dos tokens em `:root` de `css/style.css` (vermelho institucional,
  grafite, `--series-*`).
- Textos em português, sem jargão: quem lê é diretoria e equipe técnica de
  federação de indústria.

## Pendências conhecidas

- Aba Relatórios ainda está "Em construção".
- Nenhuma coleta automática está agendada (ver `ATUALIZACAO.md`).

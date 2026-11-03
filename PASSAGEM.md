# Passagem do Painel do Setor de Fundição

Guia para quem vai assumir o painel. Leitura de 10 minutos.

## O que é

Um painel na web sobre a fundição no Brasil, separado em ferro e aço
(CNAE 2451) e não ferrosos (CNAE 2452). Reúne produção, faturamento, emprego,
comércio exterior, BNDES, defesa comercial, energia e a cadeia produtiva do
setor. Foi feito para o SIFESP, em parceria com FIESP e CIESP.

- **Endereço:** https://samuelmro.github.io/dashboard-fundicao/
- **Código:** https://github.com/samuelmro/dashboard-fundicao

Não tem servidor nem banco de dados. É uma página que lê um arquivo de dados
(`data/data.json`) gerado a partir de planilhas. Atualizar o painel é atualizar
as planilhas e publicar de novo.

## Antes de o responsável atual sair

Faça isto antes do desligamento. Depois pode não dar mais.

- [ ] **Copiar a pasta `Setor Siderúrgico\`** para um lugar da equipe (OneDrive
      ou SharePoint do DECAP). Ela tem os scripts de coleta, as planilhas
      brutas e o `RUNBOOK_ACESSOS.md` com os acessos. **Não está no GitHub** (é
      de propósito, por ter chave de acesso) e hoje só existe no OneDrive
      corporativo do SESI/SENAI de quem fez o painel.
- [ ] **Resolver o GitHub.** O repositório está numa conta pessoal
      (`samuelmro`). Ou o novo responsável entra como colaborador
      (*Settings → Collaborators*), ou, melhor, o repositório é transferido
      para uma conta ou organização da FIESP (*Settings → Transfer ownership*).
      Se transferir, o endereço do site muda: avise quem usa o link.
- [ ] **Chave do UN Comtrade:** combinar se a pessoa continua usando a chave
      atual ou gera uma nova em https://comtradeapi.un.org (instruções no runbook).
- [ ] **Google Cloud (CAGED novo):** o script usa um projeto do Google Cloud do
      responsável atual. O novo responsável precisa criar o dele (a cota
      gratuita basta) e trocar o Project ID no script.

## Onde está cada coisa

| O quê | Onde |
|---|---|
| Página, gráficos e estilo | `index.html`, `js/`, `css/` |
| Planilhas tratadas que alimentam o painel | `3_Dados_Tratados_CSV/` |
| Scripts que montam o arquivo de dados | `build_data.py`, `build_downloads.py` |
| Script da aba Cadeia Produtiva (IBGE) | `extrair_cadeia.py` |
| Scripts de coleta, planilhas brutas e acessos | `Setor Siderúrgico/` (fora do GitHub) |
| Rotina de atualização por fonte | `ATUALIZACAO.md` |
| Detalhes técnicos | `README.md` |
| Contexto para o Claude Code | `CLAUDE.md` |

## Do que a pessoa precisa no computador

- **Python 3.10 ou mais novo**, para montar os dados. Na primeira vez, dentro
  da pasta do projeto, no PowerShell:
  ```powershell
  python -m venv .venv
  .venv\Scripts\pip install -r requirements.txt
  ```
- **R e RStudio**, para os scripts de coleta em `Setor Siderúrgico/2_Scripts/`.
- **Git**, e acesso ao repositório no GitHub.
- **Claude Code** (opcional, mas ajuda muito): abrindo a pasta do projeto, ele
  já lê o `CLAUDE.md` e sabe como o painel funciona.

## Rotina de atualização

O passo a passo de cada fonte está em `ATUALIZACAO.md` e no
`Setor Siderúrgico/RUNBOOK_ACESSOS.md`. Resumo do calendário:

| Quando | O quê |
|---|---|
| Todo mês | CAGED, Comex Stat, IPCA e câmbio |
| A cada 3 meses | BNDES e UN Comtrade |
| Uma vez por ano | RAIS, PIA (faturamento), Tabelas de Recursos e Usos do IBGE (Cadeia Produtiva) |
| Quando sair resolução | DECOM |
| Não precisa | Energia Industrial (decisão do SIFESP) |

Depois de atualizar as planilhas, para publicar:

```powershell
.venv\Scripts\python -m pytest
.venv\Scripts\python build_data.py
git add 3_Dados_Tratados_CSV data
git commit -m "Atualiza dados: <fontes>"
git push
```

O site se republica sozinho em uns 2 minutos depois do `push`. Se a pessoa
não vir a mudança, é cache do navegador: Ctrl+F5.

## Para ver o painel no próprio computador

```powershell
pwsh -File serve.ps1
```

Depois abra http://localhost:8791.

## Coisas que é bom saber

- **Cadeia Produtiva:** os números são do IBGE de 2021, o ano mais recente
  publicado nesse detalhe; o IBGE atrasa uns 3 anos. O diagrama mostra quem
  compra de quem entre os setores. Não é uma Matriz Insumo-Produto completa:
  só o multiplicador vem da MIP oficial, que é de 2015.
- **RAIS:** a partir de 2022 mudou a forma de coleta (eSocial), então alguns
  perfis têm quebra de série entre 2021 e 2022.
- **Pendências:**
  - a aba Relatórios está em construção;
  - nenhuma coleta está agendada para rodar sozinha.

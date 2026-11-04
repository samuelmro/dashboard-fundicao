# Leia primeiro

Você recebeu o projeto do **Painel do Setor de Fundição** (CNAE 2451 e 2452),
feito para o SIFESP em parceria com FIESP e CIESP.

- **Painel no ar:** https://samuelmro.github.io/dashboard-fundicao/
- **Código no GitHub:** https://github.com/samuelmro/dashboard-fundicao

## Por onde começar

| Quero... | Leia |
|---|---|
| Entender o projeto e o que fazer na passagem | [`PASSAGEM.md`](PASSAGEM.md) |
| Atualizar os dados | [`ATUALIZACAO.md`](ATUALIZACAO.md) e `Setor Siderúrgico/RUNBOOK_ACESSOS.md` |
| Levar a aba Cadeia Produtiva para outro CNAE | [`COMO_REPLICAR_CADEIA.md`](COMO_REPLICAR_CADEIA.md) |
| Detalhes técnicos | [`README.md`](README.md) |

## Colocar para rodar no seu computador

Extraia o zip numa pasta de caminho curto, por exemplo `C:\Projetos`. Em
pastas muito fundas o Windows passa do limite de 260 caracteres por caminho e
alguns arquivos não são extraídos.

Depois, no PowerShell, dentro desta pasta:

```powershell
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python -m pytest
pwsh -File serve.ps1
```

Depois abra http://localhost:8791. Se os testes passarem, está tudo certo.

## Continuar com o Claude Code

Abra esta pasta no Claude Code. Ele lê o [`CLAUDE.md`](CLAUDE.md)
automaticamente e já sabe:

- como o painel funciona;
- de onde vem cada dado;
- como publicar;
- o que o responsável anterior pediu, e evitou, no visual.

Bons primeiros pedidos:

- "Leia o PASSAGEM.md e me diga o que eu preciso resolver primeiro."
- "Quero atualizar os dados do CAGED. Me guie pelo ATUALIZACAO.md."
- "Quero fazer a aba Cadeia Produtiva para o setor de [setor]. Siga o
  COMO_REPLICAR_CADEIA.md."

## O que não veio no zip

- **`.venv`:** o ambiente Python é de cada computador. Recrie com os comandos
  acima.
- **`Setor Siderúrgico/1_Dados_Manuais_XLS/operacoes-financiamento-operacoes-indiretas-automaticas.csv`**
  (1,2 GB): base bruta do BNDES. O script de coleta (`extrair_dados.R`) baixa
  de novo quando precisa.
- **`Setor Siderúrgico/DEBUG_Comtrade_Completo.xlsx`** (235 MB): planilha de
  depuração. Não é usada pelo painel.
- **`.claude/settings.local.json`:** permissões do Claude da máquina anterior.

## Cuidado

Este pacote tem a pasta `Setor Siderúrgico/`, com o
`RUNBOOK_ACESSOS.md` e os scripts de coleta. **Eles contêm a chave de acesso
à API do UN Comtrade.**

- Não publique o pacote nem suba essa pasta para o GitHub. O `.gitignore` já
  impede isso, e o repositório é público.
- Assim que possível, gere a sua própria chave em https://comtradeapi.un.org e
  troque a antiga, seguindo o runbook.

Para publicar mudanças no site você precisa de acesso ao repositório no
GitHub. Veja a seção "Antes de o responsável atual sair" do `PASSAGEM.md`.

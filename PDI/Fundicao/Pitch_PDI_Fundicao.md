# Estrutura do Pitch Estratégico: O Futuro da Fundição em São Paulo
**Uma Abordagem Baseada em Dados para Venda de Projetos de PDI (SENAI)**

Este documento consolida a estrutura narrativa (storyboard) para uma apresentação executiva (C-Level). O objetivo é gerar o "senso de urgência" nos donos de fundição (CNAEs 2451 e 2452) cruzando megatendências globais com os dados locais dos seus CSVs.

---

## 📚 Recomendações de Leitura e Insumos Globais (O "Benchmark" Brabo)
Para embasar a apresentação com autoridade, cite estes relatórios e tendências que mapeamos agora (2025/2026):

1. **Deloitte - *Tracking the Trends (Metals & Mining)*:** Aponta que o foco da metalurgia mudou para "Resiliência e Ecossistemas". A IA e o Gêmeo Digital (Digital Twin) deixaram de ser ficção para serem o padrão na redução de refugo (scrap rate).
2. **American Foundry Society (AFS) - *Smart Foundries*:** Destaca a adoção em massa de **Impressão 3D de Areia** para moldes rápidos, eliminando o gargalo de modelaria para lotes pequenos e complexos e entregando moldes em dias em vez de semanas.
3. **Tendência Automotiva (Fortune Business Insights):** O "Mega-casting" (fundição de peças inteiras do chassi, introduzido pela Tesla) e a leveza (lightweighting) para veículos elétricos (EVs) estão explodindo a demanda pelo CNAE 2452 (Não-ferrosos, alumínio, magnésio), enquanto o ferro fundido tradicional sofre pressão.
4. **Economia Circular e Descarbonização:** Fornos elétricos eficientes e reaproveitamento de areia de fundição (closed-loop) passaram a ser exigências diretas para entrar nas cadeias de suprimento americanas e europeias.

---

## 📊 O Storyboard em 10 Gráficos (Usando seus CSVs)

A apresentação deve seguir o formato clássico de consultoria (Minto Pyramid): **(1) O Contexto Macro, (2) O Esmagamento Interno (A Dor), e (3) A Saída via PDI.**

### Bloco 1: O Tsunami Global (O que está acontecendo lá fora)
> *Objetivo: Mostrar que a mudança é estrutural, não passageira.*

*   **Gráfico 1: A "Fábrica das Fábricas" (A Invasão Asiática)**
    *   **Fonte:** `Comex_Exportacao_Importacao_2451.csv` e `2452`
    *   **Visual:** Gráfico de área empilhada mostrando a Balança Comercial.
    *   **Mensagem:** O déficit comercial está engolindo a indústria base. A China não exporta mais só o produto final (bens de consumo); ela está exportando a peça fundida usinada mais barata do que nosso custo de metal líquido na bica do forno.
*   **Gráfico 2: O Descolamento do Mundo (Exportações Globais vs Brasil)**
    *   **Fonte:** `Comtrade_Global_Fundicao_2451.csv` cruzado com o `Comex` BR.
    *   **Visual:** Linhas de tendência comparando o Market Share do Brasil na América Latina vs crescimento da Ásia.
    *   **Mensagem:** O "Nearshoring" está acontecendo (EUA e UE reconfigurando cadeias), mas o Brasil está perdendo a janela para capturar essa demanda por falta de competitividade e inovação tecnológica nos materiais.
*   **Gráfico 3: A Nova Demanda Oculta (IA, Energia e Eletromobilidade)**
    *   **Fonte:** `Producao_Fisica_Mensal_Metalurgia.csv` (tendências) e papers de mercado.
    *   **Visual:** Gráfico de barras de crescimento focado na diferença entre 2451 (Estagnado) e 2452 (Não-ferrosos/Alumínio subindo).
    *   **Mensagem:** A demanda física por trás da IA (data centers, infra de energia) e híbridos explodiu. O mercado exige ligas e tolerâncias que a fundição tradicional brasileira não faz em escala sem PDI.

### Bloco 2: O Esmagamento da Porta para Dentro (A "Dor" do Cliente)
> *Objetivo: Usar os dados internos do Brasil para mostrar que o modelo antigo quebrou.*

*   **Gráfico 4: O Choque Térmico/Elétrico (Custo da Energia)**
    *   **Fonte:** `energia_industria_transformacao_sp_brasil_2012-2026.csv`
    *   **Visual:** Linha dupla mostrando Custo Médio (R$/MWh) subindo violentamente vs Consumo Estagnado.
    *   **Mensagem:** A energia (o maior custo variável da fundição) subiu absurdamente. Sem um projeto de eficiência energética (IoT nos fornos), não há margem de lucro que resista.
*   **Gráfico 5: O Apagão de Talentos (O Envelhecimento do Setor)**
    *   **Fonte:** `rais_vinc_fundicao_tempo_emprego` e `escolaridade`.
    *   **Visual:** Pirâmide etária ou gráfico de barras mostrando a queda acentuada de jovens (18-25 anos) entrando ou permanecendo no setor.
    *   **Mensagem:** O trabalho pesado, quente e insalubre afasta talentos. Sem robótica e automação no vazamento de metal e rebarbação (Projetos de PDI), a fábrica vai parar por falta de operadores no futuro próximo.
*   **Gráfico 6: A Armadilha do Turnover (Custo Oculto)**
    *   **Fonte:** `caged_fundicao_tipo_movimentacao_mensal_cnae.csv`
    *   **Visual:** Gráfico de colunas com o saldo e índice de demissões/admissões.
    *   **Mensagem:** A alta rotatividade gera custos imensos com treinamento e, pior, defeitos de refugo (scrap) por inexperiência. A digitalização do processo tira a dependência exclusiva do "operador que conhece o forno de cabeça".
*   **Gráfico 7: O Abismo Financeiro (A rentabilidade espremida)**
    *   **Fonte:** `Dados_Financeiros_Fundicao_24_5.csv`
    *   **Visual:** Margem EBITDA média do setor caindo ao longo dos anos.
    *   **Mensagem:** Os custos de insumos subiram, e o preço chinês não deixa repassar para o cliente. A rentabilidade da fundição "média" (a *Straggler* da McKinsey) está estrangulada.

### Bloco 3: O Caminho das 'Standouts' e a Solução SENAI
> *Objetivo: Apresentar o PDI como o único investimento com ROI capaz de salvar o negócio.*

*   **Gráfico 8: As 'Standouts' Investem (Mesmo na Crise)**
    *   **Fonte:** `BNDES_Desembolsos_2451.csv` vs `2452.csv` (Análise de concentração de crédito).
    *   **Visual:** Gráfico de bolhas mostrando que a minoria que capta crédito foca em tecnologia e cresce, enquanto a maioria murcha.
    *   **Mensagem:** Há crédito (Nova Indústria Brasil, FINEP, EMBRAPII) disponível e barato para inovação. O gargalo é ter um bom projeto. O SENAI desenha o projeto técnico para o cliente captar esse recurso.
*   **Gráfico 9: Quem inova, paga melhor e domina o mercado**
    *   **Fonte:** `caged_fundicao_salario_mensal_uf_cnae.csv` vs Tamanho (`RAIS`).
    *   **Visual:** Dispersão (Scatterplot) mostrando o prêmio salarial das poucas empresas que crescem.
    *   **Mensagem:** As fundições "Standouts" (referência do paper McKinsey) conseguem aumentar salários e reter talentos porque sua produtividade por homem-hora explodiu via adoção tecnológica.
*   **Gráfico 10: O Funil de Valor do PDI SENAI (O Call to Action)**
    *   **Fonte:** Projeção visual conceitual (Infográfico de Vendas).
    *   **Visual:** Um "Waterfall" (Gráfico de Cascata) mostrando: 
        * Margem Atual 
        * (+) Redução de 15% de Energia com IoT 
        * (+) Queda de 10% no Refugo (Scrap) com Digital Twin 
        * (+) Premium no Preço com Ligas Especiais 
        * (=) Nova Margem da 'Standout'.
    *   **Mensagem:** O SENAI não vende pesquisa abstrata de laboratório; vende transformação na DRE da empresa. O PDI se paga rapidamente através do ganho de eficiência no processo fundido e acesso a novos mercados.

---
💡 **Dica de Ouro para o Pitch de Vendas:** Evite termos genéricos como "Indústria 4.0" soltos ao vento. Use a dor específica da fundição: **redução de scrap (refugo), tempo de try-out de novos moldes (impressão 3D reduzindo meses para dias), e TCO (Total Cost of Ownership) de energia nos fornos de indução e fornos cubilô**. Posicione o SENAI como o braço de engenharia avançada que as fundições médias não têm orçamento para manter internamente.

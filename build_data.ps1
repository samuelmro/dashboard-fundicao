#requires -Version 7.0
# Pré-processa os CSVs brutos em 3_Dados_Tratados_CSV/ e gera data/data.json
# compacto para o dashboard estático (sem Node/Python disponíveis no ambiente).

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$srcDir = Join-Path $root '3_Dados_Tratados_CSV'
$outDir = Join-Path $root 'data'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function Read-Csv($name) {
    Import-Csv -Path (Join-Path $srcDir $name) -Delimiter ';' -Encoding utf8
}

function BrNum($v) {
    if ($null -eq $v) { return $null }
    $s = "$v".Trim()
    if ($s -eq '' -or $s -eq 'NA' -or $s -eq 'NULL') { return $null }
    $s = $s -replace ',', '.'
    $n = 0.0
    if ([double]::TryParse($s, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$n)) {
        return $n
    }
    return $null
}

function BrInt($v) {
    $n = BrNum $v
    if ($null -eq $n) { return $null }
    return [int64][math]::Round($n)
}

# ---------------------------------------------------------------------------
# Tabela de UF (código IBGE -> sigla/nome canônicos)
# ---------------------------------------------------------------------------
$ufTable = @(
    @{code='11'; uf='RO'; nome='Rondônia'}, @{code='12'; uf='AC'; nome='Acre'},
    @{code='13'; uf='AM'; nome='Amazonas'}, @{code='14'; uf='RR'; nome='Roraima'},
    @{code='15'; uf='PA'; nome='Pará'}, @{code='16'; uf='AP'; nome='Amapá'},
    @{code='17'; uf='TO'; nome='Tocantins'}, @{code='21'; uf='MA'; nome='Maranhão'},
    @{code='22'; uf='PI'; nome='Piauí'}, @{code='23'; uf='CE'; nome='Ceará'},
    @{code='24'; uf='RN'; nome='Rio Grande do Norte'}, @{code='25'; uf='PB'; nome='Paraíba'},
    @{code='26'; uf='PE'; nome='Pernambuco'}, @{code='27'; uf='AL'; nome='Alagoas'},
    @{code='28'; uf='SE'; nome='Sergipe'}, @{code='29'; uf='BA'; nome='Bahia'},
    @{code='31'; uf='MG'; nome='Minas Gerais'}, @{code='32'; uf='ES'; nome='Espírito Santo'},
    @{code='33'; uf='RJ'; nome='Rio de Janeiro'}, @{code='35'; uf='SP'; nome='São Paulo'},
    @{code='41'; uf='PR'; nome='Paraná'}, @{code='42'; uf='SC'; nome='Santa Catarina'},
    @{code='43'; uf='RS'; nome='Rio Grande do Sul'}, @{code='50'; uf='MS'; nome='Mato Grosso do Sul'},
    @{code='51'; uf='MT'; nome='Mato Grosso'}, @{code='52'; uf='GO'; nome='Goiás'},
    @{code='53'; uf='DF'; nome='Distrito Federal'}
)
$byCode = @{}
$byAbbr = @{}
$byNameNorm = @{}
function NormName($s) {
    $s = $s.ToLowerInvariant()
    $s = $s -replace '[áàâã]', 'a' -replace '[éê]', 'e' -replace '[íî]', 'i' -replace '[óôõ]', 'o' -replace '[úü]', 'u' -replace 'ç', 'c'
    return $s.Trim()
}
foreach ($u in $ufTable) {
    $byCode[$u.code] = $u
    $byAbbr[$u.uf] = $u
    $byNameNorm[(NormName $u.nome)] = $u
}

# Resolve uma string de UF em qualquer formato observado nos CSVs ("15 - Pará", " SP", "São Paulo", "15 - Para")
function ResolveUF($raw) {
    if ($null -eq $raw) { return $null }
    $s = "$raw".Trim().Trim('"').Trim()
    if ($s -eq '' -or $s -eq 'Total') { return $null }
    if ($s -match '^(\d{2})\s*-\s*(.+)$') {
        $code = $Matches[1]
        if ($byCode.ContainsKey($code)) { return $byCode[$code] }
    }
    if ($byAbbr.ContainsKey($s.ToUpperInvariant())) { return $byAbbr[$s.ToUpperInvariant()] }
    $norm = NormName $s
    if ($byNameNorm.ContainsKey($norm)) { return $byNameNorm[$norm] }
    return $null
}

Write-Host "Lendo CSVs de $srcDir..."

# ---------------------------------------------------------------------------
# SHARED: Produção física
# ---------------------------------------------------------------------------
$metIndice = Read-Csv 'Producao_Fisica_Mensal_Metalurgia.csv' | ForEach-Object {
    [ordered]@{
        ano = BrInt $_.ano; mes = BrInt $_.mes; data = $_.data
        indice_bruto = BrNum $_.indice_bruto_base_100
        indice_dessaz = BrNum $_.indice_dessazonalizado_base_100
    }
}

$acoGusaBruto = Read-Csv 'Producao_Fisica_Aco_Gusa_Bruto.csv' | ForEach-Object {
    $ano = [int]$_.'Período'.Substring(0,4); $mes = [int]$_.'Período'.Substring(5,2)
    [ordered]@{
        ano = $ano; mes = $mes; data = $_.'Período'
        aco_bruto = BrNum $_.'Aço Bruto'
        laminados = BrNum $_.'Laminados'
        ferro_gusa = BrNum $_.'Ferro-Gusa*'
        semi_acabados = BrNum $_.'Semi-Acabados'
    }
}

$acoGusaDessaz = Read-Csv 'Producao_Fisica_Aco_Gusa_Dessazonalizado.csv' | ForEach-Object {
    $ano = [int]$_.'Período'.Substring(0,4); $mes = [int]$_.'Período'.Substring(5,2)
    [ordered]@{
        ano = $ano; mes = $mes; data = $_.'Período'
        aco_bruto = BrNum $_.'Aço Bruto'
        total_sem_ferro_gusa = BrNum $_.'Total sem Ferro-Gusa'
    }
}

# ---------------------------------------------------------------------------
# SHARED: Financeiro (PIA) - metalurgia ampla + fundição 24.5 (combinado 2451+2452)
# ---------------------------------------------------------------------------
function ReadFinanceiro($file) {
    Read-Csv $file | ForEach-Object {
        [ordered]@{
            ano = BrInt $_.ano
            numero_empresas = BrInt ($_.numero_empresas ?? $_.numero_unidades_locais)
            pessoal_ocupado = BrInt $_.pessoal_ocupado
            receita_liquida_total = BrNum ($_.receita_liquida_total ?? $_.total_receitas_liquidas)
            custos_despesas_totais = BrNum ($_.custos_despesas_totais ?? $_.total_custos_despesas)
            gastos_pessoal_total = BrNum ($_.gastos_pessoal_total ?? $_.salarios_retiradas)
            vbpi = BrNum $_.vbpi
            vti = BrNum $_.vti
        }
    }
}
$finMetalurgia = ReadFinanceiro 'Dados_Financeiros_Metalurgia_24.csv'
$finFundicao = ReadFinanceiro 'Dados_Financeiros_Fundicao_24_5.csv'

# ---------------------------------------------------------------------------
# SHARED: Energia (proxy Metalurgia, categoria ampla) + Macro + DECOM
# ---------------------------------------------------------------------------
$energiaAprox = Read-Csv 'Consumo_Energia_CCEE_Metalurgia_e_Produtos_Metal_APROXIMADO.csv' | ForEach-Object {
    [ordered]@{
        ano = BrInt $_.Ano; mes = BrInt $_.Mes
        consumo_livre_acl = BrNum $_.Consumo_Livre_ACL
        consumo_autoprodutor_acl = BrNum $_.Consumo_Autoprodutor_ACL
    }
}

$macro = Read-Csv 'Indicadores_Macro_e_Inflacao.csv' | Where-Object { (BrInt $_.ano) -ge 1990 } | ForEach-Object {
    [ordered]@{
        ano = BrInt $_.ano; mes = BrInt $_.mes; data = $_.data
        ipca = BrNum $_.ipca_indice_inflacao
        dolar = BrNum $_.dolar_venda
        ipp_metalurgia = BrNum $_.ipp_metalurgia_indice
    }
}

$decom = Read-Csv 'decom_fundicao_processos_2451.csv' | ForEach-Object {
    [ordered]@{
        ncm = $_.NCM; pais = $_.País; status = $_.Status
        aliquota = $_.'Alíquota_USD_Ton'; data_inicio = $_.Data_Início
        data_resolucao = $_.Data_Resolução; circular = $_.Circular_Referência
    }
}

# ---------------------------------------------------------------------------
# Meses abreviados PT-BR usados no CAGED ("Dez/2019")
# ---------------------------------------------------------------------------
$mesesPt = @{'Jan'=1;'Fev'=2;'Mar'=3;'Abr'=4;'Mai'=5;'Jun'=6;'Jul'=7;'Ago'=8;'Set'=9;'Out'=10;'Nov'=11;'Dez'=12}
function ParseCompetencia($s) {
    $s = "$s".Trim().Trim('"')
    if ($s -notmatch '^(\w{3})/(\d{4})$') { return $null }
    $m = $mesesPt[$Matches[1]]
    if (-not $m) { return $null }
    return @{ ano = [int]$Matches[2]; mes = $m }
}

function BuildSector($cnae, $label) {
    Write-Host "  Setor $cnae ($label)..."

    # --- RAIS: estabelecimentos/vínculos por UF, anual ---
    $raisFile = if ($cnae -eq '2451') { 'Empregos_RAIS_UF_Ferro_Aco_2451.csv' } else { 'Empregos_RAIS_UF_Nao_Ferrosos_2452.csv' }
    $raisRows = Read-Csv $raisFile
    $uf_yearly = foreach ($r in $raisRows) {
        $ufi = ResolveUF $r.UF
        if ($ufi) {
            [ordered]@{ ano = BrInt $r.Ano; uf = $ufi.uf; nome_uf = $ufi.nome; estabelecimentos = BrInt $r.Estabelecimentos; vinculos = BrInt $r.Vinculos }
        }
    }
    $uf_yearly_total = $raisRows | Where-Object { $_.UF -eq 'Total' } | ForEach-Object {
        [ordered]@{ ano = BrInt $_.Ano; estabelecimentos = BrInt $_.Estabelecimentos; vinculos = BrInt $_.Vinculos }
    }

    # --- RAIS por porte ---
    $tamFile = if ($cnae -eq '2451') { 'Empregos_RAIS_Tamanho_Ferro_Aco_2451.csv' } else { 'Empregos_RAIS_Tamanho_Nao_Ferrosos_2452.csv' }
    $tamRows = Read-Csv $tamFile
    $tamanho_yearly = $tamRows | Where-Object { $_.Faixa_Tamanho -ne 'Total' } | ForEach-Object {
        [ordered]@{ ano = BrInt $_.Ano; faixa = $_.Faixa_Tamanho; estabelecimentos = BrInt $_.Estabelecimentos; vinculos = BrInt $_.Vinculos }
    }

    # --- Perfis detalhados RAIS (retrato do último ano) ---
    function LatestBreakdown($file) {
        $rows = Read-Csv $file
        $anoMax = ($rows | ForEach-Object { BrInt $_.ano } | Measure-Object -Maximum).Maximum
        $items = $rows | Where-Object { (BrInt $_.ano) -eq $anoMax -and $_.is_total -ne 'TRUE' } | ForEach-Object {
            [ordered]@{ categoria = $_.categoria; frequencia = BrInt $_.frequencia }
        }
        $items = $items | Sort-Object -Property { $_.frequencia } -Descending
        return [ordered]@{ ano = $anoMax; items = @($items) }
    }
    $escolaridade_latest = LatestBreakdown "rais_vinc_fundicao_escolaridade_$cnae.csv"
    $ocupacao_agrupada_latest = LatestBreakdown "rais_vinc_fundicao_ocupacao_agrupada_$cnae.csv"
    $tempo_emprego_latest = LatestBreakdown "rais_vinc_fundicao_tempo_emprego_$cnae.csv"

    $massaRows = Read-Csv "rais_vinc_fundicao_massa_$cnae.csv"
    $massaAnoMax = ($massaRows | ForEach-Object { BrInt $_.ano } | Measure-Object -Maximum).Maximum
    $massaLatestRows = $massaRows | Where-Object { (BrInt $_.ano) -eq $massaAnoMax }
    $massaNat = $massaLatestRows | Where-Object { $_.is_total -eq 'TRUE' } | Select-Object -First 1
    $massa_uf_latest = [ordered]@{
        ano = $massaAnoMax
        nacional = if ($massaNat) { [ordered]@{ frequencia = BrInt $massaNat.frequencia; remuneracao_media_nominal = BrNum $massaNat.remuneracao_media_nominal } } else { $null }
        items = @($massaLatestRows | Where-Object { $_.is_total -ne 'TRUE' } | ForEach-Object {
            $ufi = ResolveUF $_.categoria
            if ($ufi) { [ordered]@{ uf = $ufi.uf; nome_uf = $ufi.nome; frequencia = BrInt $_.frequencia; remuneracao_media_nominal = BrNum $_.remuneracao_media_nominal } }
        } | Where-Object { $_ })
    }

    # --- CAGED (2008-2019, por UF) ---
    $cagedSaldo = Read-Csv 'caged_fundicao_saldo_mensal_uf_cnae.csv' | Where-Object { $_.cnae_subclasse -eq $cnae -and $_.Competencia -ne 'Total' }
    $cagedSalario = Read-Csv 'caged_fundicao_salario_mensal_uf_cnae.csv' | Where-Object { $_.cnae_subclasse -eq $cnae -and $_.Competencia -ne 'Total' }

    $saldo_monthly_national = $cagedSaldo | Group-Object { $_.Competencia } | ForEach-Object {
        $c = ParseCompetencia $_.Name
        if ($c) { [ordered]@{ ano = $c.ano; mes = $c.mes; saldo = ($_.Group | ForEach-Object { BrInt $_.Saldo_Movimentacao } | Measure-Object -Sum).Sum } }
    } | Where-Object { $_ } | Sort-Object { $_.ano * 100 + $_.mes }

    $salario_monthly_national = $cagedSalario | Group-Object { $_.Competencia } | ForEach-Object {
        $c = ParseCompetencia $_.Name
        if ($c) { [ordered]@{ ano = $c.ano; mes = $c.mes; massa_salarial = ($_.Group | ForEach-Object { BrInt $_.Salario_Mensal } | Measure-Object -Sum).Sum } }
    } | Where-Object { $_ } | Sort-Object { $_.ano * 100 + $_.mes }

    $saldo_uf_yearly = $cagedSaldo | ForEach-Object {
        $c = ParseCompetencia $_.Competencia; $ufi = ResolveUF $_.UF
        if ($c -and $ufi) { [ordered]@{ ano = $c.ano; uf = $ufi.uf; saldo = BrInt $_.Saldo_Movimentacao } }
    } | Where-Object { $_ } | Group-Object { "$($_.ano)|$($_.uf)" } | ForEach-Object {
        $first = $_.Group[0]
        [ordered]@{ ano = $first.ano; uf = $first.uf; saldo = ($_.Group | ForEach-Object { $_.saldo } | Measure-Object -Sum).Sum }
    }

    $tipoMovRows = Read-Csv 'caged_fundicao_tipo_movimentacao_mensal_cnae.csv' | Where-Object { $_.cnae_subclasse -eq $cnae -and $_.Competencia -ne 'Total' }
    $tipo_movimentacao_monthly = $tipoMovRows | Group-Object { $_.Competencia } | ForEach-Object {
        $c = ParseCompetencia $_.Name
        if ($c) {
            $adm = ($_.Group | Where-Object { $_.Tipo_Movimentacao -match '(?i)admiss' } | ForEach-Object { BrInt $_.Quantidade } | Measure-Object -Sum).Sum
            $desl = ($_.Group | Where-Object { $_.Tipo_Movimentacao -match '(?i)desligamento' } | ForEach-Object { BrInt $_.Quantidade } | Measure-Object -Sum).Sum
            [ordered]@{ ano = $c.ano; mes = $c.mes; admissoes = $adm; desligamentos = $desl }
        }
    } | Where-Object { $_ } | Sort-Object { $_.ano * 100 + $_.mes }

    $tipoMovTotalRows = Read-Csv 'caged_fundicao_tipo_movimentacao_mensal_cnae.csv' | Where-Object { $_.cnae_subclasse -eq $cnae -and $_.Competencia -eq 'Total' }
    $tipo_movimentacao_breakdown_total = $tipoMovTotalRows | ForEach-Object {
        [ordered]@{ tipo = $_.Tipo_Movimentacao; quantidade = BrInt $_.Quantidade }
    } | Sort-Object { -[int]$_.quantidade }

    # --- Comércio exterior (Comex Brasil) ---
    $comexFile = "Comex_Exportacao_Importacao_$cnae.csv"
    $comexRows = Read-Csv $comexFile
    $comex_yearly = $comexRows | Group-Object { "$($_.Ano)|$($_.Fluxo)" } | ForEach-Object {
        $first = $_.Group[0]
        [ordered]@{
            ano = BrInt $first.Ano; fluxo = $first.Fluxo
            valor_usd = ($_.Group | ForEach-Object { BrNum $_.Valor_US_FOB } | Measure-Object -Sum).Sum
            peso_kg = ($_.Group | ForEach-Object { BrNum $_.Quilograma_Liquido } | Measure-Object -Sum).Sum
        }
    }
    $comex_yearly_wide = $comex_yearly | Group-Object -Property { $_.ano } | ForEach-Object {
        $exp = $_.Group | Where-Object { $_.fluxo -eq 'Exportação' } | Select-Object -First 1
        $imp = $_.Group | Where-Object { $_.fluxo -eq 'Importação' } | Select-Object -First 1
        [ordered]@{
            ano = [int]$_.Name
            exportacao_usd = if ($exp) { $exp.valor_usd } else { 0 }
            exportacao_kg = if ($exp) { $exp.peso_kg } else { 0 }
            importacao_usd = if ($imp) { $imp.valor_usd } else { 0 }
            importacao_kg = if ($imp) { $imp.peso_kg } else { 0 }
        }
    } | Sort-Object -Property { $_.ano }

    $ufTotals = $comexRows | Group-Object UF_Produto | ForEach-Object {
        [ordered]@{ uf_produto = $_.Name; total = ($_.Group | ForEach-Object { BrNum $_.Valor_US_FOB } | Measure-Object -Sum).Sum }
    } | Sort-Object -Property { $_.total } -Descending
    $topUfNames = ($ufTotals | Where-Object { (ResolveUF $_.uf_produto) } | Select-Object -First 8).uf_produto
    $comex_uf_yearly = $comexRows | Where-Object { $topUfNames -contains $_.UF_Produto } | Group-Object { "$($_.Ano)|$($_.UF_Produto)|$($_.Fluxo)" } | ForEach-Object {
        $first = $_.Group[0]; $ufi = ResolveUF $first.UF_Produto
        [ordered]@{ ano = BrInt $first.Ano; uf = $ufi.uf; nome_uf = $ufi.nome; fluxo = $first.Fluxo; valor_usd = ($_.Group | ForEach-Object { BrNum $_.Valor_US_FOB } | Measure-Object -Sum).Sum }
    }

    $anoMaxComex = ($comexRows | ForEach-Object { BrInt $_.Ano } | Measure-Object -Maximum).Maximum
    $anoAtual = (Get-Date).Year
    $anoTopComex = if ($anoMaxComex -eq $anoAtual) { $anoMaxComex - 1 } else { $anoMaxComex }
    $top_paises_latest = [ordered]@{
        ano = $anoTopComex
        exportacao = @($comexRows | Where-Object { (BrInt $_.Ano) -eq $anoTopComex -and $_.Fluxo -eq 'Exportação' } | Group-Object Pais | ForEach-Object {
            [ordered]@{ pais = $_.Name; valor_usd = ($_.Group | ForEach-Object { BrNum $_.Valor_US_FOB } | Measure-Object -Sum).Sum }
        } | Sort-Object -Property { $_.valor_usd } -Descending | Select-Object -First 10)
        importacao = @($comexRows | Where-Object { (BrInt $_.Ano) -eq $anoTopComex -and $_.Fluxo -eq 'Importação' } | Group-Object Pais | ForEach-Object {
            [ordered]@{ pais = $_.Name; valor_usd = ($_.Group | ForEach-Object { BrNum $_.Valor_US_FOB } | Measure-Object -Sum).Sum }
        } | Sort-Object -Property { $_.valor_usd } -Descending | Select-Object -First 10)
    }

    # --- Comtrade global (agregação pesada: 250k/244k linhas) ---
    $comtradeFile = "Comtrade_Global_Fundicao_$cnae.csv"
    $ctRows = Read-Csv $comtradeFile
    $ctBrazilWorld = $ctRows | Where-Object { $_.Reporter -eq 'Brazil' -and $_.Partner -eq 'World' }
    $brazil_yearly = $ctBrazilWorld | Group-Object { "$($_.Ano)|$($_.Fluxo)" } | ForEach-Object {
        $first = $_.Group[0]
        [ordered]@{ ano = BrInt $first.Ano; fluxo = $first.Fluxo; valor_usd = ($_.Group | ForEach-Object { BrNum $_.Valor_US_FOB } | Measure-Object -Sum).Sum }
    }
    $brazil_yearly_wide = $brazil_yearly | Group-Object -Property { $_.ano } | ForEach-Object {
        $exp = $_.Group | Where-Object { $_.fluxo -match '(?i)export' } | Select-Object -First 1
        $imp = $_.Group | Where-Object { $_.fluxo -match '(?i)import' } | Select-Object -First 1
        [ordered]@{ ano = [int]$_.Name; export_usd = if ($exp) { $exp.valor_usd } else { 0 }; import_usd = if ($imp) { $imp.valor_usd } else { 0 } }
    } | Sort-Object -Property { $_.ano }

    $ctWorldExport = $ctRows | Where-Object { $_.Partner -eq 'World' -and $_.Fluxo -match '(?i)export' }
    $world_yearly = $ctWorldExport | Group-Object Ano | ForEach-Object {
        [ordered]@{ ano = [int]$_.Name; export_usd = ($_.Group | ForEach-Object { BrNum $_.Valor_US_FOB } | Measure-Object -Sum).Sum }
    } | Sort-Object -Property { $_.ano }

    $anoMaxCt = ($ctBrazilWorld | ForEach-Object { BrInt $_.Ano } | Measure-Object -Maximum).Maximum
    $ctPartners = $ctRows | Where-Object { $_.Reporter -eq 'Brazil' -and $_.Partner -ne 'World' -and (BrInt $_.Ano) -eq $anoMaxCt -and $_.Fluxo -match '(?i)export' }
    $top_partners_latest = [ordered]@{
        ano = $anoMaxCt
        items = @($ctPartners | Group-Object Partner | ForEach-Object {
            [ordered]@{ pais = $_.Name; valor_usd = ($_.Group | ForEach-Object { BrNum $_.Valor_US_FOB } | Measure-Object -Sum).Sum }
        } | Sort-Object -Property { $_.valor_usd } -Descending | Select-Object -First 10)
    }
    $comtrade = [ordered]@{ brazil_yearly = @($brazil_yearly_wide); world_yearly = @($world_yearly); top_partners_latest = $top_partners_latest }

    # --- Energia CCEE exata ---
    $energiaFile = "Consumo_Energia_CCEE_Exato_$cnae.csv"
    $exato_monthly = Read-Csv $energiaFile | ForEach-Object {
        [ordered]@{ ano = BrInt $_.Ano; mes = BrInt $_.Mes; consumo_acl_mwh = BrNum $_.Consumo_ACL_MWh; consumo_total_mwh = BrNum $_.Consumo_Total_MWh }
    } | Sort-Object { $_.ano * 100 + $_.mes }

    # --- BNDES ---
    $bndesFile = "BNDES_Desembolsos_$cnae.csv"
    $bndesRows = Read-Csv $bndesFile
    $bndes_yearly = $bndesRows | Group-Object Ano | ForEach-Object {
        [ordered]@{
            ano = [int]$_.Name
            valor_contratado = ($_.Group | ForEach-Object { BrNum $_.Valor_Contratado } | Measure-Object -Sum).Sum
            valor_desembolsado = ($_.Group | ForEach-Object { BrNum $_.Valor_Desembolsado } | Measure-Object -Sum).Sum
        }
    } | Sort-Object -Property { $_.ano }
    $bndes_uf_total = $bndesRows | ForEach-Object {
        $ufi = ResolveUF $_.UF
        if ($ufi) { [ordered]@{ uf = $ufi.uf; nome_uf = $ufi.nome; valor = BrNum $_.Valor_Desembolsado } }
    } | Where-Object { $_ } | Group-Object -Property { $_.uf } | ForEach-Object {
        [ordered]@{ uf = $_.Name; nome_uf = $_.Group[0].nome_uf; valor_desembolsado = ($_.Group | ForEach-Object { $_.valor } | Measure-Object -Sum).Sum }
    } | Sort-Object -Property { $_.valor_desembolsado } -Descending
    $bndes_porte_total = $bndesRows | Group-Object Porte | ForEach-Object {
        [ordered]@{ porte = $_.Name; valor_desembolsado = ($_.Group | ForEach-Object { BrNum $_.Valor_Desembolsado } | Measure-Object -Sum).Sum }
    } | Sort-Object -Property { $_.valor_desembolsado } -Descending

    return [ordered]@{
        label = $label
        rais = [ordered]@{
            uf_yearly = @($uf_yearly | Where-Object { $_ }); uf_yearly_total = @($uf_yearly_total)
            tamanho_yearly = @($tamanho_yearly)
            escolaridade_latest = $escolaridade_latest; ocupacao_agrupada_latest = $ocupacao_agrupada_latest; tempo_emprego_latest = $tempo_emprego_latest
            massa_uf_latest = $massa_uf_latest
        }
        caged = [ordered]@{
            coverage = [ordered]@{ inicio = '2008-01'; fim = '2019-12' }
            saldo_monthly_national = @($saldo_monthly_national); salario_monthly_national = @($salario_monthly_national)
            saldo_uf_yearly = @($saldo_uf_yearly)
            tipo_movimentacao_monthly = @($tipo_movimentacao_monthly); tipo_movimentacao_breakdown_total = @($tipo_movimentacao_breakdown_total)
        }
        comex = [ordered]@{ yearly = @($comex_yearly_wide); uf_yearly = @($comex_uf_yearly); top_paises_latest = $top_paises_latest }
        comtrade = $comtrade
        energia = [ordered]@{ coverage = [ordered]@{ inicio = '2024-04'; fim = '2026-05' }; exato_monthly = @($exato_monthly) }
        bndes = [ordered]@{ yearly = @($bndes_yearly); uf_total = @($bndes_uf_total); porte_total = @($bndes_porte_total) }
    }
}

$sector2451 = BuildSector '2451' 'Fundição de ferro e aço'
$sector2452 = BuildSector '2452' 'Fundição de metais não ferrosos'

$data = [ordered]@{
    meta = [ordered]@{
        gerado_em = (Get-Date -Format 'yyyy-MM-dd')
        periodo_slider_padrao = [ordered]@{ inicio = 2016; fim = 2026 }
        uf_lista = @($ufTable | Sort-Object nome | ForEach-Object { [ordered]@{ uf = $_.uf; nome = $_.nome } })
    }
    shared = [ordered]@{
        producao = [ordered]@{ metalurgia_indice = @($metIndice); aco_gusa = @($acoGusaBruto); aco_gusa_dessaz = @($acoGusaDessaz) }
        financeiro = [ordered]@{ metalurgia_24 = @($finMetalurgia); fundicao_24_5 = @($finFundicao) }
        energia_metalurgia_aproximado = @($energiaAprox)
        macro = @($macro)
        decom = @($decom)
    }
    sectors = [ordered]@{ '2451' = $sector2451; '2452' = $sector2452 }
}

$json = $data | ConvertTo-Json -Depth 12 -Compress
$outPath = Join-Path $outDir 'data.json'
[System.IO.File]::WriteAllText($outPath, $json, [System.Text.UTF8Encoding]::new($false))
Write-Host "OK: $outPath ($([math]::Round((Get-Item $outPath).Length/1KB,1)) KB)"

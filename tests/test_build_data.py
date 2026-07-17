"""Testes de fumaça do pipeline de dados: garantem que build_data.py roda contra
os CSVs reais e produz um data.json com o schema esperado, simétrico entre
2451 e 2452. Não usa mocks — o dataset é pequeno o suficiente para rodar em CI."""

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import build_data  # noqa: E402


@pytest.fixture(scope='module')
def data():
    build_data.main()
    with open(ROOT / 'data' / 'data.json', encoding='utf-8') as f:
        return json.load(f)


def test_top_level_schema(data):
    assert set(data.keys()) == {'meta', 'shared', 'sectors'}
    assert set(data['sectors'].keys()) == {'2451', '2452'}


def test_sectors_are_symmetric(data):
    def keys(d, prefix=''):
        out = set()
        for k, v in d.items():
            out.add(prefix + k)
            if isinstance(v, dict):
                out |= keys(v, prefix + k + '.')
        return out

    keys_2451 = keys(data['sectors']['2451'])
    keys_2452 = keys(data['sectors']['2452'])
    assert keys_2451 == keys_2452


@pytest.mark.parametrize('cnae', ['2451', '2452'])
def test_core_series_not_empty(data, cnae):
    s = data['sectors'][cnae]
    assert len(s['rais']['uf_yearly_total']) > 0
    assert len(s['comex']['yearly']) > 0
    assert len(s['bndes']['yearly']) > 0
    assert len(s['bndes']['table']) > 0


def test_producao_has_laminados(data):
    rows = data['shared']['producao']['aco_gusa']
    assert len(rows) > 0
    assert all('laminados' in r for r in rows)


def test_financeiro_has_materias_primas(data):
    for chave in ('metalurgia_24', 'fundicao_24_5'):
        rows = data['shared']['financeiro'][chave]
        assert len(rows) > 0
        assert all('consumo_materias_primas' in r for r in rows)


def test_json_is_utf8_no_bom():
    raw = (ROOT / 'data' / 'data.json').read_bytes()
    assert not raw.startswith(b'\xef\xbb\xbf')

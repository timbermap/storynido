"""Genera messages/es-voseo.json (DECISIONS 250): los textos de es.json pasados a voseo rioplatense.

Uso, desde apps/web:  python3 scripts/voseo/generar.py
Solo guarda las claves que cambian; request.ts las aplica sobre es.json para Argentina y Uruguay.
Las palabras ambiguas (crea, usa, prueba, cuenta…) no se tocan solas: van en MANUAL por clave.
Después de correrlo, revisá el diff de es-voseo.json.
"""
import collections, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from diccionario import MANUAL, SAFE  # noqa: E402

WEB = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(WEB, 'messages', 'es.json')
OUT = os.path.join(WEB, 'messages', 'es-voseo.json')

# Formas de 2.ª persona y enclíticos: siempre. Imperativos sin enclítico: no después de «se», «lo»,
# «la», «le», «no» o «que» (ahí suelen ser 3.ª persona: «se confirma», «lo pide»).
S2 = [k for k in SAFE if k.endswith('s') or any(ch in k for ch in 'áéíóú') or k in ('tú', 'ti')]
IMP = [k for k in SAFE if k not in S2]


def alternation(words):
    return '|'.join(sorted(map(re.escape, words), key=len, reverse=True))


PAT_S2 = re.compile(r'(?<![\w{])(' + alternation(S2) + r')(?![\w}])', re.I)
PAT_IMP = re.compile(
    r'(?<!\bse )(?<!\blo )(?<!\bla )(?<!\ble )(?<!\bno )(?<!\bque )(?<![\w{])('
    + alternation(IMP)
    + r')(?![\w}])',
    re.I,
)


def keep_case(match):
    word = match.group(0)
    rep = SAFE[word.lower()]
    return rep[0].upper() + rep[1:] if word[0].isupper() else rep


def convert(key, text):
    out = PAT_IMP.sub(keep_case, PAT_S2.sub(keep_case, text))
    for old, new in MANUAL.get(key, []):
        if old in out:
            out = out.replace(old, new)
    return out


def main():
    messages = json.load(open(SRC, encoding='utf-8'), object_pairs_hook=collections.OrderedDict)
    overrides = collections.OrderedDict()

    def walk(node, path):
        for key, value in node.items():
            here = path + [key]
            if isinstance(value, dict):
                walk(value, here)
            elif isinstance(value, str):
                converted = convert('.'.join(here), value)
                if converted != value:
                    cur = overrides
                    for part in here[:-1]:
                        cur = cur.setdefault(part, collections.OrderedDict())
                    cur[here[-1]] = converted

    walk(messages, [])
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(json.dumps(overrides, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    main()

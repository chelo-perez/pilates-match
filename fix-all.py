import re

replacements = [
    # Fuentes
    ("'DM_Sans-Regular'",    "'Nunito-Regular'"),
    ("'DM_Sans-Medium'",     "'Nunito-Medium'"),
    ("'DM_Sans-SemiBold'",   "'Nunito-SemiBold'"),
    ("'DM_Sans-Bold'",       "'Nunito-Bold'"),
    ('"DM_Sans-Regular"',    '"Nunito-Regular"'),
    ('"DM_Sans-Medium"',     '"Nunito-Medium"'),
    ('"DM_Sans-SemiBold"',   '"Nunito-SemiBold"'),
    ('"DM_Sans-Bold"',       '"Nunito-Bold"'),
    ("'Playfair_Display-Medium'",  "'Nunito-Bold'"),
    ("'Playfair_Display-Bold'",    "'Nunito-Bold'"),
    ('"Playfair_Display-Medium"',  '"Nunito-Bold"'),
    ('"Playfair_Display-Bold"',    '"Nunito-Bold"'),
    # Colores inexistentes
    ("colors.lavender",  "colors.sage"),
    ("colors.lavLight",  "colors.sageLighter"),
    ("colors.lavDark",   "colors.sage"),
    ("colors.lavBg",     "colors.sageLight"),
    ("colors.goldMid",   "colors.gold"),
    ("colors.success",   "colors.sage"),
    ("colors.successBg", "colors.sageLighter"),
    ("colors.sand",      "colors.cream"),
    ("colors.sandLight", "colors.cream"),
    ("colors.sandDark",  "colors.dark"),
    ("colors.blush",     "colors.redBg"),
    ("colors.blushDark", "colors.redTx"),
    ("colors.danger",    "colors.redTx"),
    ("colors.dangerBg",  "colors.redBg"),
    ("colors.creamLight","colors.cream"),
    ("spacing.xxxl",     "spacing.xxl"),
    ("radius.full",      "9999"),
]

import os, glob

files = glob.glob('src/**/*.tsx', recursive=True) + glob.glob('src/**/*.ts', recursive=True)
changed = []

for filepath in files:
    if 'node_modules' in filepath:
        continue
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        original = content
        for old, new in replacements:
            content = content.replace(old, new)
        if content != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            changed.append(filepath)
    except Exception as e:
        print(f"ERROR {filepath}: {e}")

print(f"Cambiados: {len(changed)} archivos")
for f in changed:
    print(f"  {f}")

import os

padding_fixes = [
  ('src/screens/instructor/MatchesScreen.tsx', 
   "header:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.lg,",
   "header:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: 52,"),
  ('src/screens/studio/HistoryScreen.tsx',
   "header:       { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderColor: colors.borderLight },",
   "header:       { paddingHorizontal: spacing.lg, paddingTop: 52, paddingBottom: spacing.md, borderBottomWidth: 0.5, borderColor: colors.borderLight },"),
  ('src/screens/studio/PendingEvaluationsScreen.tsx',
   "header:     { padding: spacing.lg, borderBottomWidth: 0.5, borderColor: colors.borderLight },",
   "header:     { padding: spacing.lg, paddingTop: 52, borderBottomWidth: 0.5, borderColor: colors.borderLight },"),
]

for filepath, old, new in padding_fixes:
    if not os.path.exists(filepath): print(f"SKIP: {filepath}"); continue
    with open(filepath, 'r') as f: c = f.read()
    if old in c:
        c = c.replace(old, new)
        with open(filepath, 'w') as f: f.write(c)
        print(f"OK: {filepath}")
    else:
        print(f"SIN CAMBIOS: {filepath}")

print("Listo")

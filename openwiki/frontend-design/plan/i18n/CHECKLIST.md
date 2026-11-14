# Interface languages — checklist

- [x] Stable keys before translating (navigation group `key`, Home by key, `inferAction` via `sourceOf`)
- [x] Self-written runtime: `t`/`msg`, parameters, plurals, fallback current → English → Vietnamese
- [x] Codemod: 2,194 strings in 95 files wrapped; leftover scan 0
- [x] Lazy catalogues, saved language activated before the app modules load, `index.html` pre-paint
- [x] Locale-aware numbers/dates with VND always; Vietnamese output unchanged
- [x] RTL (`ar`, `ur`): logical utilities, sidebar on the right, mirrored arrows
- [x] Language picker in Hồ sơ → Giao diện and on the login screen
- [x] 23 catalogues × 2,267 messages, glossary terms, placeholders and edge spaces validated
- [x] Tests for every new symbol (see TESTS.md)
- [x] Phase ② gate: lint, typecheck, test, format:check, build
- [ ] Real-browser check of `vi`/`en`/`ar` (release step, see VERIFICATION)

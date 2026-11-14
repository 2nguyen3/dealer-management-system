# Interface languages (i18n) — 24 locales (2026-11-14)

Scope: frontend `ui/` only. Vietnamese is the source and default language; 23 more interface
languages are selectable in **Hồ sơ → Giao diện** and on the login screen. Only interface text
changes; business data (product/agency/ward names, notes, reasons, document codes) is shown as
the server returns it, and money is always VND.

Companion files: [REQUIREMENTS](REQUIREMENTS.md) · [DESIGN](DESIGN.md) · [TESTS](TESTS.md) ·
[CHECKLIST](CHECKLIST.md) · [VERIFICATION](VERIFICATION.md) · [GLOSSARY](GLOSSARY.md).

## Steps

1. Stable keys before translating: navigation groups have `key`; Home matches groups by key;
   button icon inference maps translated labels back to Vietnamese (`sourceOf`); status icons
   use status codes.
2. Self-written runtime (`src/lib/i18n/`): Vietnamese text is the message ID (`t('…')`,
   `msg('…')`), `{name}` parameters, `Intl.PluralRules`, fallback current → English → Vietnamese.
3. AST codemod wraps Vietnamese interface strings; the type checker decides which JSX
   expressions become message parameters. Leftover scan = 0.
4. Lazy catalogues `src/lib/i18n/locales/<code>.json`; the saved language is activated before
   the application modules load; switching saves and reloads.
5. Locale-aware formatting (separators, digits, date order; VND always), RTL (`ar`,
   `ur`) with logical CSS utilities, sidebar on the right and mirrored arrows.
6. Translations for 23 languages following the glossary; completeness test for every locale.

Decision log: the user narrowed the list from 48 to the 24 most widely used languages on
2026-11-14 (Vietnamese, English, Chinese ×2, Japanese, Korean, the ASEAN languages Thai,
Indonesian, Malay, Filipino, Khmer, Lao, Burmese, then Hindi, Bengali, Urdu, Arabic, Turkish,
Russian, German, French, Spanish, Brazilian Portuguese, Italian); no i18n library (handoff A1); default always `vi`, never `navigator.language`
(A3); storage key `agentra-locale` with a pre-paint script (A4). Backend PDF/XLSX and unknown
server messages stay as the server wrote them (A6).

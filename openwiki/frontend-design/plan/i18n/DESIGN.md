# Interface languages — design

## Message model

The Vietnamese text is the message ID. `t('Đã lưu {code}.', { code })` returns the current
language's text (or English, or the Vietnamese source). `msg()` marks constants that are
translated later with `t(value)` (guide content, error catalogue, step labels). Catalogues are
flat JSON objects `{ "<Vietnamese>": "<translation>" }`; a value may be a plural object keyed by
`Intl.PluralRules` category (`other` required) selected by the numeric `count` parameter.

## Runtime (`src/lib/i18n/`)

| File          | Role                                                                                  |
| ------------- | ------------------------------------------------------------------------------------- |
| `core.ts`     | `t`, `msg`, catalogues, active locale, subscribers, `sourceOf` (translation → source)  |
| `locales.ts`  | 24 locales: code, native/English name, direction, `Intl` tag                           |
| `runtime.ts`  | lazy `import.meta.glob` loaders, `bootI18n`, `activate`, `changeLocale`, `useLocale`   |
| `extract.ts`  | AST extraction of message IDs (test + `npm run i18n:extract`; never bundled)           |
| `locales/*.json` | 23 catalogues, one lazily loaded chunk each                                        |

Start-up (`main.tsx`): `bootI18n()` activates the saved language (plus the English fallback)
**before** `import('./app/App')`, so strings that modules build at import time (menus, labels,
column definitions) are already translated. Switching language saves `agentra-locale` and
reloads; if storage is blocked the locale switches in memory and `LocaleRoot` remounts the app.
`index.html` sets `lang`/`dir` before paint from the same key.

## Formatting

`formatVND/formatQuantity` keep exact decimal strings and only swap the group/decimal separators,
digits and `₫` position derived from `Intl.NumberFormat(locale).formatToParts`. Vietnamese keeps
the historical fixed output. Dates use `Intl.DateTimeFormat` numeric order (business dates in UTC
so they never shift). `chart.ts`, `CountUp` and the Portal date use the current `Intl` tag.

## RTL

Logical utilities (`ms/me/ps/pe/start/end/text-start/text-end/border-s/border-e/rounded-s/e`),
sidebar `side="right"`, guide sheet on the left, directional lucide arrows mirrored by one CSS
rule under `[dir='rtl']`.

## Translation workflow

`npm run i18n:extract` lists the sources; translators follow [GLOSSARY](GLOSSARY.md); a merge
script validates key coverage, placeholders and edge whitespace before writing a catalogue;
`i18n_catalogs.test.ts` enforces the same rules in CI.

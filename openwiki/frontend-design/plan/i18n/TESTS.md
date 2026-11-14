# Interface languages — tests

Every new function, component and hook has success, failure and boundary assertions.

| Symbol                                                     | File                     | Success / failure / boundary                                                         |
| ---------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------ |
| `t`, `msg`, `activateLocale`, `sourceOf`, plurals          | `i18n_core.test.ts`      | translate + params / missing catalogue throws / empty entry, NaN plural, null        |
| `LOCALES`, `localeDirection`, `intlTag`                    | `i18n_core.test.ts`      | 24 unique, Intl-valid / unknown code / exactly two RTL                                |
| `storedLocale`                                             | `i18n_runtime.test.tsx`  | saved code / unknown code → vi / storage throws → vi; browser language ignored       |
| `applyDocumentLocale`                                      | `i18n_runtime.test.tsx`  | `lang` + `dir` for LTR and RTL                                                       |
| `availableLocales`, `loadCatalog`, `activate`, `bootI18n`  | `i18n_runtime.test.tsx`  | English loads + fallback / unknown code, failing activation → vi / saved language    |
| `changeLocale`, `useLocale`                                | `i18n_runtime.test.tsx`  | save + reload / current or unknown → unchanged / storage blocked → in-memory switch  |
| `formatVND`, `formatQuantity`, `formatDate(Time)`, `currentIntl`, `chart.ts` | `i18n_runtime.test.tsx` | vi output unchanged, en/de separators / invalid date returned / beyond 2^53, native digits |
| `inferAction` with translated labels                       | `i18n_runtime.test.tsx`  | translated verb → icon / unknown label → null                                        |
| `navigation` built at import time                          | `i18n_runtime.test.tsx`  | translated group/route / untranslated → Vietnamese                                    |
| `LanguagePicker`                                           | `i18n_runtime.test.tsx`  | lists + applies / current choice is a no-op / no match message, RTL option `dir`     |
| `extractMessages`, `placeholders`                          | `i18n_catalogs.test.ts`  | > 2000 messages incl. errors / non-literal and foreign `t` ignored / duplicates      |
| 23 catalogues                                              | `i18n_catalogs.test.ts`  | every message translated / no extra keys / placeholders identical                    |

Gate (from `ui/`): `npm run lint`, `npm run typecheck`, `npm test`, `npm run format:check`,
`npm run build`; `npm run test:e2e` before release.

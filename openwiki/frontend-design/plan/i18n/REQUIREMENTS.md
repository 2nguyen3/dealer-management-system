# Interface languages — requirements

Source: `tmp/HANDOFF-huong-dan-ngon-ngu-portal.md` §4 and decisions U4, U5, A1–A4, A6.

| ID  | Requirement                                                                                                      | Evidence                                   |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| L1  | 24 interface languages (user decision, narrowed from §4.3), Vietnamese first and default; chosen in Settings and on the login screen          | `i18n_core` locale registry; picker tests  |
| L2  | Default is always Vietnamese; the browser language is never guessed                                               | `i18n_runtime` "defaults to Vietnamese…"   |
| L3  | Business data is never translated (names, wards, notes, reasons, document codes); money is always VND             | design rule; formatter tests               |
| L4  | Every interface string goes through `t()`/`msg()`; no Vietnamese literal outside them                            | codemod leftover scan; catalogue tests     |
| L5  | Every locale translates every message, keeps placeholders, has no extra keys                                     | `i18n_catalogs`                            |
| L6  | Every §3.3 error code has a Vietnamese and English text                                                           | `i18n_catalogs` (error messages extracted) |
| L7  | Catalogues load lazily; Vietnamese needs none                                                                     | build output (one chunk per locale)        |
| L8  | `lang`/`dir` follow the language before first paint; RTL for `ar` and `ur` without broken layout       | `i18n_runtime` document tests; browser     |
| L9  | Numbers/dates follow the language (`Intl`); the Vietnamese output stays exactly as before                        | `i18n_runtime` formatting tests            |
| L10 | Menu grouping and icons do not depend on translated text                                                          | navigation key; `inferAction` test         |
| L11 | Storage failure keeps the app working (Vietnamese, or in-memory switch)                                           | `i18n_runtime` storage tests               |
| L12 | Translations use the glossary; no "machine translation" notes                                                     | [GLOSSARY](GLOSSARY.md)                    |

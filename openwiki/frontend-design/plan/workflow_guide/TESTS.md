# Workflow guide — tests

Every new function, component and hook has success, failure and boundary assertions.

| Symbol                                       | File                        | Success / failure / boundary                                                     |
| -------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------- |
| `t`, `msg`, `activateLocale`, `sourceOf`     | `i18n_core.test.ts`         | translate + params / missing catalogue throws / empty entry, NaN plural, null    |
| `LOCALES`, `localeDirection`, `intlTag`      | `i18n_core.test.ts`         | 24 unique, Intl-valid / unknown code / exactly two RTL                            |
| `describeError`, `ERROR_TEXTS`, `ApiError`   | `i18n_core.test.ts`         | all 69 codes / unknown → null / untranslated hint falls back                     |
| `WorkflowSteps`                              | `guide_components.test.tsx` | states, roles, focus / — / empty list renders nothing                            |
| `NextActionCallout`                          | `guide_components.test.tsx` | link and in-page action / null / waitingFor hides the shortcut                   |
| `LockedButton`                               | `guide_components.test.tsx` | enabled click / locked, no click, sr reason / empty reason                       |
| `notifyNextStep`, `preferences`              | `guide_components.test.tsx` | toast + navigate / not allowed → no action / hints off, blank, storage throws    |
| `SafeLink`, `ErrorNotice`                    | `guide_components.test.tsx` | router navigation, override link / plain error / empty                           |
| `GUIDES`, `guideFor`, `GuideButton`, `GuideSheet` | `guide_components.test.tsx` | every route complete / unknown page / nested path                           |
| `workflows.ts` (all exports)                 | `guide_workflows.test.tsx`  | each state of each workflow / no rights → role / exact money beyond 2^53         |
| `useUpfrontState`                            | `guide_workflows.test.tsx`  | VERIFIED / failure or odd state → UNKNOWN / version reload, abort on unmount     |
| GoodsDocumentsPage + UpfrontPaymentsPage     | `guide_pages.test.tsx`      | lock + deep link / no verify rights / malformed id, replace warnings             |
| ProfilePage hint switch                      | `profile_guide.test.tsx`    | toggle persists / stored "off" / —                                               |

Gate (from `ui/`): `npm run lint`, `npm run typecheck`, `npm test`, `npm run format:check`,
`npm run build`; `npm run test:e2e` before release.

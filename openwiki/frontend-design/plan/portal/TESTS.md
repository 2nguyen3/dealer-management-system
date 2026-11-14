# Portal — tests

Every new function, component and hook has success, failure and boundary assertions.

| Symbol                                                    | File                         | Success / failure / boundary                                                            |
| --------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------- |
| `favoritableItems`, `isFavoritable`                       | `portal_favorites.test.ts`   | menu functions / Portal, AI assistant, profile, unknown rejected / no duplicates        |
| `defaultFavorites`                                        | `portal_favorites.test.ts`   | accounting and warehouse decks / never an unpermitted page / cap 8, open-to-all fallback |
| `parseFavorites`, `readFavorites`, `writeFavorites`       | `portal_favorites.test.ts`   | order kept, per user / malformed → never saved, storage throws / empty list, duplicates |
| `addFavorite`, `removeFavorite`, `moveFavorite`           | `portal_favorites.test.ts`   | add/remove/move / unfavouritable, unknown path, NaN / clamped at both ends              |
| `reorderVisible`, `resolveDeck`                           | `portal_favorites.test.ts`   | new order, hidden kept / unknown paths ignored / empty deck                             |
| `readPortalTab`, `writePortalTab`, `isPortalTab`          | `portal_favorites.test.ts`   | per user / unknown value, storage throws / no user                                      |
| `useFavorites`, `saveDeck`, `savedDeck`                   | `portal_page.test.tsx`       | toggle/move/remove/restore persist paths / storage blocked → memory / shared store      |
| `FavoritesDeck` (rows, picker, restore, hidden note)      | `portal_page.test.tsx`       | role defaults, keyboard reorder, picker add / lost permissions hidden / empty deck      |
| `HomePage` tabs and catalogue stars                       | `portal_page.test.tsx`, `home_page.test.tsx` | Cổng quản lý, star outside link, remembered tab / no rights / empty deck opens catalogue |
| `FavoriteButton`                                          | `portal_page.test.tsx`       | add/remove + toast / hidden on Portal, AI, profile, forbidden pages / no user           |

Gate (from `ui/`): `npm run lint`, `npm run typecheck`, `npm test`, `npm run format:check`,
`npm run build`; `npm run test:e2e` before release.

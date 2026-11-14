# Portal and favourites deck (2026-11-14)

Scope: frontend `ui/` only. The home page **Bàn làm việc** becomes **Cổng quản lý** (English
*Portal*); route `/` is unchanged. The page has two tabs: **Yêu thích** (a personal deck of
functions) and **Chức năng nghiệp vụ** (the existing catalogue grouped by work area).

Companion files: [REQUIREMENTS](REQUIREMENTS.md) · [DESIGN](DESIGN.md) · [TESTS](TESTS.md) ·
[CHECKLIST](CHECKLIST.md) · [VERIFICATION](VERIFICATION.md).

## Steps

1. Rename the label in `app/navigation.ts`, the shell brand `aria-label`, the Home heading,
   the tests and the demo script (scenes 1.1 and 9.3, `tmp/`, not committed).
2. `features/portal/favorites.ts`: stable route paths, per-user storage
   `agentra-favorites:<userId>`, defaults derived from permissions, pure list operations.
3. `features/portal/favoritesStore.ts` + `useFavorites`: one in-memory store shared by the page
   and the header button; storage failures keep the in-memory list.
4. `FavoriteButton` next to GUIDE on every favouritable page; `FavoritesDeck` with add picker,
   remove, keyboard up/down and drag (`motion` `Reorder.Group`), restore defaults, empty state
   and the "n functions no longer permitted" note.
5. `HomePage` tabs; the open tab is remembered per user (`agentra-portal-tab:<userId>`).
6. Translations of the new messages for all 47 catalogues.

Decision log: browser-only storage per user (handoff A5; no backend change); paths are stored,
never labels (labels change with the language); the AI assistant (`unavailable`) and the
Portal itself cannot be favourites.

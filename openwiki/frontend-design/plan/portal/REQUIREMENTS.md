# Portal — requirements

Source: `tmp/HANDOFF-huong-dan-ngon-ngu-portal.md` §5, decisions U6 and A5.

| ID  | Requirement                                                                                            | Evidence                    |
| --- | ------------------------------------------------------------------------------------------------------ | --------------------------- |
| P1  | "Bàn làm việc" is renamed "Cổng quản lý" (EN *Portal*) in the menu, shell brand label and heading      | `home_page`, `portal` tests |
| P2  | Two tabs: Yêu thích (default when the deck has items) and Chức năng nghiệp vụ                          | `portal` tests              |
| P3  | The open tab is remembered per user                                                                     | `portal` tests              |
| P4  | Add from a star on each catalogue card, the "Thêm vào yêu thích" button next to GUIDE and a picker      | `portal` tests              |
| P5  | Remove and reorder; reorder works by keyboard (up/down buttons) and by drag (`Reorder.Group`)           | `portal` tests              |
| P6  | Empty deck shows a hint; "Khôi phục mặc định" restores the role defaults                                | `portal` tests              |
| P7  | Role defaults are derived from permissions, never from the group name                                   | `favorites` unit tests      |
| P8  | Only permitted functions are shown; lost-permission entries are hidden with an "n functions" note       | `portal` tests              |
| P9  | The unavailable AI assistant and the Portal itself cannot be added                                     | `favorites` unit tests      |
| P10 | Stored per user as stable paths in `agentra-favorites:<userId>`; storage errors never break the page   | `favorites` unit tests      |

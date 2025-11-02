Notwendige Fixes und ToDos für den Kanban Editor
===============================================

- [ ] https://github.com/edufeed-org/kanban-editor/issues/10 (Refactoren so, dass alle Stores die geleiche Persistenz-Logik nutzen)
- [ ] https://github.com/edufeed-org/kanban-editor/issues/9 (Resizebale Sidebars funktionieren nicht mit mobilen Divices)
- [x] bei neu angelegten Cards wird der Autor /Attendees nicht angezeigt, bzw. erst nach dem neu laden. Reaktivität? (FIXED: Local state pattern für author/authorName/attendees implementiert)
- [x] das Popover für die Columns Optionen bleibt nach dem klicken auf die drei Punkte (PopoverTrigger) unsichtbar. Wenn ich eine Column verschiebe, wird es nach dem Klicken auf den PopoverTriger sichtbar. Console gibt eine Warnung aus: Fehler beim Verarbeiten des Wertes für 'z-index'.  Deklaration ignoriert. 
- [x] Beim Aufrufen der Seite wird ein default Board geladen aber nicht gespeichert, wenn keine Boards existieren. Das verhaltend ist irritierend. Besser wäre das ein echtes neues Board angelegt und gespeichert wird. Ausnahme: wenn der User nicht eingeloggt ist.
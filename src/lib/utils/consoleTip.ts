/**
 * consoleTip.ts
 * 
 * Zeigt Tipps in der Browser-Console beim App-Start
 */

// Registriere Tipps beim App-Start
if (typeof window !== 'undefined') {
	// Prüfe ob schon eine Nachricht gezeigt wurde
	const SHOWN_KEY = '__kanban_console_tip_shown';
	
	// Verzögere den Tip ein bisschen, damit andere Console-Outputs zuerst kommen
	setTimeout(() => {
		if (!sessionStorage.getItem(SHOWN_KEY)) {
			showConsoleTip();
			sessionStorage.setItem(SHOWN_KEY, 'true');
		}
	}, 500);
}

function showConsoleTip(): void {
	const tip = `
%c╔════════════════════════════════════════════════════════════════╗
║  🎯 KANBAN BOARD - DEMO-LOADER VERFÜGBAR!                      ║
╚════════════════════════════════════════════════════════════════╝

%cVerfügbare Console-Funktionen:

  %c▶ window.add_democontent()%c
    → Lädt Beispieldaten (3 Spalten, 8 Karten, 6 Kommentare)

  %c▶ window.reset_board()%c
    → Löscht alle Spalten & Karten

  %c▶ window.show_board()%c
    → Zeigt Übersicht aller Spalten

  %c▶ window.show_cards()%c
    → Zeigt Details aller Karten mit Kommentaren

  %c▶ window.count_board()%c
    → Zählt Spalten, Karten, Kommentare

%cBeispiel-Workflow:
  1. window.add_democontent()     // Daten laden
  2. window.count_board()         // Statistik anzeigen
  3. window.show_cards()          // Details sehen
  4. Karten verschieben im Board  // UI testen
  5. window.show_board()          // Update-Ergebnis sehen

%c⚡ REAKTIVITÄTS-TESTS (alles LIVE ohne Reload):
  • window.reactive_test()       // Ausführlicher Test
  • window.reactive_quick_test() // Schneller Test
  • window.debug_uidata()        // Aktuellen State sehen
  • window.watch_updates()       // Updates beobachten

%cMehr Infos: 
  • DEMO-LOADER-SETUP.md    // Demo-Loader Anleitung
  • REAKTIVITÄT.md           // Wie die Reaktivität funktioniert
%c
`;

	console.log(
		tip,
		'color: #00ff00; font-size: 12px; font-weight: bold;',
		'color: #ffffff; font-size: 11px;',
		'color: #ffff00; font-weight: bold;',
		'color: #ffffff;',
		'color: #ffff00; font-weight: bold;',
		'color: #ffffff;',
		'color: #ffff00; font-weight: bold;',
		'color: #ffffff;',
		'color: #ffff00; font-weight: bold;',
		'color: #ffffff;',
		'color: #ffff00; font-weight: bold;',
		'color: #ffffff;',
		'color: #00ff00; font-size: 10px;',
		''
	);
	
	// Kurze Alternative für schnelle Hilfe
	(window as any).help_demo = (): void => {
		console.log(`
📚 DEMO-LOADER HILFE:

Daten laden:
  window.add_democontent()      - Lädt 3 Spalten mit 8 Karten
  window.reset_board()          - Alles löschen

Debugging:
  window.show_board()           - Board-Übersicht
  window.show_cards()           - Karten mit Kommentaren
  window.count_board()          - Statistik

🚀 REAKTIVITÄTS-TESTS:
  window.reactive_test()        - Ausführlicher Test (mit Timing)
  window.reactive_quick_test()  - Schneller Test
  window.debug_uidata()         - Zeige aktuellen State
  window.watch_updates()        - Beobachte Updates

Dokumentation:
  DEMO-LOADER-SETUP.md - Demo-Loader Anleitung
  REAKTIVITÄT.md       - Wie die Reaktivität funktioniert
		`);
	};
	
	console.log('%c💡 Tipp: Gib window.help_demo() ein für schnelle Hilfe', 'color: #00ff00; font-style: italic;');
}

export {};

/**
 * reactiveTestLoader.ts
 * 
 * Test-Script um zu zeigen, dass die $effect Reaktivität funktioniert
 * 
 * Verwendung in Browser-Console:
 *   window.reactive_test()
 */

import { boardStore } from '../stores/kanbanStore.svelte.js';

/**
 * Interaktiver Test der Reaktivität ohne Reload
 * Zeigt wie Store-Änderungen sofort in der UI sichtbar werden
 */
export function reactive_test(): void {
	console.group('%c🧪 REAKTIVITÄTS-TEST - Beobachte die UI während dieses Tests!', 'color: #ff00ff; font-weight: bold; font-size: 14px');
	
	console.log(`%c📝 Test-Plan:
1. Wir werden eine neue Spalte erstellen
2. Eine Karte zur Spalte hinzufügen
3. Kommentar zur Karte hinzufügen
4. Spalten-Name ändern
5. Spalte/Karte löschen

Achte auf die UI - alle Änderungen sollten SOFORT sichtbar sein (ohne Reload)!`, 'color: #00ff00; font-size: 11px');

	try {
		// Schritt 1: Neue Spalte erstellen
		console.log('%c━━━ SCHRITT 1: Neue Spalte erstellen ━━━', 'color: #ffff00; font-weight: bold');
		const col = boardStore.addColumn({
			name: '🔬 REAKTIV Test-Spalte',
			color: 'chart-5'
		});
		console.log(`✅ Spalte erstellt: "${col.name}"`);
		console.log(`   ID: ${col.id}`);
		console.log(`   🎯 Schaue jetzt ins Board - die neue Spalte sollte RECHTS sichtbar sein!`);
		console.log(`   ⏱️  Warte 2 Sekunden bevor du weitermachst...`);

		// Warte 2 Sekunden, damit User die neue Spalte sehen kann
		const step1Wait = new Promise(resolve => setTimeout(resolve, 2000));

		step1Wait.then(() => {
			// Schritt 2: Karte zur Spalte hinzufügen
			console.log('%c━━━ SCHRITT 2: Karte zur Spalte hinzufügen ━━━', 'color: #ffff00; font-weight: bold');
			
			const card = col.addCard({
				heading: '🧪 Reaktivitäts-Test Karte',
				content: 'Diese Karte wurde LIVE hinzugefügt - ohne Reload!',
				color: 'chart-1',
				publishState: 'draft'
			});
			
			console.log(`✅ Karte erstellt: "${card.heading}"`);
			console.log(`   ID: ${card.id}`);
			console.log(`   🎯 Schaue ins Board - die Karte sollte SOFORT in der Test-Spalte auftauchen!`);
			console.log(`   ⏱️  Warte 2 Sekunden bevor du weitermachst...`);
			
			// Trigger Update damit uiData neu berechnet wird
			(boardStore as any)['triggerUpdate']?.();
			
			const step2Wait = new Promise(resolve => setTimeout(resolve, 2000));
			
			step2Wait.then(() => {
				// Schritt 3: Kommentar zur Karte hinzufügen
				console.log('%c━━━ SCHRITT 3: Kommentar zur Karte hinzufügen ━━━', 'color: #ffff00; font-weight: bold');
				
				card.addComment('Das ist ein Test-Kommentar - LIVE eingefügt!', 'tester@example.com');
				
				console.log(`✅ Kommentar hinzugefügt`);
				console.log(`   Kommentare auf dieser Karte: ${card.comments.length}`);
				console.log(`   🎯 Schaue die Karte an - Kommentar-Zähler sollte aktualisiert sein!`);
				console.log(`   ⏱️  Warte 1 Sekunde bevor du weitermachst...`);
				
				// Trigger Update
				(boardStore as any)['triggerUpdate']?.();
				
				const step3Wait = new Promise(resolve => setTimeout(resolve, 1000));
				
				step3Wait.then(() => {
					// Schritt 4: Spalten-Name ändern (über Store-Methode)
					console.log('%c━━━ SCHRITT 4: Spalten-Name ändern ━━━', 'color: #ffff00; font-weight: bold');
					
					const oldName = col.name;
					boardStore.updateColumn(col.id, { name: '✨ REAKTIV: Name wurde geändert!' });
					
					console.log(`✅ Spalten-Name geändert`);
					console.log(`   ALT: "${oldName}"`);
					console.log(`   NEU: "✨ REAKTIV: Name wurde geändert!"`);
					console.log(`   🎯 Schaue die Spalten-Überschrift an - sie sollte SOFORT aktualisiert sein!`);
					console.log(`   ⏱️  Warte 2 Sekunden bevor du weitermachst...`);
					
					const step4Wait = new Promise(resolve => setTimeout(resolve, 2000));
					
					step4Wait.then(() => {
						// Schritt 5: Spalte löschen
						console.log('%c━━━ SCHRITT 5: Test-Spalte löschen ━━━', 'color: #ffff00; font-weight: bold');
						
						boardStore.deleteColumnWithCards(col.id);
						
						console.log(`✅ Spalte "${col.name}" wurde gelöscht`);
						console.log(`   🎯 Die Test-Spalte sollte SOFORT aus dem Board verschwinden!`);
						
						// Finale Statistik
						console.log('%c━━━ ✅ TEST ABGESCHLOSSEN ━━━', 'color: #00ff00; font-weight: bold; font-size: 12px');
						console.log(`%c🎉 Wenn alle Änderungen SOFORT in der UI sichtbar waren (ohne Reload), funktioniert die Reaktivität korrekt!

Das ist die Grundlage für die Nostr-Integration:
• Nostr-Event empfangen
• boardStore.addColumn() / addCard() / addComment() aufrufen
• UI aktualisiert sich AUTOMATISCH
• Benutzer sieht die Änderung SOFORT

Das funktioniert weil:
1. boardStore.triggerUpdate() inkrementiert updateTrigger
2. updateTrigger ist eine \`$state\` Variable
3. boardStore.uiData ist \`$derived.by\` und reagiert auf updateTrigger
4. Column.svelte hat \`$effect\` der boardStore.uiData überwacht
5. Column.svelte aktualisiert items automatisch
6. Svelte rendert die UI neu

🚀 Bereit für Nostr-Live-Updates!`, 'color: #00ff00; font-size: 11px');
						console.groupEnd();
					});
				});
			});
		});

	} catch (error) {
		console.error('❌ Fehler im Test:', error);
		console.groupEnd();
		throw error;
	}
}

/**
 * Schneller Test: Nur Spalte + Karte, kein Timing
 */
export function reactive_quick_test(): void {
	console.log('%c⚡ Quick Reactive Test', 'color: #ff00ff; font-weight: bold');
	
	const col = boardStore.addColumn({ name: '⚡ Quick Test' });
	console.log('✅ Spalte erstellt - sollte SOFORT im Board sichtbar sein');
	
	const card = col.addCard({ 
		heading: 'Quick Test Card', 
		content: 'Sollte SOFORT erscheinen' 
	});
	(boardStore as any)['triggerUpdate']?.();
	console.log('✅ Karte erstellt - sollte SOFORT in der Spalte erscheinen');
	
	boardStore.deleteColumnWithCards(col.id);
	console.log('✅ Spalte gelöscht - sollte SOFORT verschwinden');
}

/**
 * Debug: Zeige den aktuellen uiData $derived Wert
 */
export function debug_uidata(): void {
	console.log('%c📊 boardStore.uiData (Reaktive Computed Value)', 'color: #00ff00; font-weight: bold');
	const data = boardStore.uiData;
	console.table(data.map((col: any) => ({
		'Spalte': col.name,
		'Spalten-ID': col.id,
		'Karten': col.items.length,
		'Karten-IDs': col.items.map((c: any) => c.id).join(', ')
	})));
	console.log('Vollständige uiData:', data);
}

/**
 * Debug: Beobachte updateTrigger Änderungen
 */
export function watch_updates(): void {
	console.log('%c👁️ Beobachte boardStore Updates', 'color: #ffff00; font-weight: bold');
	
	let lastTrigger = (boardStore as any)['updateTrigger'] ?? 0;
	let updateCount = 0;
	
	const watchInterval = setInterval(() => {
		const currentTrigger = (boardStore as any)['updateTrigger'] ?? 0;
		if (currentTrigger !== lastTrigger) {
			updateCount++;
			console.log(`%c${updateCount}. Update erkannt! updateTrigger: ${lastTrigger} → ${currentTrigger}`, 'color: #00ff00');
			lastTrigger = currentTrigger;
		}
	}, 100);
	
	console.log(`%cBeobachtung aktiv. Jede Änderung wird geloggt.
Zum Stoppen:
  clearInterval(${watchInterval})`, 'color: #ffff00');
	
	// Speichere interval ID im window für leichte Kontrolle
	(window as any).__updateWatchInterval = watchInterval;
}

/**
 * Registriere Funktionen im Window
 */
if (typeof window !== 'undefined') {
	(window as any).reactive_test = reactive_test;
	(window as any).reactive_quick_test = reactive_quick_test;
	(window as any).debug_uidata = debug_uidata;
	(window as any).watch_updates = watch_updates;
	
	console.log('%c✅ Reaktivitäts-Test-Funktionen registriert', 'color: #00ff00');
	console.log('Verfügbare Funktionen:');
	console.log('  • window.reactive_test()       - Ausführlicher Test mit Timing');
	console.log('  • window.reactive_quick_test() - Schneller Test');
	console.log('  • window.debug_uidata()        - Zeige aktuellen uiData');
	console.log('  • window.watch_updates()       - Beobachte Store-Updates');
}

export type {};

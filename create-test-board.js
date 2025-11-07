/**
 * Test-Board Erstellung - Browser Console Script
 * 
 * Kopiere diesen Code in die Browser Console und führe ihn aus:
 * 
 * 1. Öffne Chrome DevTools (F12)
 * 2. Gehe zum Console Tab
 * 3. Kopiere den gesamten Inhalt dieser Datei
 * 4. Füge ihn ein und drücke Enter
 */

(function createTestBoard() {
  console.log('🚀 Erstelle Test-Board mit Spalten und Karten...');
  
  try {
    // Zugriff auf BoardStore
    const { boardStore } = window;
    
    if (!boardStore) {
      console.error('❌ boardStore nicht verfügbar! Stelle sicher, dass du auf /cardsboard bist.');
      return;
    }
    
    console.log('✅ boardStore gefunden');
    
    // SCHRITT 1: Spalten erstellen
    console.group('📋 Erstelle Spalten...');
    
    const spalten = [
      { name: 'Materialsammlung', color: 'blue' },
      { name: 'Materialauswahl', color: 'purple' },
      { name: 'Einstieg', color: 'green' },
      { name: 'Erarbeitung', color: 'orange' },
      { name: 'Sicherung', color: 'red' }
    ];
    
    const spaltenIds = [];
    
    for (const spalte of spalten) {
      try {
        const spalteId = boardStore.createColumn(spalte.name);
        spaltenIds.push(spalteId);
        console.log(`✅ Spalte erstellt: "${spalte.name}" (ID: ${spalteId})`);
        
        // Farbe setzen (wenn BoardStore das unterstützt)
        const column = boardStore.findColumn(spalteId);
        if (column) {
          column.color = spalte.color;
        }
      } catch (err) {
        console.error(`❌ Fehler bei Spalte "${spalte.name}":`, err);
      }
    }
    
    console.groupEnd();
    
    // SCHRITT 2: Demo-Karten erstellen
    console.group('🎯 Erstelle Demo-Karten...');
    
    const karten = [
      // Materialsammlung
      {
        spalte: 0,
        titel: 'Video: Die Reformation einfach erklärt',
        beschreibung: 'YouTube-Video von MrWissen2go (10 Min)',
        labels: ['Video', 'Überblick']
      },
      {
        spalte: 0,
        titel: 'Arbeitsblatt: Martin Luther Steckbrief',
        beschreibung: 'PDF mit Lückentext zu Luthers Leben',
        labels: ['AB', 'Biografie']
      },
      {
        spalte: 0,
        titel: 'Bildquelle: 95 Thesen an Kirchentür',
        beschreibung: 'Historisches Gemälde für Präsentation',
        labels: ['Bild', 'Primärquelle']
      },
      
      // Materialauswahl
      {
        spalte: 1,
        titel: '✓ Video für Einstieg ausgewählt',
        beschreibung: 'MrWissen2go Video passt perfekt',
        labels: ['Ausgewählt', 'Einstieg']
      },
      {
        spalte: 1,
        titel: '✓ Arbeitsblatt für Erarbeitung',
        beschreibung: 'Lückentext als Gruppenarbeit',
        labels: ['Ausgewählt', 'Gruppenarbeit']
      },
      
      // Einstieg
      {
        spalte: 2,
        titel: 'Video zeigen (10 Min)',
        beschreibung: 'Beamer vorbereiten, YouTube ohne Werbung',
        labels: ['Plenum', 'Medien']
      },
      {
        spalte: 2,
        titel: 'Impulsfragen stellen',
        beschreibung: '1. Was wusstet ihr schon?\n2. Was hat euch überrascht?',
        labels: ['Gespräch']
      },
      
      // Erarbeitung
      {
        spalte: 3,
        titel: 'Gruppenarbeit: Luther-Steckbrief',
        beschreibung: '4er-Gruppen, 15 Min, Arbeitsblatt ausfüllen',
        labels: ['Gruppenarbeit', 'AB']
      },
      {
        spalte: 3,
        titel: 'Präsentation der Gruppen',
        beschreibung: 'Jede Gruppe stellt 2 Fakten vor',
        labels: ['Präsentation', 'Plenum']
      },
      
      // Sicherung
      {
        spalte: 4,
        titel: 'Tafelübersicht anfertigen',
        beschreibung: 'Gemeinsam Mindmap erstellen',
        labels: ['Tafel', 'Visualisierung']
      },
      {
        spalte: 4,
        titel: 'Hausaufgabe: Reflexion',
        beschreibung: 'Was würdet ihr heute anders machen?',
        labels: ['HA', 'Reflexion']
      }
    ];
    
    let kartenCount = 0;
    
    for (const karte of karten) {
      if (spaltenIds[karte.spalte]) {
        try {
          const karteId = boardStore.createCard(
            spaltenIds[karte.spalte],
            karte.titel,
            karte.beschreibung
          );
          
          kartenCount++;
          console.log(`✅ Karte ${kartenCount}: "${karte.titel}"`);
          
          // Labels hinzufügen (wenn möglich)
          if (karte.labels && karte.labels.length > 0) {
            const card = boardStore.findCardAndColumn(karteId)?.card;
            if (card) {
              card.labels = karte.labels;
            }
          }
          
        } catch (err) {
          console.error(`❌ Fehler bei Karte "${karte.titel}":`, err);
        }
      }
    }
    
    console.groupEnd();
    
    // SCHRITT 3: Trigger Update für Persistierung
    console.log('💾 Speichere Board...');
    // boardStore sollte automatisch speichern via triggerUpdate()
    
    console.log('');
    console.log('✨ Board-Erstellung abgeschlossen!');
    console.log(`📊 Statistik:`);
    console.log(`   - ${spalten.length} Spalten erstellt`);
    console.log(`   - ${kartenCount} Karten erstellt`);
    console.log('');
    console.log('🔄 Seite neu laden (F5) um Updates zu sehen');
    
  } catch (err) {
    console.error('❌ Fehler bei Board-Erstellung:', err);
  }
})();

// Alternative: Einzelne Befehle für manuelle Ausführung
console.log('');
console.log('📝 ALTERNATIVE: Einzelne Befehle:');
console.log('');
console.log('// 1. Spalte erstellen:');
console.log('boardStore.createColumn("Materialsammlung")');
console.log('');
console.log('// 2. Karte erstellen (spaltenId einfügen):');
console.log('boardStore.createCard("SPALTEN-ID", "Karten-Titel", "Beschreibung")');

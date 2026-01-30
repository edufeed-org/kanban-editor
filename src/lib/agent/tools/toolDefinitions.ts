/**
 * Tool Definitions für OpenAI Function Calling
 * MCP-Style Tool-Based AI Architecture
 * 
 * @see docs/FEATURE/TOOL-BASED-AI.md
 */

export interface ToolDefinition {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: {
            type: 'object';
            properties: Record<string, any>;
            required: string[];
        };
    };
}

/**
 * Alle verfügbaren Tools für den KI-Assistenten
 */
export const toolDefinitions: ToolDefinition[] = [
    // ═══════════════════════════════════════════════════════════════════
    // BOARD TOOLS
    // ═══════════════════════════════════════════════════════════════════
    {
        type: 'function',
        function: {
            name: 'populate_board',
            description: 'Befüllt das aktuelle Board mit Inhalt zu einem Thema. Setzt Titel, Beschreibung, erstellt passende Spalten und fügt Karten mit ausführlichem Inhalt hinzu. VERWENDEN wenn der Nutzer sagt: "erstelle ein Board zu...", "mach mir ein Board für...", "Board zum Thema...", "Unterrichtseinheit zu..."',
            parameters: {
                type: 'object',
                properties: {
                    title: {
                        type: 'string',
                        description: 'Neuer Titel für das Board'
                    },
                    description: {
                        type: 'string',
                        description: 'Beschreibung des Boards (Thema, Zielgruppe, Lernziele)'
                    },
                    columns: {
                        type: 'array',
                        description: 'Spalten mit Karten. Nutze vorhandene Spalten-Namen wenn passend, oder erstelle neue.',
                        items: {
                            type: 'object',
                            properties: {
                                name: { 
                                    type: 'string', 
                                    description: 'Spaltenname (z.B. "Einstieg", "Erarbeitung", "Material")' 
                                },
                                cards: {
                                    type: 'array',
                                    description: 'Karten für diese Spalte',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            heading: { 
                                                type: 'string',
                                                description: 'Kurzer Titel der Karte (5-10 Wörter)'
                                            },
                                            content: { 
                                                type: 'string',
                                                description: 'AUSFÜHRLICHER Inhalt mit Arbeitsanweisungen, Fragen, Materialien. PFLICHTFELD!'
                                            }
                                        },
                                        required: ['heading', 'content']
                                    }
                                }
                            },
                            required: ['name']
                        }
                    },
                    removeUnusedColumns: {
                        type: 'boolean',
                        description: 'Wenn true: Löscht alle Spalten die NICHT in columns[] genannt sind (inklusive Standard-Spalten wie "To Do"). Standardmäßig false.'
                    }
                },
                required: ['title', 'columns']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'update_board',
            description: 'Aktualisiert NUR die Metadaten des aktuellen Boards (Beschreibung, Tags). NICHT verwenden um Inhalt hinzuzufügen - dafür populate_board nutzen!',
            parameters: {
                type: 'object',
                properties: {
                    description: {
                        type: 'string',
                        description: 'Neue Beschreibung des Boards'
                    },
                    tags: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Tags/Kategorien für das Board'
                    }
                },
                required: []
            }
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    // COLUMN TOOLS
    // ═══════════════════════════════════════════════════════════════════
    {
        type: 'function',
        function: {
            name: 'add_column',
            description: 'Fügt eine neue Spalte zum aktuellen Board hinzu',
            parameters: {
                type: 'object',
                properties: {
                    name: {
                        type: 'string',
                        description: 'Name der neuen Spalte'
                    },
                    color: {
                        type: 'string',
                        enum: ['slate', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'],
                        description: 'Optionale Farbe der Spalte'
                    }
                },
                required: ['name']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'update_column',
            description: 'Benennt eine bestehende Spalte um',
            parameters: {
                type: 'object',
                properties: {
                    columnName: {
                        type: 'string',
                        description: 'Aktueller Name der Spalte (zur Identifikation)'
                    },
                    newName: {
                        type: 'string',
                        description: 'Neuer Name für die Spalte'
                    }
                },
                required: ['columnName', 'newName']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'delete_column',
            description: 'Löscht eine Spalte inkl. aller enthaltenen Karten. VORSICHT: Alle Karten werden gelöscht!',
            parameters: {
                type: 'object',
                properties: {
                    columnName: {
                        type: 'string',
                        description: 'Name der zu löschenden Spalte'
                    }
                },
                required: ['columnName']
            }
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    // CARD TOOLS
    // ═══════════════════════════════════════════════════════════════════
    {
        type: 'function',
        function: {
            name: 'add_card',
            description: 'Erstellt eine EINZELNE neue Karte in einer Spalte. IMMER verwenden wenn der Nutzer "eine Karte erstellen" möchte - NIEMALS create_board! WICHTIG: Immer content/description mitliefern!',
            parameters: {
                type: 'object',
                properties: {
                    heading: {
                        type: 'string',
                        description: 'Kurzer, prägnanter Titel der Karte (5-8 Wörter)'
                    },
                    columnName: {
                        type: 'string',
                        description: 'Name der Zielspalte (muss existieren)'
                    },
                    content: {
                        type: 'string',
                        description: 'PFLICHT! Ausführliche Beschreibung mit konkreten Arbeitsanweisungen, Materialien, Zeitangaben, erwarteten Ergebnissen. Nutze Markdown-Formatierung (**, \\n, Listen).'
                    },
                    labels: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Optionale Labels/Tags für die Karte'
                    }
                },
                required: ['heading', 'columnName', 'content']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'update_card',
            description: 'Aktualisiert eine bestehende Karte. Kann Titel, Inhalt, Labels, Links oder Bild ändern.',
            parameters: {
                type: 'object',
                properties: {
                    cardId: {
                        type: 'string',
                        description: 'ID oder Titel der Karte (zur Identifikation)'
                    },
                    heading: {
                        type: 'string',
                        description: 'Neuer Titel der Karte'
                    },
                    content: {
                        type: 'string',
                        description: 'Neue Beschreibung/Inhalt'
                    },
                    labels: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Neue Labels (ersetzt bestehende)'
                    },
                    links: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                url: { type: 'string' },
                                title: { type: 'string' }
                            },
                            required: ['url', 'title']
                        },
                        description: 'Links zur Karte hinzufügen'
                    },
                    image: {
                        type: 'string',
                        description: 'URL eines Bildes für die Karte'
                    }
                },
                required: ['cardId']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'move_card',
            description: 'Verschiebt eine Karte von einer Spalte in eine andere',
            parameters: {
                type: 'object',
                properties: {
                    cardId: {
                        type: 'string',
                        description: 'ID oder Titel der Karte'
                    },
                    fromColumn: {
                        type: 'string',
                        description: 'Name der aktuellen Spalte'
                    },
                    toColumn: {
                        type: 'string',
                        description: 'Name der Zielspalte'
                    }
                },
                required: ['cardId', 'fromColumn', 'toColumn']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'delete_card',
            description: 'Löscht eine Karte aus dem Board',
            parameters: {
                type: 'object',
                properties: {
                    cardId: {
                        type: 'string',
                        description: 'ID oder Titel der zu löschenden Karte'
                    }
                },
                required: ['cardId']
            }
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    // COMMENT TOOLS
    // ═══════════════════════════════════════════════════════════════════
    {
        type: 'function',
        function: {
            name: 'add_comment',
            description: 'Fügt einen Kommentar zu einer Karte hinzu',
            parameters: {
                type: 'object',
                properties: {
                    cardId: {
                        type: 'string',
                        description: 'ID oder Titel der Karte'
                    },
                    text: {
                        type: 'string',
                        description: 'Der Kommentar-Text'
                    }
                },
                required: ['cardId', 'text']
            }
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    // META TOOLS (Kommunikation)
    // ═══════════════════════════════════════════════════════════════════
    {
        type: 'function',
        function: {
            name: 'respond',
            description: 'Antwortet dem Nutzer OHNE eine Board-Aktion durchzuführen. Für Fragen, Erklärungen, Gespräche.',
            parameters: {
                type: 'object',
                properties: {
                    message: {
                        type: 'string',
                        description: 'Die Antwort an den Nutzer'
                    }
                },
                required: ['message']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'ask_clarification',
            description: 'Fragt den Nutzer nach mehr Details wenn die Anfrage unklar ist',
            parameters: {
                type: 'object',
                properties: {
                    question: {
                        type: 'string',
                        description: 'Die Rückfrage an den Nutzer'
                    }
                },
                required: ['question']
            }
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    // OER TOOLS (Open Educational Resources)
    // ═══════════════════════════════════════════════════════════════════
    {
        type: 'function',
        function: {
            name: 'search_oer',
            description: 'Sucht nach Open Educational Resources (OER) wie Lernmaterialien, Arbeitsblätter, Videos. Ergebnisse können dann mit add_cards_from_oer als Karten hinzugefügt werden.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Der Suchbegriff für OER-Materialien (z.B. "Bruchrechnung", "Photosynthese")'
                    },
                    source: {
                        type: 'string',
                        description: 'Optional: Spezifische OER-Quelle (z.B. "rpi-virtuell", "nostr-amb-relay"). Nutze list_oer_sources für verfügbare Quellen.'
                    },
                    sources: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Optional: Mehrere OER-Quellen (z.B. ["rpi-virtuell", "nostr-amb-relay"])'
                    },
                    educational_level: {
                        type: 'string',
                        description: 'Optional: Bildungsstufe (z.B. "Grundschule", "Sekundarstufe", "Oberstufe")'
                    },
                    limit: {
                        type: 'number',
                        description: 'Maximale Anzahl der Ergebnisse (default: 10, max: 20)'
                    }
                },
                required: ['query']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'add_cards_from_oer',
            description: 'Fügt OER-Materialien aus der letzten Suche als Karten zum Board hinzu. Erfordert vorherige search_oer Ausführung.',
            parameters: {
                type: 'object',
                properties: {
                    resultNumbers: {
                        type: 'array',
                        items: { type: 'number' },
                        description: 'Nummern der Suchergebnisse die hinzugefügt werden sollen (z.B. [1, 3, 5] für Ergebnis 1, 3 und 5)'
                    },
                    targetColumnId: {
                        type: 'string',
                        description: 'Optional: ID der Zielspalte. Falls nicht angegeben, wird eine "OER Materialien" Spalte erstellt oder verwendet.'
                    },
                    targetColumnName: {
                        type: 'string',
                        description: 'Optional: Name für neue Spalte falls targetColumnId nicht existiert (default: "OER Materialien")'
                    }
                },
                required: ['resultNumbers']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'list_oer_sources',
            description: 'Listet alle verfügbaren OER-Quellen auf (z.B. WirLernenOnline, OERSI). Nützlich um zu sehen, welche Quellen für search_oer verfügbar sind.',
            parameters: {
                type: 'object',
                properties: {},
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'search_oer_for_card',
            description: 'Sucht automatisch nach passenden OER-Materialien basierend auf einer bestehenden Karte. Extrahiert Suchbegriffe aus Titel, Beschreibung und Labels.',
            parameters: {
                type: 'object',
                properties: {
                    cardId: {
                        type: 'string',
                        description: 'ID der Karte, für die OER-Materialien gesucht werden sollen'
                    },
                    additionalTerms: {
                        type: 'string',
                        description: 'Optional: Zusätzliche Suchbegriffe'
                    },
                    maxResults: {
                        type: 'number',
                        description: 'Maximale Anzahl der Ergebnisse (default: 5)'
                    },
                    source: {
                        type: 'string',
                        description: 'Optional: Spezifische OER-Quelle'
                    }
                },
                required: ['cardId']
            }
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    // URL CONTENT IMPORT TOOL
    // ═══════════════════════════════════════════════════════════════════
    {
        type: 'function',
        function: {
            name: 'import_url_content',
            description: 'Importiert Inhalt von einer URL (Webseite, PDF, YouTube-Video) und erstellt automatisch Karten im Board. Strukturiert den Inhalt basierend auf Überschriften/Kapiteln. Ideal für: Artikel als Lernmaterial aufbereiten, PDFs in Karten umwandeln, YouTube-Transkripte importieren.',
            parameters: {
                type: 'object',
                properties: {
                    url: {
                        type: 'string',
                        description: 'Die URL zum Importieren (Webseite, PDF-Link, oder YouTube-Video URL)'
                    },
                    structureMode: {
                        type: 'string',
                        enum: ['auto', 'single-column', 'multi-column'],
                        description: 'Wie der Inhalt strukturiert werden soll: auto (intelligente Erkennung), single-column (alle Karten in eine Spalte), multi-column (Hauptabschnitte werden zu eigenen Spalten). Default: auto'
                    },
                    targetColumn: {
                        type: 'string',
                        description: 'Optional: Name einer bestehenden Spalte, in die importiert werden soll'
                    },
                    columnName: {
                        type: 'string',
                        description: 'Optional: Name für die neue Spalte (bei single-column). Default: "Import: [Titel]"'
                    },
                    maxCardLength: {
                        type: 'number',
                        description: 'Maximale Textlänge pro Karte in Zeichen. Längere Abschnitte werden gekürzt. Default: 2000'
                    }
                },
                required: ['url']
            }
        }
    }
];

/**
 * Gibt alle Tool-Definitionen zurück (für LLM-Request)
 */
export function getToolDefinitions(): ToolDefinition[] {
    return toolDefinitions;
}

/**
 * Findet eine Tool-Definition by Name
 */
export function getToolByName(name: string): ToolDefinition | undefined {
    return toolDefinitions.find(t => t.function.name === name);
}

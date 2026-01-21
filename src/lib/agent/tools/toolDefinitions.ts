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
            name: 'create_board',
            description: 'Erstellt ein komplett neues Kanban-Board mit optionalen Spalten und Karten. NUR verwenden wenn der Nutzer explizit ein NEUES BOARD möchte.',
            parameters: {
                type: 'object',
                properties: {
                    title: {
                        type: 'string',
                        description: 'Titel des neuen Boards'
                    },
                    description: {
                        type: 'string',
                        description: 'Optionale Beschreibung des Boards'
                    },
                    columns: {
                        type: 'array',
                        description: 'Optionale Spalten mit Karten',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string', description: 'Spaltenname' },
                                cards: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            heading: { type: 'string' },
                                            content: { type: 'string' }
                                        },
                                        required: ['heading']
                                    }
                                }
                            },
                            required: ['name']
                        }
                    }
                },
                required: ['title']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'update_board',
            description: 'Aktualisiert die Metadaten des aktuellen Boards (Beschreibung, Tags)',
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
            description: 'Erstellt eine EINZELNE neue Karte in einer Spalte. IMMER verwenden wenn der Nutzer "eine Karte erstellen" möchte - NIEMALS create_board!',
            parameters: {
                type: 'object',
                properties: {
                    heading: {
                        type: 'string',
                        description: 'Titel/Überschrift der Karte'
                    },
                    columnName: {
                        type: 'string',
                        description: 'Name der Zielspalte (muss existieren)'
                    },
                    content: {
                        type: 'string',
                        description: 'Optionale Beschreibung/Inhalt der Karte'
                    },
                    labels: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Optionale Labels/Tags für die Karte'
                    }
                },
                required: ['heading', 'columnName']
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

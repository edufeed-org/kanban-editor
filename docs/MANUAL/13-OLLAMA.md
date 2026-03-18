# 13 - Ollama lokal nutzen

**Ziel:** Nach diesem Kapitel koennen Sie Ollama auf Ihrem eigenen Rechner starten und mit dem Kanban-Board verbinden.

---

## Warum dieses Kapitel wichtig ist

Das Kanban-Board ist eine Browser-App. Es braucht keinen eigenen KI-Server vom Betreiber.

Stattdessen kann jede Person ihre eigene KI lokal auf dem eigenen Geraet nutzen, zum Beispiel mit Ollama.

Das bedeutet:

- Ihre KI laeuft lokal auf Ihrem Rechner
- Die App im Browser spricht direkt mit Ihrer lokalen Ollama-Instanz
- Sie behalten die Kontrolle ueber Modell, Hardware und Datenfluss

Wenn die App auf einer oeffentlichen Domain laeuft, zum Beispiel:

- `https://kanban.edufeed.org`

und Ollama lokal auf Ihrem Geraet laeuft, zum Beispiel:

- `http://localhost:11434`

dann muss Ollama diesen Browser-Origin ausdruecklich erlauben.

---

## Schnelluebersicht

Fuer das Kanban-Board brauchen Sie in den LLM-Einstellungen typischerweise:

| Feld | Wert |
|------|------|
| **Model Name** | z.B. `qwen3.5` |
| **Base URL** | `http://localhost:11434` |
| **API Key** | leer lassen |

Wenn die App auf einer oeffentlichen Domain geoeffnet ist, muss Ollama mit `OLLAMA_ORIGINS` neu gestartet werden.

---

## Vorbereitungen

1. Installieren Sie Ollama auf Ihrem Rechner.
2. Laden Sie ein Modell, zum Beispiel:

```bash
ollama pull qwen3.5
```

3. Stellen Sie sicher, dass Ollama lokal erreichbar ist:

```text
http://localhost:11434
```

Wenn dort im Browser eine Antwort wie `Ollama is running` erscheint, laeuft der Dienst.

---

## Windows

### Variante A: Schnelltest in PowerShell

```powershell
$env:OLLAMA_ORIGINS = "https://kanban.edufeed.org"
ollama serve
```

Das gilt nur fuer dieses PowerShell-Fenster.

### Variante B: Dauerhaft in Windows setzen

```powershell
setx OLLAMA_ORIGINS "https://kanban.edufeed.org"
```

Danach:

1. Ollama komplett beenden
2. Ollama neu starten
3. Browser-Seite neu laden

### Wenn Sie mehrere Origins erlauben wollen

```powershell
setx OLLAMA_ORIGINS "https://kanban.edufeed.org,http://localhost:5173,http://127.0.0.1:5173"
```

### CMD statt PowerShell

```cmd
set OLLAMA_ORIGINS=https://kanban.edufeed.org
ollama serve
```

Fuer dauerhaft:

```cmd
setx OLLAMA_ORIGINS "https://kanban.edufeed.org"
```

---

## macOS

### Terminal-Start fuer die aktuelle Sitzung

```bash
export OLLAMA_ORIGINS="https://kanban.edufeed.org"
ollama serve
```

### Dauerhaft in zsh setzen

```bash
echo 'export OLLAMA_ORIGINS="https://kanban.edufeed.org"' >> ~/.zshrc
source ~/.zshrc
```

### Dauerhaft in bash setzen

```bash
echo 'export OLLAMA_ORIGINS="https://kanban.edufeed.org"' >> ~/.bashrc
source ~/.bashrc
```

---

## Linux

### Terminal-Start fuer die aktuelle Sitzung

```bash
export OLLAMA_ORIGINS="https://kanban.edufeed.org"
ollama serve
```

### Dauerhaft ueber Shell-Profil

```bash
echo 'export OLLAMA_ORIGINS="https://kanban.edufeed.org"' >> ~/.bashrc
source ~/.bashrc
```

oder bei zsh:

```bash
echo 'export OLLAMA_ORIGINS="https://kanban.edufeed.org"' >> ~/.zshrc
source ~/.zshrc
```

### Wenn Ollama als systemd-Service laeuft

```bash
sudo systemctl edit ollama
```

Dann zum Beispiel:

```ini
[Service]
Environment="OLLAMA_ORIGINS=https://kanban.edufeed.org"
```

Danach:

```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

---

## Einstellungen im Kanban-Board

Oeffnen Sie:

- **Einstellungen**
- Tab **LLM**

Tragen Sie ein:

```text
Model Name: qwen3.5
Base URL: http://localhost:11434
API Key: leer
```

Andere Modelle wie `granite4` oder `glm 4.7` sind ebenfalls moeglich, wenn sie lokal installiert sind.

---

## So pruefen Sie, ob alles funktioniert

1. Starten Sie Ollama neu
2. Laden Sie die Kanban-App neu
3. Oeffnen Sie den KI-Assistenten
4. Senden Sie eine einfache Anfrage, zum Beispiel:

```text
Erstelle drei Karten fuer eine Unterrichtseinheit zum Thema Wasser.
```

---

## Haeufige Probleme

### Problem: CORS-Fehler im Browser

**Ursache:** Ollama erlaubt den Origin der App noch nicht.

**Loesung:**

1. `OLLAMA_ORIGINS` setzen
2. Ollama komplett neu starten
3. Browser neu laden

### Problem: `Ollama is running`, aber die App bekommt trotzdem Fehler

**Ursache:** Der Dienst laeuft, aber Browser-Zugriffe von der App-Domain sind nicht freigegeben.

**Loesung:** `OLLAMA_ORIGINS` korrekt setzen und neu starten.

### Problem: Modell nicht gefunden

```bash
ollama pull qwen3.5
```

### Problem: Falscher API-Key

Fuer lokales Ollama das Feld **API Key** leer lassen.

---

## Kurzfassung

- Ollama darf lokal auf dem Geraet des Nutzers laufen
- Die Browser-App spricht direkt mit `http://localhost:11434`
- Bei einer oeffentlichen App-URL muss Ollama den Origin erlauben
- `API Key` bleibt fuer Ollama leer

---

## Weiterfuehrende Links

| Thema | Link |
|-------|------|
| Einstellungen | [12 - Einstellungen](./12-EINSTELLUNGEN.md) |
| Handbuch-Start | [README](./README.md) |
| Technische Doku fuer Settings | [SettingsStore](../ARCHITECTURE/STORES/SETTINGSSTORE.md) |

---

**Zeit:** ⏱️ ~5 Minuten
# Fehlerbehebung

## Website-Build scheitert an `/_version`

Meldung im Build-Log bei `ADD ${PUBLIC_IMAGE_BASE_URL}/_version`, z. B. ein Download- oder DNS-Fehler.

- Läuft der Bildserver? `https://images.mathisheck.de/_version` im Browser öffnen.
- Antwortet er mit 503, ist der Indexer noch beim ersten Scan. Einige Sekunden warten und erneut deployen.
- Läuft der Bildserver unter einer anderen Adresse, bei der Website das Build-Argument `PUBLIC_IMAGE_BASE_URL` setzen.
- Beim allerersten Deployment: zuerst den Bildserver deployen, dann die Website.

## Website-Build scheitert an `_index.json`

Meldung `Could not load https://images.mathisheck.de/_index.json: HTTP <status>`.

- `502` oder `504`: nginx erreicht den Indexer nicht. Im Compose-Service in Dokploy die Logs von `indexer` prüfen und den Service neu deployen.
- `503`: erster Scan läuft noch, erneut deployen.
- `404`: falsche Adresse in `PUBLIC_IMAGE_BASE_URL` (z. B. mit zusätzlichem Pfad).

## `Image "..." not found in src/assets and PUBLIC_IMAGE_BASE_URL is not set.`

Der Build lief ohne `PUBLIC_IMAGE_BASE_URL` und die Datei fehlt in `src/assets/`.

- Lokal: `.env` aus `.env.example` anlegen oder die Fotos nach `src/assets/` kopieren.
- In Docker: tritt nicht auf, weil das `DOCKERFILE` einen Standardwert setzt. Wurde das Build-Argument leer übergeben, entfernen.

## Build bricht bei einem Cover ab

Das Cover aus `src/data/series.json` (Feld `cover`) fehlt auf dem Bildserver. Prüfen, ob `https://images.mathisheck.de/cover/<datei>` erreichbar ist, und Dateiname inklusive Groß-/Kleinschreibung vergleichen.

## Hochgeladenes Foto erscheint nicht

1. **In der Bildliste?** `https://images.mathisheck.de/_index.json` öffnen. Der Indexer scannt alle 30 Sekunden.
   - Nicht enthalten: Endung prüfen (`.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`), Datei liegt direkt im Serienordner (nicht in einem Unterordner), Name beginnt nicht mit `.`.
2. **Abrufbar?** `https://images.mathisheck.de/<ordner>/<datei>` öffnen.
   - 403: Dateirechte. FileBrowser Quantum legt Dateien mit `644` an. Wurden Dateien auf anderem Weg ins Volume kopiert, auf dem Server die Rechte korrigieren:

     ```sh
     docker run --rm -v <volume-name>:/data alpine sh -c 'chmod -R a+rX /data'
     ```

3. **Ordner in `series.json`?** Nur Ordner, die in `src/data/series.json` als `folder` eingetragen sind, erscheinen auf der Website.
4. **Rebuild gelaufen?** Siehe nächster Abschnitt. Der Rebuild startet erst `QUIET_SECONDS` (Standard 120) nach der letzten Änderung.

## Kein automatischer Rebuild

Logs des `indexer` im Compose-Service ansehen:

| Log-Zeile | Bedeutung |
| :--- | :--- |
| `photos changed (...)` | Änderung erkannt |
| `photos changed, DOKPLOY_* not set – redeploy the website manually` | Variablen fehlen. `DOKPLOY_URL`, `DOKPLOY_API_KEY`, `DOKPLOY_APPLICATION_ID` setzen und Bildserver neu deployen |
| `redeploy requested: HTTP 200` | Rebuild angestoßen |
| `redeploy requested: HTTP 401` | API-Key falsch oder gelöscht. Neuen Key unter **Profile → API/CLI** erzeugen |
| `redeploy requested: HTTP 400` / `404` | Application-ID falsch, oder `DOKPLOY_URL` enthält einen Pfad |
| `redeploy failed: ...` | Dokploy nicht erreichbar. `DOKPLOY_URL` prüfen (mit `https://`, ohne abschließenden Schrägstrich) |

Kommt gar keine `photos changed`-Zeile, hat sich aus Sicht des Indexers nichts geändert (z. B. Upload in einen Unterordner).

## Admin-Passwort vergessen

Im Compose-Service unter **Environment** `FILEBROWSER_ADMIN_PASSWORD` auf ein neues Passwort (mindestens 10 Zeichen) setzen und neu deployen. Das Passwort wird bei jedem Start übernommen. Benutzername ist `admin`.

## Neue Fotos auf dem Server, Website zeigt alten Stand

Der Docker-Cache wird über `ADD ${PUBLIC_IMAGE_BASE_URL}/_version` ungültig, sobald sich `/_version` ändert.

- `https://images.mathisheck.de/_version` vor und nach dem Upload vergleichen. Ändert sich der Wert nicht, hat der Indexer die Datei nicht erfasst (siehe oben).
- Im Build-Log muss `npm run build` ausgeführt und nicht als `CACHED` markiert sein.
- Browser-Cache: Seite mit Strg+Umschalt+R neu laden.

## Domain nicht erreichbar oder Zertifikatsfehler

- DNS prüfen: `nslookup images.mathisheck.de` muss die Server-IP liefern.
- In Dokploy unter **Domains** HTTPS mit Let's Encrypt aktivieren. Das Zertifikat wird erst ausgestellt, wenn DNS korrekt auf den Server zeigt. Danach den Service neu deployen.
- Port in der Domain-Einstellung muss `80` sein (gilt für `images`, `upload` und die Website).
- Domain beim richtigen Service eingetragen? `images` und `upload` sind zwei getrennte Einträge im selben Compose-Service.

## Compose-Service startet nicht

- `set FILEBROWSER_ADMIN_PASSWORD in the Dokploy environment`: Variable fehlt, siehe [Deployment](deployment-dokploy.md#2-bildserver-anlegen).
- `network dokploy-network declared as external, but could not be found`: tritt nur außerhalb von Dokploy auf. Lokal mit `docker network create dokploy-network` anlegen.

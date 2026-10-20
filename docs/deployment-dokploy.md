# Deployment mit Dokploy

In Dokploy laufen zwei Dienste:

1. **Bildserver** als Compose-Service aus `image-server/docker-compose.yml`
2. **Website** als Application aus dem `DOCKERFILE` in der Repository-Wurzel

Reihenfolge: zuerst den Bildserver einrichten und mit Fotos befüllen, dann die Website deployen. Der Website-Build lädt `https://images.mathisheck.de/_version` und `/_index.json` und bricht ab, wenn der Bildserver nicht erreichbar ist.

## 1. DNS

Beim Domain-Anbieter zwei Einträge auf die IP-Adresse des Dokploy-Servers anlegen:

| Name | Typ | Ziel |
| :--- | :--- | :--- |
| `images.mathisheck.de` | A (und ggf. AAAA) | IP des Servers |
| `upload.mathisheck.de` | A (und ggf. AAAA) | IP des Servers |

Andere Namen sind möglich. Dann muss die Website mit dem Build-Argument `PUBLIC_IMAGE_BASE_URL` gebaut werden (siehe Schritt 4).

## 2. Bildserver anlegen

1. Im Projekt **Create Service → Compose** wählen.
2. **General**:
   - Provider: GitHub, Repository `mathistrd/mathisheck.de`
   - Branch: der Branch mit `image-server/` (nach dem Merge `main`)
   - Compose Path: `image-server/docker-compose.yml`
3. **Environment**:

   ```
   FILEBROWSER_ADMIN_PASSWORD=<mindestens 10 Zeichen>
   ```

   Pflicht. Ohne diese Variable startet der Compose-Service nicht (Meldung `set FILEBROWSER_ADMIN_PASSWORD in the Dokploy environment`).

   Optional für den automatischen Rebuild (siehe Schritt 5):

   ```
   DOKPLOY_URL=https://<adresse-deiner-dokploy-instanz>
   DOKPLOY_API_KEY=<api-key>
   DOKPLOY_APPLICATION_ID=<application-id-der-website>
   QUIET_SECONDS=120
   ```

4. **Domains**, zwei Einträge:

   | Service | Host | Port | HTTPS |
   | :--- | :--- | :--- | :--- |
   | `images` | `images.mathisheck.de` | 80 | an (Let's Encrypt) |
   | `upload` | `upload.mathisheck.de` | 80 | an (Let's Encrypt) |

   Traefik-Labels und Netzwerke ergänzt Dokploy selbst. `images` und `upload` hängen bereits am Netzwerk `dokploy-network`, der `indexer` bleibt intern.
5. **Deploy** klicken.

Prüfen:

- `https://upload.mathisheck.de` zeigt die Login-Seite.
- `https://images.mathisheck.de/_index.json` liefert `{"version":"...","folders":{}}`.

## 3. Vorhandene Fotos hochladen

1. `https://upload.mathisheck.de` öffnen, anmelden mit Benutzer `admin` und dem Passwort aus `FILEBROWSER_ADMIN_PASSWORD`.
2. Diese Ordner mit ihren Fotos hochladen (die Ordner aus dem bisherigen `src/assets/`):

   ```
   cover/          astro.jpg, blackandwhite.jpg, color.jpg, concert.jpg, street.jpg
   street/
   color/
   blackandwhite/
   astro/
   concert/
   ```

3. `https://images.mathisheck.de/_index.json` prüfen: alle Ordner mit ihren Dateien müssen aufgelistet sein.

Der Indexer scannt alle 30 Sekunden. Ein neues Foto erscheint also spätestens nach etwa 30 Sekunden in der Liste.

## 4. Website anlegen bzw. umstellen

1. Bestehende Application öffnen oder **Create Service → Application** wählen.
2. **General**:
   - Provider: GitHub, Repository `mathistrd/mathisheck.de`, Branch wie oben
   - Build Type: **Dockerfile**
   - Docker File: `DOCKERFILE` (großgeschrieben, so heißt die Datei im Repository)
   - Docker Context Path: `.`
3. **Environment → Build-time Arguments**: nur nötig, wenn der Bildserver nicht unter `https://images.mathisheck.de` läuft:

   ```
   PUBLIC_IMAGE_BASE_URL=https://<deine-bild-domain>
   ```

   Der Standardwert steht im `DOCKERFILE`.
4. **Domains**: `mathisheck.de` (und ggf. `www.mathisheck.de`), Port 80.
5. **Deploy** klicken.

Im Build-Log erscheinen Zeilen wie `▶ /_astro/mathisheck-...webp`. Das sind die optimierten Bilder.

## 5. Automatischer Rebuild nach Uploads

Der Indexer ruft nach Änderungen die Dokploy-API auf:

```
POST <DOKPLOY_URL>/api/application.deploy
x-api-key: <DOKPLOY_API_KEY>
{"applicationId": "<DOKPLOY_APPLICATION_ID>"}
```

Einrichtung:

1. **API-Key erzeugen:** in Dokploy oben rechts auf das Profil, dann **Profile → API/CLI**, neuen Key erzeugen und sofort kopieren (er wird nur einmal angezeigt).
2. **Application-ID finden:** die Website-Application in Dokploy öffnen. Die ID ist der letzte Teil der Adresse in der Browserzeile (eine zufällige Zeichenkette).
3. Beim Bildserver unter **Environment** `DOKPLOY_URL`, `DOKPLOY_API_KEY` und `DOKPLOY_APPLICATION_ID` eintragen. `DOKPLOY_URL` ist die Adresse, unter der du Dokploy im Browser öffnest, ohne Pfad und ohne abschließenden Schrägstrich.
4. Bildserver neu deployen.

Ablauf danach: Der Indexer bemerkt eine Änderung beim nächsten Scan (alle 30 Sekunden). Der Rebuild startet, wenn danach `QUIET_SECONDS` lang (Standard 120) nichts mehr geändert wurde. Wer viele Fotos auf einmal hochlädt, löst so nur einen Rebuild aus.

Ohne diese Variablen schreibt der Indexer ins Log `photos changed, DOKPLOY_* not set – redeploy the website manually`. Dann bei der Website-Application auf **Deploy** klicken.

## 6. Prüfliste

- [ ] DNS für `images` und `upload` zeigt auf den Server
- [ ] Bildserver läuft, `https://upload.mathisheck.de` zeigt die Login-Seite
- [ ] Login mit `admin` und `FILEBROWSER_ADMIN_PASSWORD` funktioniert
- [ ] `https://images.mathisheck.de/_index.json` listet alle Ordner
- [ ] `https://images.mathisheck.de/cover/street.jpg` zeigt das Cover
- [ ] Website-Build läuft durch, Build-Log zeigt optimierte `.webp`-Dateien
- [ ] Alle Serienseiten unter `https://mathisheck.de/images/<slug>` zeigen ihre Fotos
- [ ] Testfoto hochladen: Indexer-Log zeigt `photos changed` und nach etwa 2 bis 3 Minuten `redeploy requested: HTTP 200`, danach ist das Foto auf der Website

## 7. Sicherung der Fotos

Die Fotos liegen im Docker-Volume `photos` des Compose-Service. Dokploy stellt dem Namen das App-Kürzel voran. Den genauen Namen auf dem Server ermitteln:

```sh
docker volume ls | grep photos
```

**Mit Dokploy:** im Compose-Service unter **Volume Backups** eine Sicherung des Volumes auf ein eingerichtetes S3-Ziel planen.

**Manuell auf dem Server:**

```sh
# Sicherung nach ./photos-backup.tar.gz
docker run --rm -v <volume-name>:/data:ro -v "$PWD":/backup alpine \
  tar czf /backup/photos-backup.tar.gz -C /data .

# Wiederherstellung
docker run --rm -v <volume-name>:/data -v "$PWD":/backup alpine \
  tar xzf /backup/photos-backup.tar.gz -C /data
```

Das Volume `filebrowser-data` enthält nur die Datenbank von FileBrowser Quantum. Es muss nicht gesichert werden, das Admin-Passwort wird bei jedem Start aus `FILEBROWSER_ADMIN_PASSWORD` gesetzt.

## 8. Updates

- **Website-Code:** Änderungen pushen, Dokploy baut automatisch (bei aktiviertem Auto-Deploy) oder per **Deploy**.
- **Bildserver:** Änderungen in `image-server/` pushen und den Compose-Service neu deployen. Die Volumes bleiben erhalten.
- **FileBrowser Quantum:** Version in `image-server/filebrowser/Dockerfile` anpassen (`FROM gtstef/filebrowser:<version>-stable-slim`), vorher die Release Notes prüfen.
- **nginx / Node:** Versionen in `image-server/nginx/Dockerfile` (`nginx:1.29-alpine`) und `image-server/indexer/Dockerfile` (`node:22-alpine`) anpassen.

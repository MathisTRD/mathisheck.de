# Entwicklung

## Voraussetzungen

- Node.js 22.12 oder neuer (`engines` in `package.json`)
- npm
- Optional: Docker mit Compose, um den Bildserver lokal zu starten

## Einrichtung

```sh
npm ci
```

| Befehl            | Wirkung                                                  |
| :---------------- | :------------------------------------------------------- |
| `npm run dev`     | Entwicklungsserver auf `http://localhost:4321`           |
| `npm run build`   | Statische Seite nach `./dist/` bauen                     |
| `npm run preview` | Inhalt von `./dist/` lokal ausliefern                    |

## Bildquelle wählen

### Variante A: Bildserver (`.env`)

```sh
cp .env.example .env
```

`.env` enthält:

```
PUBLIC_IMAGE_BASE_URL=https://images.mathisheck.de
```

Die Seite lädt Bildliste und Fotos vom Bildserver. `.env` ist in `.gitignore`.

### Variante B: lokale Bilder

Ohne `.env` bzw. ohne `PUBLIC_IMAGE_BASE_URL` liest die Seite Fotos aus `src/assets/`, in derselben Ordnerstruktur wie auf dem Bildserver:

```
src/assets/
├── cover/street.jpg, color.jpg, blackandwhite.jpg, astro.jpg, concert.jpg
├── street/...
├── color/...
├── blackandwhite/...
├── astro/...
└── concert/...
```

`src/assets/` ist in `.gitignore` und wird nicht committet. Fehlt ein Cover, bricht der Build mit `Image "cover/street.jpg" not found in src/assets and PUBLIC_IMAGE_BASE_URL is not set.` ab.

Die Auswahl passiert in `src/lib/images.ts` (`listFolder`, `resolveImage`).

## Bildserver lokal starten

Die Compose-Datei ist für Dokploy gebaut: Sie erwartet das externe Netzwerk `dokploy-network` und gibt keine Ports nach außen frei. Für lokale Tests:

1. Netzwerk anlegen (einmalig):

   ```sh
   docker network create dokploy-network
   ```

2. Außerhalb des Repositorys eine Override-Datei anlegen, z. B. `~/mathisheck-local/compose.override.yml`:

   ```yaml
   services:
     images:
       ports:
         - "8081:80"
     upload:
       ports:
         - "8082:80"
     indexer:
       environment:
         QUIET_SECONDS: "5"
   ```

3. Starten:

   ```sh
   cd image-server
   export FILEBROWSER_ADMIN_PASSWORD='lokales-passwort-123'
   docker compose -p mathisheck-images -f docker-compose.yml -f ~/mathisheck-local/compose.override.yml up -d --build
   ```

4. Vorhandene Fotos ins Volume kopieren (optional):

   ```sh
   docker run --rm -v mathisheck-images_photos:/dst -v "$PWD/../src/assets":/src:ro alpine cp -r /src/. /dst/
   ```

5. Testen:
   - Upload-Oberfläche: `http://localhost:8082` (Benutzer `admin`)
   - Bildliste: `http://localhost:8081/_index.json`
   - Website gegen den lokalen Bildserver bauen:

     ```sh
     PUBLIC_IMAGE_BASE_URL=http://localhost:8081 npm run build
     ```

6. Beenden und aufräumen:

   ```sh
   docker compose -p mathisheck-images -f docker-compose.yml -f ~/mathisheck-local/compose.override.yml down -v
   ```

   `-v` löscht auch die Volumes mit den Fotos.

Ohne `DOKPLOY_*`-Variablen löst der Indexer keinen Rebuild aus und schreibt nur einen Hinweis ins Log (`docker compose -p mathisheck-images logs indexer`).

### Indexer-Variablen

| Variable | Standard | Bedeutung |
| :--- | :--- | :--- |
| `PHOTOS_DIR` | `/srv/photos` | Verzeichnis mit den Fotos |
| `PORT` | `8080` | Port für `/_index.json` und `/_version` |
| `SCAN_SECONDS` | `30` | Abstand zwischen zwei Scans |
| `QUIET_SECONDS` | `120` | Wartezeit nach der letzten Änderung bis zum Rebuild |
| `DOKPLOY_URL` | leer | Adresse der Dokploy-Instanz |
| `DOKPLOY_API_KEY` | leer | API-Key für Dokploy |
| `DOKPLOY_APPLICATION_ID` | leer | Application-ID der Website |

In `docker-compose.yml` werden nur `QUIET_SECONDS` und die `DOKPLOY_*`-Variablen durchgereicht. Die übrigen gelten mit ihrem Standardwert.

## Website-Docker-Image lokal bauen

```sh
docker build -f DOCKERFILE --build-arg PUBLIC_IMAGE_BASE_URL=https://images.mathisheck.de -t mathisheck-site .
docker run --rm -p 8080:80 mathisheck-site
```

Der Bildserver muss erreichbar sein, sonst scheitert `ADD ${PUBLIC_IMAGE_BASE_URL}/_version`. Für einen lokalen Bildserver auf `localhost:8081` zusätzlich `--network host` angeben und `PUBLIC_IMAGE_BASE_URL=http://localhost:8081` setzen.

## Seiten

| Datei | Adresse | Inhalt |
| :--- | :--- | :--- |
| `src/pages/index.astro` | `/` | Startseite mit Porträt (`public/bio.png`) |
| `src/pages/images.astro` | `/images` | Übersicht aller Serien mit Cover |
| `src/pages/images/[slug].astro` | `/images/<slug>` | Galerie einer Serie, Lightbox mit Pfeiltasten, Escape und Wischgesten |
| `src/pages/contact.astro` | `/contact` | Kontakt (E-Mail, Instagram) |
| `src/pages/impressum.astro` | `/impressum` | Impressum |

Alle Seiten nutzen `src/layouts/BaseLayout.astro` (Kopf, Schriften, Meta-Tags) und `src/components/SiteHeader.astro` (Navigation, Mobilmenü unter 800 px Breite).

## Styling

- `src/styles/global.css` enthält das gesamte Styling. Es bindet Tailwind CSS 4 über `@import "tailwindcss";` ein, das Layout ist aber überwiegend eigenes CSS.
- Seitenspezifische Anpassungen stehen in `<style>`-Blöcken der jeweiligen `.astro`-Datei.
- Schriften (Plus Jakarta Sans, Zodiak von Fontshare, Nunito Sans von Google Fonts) werden in `BaseLayout.astro` per `<link>` geladen.
- Wichtige Umbrüche: 900 px (Hero einspaltig), 800 px (Mobilmenü), 700 px (Serienkarten untereinander, Galerie einspaltig), 480 px (kleinere Schriften).
- Startseite, Kontakt und Impressum füllen die Höhe des Fensters und zentrieren den Inhalt vertikal. Ist das Fenster zu niedrig, wird gescrollt.

Nach Layout-Änderungen alle Seiten in mehreren Breiten prüfen, mindestens 1440, 1024, 820, 390 und 375 px sowie ein Handy im Querformat (667 x 375).

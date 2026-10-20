# mathisheck.de

Fotografie-Portfolio von Mathis Heck. Statische Website mit Astro, die Fotos liegen nicht im Repository, sondern auf einem eigenen Bildserver, der zusammen mit der Website über Dokploy betrieben wird.

## Technik

- **Website:** Astro 6, Tailwind CSS 4, ausgeliefert als statische Seiten über nginx (`DOCKERFILE`)
- **Bildserver** (`image-server/`):
  - `images`: nginx, liefert die Fotos aus (z. B. `images.mathisheck.de`)
  - `upload`: FileBrowser Quantum, Weboberfläche zum Hochladen (z. B. `upload.mathisheck.de`)
  - `indexer`: Node-Dienst, erzeugt die Bildliste `/_index.json` und löst nach Änderungen einen Rebuild der Website in Dokploy aus
- **Hosting:** Dokploy (Website als Application, Bildserver als Compose-Service)

Fotos werden beim Build von Astro heruntergeladen und in optimierte WebP-Varianten umgewandelt. Besucher laden nur diese verkleinerten Dateien von der Website.

## Schnellstart

Voraussetzung: Node.js 22.12 oder neuer.

```sh
npm ci
```

**Mit Bildserver** (empfohlen):

```sh
cp .env.example .env    # PUBLIC_IMAGE_BASE_URL=https://images.mathisheck.de
npm run dev             # http://localhost:4321
```

**Mit lokalen Bildern** (ohne `.env`): Fotos nach `src/assets/<ordner>/` legen, z. B. `src/assets/street/foto.jpg` und `src/assets/cover/street.jpg`. Der Ordner ist in `.gitignore` und wird nicht committet.

```sh
npm run dev
```

| Befehl            | Wirkung                                        |
| :---------------- | :--------------------------------------------- |
| `npm run dev`     | Entwicklungsserver auf `localhost:4321`        |
| `npm run build`   | Statische Seite nach `./dist/` bauen           |
| `npm run preview` | Gebaute Seite lokal ansehen                    |

## Dokumentation

- [Architektur](docs/architektur.md): Komponenten, Datenfluss, Aufbau des Repositorys
- [Deployment mit Dokploy](docs/deployment-dokploy.md): Einrichtung von Bildserver und Website
- [Bilder verwalten](docs/bilder-verwalten.md): Fotos hochladen, löschen, neue Serien anlegen
- [Entwicklung](docs/entwicklung.md): lokale Entwicklung, Bildserver lokal starten, Styling
- [Fehlerbehebung](docs/fehlerbehebung.md): häufige Probleme und Lösungen

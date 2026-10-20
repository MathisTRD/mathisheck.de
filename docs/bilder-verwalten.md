# Bilder verwalten

Fotos werden über `https://upload.mathisheck.de` verwaltet. Anmeldung: Benutzer `admin`, Passwort aus der Dokploy-Variable `FILEBROWSER_ADMIN_PASSWORD`.

## Ordner

| Ordner | Inhalt | Seite |
| :--- | :--- | :--- |
| `cover/` | ein Coverbild pro Serie | `/images` |
| `street/` | Serie Street | `/images/street` |
| `color/` | Serie Color | `/images/color` |
| `blackandwhite/` | Serie BlackAndWhite | `/images/blackandwhite` |
| `astro/` | Serie Astro | `/images/astro` |
| `concert/` | Serie Concerts | `/images/concerts` |

Welcher Ordner zu welcher Seite gehört, steht in `src/data/series.json` (Feld `folder`). Ordner und Seitenadresse können verschieden heißen, z. B. Ordner `concert`, Adresse `/images/concerts`.

## Fotos hinzufügen

1. Auf `upload.mathisheck.de` in den Ordner der Serie wechseln.
2. Fotos hochladen (Schaltfläche oder per Drag-and-Drop).
3. Warten. Der Indexer bemerkt die Änderung innerhalb von 30 Sekunden. Gibt es danach 120 Sekunden lang (`QUIET_SECONDS`) keine weitere Änderung, startet Dokploy den Rebuild. Der Build dauert je nach Anzahl neuer Fotos ein bis wenige Minuten.
4. Die Fotos sind auf der Website.

Ist der automatische Rebuild nicht eingerichtet, in Dokploy bei der Website-Application auf **Deploy** klicken.

## Fotos löschen

In FileBrowser Quantum löschen. Danach läuft derselbe Ablauf wie beim Hinzufügen: Nach dem Rebuild ist das Foto von der Website verschwunden.

## Fotos ersetzen

Eine Datei mit gleichem Namen hochladen und überschreiben. Größe oder Änderungszeit ändern sich dabei, der Indexer erkennt das und löst den Rebuild aus.

## Coverbild ändern

Die Datei in `cover/` ersetzen, z. B. `cover/street.jpg`. Soll das Cover anders heißen, den Pfad in `src/data/series.json` im Feld `cover` anpassen und den Code pushen.

## Reihenfolge

Fotos werden nach Dateinamen sortiert (alphabetisch, wie `localeCompare`). Für eine feste Reihenfolge Präfixe verwenden:

```
01-ankunft.jpg
02-strasse.jpg
10-abend.jpg
```

Ohne führende Null steht `10-...` vor `2-...`.

## Dateien

- Formate: `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`. Andere Dateien werden ignoriert.
- Dateien und Ordner, deren Name mit `.` beginnt, werden ignoriert.
- Unterordner innerhalb eines Serienordners werden ignoriert.
- Empfohlen: JPG, lange Kante höchstens etwa 3000 bis 4000 Pixel, unter 10 MB. Die Website erzeugt daraus Varianten bis 2000 Pixel Breite. Größere Originale verlängern nur den Build.
- Leerzeichen und Umlaute im Dateinamen funktionieren, einfache Namen aus Kleinbuchstaben, Ziffern und Bindestrichen sind aber robuster.
- Die Originale sind unter `https://images.mathisheck.de/<ordner>/<datei>` öffentlich abrufbar. Nichts hochladen, was nicht öffentlich sein soll.

## Neue Serie anlegen

1. Auf `upload.mathisheck.de` einen neuen Ordner anlegen, z. B. `portrait`, und die Fotos hochladen.
2. Ein Coverbild nach `cover/` hochladen, z. B. `cover/portrait.jpg`.
3. In `src/data/series.json` einen Eintrag ergänzen:

   ```json
   {
     "slug": "portrait",
     "title": "Portrait",
     "description": "Faces, light, and character.",
     "folder": "portrait",
     "cover": "cover/portrait.jpg"
   }
   ```

   | Feld | Bedeutung |
   | :--- | :--- |
   | `slug` | Adresse der Serienseite: `/images/<slug>` |
   | `title` | Überschrift und Name in der Übersicht |
   | `description` | Kurzbeschreibung in der Übersicht und Meta-Beschreibung der Seite |
   | `folder` | Ordner auf dem Bildserver, aus dem die Fotos kommen |
   | `cover` | Pfad des Coverbilds auf dem Bildserver |

   Die Reihenfolge der Einträge ist die Reihenfolge auf `/images`.
4. Änderung committen und pushen. Dokploy baut die Website neu.

Ein Ordner ohne Eintrag in `series.json` erscheint nicht auf der Website. Ein Eintrag, dessen Ordner fehlt oder leer ist, ergibt eine leere Galerie. Fehlt das Coverbild, bricht der Build ab.

## Manueller Rebuild

In Dokploy die Website-Application öffnen und **Deploy** klicken. Der Build lädt immer die aktuelle Bildliste.

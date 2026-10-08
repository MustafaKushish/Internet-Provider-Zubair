# شبكة أولاد كشيش – SAS Plus

Verwaltung von Mitgliedern, Türmen, Zahlungen und Tickets. Die App läuft als **Cloudflare Worker**:
derselbe Worker liefert die Oberfläche aus und stellt die Schnittstelle `/api` bereit. Die Daten liegen in
einer **Cloudflare-D1-Datenbank**.

## So funktioniert die Datenspeicherung

- **Login und Rechte prüft der Server.** Passwörter der Mitarbeiter liegen nur verschlüsselt (PBKDF2) in der Datenbank
  und kommen nie im Browser an. Nach 10 falschen Versuchen ist ein Benutzername 15 Minuten gesperrt.
- **Automatische Synchronisation:** Jede Änderung wird etwa eine Sekunde später hochgeladen. Änderungen anderer Geräte
  holt die App alle 15 Sekunden, beim Zurückkehren ins Fenster und sobald wieder Internet da ist.
- **Ohne Internet weiterarbeiten:** Alle Daten bleiben zusätzlich im Browser gespeichert. Fällt das Internet aus,
  sammelt die App die Änderungen und lädt sie später hoch. Die Anzeige unten links zeigt den Stand
  („محفوظ على الخادم“ = gespeichert, „بدون إنترنت“ = wartet). Zum **Anmelden** braucht man Internet.
- **Gleichzeitige Änderungen:** Ändern zwei Geräte denselben Datensatz, gilt die zuletzt hochgeladene Änderung.
  Doppelte Beleg- und Ticketnummern vergibt der Server automatisch neu.
- **Rechte (vom Server erzwungen):**
  | | Admin | Buchhalter | Techniker |
  |---|---|---|---|
  | Mitglieder anlegen/ändern | ✓ | ✓ | ✓ |
  | Mitglieder löschen, Belege löschen | ✓ | – | – |
  | Anbieter und Türme | ✓ | ✓ | – |
  | Einstellungen, Mitarbeiter | ✓ | – | – |

## Als App installieren

| Gerät | So geht's |
|---|---|
| **Android** | Adresse in **Chrome** öffnen → Knopf **„تثبيت التطبيق“** oben in der App (oder Chrome-Menü ⋮ → *App installieren*). |
| **iPhone / iPad** | Adresse in **Safari** öffnen → Teilen-Symbol → **„Zum Home-Bildschirm“** → *Hinzufügen*. |
| **Windows** | Entweder in **Edge/Chrome** auf „تثبيت التطبيق“ klicken, oder den Installer `AwladKushish-Setup-x.y.z.exe` aus den GitHub-Releases ausführen (Workflow *Build Windows App*). |

Die installierte App startet ohne Browserleiste, hat ein eigenes Symbol, öffnet sich auch ohne Internet
(mit den zuletzt gespeicherten Daten) und aktualisiert sich bei jedem Deploy automatisch.
Der Windows-Installer ist eine Electron-Hülle (`desktop/`) um dieselbe Adresse.

## Der KI-Berater („المستشار الذكي“)

Ein Reiter für Admin und Buchhalter: Er beantwortet Fragen zu Marketing, Preisen, Zuschlägen, Schulden und dazu,
welche Türme sich lohnen. Dafür nutzt er **Claude Opus 5.5** mit gründlichem Nachdenken und die aktuellen Zahlen der App.

- **Datenschutz:** Gesendet wird nur eine Zahlenübersicht (Türme, Pakete, Preise, Gewinne, Schulden, Einnahmen pro Monat, Tickets).
  Keine Namen, Telefonnummern, Benutzernamen oder Passwörter. In der App zeigt der Knopf „البيانات المرسلة“ genau, was gesendet wird.
- **Kosten:** Pro Frage etwa 0,05–0,20 US-$, abgerechnet bei Anthropic. Pro Person sind höchstens 40 Fragen am Tag erlaubt.
- **Einrichtung (einmalig):**
  1. Auf <https://console.anthropic.com> ein Konto anlegen, Guthaben aufladen und unter *API Keys* einen Schlüssel erstellen.
  2. Im Cloudflare-Dashboard unter *Workers & Pages → sas-plus-zubair → Settings → Variables and Secrets* den Eintrag **Add**
     wählen, Typ **Secret**, Name `ANTHROPIC_API_KEY` und den Schlüssel als Wert eintragen, dann **Deploy**.
     Der Schlüssel bleibt nur auf dem Server und übersteht alle späteren Deploys.

## Einmalige Einrichtung bei Cloudflare

1. Kostenloses Konto auf <https://dash.cloudflare.com> anlegen.
2. **Account-ID** kopieren: Dashboard → rechts „Account ID“ (oder unter *Workers & Pages*).
3. **API-Token** erstellen: *My Profile → API Tokens → Create Token → Vorlage „Edit Cloudflare Workers“*,
   dann zusätzlich die Berechtigung **Account → D1 → Edit** hinzufügen.
4. Im GitHub-Repo unter *Settings → Secrets and variables → Actions* zwei Secrets anlegen:
   `CLOUDFLARE_API_TOKEN` und `CLOUDFLARE_ACCOUNT_ID`.
5. Den Workflow **Deploy to Cloudflare** starten (*Actions* → Workflow → *Run workflow*). Danach läuft er bei jedem Push auf `main`
   automatisch. Beim ersten Deploy legt Wrangler die Datenbank `sas-plus-db` an; die Tabellen erstellt der Worker selbst.
6. Die Adresse steht am Ende des Deploy-Logs, z. B. `https://sas-plus-zubair.<konto>.workers.dev`.
7. Beim ersten Öffnen fragt die App nach dem **Admin-Konto** (Name, Benutzername, Passwort ≥ 8 Zeichen). Das geht nur einmal.
8. Danach als Admin die Excel-Liste importieren oder eine JSON-Sicherung einspielen. Auf allen Geräten erscheinen die Daten nach dem Anmelden.

Neue Mitarbeiter legt der Admin unter „المستخدمين“ an. Das vergebene Passwort ist vorläufig, der Mitarbeiter muss es beim ersten Login ändern.

**Datensicherung:** Cloudflare D1 kann die Datenbank bis zu 30 Tage zurücksetzen (*Time Travel*). Zusätzlich kann der Admin
in den Einstellungen jederzeit eine JSON-Sicherung herunterladen.

## Lokal entwickeln

```bash
npm install
npm run build          # Oberfläche bauen (dist/)
npm run dev:api        # Worker + lokale D1 auf http://localhost:8787 (liefert auch dist/ aus)
npm run dev            # optional: Vite mit Hot Reload auf :3000, leitet /api an :8787 weiter
npm run lint           # Typprüfung für App und Worker
```

Manuelles Deploy ohne GitHub: `npx wrangler login` und dann `npm run deploy`.

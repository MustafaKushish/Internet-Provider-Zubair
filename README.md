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
  | Schulden kassieren (mit Beleg) | ✓ | ✓ | ✓ |
  | Schulden ändern oder erlassen | ✓ | – | – |
  | Anbieter und Türme | ✓ | ✓ | – |
  | Einstellungen, Mitarbeiter | ✓ | – | – |
  | Ausgaben erfassen/ändern | ✓ | ✓ | – |
  | Ausgaben löschen | ✓ | – | – |
  | Kunden archivieren, Ratenpläne, Protokoll | ✓ | – | – |
  | Paketpreise ändern | ✓ | ✓ | – |

## Als App installieren

| Gerät | So geht's |
|---|---|
| **Android** | Adresse in **Chrome** öffnen → Knopf **„تثبيت التطبيق“** oben in der App (oder Chrome-Menü ⋮ → *App installieren*). |
| **iPhone / iPad** | Adresse in **Safari** öffnen → Teilen-Symbol → **„Zum Home-Bildschirm“** → *Hinzufügen*. |
| **Windows** | Entweder in **Edge/Chrome** auf „تثبيت التطبيق“ klicken, oder den Installer `AwladKushish-Setup-x.y.z.exe` aus den GitHub-Releases ausführen (Workflow *Build Windows App*). |

Die installierte App startet ohne Browserleiste, hat ein eigenes Symbol, öffnet sich auch ohne Internet
(mit den zuletzt gespeicherten Daten) und aktualisiert sich bei jedem Deploy automatisch.
Der Windows-Installer ist eine Electron-Hülle (`desktop/`) um dieselbe Adresse.

## Bedienung

- **Schnellsuche:** Lupe oben oder `Strg+K` (bzw. `/`). Findet Kunden nach Name, Telefon (mit oder ohne 0, auch arabische Ziffern),
  Benutzername oder IP. „احمد“ findet auch „أحمد“. `Enter` öffnet direkt die Verlängerung.
- **Handy:** kompakte Kopfzeile, Leiste unten mit den wichtigsten Bereichen, alles Weitere unter „المزيد“.
- **Kundenliste:** 25 pro Seite (umstellbar), sortierbar nach Name, Ablauf, Schulden oder neueste.
- **Erinnerungen:** nach Dringlichkeit sortiert, Suche und Turmfilter; „heute gesendet“ bleibt bis Mitternacht markiert.
- **Übersicht:** „ملخص اليوم“ zeigt heutige Einnahmen nach Zahlungsart, Verlängerungen und wer heute oder morgen abläuft.

## Kundenprofil, Ratenpläne und Kundenbewegung

- **Kundenprofil:** Auf den Namen tippen (Liste, Erinnerungen) oder in der Schnellsuche „الملف“. Zeigt alle Daten, Kunde seit,
  Gesamtzahlungen, letzte Zahlung, Ratenplan und den kompletten Verlauf (Belege, Schuldenänderungen, Störungen) mit allen Aktionen.
- **Ratenpläne für alte Schulden** (im Schuldenfenster): Der Admin wählt 2–12 Monatsraten und das Datum der ersten Rate.
  Jede Schuldenzahlung zählt automatisch als Rate. Die App zeigt Fortschritt, nächste Rate und Rückstand; Erinnerungen
  schicken dann die Raten-Nachricht statt der ganzen Schuld. Anlegen und Aufheben nur durch den Admin (vom Server erzwungen),
  Raten kassieren darf jeder.
- **Kundenbewegung** (Finanzbericht und KI-Berater): pro Monat neue, verlängerte, zurückgewonnene und verlorene Kunden,
  Nettowachstum und Bindungsquote, dazu pro Turm. „Verloren“ = abgelaufen und 30 Tage nicht verlängert.
  Aus Excel importierte Kunden zählen nicht als neu.

## Archiv, Datenprüfung, Protokoll und Preisänderung

- **Archiv (nur Admin, vom Server erzwungen):** Kunden, die gegangen sind, verschwinden aus Listen, Kopfzahlen, Erinnerungen,
  Türmen und KI-Berater, bleiben aber mit allen Belegen und Schulden erhalten (Filter „مؤرشف“, Schnellsuche, Profil).
  Archivieren über das Profil, die Auswahl in der Liste oder „Datenprüfung“. **Eine Verlängerung holt den Kunden automatisch zurück.**
- **Datenprüfung („جودة البيانات“ in der Übersicht):** lange abgelaufene Kunden (3/6/12 Monate, mit „alle archivieren“),
  doppelte Benutzernamen oder Telefonnummern, fehlende Telefonnummer oder fehlender Turm, Platzhalter-Benutzernamen aus dem Import,
  Verkaufspreis unter Einkaufspreis – jeweils mit Profil- und Bearbeiten-Knopf.
- **Protokoll („سجل العمليات“, nur Admin, unter „المستخدمون والمشرفون“):** jede Anlage, Änderung und Löschung mit Mitarbeiter,
  Zeit und geänderten Feldern (alte → neue Werte). Wird ein Jahr auf dem Server aufbewahrt. Passwörter werden nie mitgeschrieben.
- **Preisänderung pro Paket („تغيير السعر“ bei den Anbietern):** Der neue Preis gilt für jeden Kunden des Pakets ab seiner
  **nächsten Verlängerung** (laufende Periode und Schulden bleiben unverändert), zeigt den Mehrumsatz und liefert einen
  fertigen WhatsApp-Ankündigungstext.

## Kasse und Ausgaben („الصندوق والمصاريف“, Admin und Buchhalter)

- **Kassenabschluss pro Tag:** Was jeder Mitarbeiter kassiert hat, getrennt nach Bar, Zain Cash, Qi Card und Überweisung,
  abzüglich der Ausgaben, die er bar bezahlt hat = Betrag, den er abgeben muss. Per WhatsApp teilen oder kopieren.
- **Ausgaben:** Miete, Generator, Strom, Wartung, Geräte, Gehälter, Leitung, Werbung … optional einem Turm zugeordnet.
  „Monatlich fest“ markierte Ausgaben schlägt die App im nächsten Monat zur Übernahme mit einem Klick vor.
- **Echter Nettogewinn** = Gewinn aus Belegen (nach Großhandelskosten) − Ausgaben. Erscheint in der Übersicht, bei den Türmen
  (Netto pro Turm), im Finanzbericht und beim KI-Berater.
- Rechte: Admin und Buchhalter erfassen und ändern, **löschen nur der Admin**. Techniker sehen Ausgaben nicht (der Server schickt sie ihnen gar nicht).
- **Serienversand bei Erinnerungen:** „إرسال متتالي“ geht die Liste Kunde für Kunde durch (Senden und weiter / Überspringen).
- **Backup-Erinnerung:** Der Admin wird wöchentlich an eine JSON-Sicherung erinnert (zusätzlich zur 30-Tage-Sicherung von Cloudflare D1).

## Der KI-Berater („المستشار الذكي“)

Ein Reiter für Admin und Buchhalter: Er beantwortet Fragen zu Marketing, Preisen, Zuschlägen, Schulden und dazu,
welche Türme sich lohnen. Grundlage sind die aktuellen Zahlen der App.

- **Datenschutz:** Gesendet wird nur eine Zahlenübersicht (Türme, Pakete, Preise, Gewinne, Schulden, Einnahmen pro Monat, Tickets).
  Keine Namen, Telefonnummern, Benutzernamen oder Passwörter. In der App zeigt der Knopf „البيانات المرسلة“ genau, was gesendet wird.
- **Pro Person höchstens 40 Fragen am Tag.** Fehlgeschlagene Fragen werden nicht gezählt.
- **„معلومات عملي“** (nur der Admin bearbeitet): Kosten pro Turm, Kapazität, Preise der Konkurrenz, Ziele. Der Berater
  rechnet bei jeder Frage damit. Keine Kundennamen oder Telefonnummern eintragen.
- **„خطة رفع برج“**: Turm wählen → der Berater vergleicht ihn mit dem Netz und erstellt einen Monatsplan mit Ziel nach 3 Monaten
  und fertigen WhatsApp-Texten.
- Pro Turm bekommt der Berater u. a. ARPU, Marge pro Kunde, Verlängerungsquote, Rückgewinnungs-Potenzial
  (in den letzten 90 Tagen abgelaufen), Schulden im Verhältnis zum Umsatz und Störungsmeldungen pro 10 Kunden.

**KI-Motoren** (der Admin wählt oben im Berater unter „المحرك“):

| Motor | Kosten | Einrichtung |
|---|---|---|
| **Automatisch** (Standard) | kostenlos | Erst Google Gemini, bei Fehler oder Limit automatisch Cloudflare AI. |
| **Google Gemini** (Flash) | kostenlos im Rahmen der Google-Limits | Secret `GEMINI_API_KEY` (siehe unten). |
| **Cloudflare AI** (Workers AI) | kostenlos bis 10.000 „Neurons“ pro Tag (Reset 00:00 UTC) | Nichts, ist über `wrangler.jsonc` (`"ai"`) schon verbunden. |
| **Claude** (Opus 5.5) | ca. 0,05–0,20 US-$ pro Frage bei Anthropic, nur mit Guthaben | Secret `ANTHROPIC_API_KEY` (optional). |

**Gemini-Schlüssel einrichten (einmalig):**

1. Auf <https://aistudio.google.com> mit einem Google-Konto anmelden → **Get API key** → **Create API key** → Schlüssel kopieren.
2. Im Cloudflare-Dashboard unter *Workers & Pages → sas-plus-zubair → Settings → Variables and Secrets* auf **Add**,
   Typ **Secret**, Name `GEMINI_API_KEY`, Schlüssel als Wert, dann **Deploy**.
   Der Schlüssel bleibt nur auf dem Server und übersteht alle späteren Deploys.
   Auch die Namen `Gemini_Key` oder `GEMINI_KEY` werden erkannt. Schlüssel von Google AI Studio (`AIza…`)
   und von Vertex AI Express (`AQ.…`) funktionieren beide.

Für Claude geht es genauso mit einem Schlüssel von <https://console.anthropic.com> und dem Namen `ANTHROPIC_API_KEY`.
Optional lassen sich die Modelle über die Variablen `GEMINI_MODEL` und `WORKERS_AI_MODEL` ändern.
Die grünen Punkte neben der Motor-Auswahl zeigen, welche Motoren auf dem Server eingerichtet sind.

## Einmalige Einrichtung bei Cloudflare

1. Kostenloses Konto auf <https://dash.cloudflare.com> anlegen.
2. **Account-ID** kopieren: Dashboard → rechts „Account ID“ (oder unter *Workers & Pages*).
3. **API-Token** erstellen: *My Profile → API Tokens → Create Token → Vorlage „Edit Cloudflare Workers“*,
   dann zusätzlich die Berechtigungen **Account → D1 → Edit** und **Account → Workers AI → Edit** hinzufügen.
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

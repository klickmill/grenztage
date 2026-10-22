// Prüft den Rechenkern: node test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const G = createRequire(import.meta.url)("./grenz.js");

// Datum
assert.ok(G.istDatum("2026-10-21"));
assert.ok(G.istDatum("2028-02-29"));
assert.equal(G.istDatum("2026-02-29"), false);
assert.equal(G.istDatum("2026-13-01"), false);
assert.equal(G.istDatum("1999-12-31"), false);
assert.equal(G.istDatum("2026-1-1"), false);
assert.equal(G.istDatum(20261021), false);
assert.equal(G.plusTage("2026-12-31", 1), "2027-01-01");
assert.equal(G.plusTage("2026-03-29", 1), "2026-03-30"); // Sommerzeit verschiebt nichts
assert.equal(G.wochentag("2026-10-19"), 0); // Montag
assert.equal(G.wochentag("2026-10-25"), 6); // Sonntag
assert.equal(G.lokalHeute(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
assert.equal(G.datumLang("2026-10-01"), "1. Oktober 2026");

// Land und Name: Buchstabe zuerst, nichts, was in Excel eine Formel wäre
assert.equal(G.landSaeubern("  Schweiz "), "Schweiz");
assert.equal(G.landSaeubern("Côte d'Ivoire"), "Côte d'Ivoire");
assert.equal(G.landSaeubern("Bosnien-Herzegowina"), "Bosnien-Herzegowina");
assert.equal(G.landSaeubern("=HYPERLINK(1)"), null);
assert.equal(G.landSaeubern("+49"), null);
assert.equal(G.landSaeubern("Schweiz;x"), null);
assert.equal(G.landSaeubern('Schweiz"'), null);
assert.equal(G.landSaeubern(""), null);
assert.equal(G.landSaeubern("x".repeat(41)), null);
assert.equal(G.nameSaeubern("183 Tage Zypern"), "183 Tage Zypern");
assert.equal(G.nameSaeubern("-5"), null);
assert.equal(G.nameSaeubern("@Grenze"), null);

// Einträge und Grenzen säubern
assert.deepEqual(G.eintragSaeubern({ land: "Schweiz", art: "buero" }), { land: "Schweiz", art: "buero" });
assert.deepEqual(G.eintragSaeubern({ land: "Schweiz", art: "Büro" }), { land: "Schweiz", art: "buero" });
assert.equal(G.eintragSaeubern({ land: "Schweiz", art: "toString" }), null);
assert.equal(G.eintragSaeubern({ land: "Schweiz", art: "__proto__" }), null);
assert.deepEqual(G.tageSaeubern({ "2026-10-01": { land: "Schweiz", art: "buero" }, "2026-02-30": { land: "Schweiz", art: "buero" }, "__proto__": { land: "X", art: "frei" }, "2026-10-02": { land: "", art: "frei" } }),
  { "2026-10-01": { land: "Schweiz", art: "buero" } });
const g1 = { id: "abcd1234", name: "Tage in der Schweiz", zahl: 60, zeitraum: "jahr", arten: ["homeoffice", "buero", "quatsch"], land: "Schweiz" };
assert.deepEqual(G.grenzeSaeubern(g1), { id: "abcd1234", name: "Tage in der Schweiz", zahl: 60, zeitraum: "jahr", arten: ["buero", "homeoffice"], land: "Schweiz" });
assert.equal(G.grenzeSaeubern({ ...g1, zahl: 0 }), null);
assert.equal(G.grenzeSaeubern({ ...g1, zahl: 367 }), null);
assert.equal(G.grenzeSaeubern({ ...g1, zahl: "60abc" }), null);
assert.equal(G.grenzeSaeubern({ ...g1, zahl: "60" }).zahl, 60);
assert.equal(G.grenzeSaeubern({ ...g1, zahl: 6.5 }), null);
assert.equal(G.grenzeSaeubern({ ...g1, arten: [] }), null);
assert.equal(G.grenzeSaeubern({ ...g1, zeitraum: "woche" }), null);
assert.equal(G.grenzeSaeubern({ ...g1, id: "<x>" }), null);
assert.equal(G.grenzeSaeubern({ ...g1, land: "" }).land, "");
assert.equal(G.grenzeSaeubern({ ...g1, land: "=1" }), null);
assert.equal(G.grenzeSaeubern({ ...g1, zeitraum: "Letzte 12 Monate" }).zeitraum, "rollend");

// Zeitfenster
assert.deepEqual(G.fenster({ zeitraum: "jahr" }, "2026-10-21"), { von: "2026-01-01", bis: "2026-12-31" });
assert.deepEqual(G.fenster({ zeitraum: "rollend" }, "2026-10-21"), { von: "2025-10-22", bis: "2026-10-21" });
assert.deepEqual(G.fenster({ zeitraum: "rollend" }, "2028-02-29"), { von: "2027-03-01", bis: "2028-02-29" });

// Zählen
const tage = {
  "2025-10-21": { land: "Schweiz", art: "buero" },      // vor dem rollenden Fenster
  "2025-10-22": { land: "schweiz", art: "buero" },      // erster Tag im Fenster, Schreibweise egal
  "2026-03-02": { land: "Schweiz", art: "homeoffice" },
  "2026-03-03": { land: "Deutschland", art: "buero" },  // anderes Land
  "2026-03-04": { land: "Schweiz", art: "frei" },       // Art zählt nicht
  "2026-10-21": { land: "Schweiz", art: "reise" },      // heute
  "2026-11-02": { land: "Schweiz", art: "buero" },      // geplant
};
const z1 = G.zaehle(G.grenzeSaeubern({ ...g1, arten: ["buero", "homeoffice", "reise"] }), tage, "2026-10-21");
assert.deepEqual(z1, { von: "2026-01-01", bis: "2026-12-31", bisHeute: 2, danach: 1, gezaehlt: 3, rest: 57, ueber: 0 });
const z2 = G.zaehle(G.grenzeSaeubern({ ...g1, zeitraum: "rollend", arten: ["buero", "homeoffice", "reise"] }), tage, "2026-10-21");
assert.deepEqual(z2, { von: "2025-10-22", bis: "2026-10-21", bisHeute: 3, danach: 0, gezaehlt: 3, rest: 57, ueber: 0 });
const z3 = G.zaehle(G.grenzeSaeubern({ ...g1, zahl: 2, land: "", arten: ["buero"] }), tage, "2026-10-21");
assert.equal(z3.gezaehlt, 2); // Deutschland 3.3. und Schweiz 2.11.
assert.equal(z3.rest, 0);
assert.equal(G.zaehle(G.grenzeSaeubern({ ...g1, zahl: 1, land: "", arten: ["buero"] }), tage, "2026-10-21").ueber, 1);

// Zeiträume eintragen
assert.deepEqual(G.bereich("2026-10-23", "2026-10-26", false), ["2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26"]);
assert.deepEqual(G.bereich("2026-10-26", "2026-10-23", true), ["2026-10-23", "2026-10-26"]); // Fr und Mo, umgedreht eingegeben
assert.equal(G.bereich("2026-01-01", "2027-03-01", false), null); // zu lang
assert.equal(G.bereich("2026-02-30", "2026-03-01", false), null);
const t2 = G.setzen({}, ["2026-10-23", "2026-10-24"], { land: " Zypern ", art: "Reise" });
assert.deepEqual(t2, { "2026-10-23": { land: "Zypern", art: "reise" }, "2026-10-24": { land: "Zypern", art: "reise" } });
assert.equal(G.setzen({}, ["2026-10-23"], { land: "", art: "reise" }), null);
assert.deepEqual(G.entfernen(t2, ["2026-10-23"]), { "2026-10-24": { land: "Zypern", art: "reise" } });
assert.deepEqual(Object.keys(t2), ["2026-10-23", "2026-10-24"]); // setzen und entfernen ändern das Original nicht
assert.deepEqual(G.zuletzt(["Schweiz", "Deutschland"], "deutschland"), ["deutschland", "Schweiz"]);
assert.equal(G.zuletzt(["A", "B", "C", "D", "E", "F"], "G").length, 6);
assert.deepEqual(G.zuletzt(["Schweiz"], "=1"), ["Schweiz"]);

// Monat
const raster = G.monatsRaster(2026, 10);
assert.equal(raster.length, 42);
assert.equal(raster[3], "2026-10-01"); // Donnerstag
assert.equal(raster[0], null);
assert.equal(raster.filter(Boolean).length, 31);
assert.equal(G.monatsRaster(2026, 2).filter(Boolean).length, 28);
const ms = G.monatsSumme(tage, 2026, 3);
assert.deepEqual(ms.laender, [["Schweiz", 2], ["Deutschland", 1]]);
assert.deepEqual(ms.arten, { buero: 1, homeoffice: 1, reise: 0, frei: 1 });

// Tabelle schreiben und lesen
const grenzen = [G.grenzeSaeubern(g1), G.grenzeSaeubern({ ...g1, id: "efgh5678", name: "Ausland gesamt", zahl: 183, zeitraum: "rollend", land: "" })];
const text = G.csv(tage, grenzen);
assert.ok(text.startsWith("﻿Datum;Land;Art\r\n2025-10-21;Schweiz;Büro\r\n"));
assert.ok(text.includes("\r\nGrenze;Zahl;Zeitraum;Arten;Land\r\nTage in der Schweiz;60;Kalenderjahr;Büro, Homeoffice;Schweiz\r\n"));
assert.ok(text.includes("Ausland gesamt;183;Letzte 12 Monate;Büro, Homeoffice;\r\n"));
const zurueck = G.csvLesen(text);
assert.deepEqual(zurueck.tage, tage);
assert.equal(zurueck.kaputt, 0);
assert.deepEqual(zurueck.grenzen.map((g) => ({ ...g, id: "x" })), grenzen.map((g) => ({ ...g, id: "x" })));
assert.ok(zurueck.grenzen.every((g) => /^[a-z0-9]{4,24}$/.test(g.id)));
assert.equal(G.csvLesen("irgendwas;ohne;kopf"), null);
assert.equal(G.csvLesen(""), null);
// Excel speichert gern mit Semikolons am Zeilenende und ohne BOM
const excel = G.csvLesen("Datum;Land;Art;;\n2026-10-01;Schweiz;homeoffice;;\n2026-10-02;=cmd;Büro\nkaputt\n");
assert.deepEqual(excel.tage, { "2026-10-01": { land: "Schweiz", art: "homeoffice" } });
assert.equal(excel.kaputt, 2);
// Excel schreibt beim Speichern deutsche Datumsangaben und füllt Leerzeilen mit Semikolons
const excel2 = G.csvLesen("Datum;Land;Art\n01.10.2026;Schweiz;Büro\n2.3.2026;Schweiz;Frei\n31.02.2026;Schweiz;Büro\n;;\nGrenze;Zahl;Zeitraum;Arten;Land\nX;5;Kalenderjahr;Büro;\n");
assert.deepEqual(excel2.tage, { "2026-10-01": { land: "Schweiz", art: "buero" }, "2026-03-02": { land: "Schweiz", art: "frei" } });
assert.equal(excel2.kaputt, 1); // nur der 31.02.
assert.equal(excel2.grenzen.length, 1);
assert.equal(G.datumLesen("2026-10-01"), "2026-10-01");
assert.equal(G.datumLesen("1.1.26"), null);

// Grenzennamen eindeutig, sonst verliert Export und Import eine Grenze
assert.equal(G.nameVergeben(grenzen, " tage IN der Schweiz ", null), true);
assert.equal(G.nameVergeben(grenzen, "Tage in der Schweiz", "abcd1234"), false); // die eigene beim Ändern
assert.equal(G.nameVergeben(grenzen, "Neu", null), false);
assert.equal(G.nameVergeben(grenzen, "Tage  in der\tSchweiz", null), true); // Leerzeichen innen wie beim Speichern

// Zusammenführen: Datei gewinnt, Grenzen über den Namen
const zf = G.zusammenfuehren(
  { "2026-10-01": { land: "Schweiz", art: "buero" }, "2026-10-02": { land: "Schweiz", art: "buero" } },
  { "2026-10-02": { land: "Schweiz", art: "buero" }, "2026-10-01": { land: "Deutschland", art: "frei" }, "2026-10-03": { land: "Zypern", art: "reise" } },
  [grenzen[0]],
  [{ ...grenzen[0], id: "neu00001", name: "tage in der schweiz", zahl: 61 }, grenzen[1]]);
assert.equal(zf.dazu, 1);
assert.equal(zf.geaendert, 1);
assert.equal(zf.tage["2026-10-01"].land, "Deutschland");
assert.equal(zf.gDazu, 1);
assert.equal(zf.gGeaendert, 1);
assert.equal(zf.grenzen[0].id, "abcd1234"); // alte Kennung bleibt
assert.equal(zf.grenzen[0].zahl, 61);

console.log("grenz.js: alle Prüfungen bestanden");

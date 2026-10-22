// Rechenkern von Grenztage: Tage je Land und Art speichern, selbst gesetzte Grenzen
// mitzählen, Tabelle (CSV) schreiben und lesen. Zählt nur, bewertet nichts.
// Läuft im Browser (window.Grenz) und in Node (require) für test.mjs.
(function (wurzel) {
  "use strict";

  var ARTEN = [["buero", "Büro"], ["homeoffice", "Homeoffice"], ["reise", "Reise"], ["frei", "Frei"]];
  var ZEITRAEUME = [["jahr", "Kalenderjahr"], ["rollend", "Letzte 12 Monate"]];
  var MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  var name = function (liste) { var o = {}; liste.forEach(function (x) { o[x[0]] = x[1]; }); return o; };
  var ART_NAME = name(ARTEN), ZEITRAUM_NAME = name(ZEITRAEUME);
  var ART_KEYS = ARTEN.map(function (a) { return a[0]; });
  var MAX_BEREICH = 400, MAX_TAGE = 20000, MAX_GRENZEN = 50;

  function eigen(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function zuArt(v) {
    var s = String(v == null ? "" : v).trim();
    for (var i = 0; i < ARTEN.length; i++) if (s === ARTEN[i][0] || s.toLowerCase() === ARTEN[i][1].toLowerCase()) return ARTEN[i][0];
    return null;
  }
  function zuZeitraum(v) {
    var s = String(v == null ? "" : v).trim();
    for (var i = 0; i < ZEITRAEUME.length; i++) if (s === ZEITRAEUME[i][0] || s.toLowerCase() === ZEITRAEUME[i][1].toLowerCase()) return ZEITRAEUME[i][0];
    return null;
  }

  // Datum immer als Text JJJJ-MM-TT, gerechnet in UTC, damit Sommerzeit nichts verschiebt.
  function nr(s) { return Math.round(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 864e5); }
  function ausNr(n) { return new Date(n * 864e5).toISOString().slice(0, 10); }
  function istDatum(s) {
    if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var j = +s.slice(0, 4);
    return j >= 2000 && j <= 2100 && ausNr(nr(s)) === s;
  }
  function plusTage(s, n) { return ausNr(nr(s) + n); }
  function wochentag(s) { return (new Date(nr(s) * 864e5).getUTCDay() + 6) % 7; } // 0 = Montag
  function lokalHeute(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function datumLang(s) { return +s.slice(8, 10) + ". " + MONATE[+s.slice(5, 7) - 1] + " " + s.slice(0, 4); }
  function datumKurz(s) { return +s.slice(8, 10) + "." + +s.slice(5, 7) + "." + s.slice(0, 4); }

  // Land und Namen beginnen mit einem Buchstaben (Name auch Ziffer) und enthalten kein
  // Semikolon, keine Anführungszeichen, kein = + @: so bleibt die Tabelle sicher für Excel.
  function landSaeubern(v) {
    var s = String(v == null ? "" : v).replace(/\s+/g, " ").trim();
    return /^\p{L}[\p{L}\p{M} .'’-]{0,39}$/u.test(s) ? s : null;
  }
  function nameSaeubern(v) {
    var s = String(v == null ? "" : v).replace(/\s+/g, " ").trim();
    return /^[\p{L}\p{N}][\p{L}\p{M}\p{N} .,'’()\/&-]{0,59}$/u.test(s) ? s : null;
  }
  function gleichesLand(a, b) { return String(a).toLocaleLowerCase("de") === String(b).toLocaleLowerCase("de"); }

  function eintragSaeubern(e) {
    if (!e || typeof e !== "object") return null;
    var land = landSaeubern(e.land), art = zuArt(e.art);
    return land && art ? { land: land, art: art } : null;
  }
  function tageSaeubern(t) {
    var aus = {};
    if (!t || typeof t !== "object") return aus;
    var n = 0;
    Object.keys(t).sort().forEach(function (d) {
      if (n >= MAX_TAGE || !istDatum(d)) return;
      var e = eintragSaeubern(t[d]);
      if (e) { aus[d] = e; n++; }
    });
    return aus;
  }

  function neueId() { return (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)).slice(0, 20); }
  function grenzeSaeubern(g) {
    if (!g || typeof g !== "object") return null;
    var id = typeof g.id === "string" && /^[a-z0-9]{4,24}$/.test(g.id) ? g.id : null;
    var nm = nameSaeubern(g.name);
    var zs = String(g.zahl == null ? "" : g.zahl).trim();
    var zahl = typeof g.zahl === "number" ? g.zahl : /^\d{1,3}$/.test(zs) ? parseInt(zs, 10) : NaN;
    var zr = zuZeitraum(g.zeitraum);
    var arten = Array.isArray(g.arten) ? ART_KEYS.filter(function (k) { return g.arten.some(function (a) { return zuArt(a) === k; }); }) : [];
    var land = g.land == null || String(g.land).trim() === "" ? "" : landSaeubern(g.land);
    if (!id || !nm || !Number.isInteger(zahl) || zahl < 1 || zahl > 366 || !zr || !arten.length || land === null) return null;
    return { id: id, name: nm, zahl: zahl, zeitraum: zr, arten: arten, land: land };
  }

  // Der Import erkennt Grenzen am Namen, darum muss er eindeutig sein.
  function nameVergeben(grenzen, nm, ohneId) {
    var k = String(nm).replace(/\s+/g, " ").trim().toLocaleLowerCase("de"); // wie nameSaeubern
    return grenzen.some(function (g) { return g.id !== ohneId && g.name.toLocaleLowerCase("de") === k; });
  }

  // Zeitraum einer Grenze, bezogen auf heute. Rollend: die 365 oder 366 Tage bis heute,
  // also vom Tag nach demselben Datum im Vorjahr bis heute.
  function fenster(g, heute) {
    if (g.zeitraum === "jahr") return { von: heute.slice(0, 4) + "-01-01", bis: heute.slice(0, 4) + "-12-31" };
    var j = +heute.slice(0, 4) - 1, md = heute.slice(4);
    var vorjahr = j + md;
    if (!istDatum(vorjahr)) vorjahr = j + "-02-28"; // 29. Februar
    return { von: plusTage(vorjahr, 1), bis: heute };
  }
  function zaehle(g, tage, heute) {
    var f = fenster(g, heute), bisHeute = 0, danach = 0;
    Object.keys(tage).forEach(function (d) {
      if (d < f.von || d > f.bis) return;
      var e = tage[d];
      if (g.arten.indexOf(e.art) < 0) return;
      if (g.land && !gleichesLand(g.land, e.land)) return;
      if (d <= heute) bisHeute++; else danach++;
    });
    var gezaehlt = bisHeute + danach;
    return { von: f.von, bis: f.bis, bisHeute: bisHeute, danach: danach, gezaehlt: gezaehlt,
      rest: Math.max(0, g.zahl - gezaehlt), ueber: Math.max(0, gezaehlt - g.zahl) };
  }

  function bereich(von, bis, ohneWochenende) {
    if (!istDatum(von) || !istDatum(bis)) return null;
    if (bis < von) { var x = von; von = bis; bis = x; }
    if (nr(bis) - nr(von) + 1 > MAX_BEREICH) return null;
    var aus = [];
    for (var n = nr(von); n <= nr(bis); n++) {
      var d = ausNr(n);
      if (!ohneWochenende || wochentag(d) < 5) aus.push(d);
    }
    return aus;
  }
  function setzen(tage, daten, eintrag) {
    var e = eintragSaeubern(eintrag);
    if (!e) return null;
    var aus = Object.assign({}, tage);
    daten.forEach(function (d) { if (istDatum(d)) aus[d] = { land: e.land, art: e.art }; });
    return aus;
  }
  function entfernen(tage, daten) {
    var aus = Object.assign({}, tage);
    daten.forEach(function (d) { delete aus[d]; });
    return aus;
  }
  function zuletzt(liste, land) {
    var l = landSaeubern(land);
    if (!l) return liste.slice(0, 6);
    return [l].concat(liste.filter(function (x) { return !gleichesLand(x, l); })).slice(0, 6);
  }

  // Raster eines Monats: 6 Wochen ab Montag, Tage außerhalb des Monats als null.
  function monatsRaster(jahr, monat) {
    var erster = jahr + "-" + String(monat).padStart(2, "0") + "-01";
    var start = nr(erster) - wochentag(erster), aus = [];
    for (var i = 0; i < 42; i++) {
      var d = ausNr(start + i);
      aus.push(d.slice(0, 7) === erster.slice(0, 7) ? d : null);
    }
    return aus;
  }
  function monatsSumme(tage, jahr, monat) {
    var vorne = jahr + "-" + String(monat).padStart(2, "0"), laender = {}, reihe = [], arten = {};
    ART_KEYS.forEach(function (k) { arten[k] = 0; });
    Object.keys(tage).forEach(function (d) {
      if (d.slice(0, 7) !== vorne) return;
      var e = tage[d], k = e.land.toLocaleLowerCase("de");
      if (!eigen(laender, k)) { laender[k] = [e.land, 0]; reihe.push(k); }
      laender[k][1]++;
      arten[e.art]++;
    });
    return { laender: reihe.map(function (k) { return laender[k]; }).sort(function (a, b) { return b[1] - a[1]; }), arten: arten };
  }

  // Tabelle mit Semikolon (so öffnet Excel sie im deutschen Raum richtig) und BOM für Umlaute.
  var KOPF_TAGE = "Datum;Land;Art", KOPF_GRENZEN = "Grenze;Zahl;Zeitraum;Arten;Land";
  function csv(tage, grenzen) {
    var z = [KOPF_TAGE];
    Object.keys(tage).sort().forEach(function (d) { z.push(d + ";" + tage[d].land + ";" + ART_NAME[tage[d].art]); });
    if (grenzen.length) {
      z.push("", KOPF_GRENZEN);
      grenzen.forEach(function (g) {
        z.push([g.name, g.zahl, ZEITRAUM_NAME[g.zeitraum], g.arten.map(function (a) { return ART_NAME[a]; }).join(", "), g.land].join(";"));
      });
    }
    return "﻿" + z.join("\r\n") + "\r\n";
  }
  // Excel speichert bei deutscher Einstellung Datumsangaben als TT.MM.JJJJ zurück.
  function datumLesen(s) {
    var m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(String(s || "").trim());
    var d = m ? m[3] + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0") : String(s || "").trim();
    return istDatum(d) ? d : null;
  }
  function csvLesen(text) {
    var zeilen = String(text || "").replace(/^﻿/, "").split(/\r?\n/);
    var teil = null, tage = {}, grenzen = [], kaputt = 0, erkannt = false;
    zeilen.forEach(function (roh) {
      var z = roh.trim();
      if (!z || /^;+$/.test(z)) return;
      var kopf = z.replace(/;+$/, "").toLowerCase();
      if (kopf === KOPF_TAGE.toLowerCase()) { teil = "tage"; erkannt = true; return; }
      if (kopf === KOPF_GRENZEN.toLowerCase()) { teil = "grenzen"; erkannt = true; return; }
      var f = z.split(";").map(function (x) { return x.trim(); });
      if (teil === "tage") {
        var e = eintragSaeubern({ land: f[1], art: f[2] }), dt = datumLesen(f[0]);
        if (dt && e && Object.keys(tage).length < MAX_TAGE) tage[dt] = e; else kaputt++;
      } else if (teil === "grenzen") {
        var g = grenzeSaeubern({ id: neueId(), name: f[0], zahl: f[1], zeitraum: f[2], arten: String(f[3] || "").split(","), land: f[4] });
        if (g && grenzen.length < MAX_GRENZEN) grenzen.push(g); else kaputt++;
      } else kaputt++;
    });
    return erkannt ? { tage: tage, grenzen: grenzen, kaputt: kaputt } : null;
  }

  // Einspielen: die Datei gewinnt bei gleichem Datum, Grenzen werden über den Namen erkannt.
  function zusammenfuehren(altTage, neuTage, altGrenzen, neuGrenzen) {
    var tage = Object.assign({}, altTage), dazu = 0, geaendert = 0;
    Object.keys(neuTage).forEach(function (d) {
      var a = tage[d], n = neuTage[d];
      if (!a) dazu++;
      else if (a.land !== n.land || a.art !== n.art) geaendert++;
      tage[d] = n;
    });
    var grenzen = altGrenzen.slice(), gDazu = 0, gGeaendert = 0;
    neuGrenzen.forEach(function (n) {
      var i = grenzen.findIndex(function (g) { return g.name.toLocaleLowerCase("de") === n.name.toLocaleLowerCase("de"); });
      if (i < 0) { if (grenzen.length < MAX_GRENZEN) { grenzen.push(n); gDazu++; } }
      else {
        var g = grenzen[i];
        if (g.zahl !== n.zahl || g.zeitraum !== n.zeitraum || g.arten.join() !== n.arten.join() || g.land !== n.land) gGeaendert++;
        grenzen[i] = Object.assign({}, n, { id: g.id });
      }
    });
    return { tage: tage, grenzen: grenzen, dazu: dazu, geaendert: geaendert, gDazu: gDazu, gGeaendert: gGeaendert };
  }

  var api = { ARTEN: ARTEN, ZEITRAEUME: ZEITRAEUME, MONATE: MONATE, ART_NAME: ART_NAME, ZEITRAUM_NAME: ZEITRAUM_NAME, MAX_BEREICH: MAX_BEREICH,
    MAX_GRENZEN: MAX_GRENZEN, istDatum: istDatum, plusTage: plusTage, wochentag: wochentag, lokalHeute: lokalHeute, datumLang: datumLang,
    datumKurz: datumKurz, landSaeubern: landSaeubern, nameSaeubern: nameSaeubern, gleichesLand: gleichesLand, eintragSaeubern: eintragSaeubern,
    tageSaeubern: tageSaeubern, neueId: neueId, nameVergeben: nameVergeben, datumLesen: datumLesen, grenzeSaeubern: grenzeSaeubern, fenster: fenster, zaehle: zaehle, bereich: bereich,
    setzen: setzen, entfernen: entfernen, zuletzt: zuletzt, monatsRaster: monatsRaster, monatsSumme: monatsSumme, csv: csv,
    csvLesen: csvLesen, zusammenfuehren: zusammenfuehren };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else wurzel.Grenz = api;
})(this);

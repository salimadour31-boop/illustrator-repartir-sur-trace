//@target illustrator
/*
 * RepartirSurTrace.jsx — v1.0.0
 * ---------------------------------------------------------------------------
 * FR : Répartit les objets sélectionnés le long d'un tracé guide, à espacement
 *      égal ou à intervalle fixe, chacun orienté selon la tangente du tracé
 *      (en option). Peut aussi dupliquer un objet N fois le long du tracé.
 * EN : Distributes the selected objects along a guide path, with equal spacing
 *      or a fixed interval, each one optionally rotated to the path tangent.
 *      Can also duplicate one object N times along the path.
 *
 * Cible / Target : Adobe Illustrator CC 2018 – 2026 (ExtendScript, ES3)
 * Statut / Status : non testé dans Illustrator / not tested in Illustrator
 *                   (syntaxe vérifiée avec acorn, géométrie vérifiée sur
 *                   tracés simulés / syntax checked with acorn, geometry
 *                   checked on simulated paths).
 *
 * Usage : sélectionnez le tracé guide (au premier plan, ou le plus long) ET
 *         les objets à répartir, puis lancez le script.
 * Usage: select the guide path (frontmost, or the longest) AND the objects
 *        to distribute, then run the script.
 *
 * Conseillé : travaillez sur une copie du document.
 * Recommended: work on a copy of the document.
 *
 * Aucun appel réseau, aucune collecte de données.
 * No network access, no data collection.
 *
 * Code original. L'idée de « répartir sur un tracé » existe dans d'autres
 * scripts libres (ex. Hiroyuki Sato, shspage/illustrator-scripts) ; aucun code
 * n'en est repris. / Original code; no code taken from other scripts.
 *
 * © 2026 Amirouche Amwanes — Licence MIT / MIT License
 */

(function () {

    // =====================================================================
    // Constantes / Constants
    // =====================================================================
    var SCRIPT_NAME = "RepartirSurTrace";
    var SCRIPT_VERSION = "1.0.0";
    var SAMPLES_PER_SEGMENT = 64;   // précision de la mesure / length accuracy
    var UNITS = [
        { key: "mm", factor: 72 / 25.4 },
        { key: "cm", factor: 72 / 2.54 },
        { key: "pt", factor: 1 },
        { key: "px", factor: 1 },
        { key: "in", factor: 72 }
    ];

    // =====================================================================
    // Langue / Language (FR si Illustrator est en français, sinon EN)
    // =====================================================================
    var LANG = "en";
    try {
        var loc = String(app.locale || $.locale || "");
        if (loc.toLowerCase().indexOf("fr") === 0) { LANG = "fr"; }
    } catch (eLoc) { /* EN par défaut / EN by default */ }

    function L(fr, en) { return LANG === "fr" ? fr : en; }

    // <GEOM> ===============================================================
    // Géométrie des courbes de Bézier / Bezier geometry
    // (bloc indépendant d'Illustrator, testable hors application)
    // (Illustrator-independent block, testable outside the app)
    // =====================================================================

    // Point sur une cubique / point on a cubic Bezier at t
    function bezPoint(s, t) {
        var u = 1 - t;
        var a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
        return [
            a * s.p0[0] + b * s.p1[0] + c * s.p2[0] + d * s.p3[0],
            a * s.p0[1] + b * s.p1[1] + c * s.p2[1] + d * s.p3[1]
        ];
    }

    // Dérivée d'une cubique / derivative of a cubic Bezier at t
    function bezDeriv(s, t) {
        var u = 1 - t;
        var a = 3 * u * u, b = 6 * u * t, c = 3 * t * t;
        return [
            a * (s.p1[0] - s.p0[0]) + b * (s.p2[0] - s.p1[0]) + c * (s.p3[0] - s.p2[0]),
            a * (s.p1[1] - s.p0[1]) + b * (s.p2[1] - s.p1[1]) + c * (s.p3[1] - s.p2[1])
        ];
    }

    function dist2(a, b) {
        var dx = b[0] - a[0], dy = b[1] - a[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    /*
     * Construit un modèle mesurable à partir d'une liste de points
     * { anchor, leftDirection, rightDirection } (format Illustrator).
     * Builds a measurable model from Illustrator-like path points.
     */
    function buildPathModel(points, closed, samples) {
        var segs = [], total = 0, n = points.length, i, k;
        var count = closed ? n : n - 1;
        samples = samples || SAMPLES_PER_SEGMENT;
        for (i = 0; i < count; i++) {
            var a = points[i], b = points[(i + 1) % n];
            var s = {
                p0: a.anchor, p1: a.rightDirection,
                p2: b.leftDirection, p3: b.anchor,
                ts: [0], ls: [0], length: 0, start: total
            };
            var prev = s.p0, acc = 0;
            for (k = 1; k <= samples; k++) {
                var t = k / samples;
                var p = bezPoint(s, t);
                acc += dist2(prev, p);
                s.ts.push(t);
                s.ls.push(acc);
                prev = p;
            }
            s.length = acc;
            if (acc > 1e-9) {
                segs.push(s);
                total += acc;
            }
        }
        return { segments: segs, length: total, closed: closed };
    }

    /*
     * Point et angle (degrés) à la distance d le long du tracé.
     * Point and angle (degrees) at distance d along the path.
     */
    function pointAtDistance(model, d) {
        var segs = model.segments;
        if (segs.length === 0) { return null; }
        if (d < 0) { d = 0; }
        if (d > model.length) { d = model.length; }
        var i, s = segs[segs.length - 1];
        for (i = 0; i < segs.length; i++) {
            if (d <= segs[i].start + segs[i].length + 1e-9) { s = segs[i]; break; }
        }
        var local = d - s.start, k = 1;
        while (k < s.ls.length - 1 && s.ls[k] < local) { k++; }
        var l0 = s.ls[k - 1], l1 = s.ls[k];
        var f = (l1 - l0) > 1e-12 ? (local - l0) / (l1 - l0) : 0;
        if (f < 0) { f = 0; }
        if (f > 1) { f = 1; }
        var t = s.ts[k - 1] + f * (s.ts[k] - s.ts[k - 1]);
        var p = bezPoint(s, t);
        var dv = bezDeriv(s, t);
        if (Math.abs(dv[0]) < 1e-9 && Math.abs(dv[1]) < 1e-9) {
            // Poignée confondue avec l'ancre : on mesure la corde voisine.
            // Handle on the anchor: use a neighbouring chord instead.
            var t0 = Math.max(0, t - 0.01), t1 = Math.min(1, t + 0.01);
            var q0 = bezPoint(s, t0), q1 = bezPoint(s, t1);
            dv = [q1[0] - q0[0], q1[1] - q0[1]];
        }
        return { x: p[0], y: p[1], angle: Math.atan2(dv[1], dv[0]) * 180 / Math.PI };
    }

    /*
     * Distances de placement / placement distances.
     * opts: { mode: "equal"|"interval", count, interval, startPct, endPct }
     */
    function computeDistances(model, opts) {
        var L0 = model.length;
        var a = L0 * opts.startPct / 100;
        var b = L0 * (1 - opts.endPct / 100);
        var out = [], i;
        if (b < a) { return out; }
        var span = b - a;
        var fullLoop = model.closed && opts.startPct === 0 && opts.endPct === 0;
        if (opts.mode === "interval") {
            if (!(opts.interval > 0)) { return out; }
            var limit = opts.count > 0 ? opts.count : 100000;
            for (i = 0; i < limit; i++) {
                var dd = a + i * opts.interval;
                if (dd > b + 1e-6) { break; }
                // boucle fermée : pas de doublon au point de départ
                // closed loop: no duplicate at the starting point
                if (fullLoop && i > 0 && Math.abs(dd - L0) < 1e-6) { break; }
                out.push(dd);
            }
            return out;
        }
        var n = opts.count;
        if (n <= 0) { return out; }
        if (n === 1) { out.push(fullLoop ? a : a + span / 2); return out; }
        var step = fullLoop ? span / n : span / (n - 1);
        for (i = 0; i < n; i++) { out.push(a + i * step); }
        return out;
    }

    // Tri naturel (« 2 » avant « 10 ») / natural sort
    function naturalCompare(x, y) {
        var re = /(\d+|\D+)/g;
        var ax = String(x).toLowerCase().match(re) || [];
        var ay = String(y).toLowerCase().match(re) || [];
        var i, n = Math.min(ax.length, ay.length);
        for (i = 0; i < n; i++) {
            var p = ax[i], q = ay[i];
            var pn = /^\d/.test(p), qn = /^\d/.test(q);
            if (pn && qn) {
                var dn = parseInt(p, 10) - parseInt(q, 10);
                if (dn !== 0) { return dn; }
            } else if (p !== q) {
                return p < q ? -1 : 1;
            }
        }
        return ax.length - ay.length;
    }
    // </GEOM> ==============================================================

    // =====================================================================
    // Outils Illustrator / Illustrator helpers
    // =====================================================================
    function toPlainPoints(pathItem) {
        var pts = [], i, pp = pathItem.pathPoints;
        for (i = 0; i < pp.length; i++) {
            pts.push({
                anchor: [pp[i].anchor[0], pp[i].anchor[1]],
                leftDirection: [pp[i].leftDirection[0], pp[i].leftDirection[1]],
                rightDirection: [pp[i].rightDirection[0], pp[i].rightDirection[1]]
            });
        }
        return pts;
    }

    function reversePoints(pts) {
        var out = [], i;
        for (i = pts.length - 1; i >= 0; i--) {
            out.push({
                anchor: pts[i].anchor,
                leftDirection: pts[i].rightDirection,
                rightDirection: pts[i].leftDirection
            });
        }
        return out;
    }

    // Tracé simple utilisable comme guide / usable single path for a guide
    function guideCandidate(item) {
        if (item.typename === "PathItem") {
            return item.pathPoints.length >= 2 ? item : null;
        }
        if (item.typename === "CompoundPathItem") {
            // sous-tracé le plus long / longest sub-path
            var best = null, bestLen = -1, i;
            for (i = 0; i < item.pathItems.length; i++) {
                var p = item.pathItems[i];
                if (p.pathPoints.length < 2) { continue; }
                var len = buildPathModel(toPlainPoints(p), p.closed, 16).length;
                if (len > bestLen) { bestLen = len; best = p; }
            }
            return best;
        }
        return null;
    }

    function itemCenter(item) {
        var b = item.geometricBounds; // [gauche, haut, droite, bas]
        return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
    }

    function itemHeight(item) {
        var b = item.geometricBounds;
        return Math.abs(b[1] - b[3]);
    }

    function itemName(item) {
        var n = "";
        try { n = item.name; } catch (e1) { /* */ }
        if (!n && item.typename === "TextFrame") {
            try { n = item.contents; } catch (e2) { /* */ }
        }
        return n || "";
    }

    function unitByKey(key) {
        var i;
        for (i = 0; i < UNITS.length; i++) { if (UNITS[i].key === key) { return UNITS[i]; } }
        return UNITS[0];
    }

    function parseNum(txt, fallback) {
        var v = parseFloat(String(txt).replace(",", "."));
        return isNaN(v) ? fallback : v;
    }

    function fmt(v) { return String(Math.round(v * 100) / 100); }

    // =====================================================================
    // Contrôles initiaux / Initial checks
    // =====================================================================
    if (app.documents.length === 0) {
        alert(L("Aucun document ouvert.\nOuvrez un document puis relancez le script.",
                "No document is open.\nOpen a document and run the script again."), SCRIPT_NAME);
        return;
    }
    var doc = app.activeDocument;
    var sel = doc.selection;
    if (sel && sel.typename === "TextRange") {
        alert(L("Vous êtes en train d'éditer du texte.\nQuittez l'édition (Échap) et sélectionnez des objets.",
                "You are editing text.\nLeave text editing (Esc) and select objects."), SCRIPT_NAME);
        return;
    }
    if (!sel || typeof sel.length !== "number" || sel.length === 0) {
        alert(L("Rien n'est sélectionné.\nSélectionnez un tracé guide et les objets à répartir.",
                "Nothing is selected.\nSelect a guide path and the objects to distribute."), SCRIPT_NAME);
        return;
    }
    var items = [], s;
    for (s = 0; s < sel.length; s++) { items.push(sel[s]); }

    // Recherche des guides possibles / find possible guides
    var frontGuide = null, frontIndex = -1, longGuide = null, longIndex = -1, longLen = -1;
    for (s = 0; s < items.length; s++) {
        var cand = guideCandidate(items[s]);
        if (!cand) { continue; }
        if (!frontGuide) { frontGuide = cand; frontIndex = s; }
        var cl = buildPathModel(toPlainPoints(cand), cand.closed, 16).length;
        if (cl > longLen) { longLen = cl; longGuide = cand; longIndex = s; }
    }
    if (!frontGuide) {
        alert(L("Aucun tracé dans la sélection.\nAjoutez un tracé (ligne, courbe, cercle…) qui servira de guide.",
                "No path in the selection.\nAdd a path (line, curve, circle…) to use as the guide."), SCRIPT_NAME);
        return;
    }
    if (items.length < 2) {
        alert(L("Sélectionnez aussi au moins un objet à placer sur le tracé.",
                "Also select at least one object to place on the path."), SCRIPT_NAME);
        return;
    }

    // =====================================================================
    // Dialogue / Dialog
    // =====================================================================
    var w = new Window("dialog", SCRIPT_NAME + " v" + SCRIPT_VERSION);
    w.orientation = "column";
    w.alignChildren = "fill";

    var pGuide = w.add("panel", undefined, L("Tracé guide", "Guide path"));
    pGuide.alignChildren = "left";
    var rbFront = pGuide.add("radiobutton", undefined, L("Le tracé au premier plan de la sélection", "Frontmost path in the selection"));
    var rbLong = pGuide.add("radiobutton", undefined, L("Le tracé le plus long", "Longest path"));
    rbFront.value = true;
    var cbReverse = pGuide.add("checkbox", undefined, L("Inverser le sens du tracé", "Reverse path direction"));

    var pMode = w.add("panel", undefined, L("Mode", "Mode"));
    pMode.alignChildren = "left";
    var rbDistribute = pMode.add("radiobutton", undefined, L("Répartir les objets sélectionnés", "Distribute the selected objects"));
    var rbDuplicate = pMode.add("radiobutton", undefined, L("Dupliquer un seul objet (le 1er hors guide)", "Duplicate one object (first non-guide item)"));
    rbDistribute.value = true;
    var gCount = pMode.add("group");
    gCount.add("statictext", undefined, L("Nombre de copies :", "Number of copies:"));
    var etCount = gCount.add("edittext", undefined, "10");
    etCount.characters = 6;
    var cbKeepSrc = gCount.add("checkbox", undefined, L("Conserver l'original", "Keep the original"));
    cbKeepSrc.value = true;

    var pSpace = w.add("panel", undefined, L("Espacement", "Spacing"));
    pSpace.alignChildren = "left";
    var rbEqual = pSpace.add("radiobutton", undefined, L("Égal sur la longueur utile", "Equal over the usable length"));
    var rbInterval = pSpace.add("radiobutton", undefined, L("Intervalle fixe", "Fixed interval"));
    rbEqual.value = true;
    var gInt = pSpace.add("group");
    gInt.add("statictext", undefined, L("Intervalle :", "Interval:"));
    var etInterval = gInt.add("edittext", undefined, "10");
    etInterval.characters = 7;
    var ddUnit = gInt.add("dropdownlist", undefined, ["mm", "cm", "pt", "px", "in"]);
    ddUnit.selection = 0;
    var gOff = pSpace.add("group");
    gOff.add("statictext", undefined, L("Début (%) :", "Start (%):"));
    var etStart = gOff.add("edittext", undefined, "0");
    etStart.characters = 5;
    gOff.add("statictext", undefined, L("Fin (%) :", "End (%):"));
    var etEnd = gOff.add("edittext", undefined, "0");
    etEnd.characters = 5;

    var pOrient = w.add("panel", undefined, L("Orientation et point d'accroche", "Orientation and anchor point"));
    pOrient.alignChildren = "left";
    var cbRotate = pOrient.add("checkbox", undefined, L("Orienter selon la tangente du tracé", "Rotate to the path tangent"));
    cbRotate.value = true;
    var gAng = pOrient.add("group");
    gAng.add("statictext", undefined, L("Angle supplémentaire (°) :", "Extra angle (°):"));
    var etAngle = gAng.add("edittext", undefined, "0");
    etAngle.characters = 5;
    var gAnch = pOrient.add("group");
    gAnch.add("statictext", undefined, L("Accroche sur le tracé :", "Attach to path at:"));
    var ddAnchor = gAnch.add("dropdownlist", undefined, [
        L("Centre de l'objet", "Object centre"),
        L("Bas de l'objet (posé sur le tracé)", "Object bottom (sits on the path)"),
        L("Haut de l'objet (suspendu au tracé)", "Object top (hangs from the path)")
    ]);
    ddAnchor.selection = 0;
    var gNorm = pOrient.add("group");
    gNorm.add("statictext", undefined, L("Décalage perpendiculaire :", "Perpendicular offset:"));
    var etNormal = gNorm.add("edittext", undefined, "0");
    etNormal.characters = 6;
    gNorm.add("statictext", undefined, L("(même unité)", "(same unit)"));

    var pOrder = w.add("panel", undefined, L("Ordre des objets", "Object order"));
    pOrder.alignChildren = "left";
    var ddOrder = pOrder.add("dropdownlist", undefined, [
        L("Ordre d'empilement (premier plan d'abord)", "Stacking order (front first)"),
        L("Position : gauche → droite", "Position: left → right"),
        L("Position : haut → bas", "Position: top → bottom"),
        L("Nom (tri naturel)", "Name (natural sort)"),
        L("Aléatoire", "Random")
    ]);
    ddOrder.selection = 1;
    var cbInvertOrder = pOrder.add("checkbox", undefined, L("Inverser l'ordre", "Reverse the order"));
    var cbGroup = pOrder.add("checkbox", undefined, L("Grouper le résultat", "Group the result"));

    w.add("statictext", undefined, L("Conseil : travaillez sur une copie. Annulation : Ctrl/Cmd+Z.",
                                      "Tip: work on a copy. Undo: Ctrl/Cmd+Z."));

    var gBtn = w.add("group");
    gBtn.alignment = "right";
    var btAnalyze = gBtn.add("button", undefined, L("Analyser", "Analyze"));
    var btCancel = gBtn.add("button", undefined, L("Annuler", "Cancel"), { name: "cancel" });
    var btOk = gBtn.add("button", undefined, L("Appliquer", "Apply"), { name: "ok" });

    function refreshUI() {
        var dup = rbDuplicate.value;
        etCount.enabled = dup;
        cbKeepSrc.enabled = dup;
        gInt.enabled = rbInterval.value;
        ddOrder.enabled = !dup;
        cbInvertOrder.enabled = !dup;
        gAng.enabled = true;
    }
    rbDistribute.onClick = rbDuplicate.onClick = rbEqual.onClick = rbInterval.onClick = refreshUI;
    refreshUI();

    // Lecture des réglages / read settings
    function readSettings() {
        var u = unitByKey(ddUnit.selection ? ddUnit.selection.text : "mm");
        var st = {
            useLongest: rbLong.value,
            reverse: cbReverse.value,
            duplicate: rbDuplicate.value,
            keepSource: cbKeepSrc.value,
            count: Math.floor(parseNum(etCount.text, 0)),
            mode: rbInterval.value ? "interval" : "equal",
            interval: parseNum(etInterval.text, 0) * u.factor,
            startPct: Math.max(0, Math.min(100, parseNum(etStart.text, 0))),
            endPct: Math.max(0, Math.min(100, parseNum(etEnd.text, 0))),
            rotate: cbRotate.value,
            extraAngle: parseNum(etAngle.text, 0),
            anchor: ddAnchor.selection ? ddAnchor.selection.index : 0,
            normal: parseNum(etNormal.text, 0) * u.factor,
            order: ddOrder.selection ? ddOrder.selection.index : 0,
            invertOrder: cbInvertOrder.value,
            group: cbGroup.value,
            unit: u
        };
        return st;
    }

    // Prépare le plan (sans rien modifier) / build the plan (no changes)
    function buildPlan(st) {
        var guide = st.useLongest ? longGuide : frontGuide;
        var guideIdx = st.useLongest ? longIndex : frontIndex;
        var pts = toPlainPoints(guide);
        if (st.reverse) { pts = reversePoints(pts); }
        var model = buildPathModel(pts, guide.closed, SAMPLES_PER_SEGMENT);
        var objs = [], i;
        for (i = 0; i < items.length; i++) {
            if (i === guideIdx) { continue; }
            // le guide peut être un sous-tracé d'un tracé composé sélectionné
            if (items[i] === guide.parent && guide.parent.typename === "CompoundPathItem") { continue; }
            objs.push(items[i]);
        }
        var plan = { guide: guide, model: model, objects: objs, distances: [], errors: [] };
        if (model.length <= 0) {
            plan.errors.push(L("Le tracé guide a une longueur nulle.", "The guide path has zero length."));
            return plan;
        }
        if (objs.length === 0) {
            plan.errors.push(L("Aucun objet à placer (seul le guide est sélectionné).",
                               "No object to place (only the guide is selected)."));
            return plan;
        }
        if (st.startPct + st.endPct >= 100) {
            plan.errors.push(L("Début + fin doivent rester inférieurs à 100 %.",
                               "Start + end must stay below 100%."));
            return plan;
        }
        if (st.mode === "interval" && !(st.interval > 0)) {
            plan.errors.push(L("L'intervalle doit être supérieur à 0.", "The interval must be greater than 0."));
            return plan;
        }
        if (st.duplicate) {
            if (st.mode === "equal" && st.count < 1) { // 0 accepté en intervalle / 0 allowed for interval
                plan.errors.push(L("Le nombre de copies doit être au moins 1.", "The number of copies must be at least 1."));
                return plan;
            }
            plan.objects = [objs[0]];
            plan.distances = computeDistances(model, {
                mode: st.mode,
                // en intervalle fixe, le nombre est un maximum (0 = illimité)
                // with a fixed interval the count is a maximum (0 = unlimited)
                count: st.count, interval: st.interval,
                startPct: st.startPct, endPct: st.endPct
            });
        } else {
            plan.objects = sortObjects(objs, st);
            plan.distances = computeDistances(model, {
                mode: st.mode,
                count: objs.length,
                interval: st.interval, startPct: st.startPct, endPct: st.endPct
            });
        }
        return plan;
    }

    function sortObjects(objs, st) {
        var arr = objs.slice(0), i;
        var keyed = [];
        for (i = 0; i < arr.length; i++) {
            var c = itemCenter(arr[i]);
            keyed.push({ item: arr[i], idx: i, x: c[0], y: c[1], name: itemName(arr[i]), r: Math.random() });
        }
        var cmp;
        if (st.order === 1) {
            cmp = function (a, b) { return (a.x - b.x) || (b.y - a.y) || (a.idx - b.idx); };
        } else if (st.order === 2) {
            cmp = function (a, b) { return (b.y - a.y) || (a.x - b.x) || (a.idx - b.idx); };
        } else if (st.order === 3) {
            cmp = function (a, b) { return naturalCompare(a.name, b.name) || (a.idx - b.idx); };
        } else if (st.order === 4) {
            cmp = function (a, b) { return a.r - b.r; };
        } else {
            cmp = function (a, b) { return a.idx - b.idx; };
        }
        keyed.sort(cmp);
        var out = [];
        for (i = 0; i < keyed.length; i++) { out.push(keyed[i].item); }
        if (st.invertOrder) { out.reverse(); }
        return out;
    }

    function planSummary(plan, st) {
        var u = st.unit;
        var lines = [];
        lines.push(L("Longueur du guide : ", "Guide length: ") + fmt(plan.model.length / u.factor) + " " + u.key +
                   (plan.model.closed ? L(" (fermé)", " (closed)") : L(" (ouvert)", " (open)")));
        if (plan.errors.length) {
            lines.push("");
            lines.push(plan.errors.join("\n"));
            return lines.join("\n");
        }
        var n = plan.distances.length;
        if (st.duplicate) {
            lines.push(L("Copies prévues : ", "Planned copies: ") + n);
        } else {
            lines.push(L("Objets à placer : ", "Objects to place: ") + plan.objects.length);
            lines.push(L("Positions disponibles : ", "Available positions: ") + n);
            if (n < plan.objects.length) {
                lines.push(L("→ ", "→ ") + (plan.objects.length - n) +
                           L(" objet(s) resteront en place (intervalle trop grand).",
                             " object(s) will stay in place (interval too large)."));
            }
        }
        if (n >= 2) {
            lines.push(L("Écart entre positions : ", "Gap between positions: ") +
                       fmt((plan.distances[1] - plan.distances[0]) / u.factor) + " " + u.key);
        }
        return lines.join("\n");
    }

    btAnalyze.onClick = function () {
        var st = readSettings();
        alert(planSummary(buildPlan(st), st), SCRIPT_NAME + " — " + L("Analyse", "Analysis"));
    };

    if (w.show() !== 1) { return; }

    // =====================================================================
    // Application / Apply
    // =====================================================================
    var settings = readSettings();
    var plan = buildPlan(settings);
    if (plan.errors.length) {
        alert(plan.errors.join("\n"), SCRIPT_NAME);
        return;
    }
    if (plan.distances.length === 0) {
        alert(L("Aucune position calculée : vérifiez l'intervalle et les décalages.",
                "No position computed: check the interval and offsets."), SCRIPT_NAME);
        return;
    }

    // Place un objet : rotation autour de son centre puis translation.
    // Places one object: rotate around its centre, then translate.
    function placeItem(item, pos, st) {
        var c0 = itemCenter(item);   // centre avant rotation (point fixe)
        var h = itemHeight(item);
        var ang = st.extraAngle + (st.rotate ? pos.angle : 0);
        if (Math.abs(ang) > 1e-6) {
            item.rotate(ang, true, true, true, true, Transformation.CENTER);
        }
        // direction « haut » de l'objet après rotation / object's "up" after rotation
        var rad = ang * Math.PI / 180;
        var ux = -Math.sin(rad), uy = Math.cos(rad);
        var lift = st.normal;
        if (st.anchor === 1) { lift += h / 2; }
        if (st.anchor === 2) { lift -= h / 2; }
        var tx = pos.x + ux * lift, ty = pos.y + uy * lift;
        item.translate(tx - c0[0], ty - c0[1]);
    }

    var placed = [], skipped = 0, failed = 0, i;
    try {
        if (settings.duplicate) {
            var src = plan.objects[0];
            for (i = 0; i < plan.distances.length; i++) {
                var posD = pointAtDistance(plan.model, plan.distances[i]);
                try {
                    var dup = src.duplicate();
                    placeItem(dup, posD, settings);
                    placed.push(dup);
                } catch (eDup) { failed++; }
            }
            if (!settings.keepSource) {
                try { src.remove(); } catch (eRm) { /* */ }
            }
        } else {
            for (i = 0; i < plan.objects.length; i++) {
                if (i >= plan.distances.length) { skipped++; continue; }
                var pos = pointAtDistance(plan.model, plan.distances[i]);
                try {
                    placeItem(plan.objects[i], pos, settings);
                    placed.push(plan.objects[i]);
                } catch (ePl) { failed++; }
            }
        }

        if (settings.group && placed.length > 0) {
            try {
                var grp = plan.guide.layer.groupItems.add();
                grp.move(plan.guide.parent.typename === "CompoundPathItem" ? plan.guide.parent : plan.guide,
                         ElementPlacement.PLACEBEFORE);
                for (i = placed.length - 1; i >= 0; i--) {
                    placed[i].move(grp, ElementPlacement.PLACEATBEGINNING);
                }
                grp.name = L("Répartis sur tracé", "Distributed on path");
            } catch (eGrp) { /* le groupement est facultatif / grouping is optional */ }
        }
    } catch (eAll) {
        alert(L("Erreur : ", "Error: ") + eAll.message + "\n" +
              L("Utilisez Ctrl/Cmd+Z pour annuler.", "Use Ctrl/Cmd+Z to undo."), SCRIPT_NAME);
        return;
    }

    try { doc.selection = placed; } catch (eSel) { /* */ }
    try { app.redraw(); } catch (eRd) { /* */ }

    var msg = L("Objets placés : ", "Objects placed: ") + placed.length;
    if (skipped) { msg += "\n" + L("Laissés en place (pas de position) : ", "Left in place (no position): ") + skipped; }
    if (failed) { msg += "\n" + L("Échecs : ", "Failures: ") + failed; }
    alert(msg, SCRIPT_NAME + " v" + SCRIPT_VERSION);

})();

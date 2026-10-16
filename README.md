# RepartirSurTrace.jsx — Répartir des objets le long d'un tracé (Illustrator)

**v1.0.0** · Adobe Illustrator **CC 2018 – 2026** · ExtendScript (ES3) · Licence MIT · FR / EN

> **Statut de test : non testé dans Illustrator.** La syntaxe a été vérifiée avec
> [acorn](https://github.com/acornjs/acorn) (ECMAScript 3) et le calcul géométrique
> (longueur de Bézier, points, tangentes, espacements) avec des tracés simulés
> (`tests/geom.test.js`, 16 vérifications). Merci de signaler tout problème via les *Issues*.
>
> **Test status: not tested in Illustrator.** Syntax checked with acorn (ES3);
> geometry checked on simulated paths.

---

## 🇫🇷 Français

Place les objets sélectionnés **le long d'un tracé guide** (ligne, courbe, cercle,
spirale…), à **espacement égal** ou à **intervalle fixe**, chacun **orienté selon la
tangente** du tracé si vous le souhaitez. Contrairement à l'outil natif *Objets sur
un tracé*, chaque objet reçoit **sa propre rotation**, et le script peut aussi
**dupliquer un objet N fois** le long du tracé (perles, pointillés décoratifs,
texte en arc fait de lettres vectorisées, frises, logos circulaires…).

> **Conseil : travaillez sur une copie du document.** Les modifications s'annulent
> avec **Ctrl/Cmd + Z** (selon la version d'Illustrator, plusieurs annulations
> peuvent être nécessaires).

### Fonctionnalités

- **Tracé guide** : le tracé au premier plan de la sélection, ou le plus long ;
  tracés ouverts, fermés et tracés composés (sous-tracé le plus long) ; sens inversable.
- **Deux modes** :
  - **Répartir** les objets sélectionnés (un objet par position) ;
  - **Dupliquer** le premier objet hors guide (nombre de copies, original conservé ou supprimé).
- **Espacement** :
  - **égal** sur la longueur utile (extrémités incluses sur un tracé ouvert,
    pas de doublon au point de départ sur un tracé fermé) ;
  - **intervalle fixe** en mm / cm / pt / px / in (en mode Dupliquer, le nombre
    de copies sert alors de maximum, 0 = autant que possible).
- **Début / fin (%)** : laisse une marge au début et à la fin du tracé.
- **Orientation** : rotation selon la tangente (case à cocher) + angle supplémentaire.
- **Point d'accroche** : centre, bas de l'objet (posé sur le tracé) ou haut
  (suspendu), plus un **décalage perpendiculaire**.
- **Ordre** : empilement, gauche → droite, haut → bas, nom (tri naturel « 2 » avant
  « 10 »), aléatoire ; ordre inversable.
- **Grouper le résultat** (facultatif).
- **Bouton Analyser** : longueur du guide, nombre de positions, écart — **sans rien modifier**.
- Messages clairs si aucun document n'est ouvert, si rien n'est sélectionné, si
  aucun tracé n'est trouvé ou si du texte est en cours d'édition.
- **Interface FR / EN** selon la langue d'Illustrator.

### Installation

1. Téléchargez `RepartirSurTrace.jsx`.
2. **Usage ponctuel** : **Fichier > Scripts > Autre script…** (`Ctrl/Cmd + F12`).
3. **Installation permanente** : copiez le fichier dans `Presets/<langue>/Scripts`
   puis redémarrez Illustrator ; il apparaîtra dans **Fichier > Scripts** :
   - Windows : `C:\Program Files\Adobe\Adobe Illustrator <version>\Presets\fr_FR\Scripts\`
   - macOS : `/Applications/Adobe Illustrator <version>/Presets/fr_FR/Scripts/`

### Usage

1. Ouvrez une **copie** de votre document.
2. Sélectionnez le **tracé guide** et les **objets** à placer (le guide au premier
   plan, ou choisissez « le plus long » dans le dialogue).
3. Lancez le script, réglez mode, espacement, orientation et ordre.
4. Cliquez sur **Analyser** pour vérifier, puis sur **Appliquer**.

### Bon à savoir

- Le tracé guide n'est jamais modifié.
- La rotation se fait autour du centre de chaque objet, puis l'objet est déplacé
  sur le tracé : la forme et l'aspect sont conservés (motifs et dégradés suivent).
- En intervalle fixe, si le tracé est trop court, les objets en trop restent en
  place et sont comptés dans le résumé.
- Aucun appel réseau, aucune collecte de données.

---

## 🇬🇧 English

Places the selected objects **along a guide path** with **equal spacing** or a
**fixed interval**, each optionally **rotated to the path tangent**. Unlike the
built-in *Objects on Path* tool, every object gets **its own rotation**, and the
script can also **duplicate one object N times** along the path.

- Guide: frontmost or longest selected path (open, closed, compound); reversible direction.
- Modes: distribute the selection, or duplicate the first non-guide object.
- Spacing: equal or fixed interval (mm, cm, pt, px, in), start/end margins in %.
- Orientation: tangent rotation + extra angle; attach at centre, bottom or top, with a perpendicular offset.
- Order: stacking, left → right, top → bottom, natural name sort, random; reversible.
- Optional grouping, **Analyze** button (no changes), FR/EN UI.

**Install:** **File > Scripts > Other Script…**, or copy into `Presets/<locale>/Scripts`
and restart Illustrator. **Work on a copy**; undo with **Ctrl/Cmd + Z**.

**Target:** Illustrator CC 2018 – 2026. **Not tested in Illustrator.**

### Tests (hors Illustrator / outside Illustrator)

```bash
node tests/geom.test.js
```

## Licence

MIT © 2026 Amirouche Amwanes — voir [LICENSE](LICENSE).

L'idée de répartir des objets sur un tracé existe dans d'autres scripts libres
(par ex. ceux de Hiroyuki Sato, `shspage/illustrator-scripts`) ; ce script est
écrit de zéro et n'en reprend aucun code.

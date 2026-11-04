# Atlas of propaganda techniques

Live at https://botfather-dev.github.io/propaganda-atlas/

An interactive map of propaganda techniques and documented cases. Each card links its claims to sources and shows what the available evidence can and cannot establish.

## Reading a card

Choose a technique, case, or family in the map. A card gives its title, description, sources, and links to related cards. Read the source locator with its link: it points to the passage or material used. The status and gaps describe the limits of the evidence. Switch languages with the language control.

## Links to cards

Every card has a stable link. The address ends in `#t/T15` for a technique, `#p/tape` for a case, or `#f/F-DODGE` for a family, where the part after the slash is the card's id. Opening such a link shows that card. Older links of the form `#T15` still open the same card.

## Marks

Marks on cards (picks, skips, and short notes) stay in the visitor's browser. Nothing is sent anywhere. A browser keeps its marks separately for each page address. The panel called Move your marks offers Export and Import. Export saves a file, `atlas-marks.json`, and shows the same marks as a line of text. Import reads such a file or a pasted line and adds the marks back, each on its own card.

## Comments

Comments are off for now. A card's Comments section says so, and no discussion loads.

## Build

This repository holds the built page in `docs/`, its source data in `content/atlas.json`, and the page parts in `src/`: the template, styles, script, English labels, and bundled fonts. The build tooling is outside this repository.

`docs/index.html` is one self-contained file. It works without a network connection and can be opened directly in a browser or served as a static site from `docs/`.

The fonts are distributed under their respective SIL Open Font Licenses. See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

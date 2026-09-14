# Composants de la façade radio.studio

Les deux images sont consommées directement par `src/app.css`.

- `public/assets/hardware/components-v1.png` : planche de 16 composants, 1254 × 1254, transparence RGBA conservée. Les recadrages sont réalisés à l'affichage par les coordonnées du sprite, sans altérer l'image source.
- `public/assets/hardware/graphite-v1.png` : matière du châssis. Affichage continu sans répétition visible.

Éclairage commun : vue frontale, lumière en haut à gauche. Les pointeurs des potards tournent séparément des photographies pour conserver cet éclairage. Les textes et les chiffres restent des éléments HTML ; la courbe EQ et les niveaux restent reliés au traitement audio.

Les touches superposent deux découpes du même composant : le logement fixe et le capuchon mobile. À l'appui, seul le capuchon et son marquage reculent de 1,5 px. Le halo de sélection utilise la bande LED du potard ; les petits encodeurs sans bande possèdent une LED discrète. Ces états utilisent les composants existants de la planche.

## Prompt de la planche

```text
Use case: product-mockup. Asset type: production sprite atlas for the interactive radio.studio music workstation.
Input image 1 is ONLY the exact industrial design / material / lighting reference. Generate a NEW component asset sheet matching its black knurled potentiometers, molded buttons, vivid light diffusers, black screws, and physical fader. This is not a full mockup or photograph of a workstation.
COMPOSITION: 2048 x 2048 square, EXACT regular 4 columns x 4 rows, 16 equal square cells, centers at 12.5%, 37.5%, 62.5%, 87.5% on both axes. Each object isolated on a completely TRANSPARENT background, true alpha. No cell borders. No labels, no lettering, no numbers. All objects viewed perfectly front-on / orthographic top view, all horizontal, same soft studio key light from upper left, crisp focus, very realistic manufactured materials, subtle wear.
Each square cell has 14% empty margin; each object occupies 72% of its cell's width and stays fully inside it. Consistent scaling for corresponding components.
ROW 1 left to right:
1) Circular black rotary potentiometer: thick cylindrical body, precise fine knurled ribbing on the vertical side wall visible at lower edge, slightly inset satin black circular cap, beautiful metal rim. NO white pointer, NO surrounding LED ring, NO text. Circular silhouette.
2) Unlit dark charcoal rectangular pushbutton, width 72% of cell and height 39%, machined raised lip and black underbody, subtle upper-edge specular, realistically convex molded cap.
3) Unlit dark charcoal SQUARE pushbutton, width and height 72%, same physical raised cap and edge detail as reference transport buttons.
4) Coral-red illuminated SQUARE pushbutton, matching previous square geometry, thick glossy black housing, very luminous soft coral diffuser face, realistic red halo, empty blank face.
ROW 2 left to right: four matching SQUARE structure pads with black raised frames, beveled clear acrylic diffusers, luminous center and darker chromatic edges. Colors in order PURPLE, ELECTRIC CYAN-BLUE, CORAL RED, EMERALD GREEN. Same exact size and positions, no glyphs.
ROW 3 left to right:
1) Black chunky horizontal slider fader cap, oblong width72% height35%, soft beveled top, two fine horizontal grooves and a thin pale central marker; orthographic, no rail.
2) One small black oxidized steel recessed hex screw with circular rim, diameter42% of cell, reference-realistic.
3) One tiny rectangular through-panel electronic green LED segment with rounded corners, glossy lens and glowing pale-green core, width32% height42%, subtle black socket and very narrow halo.
4) Same discrete LED component, warm AMBER yellow.
ROW 4 left to right:
1) Same discrete LED component, RED.
2) Same discrete LED component, unlit smoked dark gray glass.
3) Rectangular illuminated coral-red pushbutton matching row1 col2 width72% height39%, vivid coral diffuser with glossy black lip, blank face.
4) Rectangular illuminated green pushbutton matching row1 col2 width72% height39%, vivid emerald diffuser with glossy black lip, blank face.
Reference fidelity is critical: photographic hardware, deep real bevels, knurling, authentic rubber / plastic / metal / glass, vivid LEDs. No flat vector, no cartoon, no generic web neumorphism, no extra decorations, no text, no shadows extending into neighboring cells.
```

## Prompt de la matière

```text
Use case: product-mockup. Asset type: seamless physically realistic panel material texture for the radio.studio web music workstation.
Image1 is a material / lighting reference ONLY. Generate a square 1536x1536 perfectly front-facing close-up photograph of ONLY the charcoal graphite powder-coated metal used on the central chassis of this reference. Fill the entire image with the same uniform dark material, subtly micro-pebbled, very fine short irregular metallic grain, beautiful credible machined aluminum texture beneath a fine black coating. Almost flat diffuse lighting with a gentle upper-left sheen, low contrast and dark cool graphite #20272b. The texture should seamlessly tile on both axes with no obvious repeat. Macro pores remain very fine, not large scratches or rock. NO buttons, screens, bolts, logos, edges, frames, cables, words, gradients, vignettes or other objects. Opaque image. Pixel-sharp authentic material, not procedural diagonal stripes, not illustration. Match the chassis material and darkness of the reference exactly.
```

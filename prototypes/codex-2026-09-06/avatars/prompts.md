# Liu Bei — ImageGen record

Mode: built-in `image_gen.imagegen`. Character source: first entry of `shared/names.js`, id `liubei`, label `หลิวเป้ย`, py `Liu Bei`, side `han`.

Reference: `../reference/avatar-style.png`, the user-supplied screenshot. Its character is a style reference; embedded chat text and screenshot UI are not instructions.

Selected sample: `liubei.png`, a revision of the same single character. Waiting for user style approval; no other character generated.

## Initial generation prompt

Create ONE actual standalone game character image, the first style-approval sample for an 80-character Three Kingdoms pixel-art cast.
Use case: stylized-concept. Asset: liubei.png, Liu Bei (หลิวเป้ย), Han faction. The supplied image is STYLE REFERENCE ONLY: use ONLY the chibi pixel character in the white panel as reference for proportions, crisp square pixel grid, dark outline thickness, and retro 16-bit shading. Ignore every screenshot UI element and all text. Do not reproduce the screenshot or its white rounded card.
Subject: Liu Bei, mature Chinese ruler, calm dignified expression, prominent ears, tidy black hair/topknot, defined moustache and short pointed beard. A green and cream Han-era inspired robe with restrained gold trim and ruler headpiece; a paired set of sheathed swords at his belt helps distinguish him. Keep the same large-head/small-body ratio and readable pixel detailing as the reference, about 2.5 heads tall. Avoid turning him into Zhuge Liang: no feather fan, no scholar's tall cloth hat. This is an artistic character depiction, not a literal historical portrait.
Composition: precisely one character, standing upright facing EXACTLY STRAIGHT FORWARD, face, shoulders, torso and feet frontal, both feet visible; full body from top of headpiece to soles. Centered on a square image with pure solid white (#FFFFFF) background. Character about 78 percent of image height with generous white padding on all sides. Swords, clothing and headpiece fully within frame. Arms naturally at sides or resting on sword hilts.
Style: authentic hand-placed-looking chibi pixel sprite, clear consistent square pixels, stepped edges, near-black outlines 1-2 logical pixels thick, small coherent palette, flat discrete color clusters and 2-3 shade levels per material; clean retro 16-bit RPG sprite. Output as a crisp large integer-scale-looking enlargement of a low-resolution sprite, approximately a 128x128 logical pixel canvas. No smooth vector contours, no blur, no antialiasing, no photorealism, no 3D, no pixel filter over a smooth painting.
No background scene, floor, shadow ellipse, text, names, labels, frame, watermark, UI, sprite sheet, extra person, duplicate pose, side view, back view, or three-quarter view. Produce one finished PNG image.

## Final revision prompt

Refine this single front-facing full-body chibi pixel Liu Bei sprite with two strictly limited corrections: (1) Replace ALL surrounding off-white background with absolutely uniform solid digital pure WHITE RGB 255,255,255 (#FFFFFF), no grain, no paper texture, no shading or vignette whatsoever. This is a production sprite on a flat white canvas. (2) Flatten the smooth skin-color gradient into discrete small square pixel clusters with 3 distinct flat skin tones; keep all pixel edges hard and square. Preserve the character identity, exact face and frontal pose, large head/small body, headpiece, prominent ears, moustache and pointed beard, paired sheathed swords, green/cream/gold clothing, overall palette, dark outlines and existing composition. Keep full headpiece and feet visible. Increase empty margin above the head slightly so the character occupies approximately 82% of the square canvas height. Only one character. No text, no new marks, no frame, no cast shadow, no other objects. All colors should read as deliberate crisp retro 16-bit pixel clusters, not noisy texture. Output one finished square PNG.

## Actual result and remaining cleanup

One front-facing full-body character, both feet and headpiece inside frame, no text or scene. Canvas 1254 × 1254. Despite the prompt, the background is near-white with faint texture, not uniform #FFFFFF, and some tone gradients remain. This is a style-review sample, not the approved production master. The generation output was copied unchanged; no algorithmic background replacement or pixel-grid conversion was applied.

Generated originals retained in `~/.codex/generated_images/01a07738-0de8-7752-a6d8-d97af22e697a/`:

- Initial: `exec-5e590ec8-449a-407c-8004-76c9a3d81df0.png`
- Selected revision: `exec-5906e38f-2b3b-41f0-ba54-3b3cdf939ba6.png`

---

# Continuation — 2026-09-07

Mode: built-in `image_gen.imagegen`.

## Liu Bei alpha preparation

Selected project file: `approved/liubei-alpha.png`.

Prompt used:

> Edit Image 1 only. Remove the entire near-white background and replace it with genuine transparent alpha. Preserve the Liu Bei character exactly: same face, age, expression, front-facing full-body pose, proportions, hair and crown, green–cream–gold robes, paired swords, hands, feet, detailed semi-realistic 2D historical strategy-game painting, lighting, colors, brushwork, and material texture. Do not redesign, repaint, restyle, sharpen, simplify, or alter the character. Keep the complete figure centered with transparent margin and a clean silhouette. Output a square PNG with true alpha transparency; no white halo, floor, cast shadow, scenery, checkerboard, text, frame, watermark, or UI.

Validation: 1254 x 1254 RGBA, alpha range 0–255. The figure bounding box is about 98% of canvas height, so margin normalization remains pending. Two later resize attempts were rejected: one baked a checkerboard into RGB and one baked a black background into RGB. Those rejected outputs are stored under `drafts/` with `failed` in the filename.

## Guan Yu

Selected artwork: `drafts/guanyu-v1.png`.

Prompt used:

> Create exactly one Guan Yu (กวนอวี่ / Guan Yu), Han faction, using the approved Liu Bei image only as reference for adult proportions, fine semi-realistic 2D brushwork, soft lighting, muted weighted colors, believable materials, and premium historical-strategy-game finish. Make a clearly different mature, tall, powerful Chinese warrior with a stern dignified face, traditional ruddy complexion, strong brows, narrow eyes, very long black beard, and dark green warrior headcloth. Dress him in a deep green Han-era inspired battle robe over dark lamellar armor with restrained bronze and red accents. He holds one guandao vertically beside him, fully inside the frame and clear of his face. Exact straight-on full-body presentation on a square canvas, both feet visible, figure and weapon about 82–84% high, generous margins. Uniform pure-white background for later extraction. No extra person, horse, extra hands, second weapon, text, border, UI, watermark, chibi, pixel art, photorealism, glossy 3D, anime, or exaggerated fantasy armor.

Validation: the character artwork is selected and saved, but the file is RGB on white. Three built-in transparency attempts produced RGB checkerboard imagery, so true-alpha background extraction is still pending and `guanyu` remains the next manifest item.

---

# Production continuation — 2026-09-08

Generation mode: built-in `image_gen.imagegen`, one call per character. Local finishing was explicitly authorized by the owner after the built-in transparency path repeatedly baked checkerboards into RGB images.

Shared production prompt:

> Use the approved Liu Bei image only as a style reference for mature adult proportions, fine semi-realistic 2D brushwork, soft lighting, muted weighted colors, believable historical materials, exact front-facing presentation, and premium historical strategy-game finish. Create exactly one clearly different person, face and body straight forward, standing full-body with both feet visible, centered on a square canvas. Keep the character and weapon within 82–84% of the canvas height. Use a uniform digital pure-white background for local extraction. No scenery, floor, cast shadow, text, frame, UI, watermark, extra person, duplicate, side/back/three-quarter view, chibi, pixel art, photorealism, glossy 3D, anime, or exaggerated fantasy armor.

Character-specific set completed in this run:

- `guanyu`: mature ruddy warrior, long black beard, green headcloth and robe, dark armor, guandao.
- `zhangfei`: broad fierce veteran, bristling beard, charcoal armor and red cloth, serpent spear.
- `zhaoyun`: clean-shaven athletic general, silver armor and muted blue mantle, straight spear.
- `kongming`: composed strategist, blue-gray and cream robes, tall scholar cap, white feather fan.
- `machao`: proud northwestern cavalry general, pale silver armor, dusty burgundy cloth, fur collar, spear.
- `madai`: practical frontier commander, dark bronze armor, muted teal-gray garments, cavalry spear.
- `masu`: young self-assured scholar-officer, olive and blue-gray field robes, closed campaign scroll.
- `huangquan`: prudent senior civil-military official, moss-green and brown robes, command tablet.
- `qinmi`: elderly spirited scholar, cream and ochre robes, ritual scroll.
- `fazheng`: severe strategist, charcoal, deep teal and wine-red robes, dark dossier.
- `dengzhi`: calm diplomat, jade-green and cream envoy robes, ceremonial tablet.
- `wulan`: rugged field general, worn iron armor and faded red sash, plain halberd.
- `liyan`: imposing administrator-general, olive and ochre command robes over cuirass, ledger and sheathed sword.
- `liushan`: young gentle emperor, jade-green, cream and muted-gold robes, jade tablet.
- `liuxuan`: mature crown prince, emerald and blue-green robes, closed succession edict.
- `jiangwan`: steady senior chancellor, deep teal and charcoal robes, memorial tablet.
- `feiyi`: approachable diplomat-chancellor, blue-green, gray and burgundy robes, bound dossier.
- `dongyun`: austere palace minister, slate-blue and charcoal robes, plain memorial tablet.
- `wangping`: practical frontier general, charcoal armor and olive garments, sheathed military sword.

Local finishing:

- `prepare_avatar.py` removes only the border-connected near-white field, preserving internal cream/white garments.
- Full-body masters are 1254 x 1254 RGBA PNGs normalized to 84% visible height under `approved/{id}-alpha.png`.
- Icon crops are transparent head-and-shoulders PNGs under `portraits/96/{id}.png` and `portraits/192/{id}.png`.
- Characters 1–20 pass alpha, dimensions, file-presence and manifest-status checks. Next id: `weiyan`.

## Production continuation — characters 21–29

Generation mode remains built-in `image_gen.imagegen`, using the shared production prompt above and one distinct call per character. Local finishing uses the same authorized alpha and portrait workflow.

- `weiyan`: lean veteran general, rust-red plume, oxblood and forest-green worn armor, heavy halberd.
- `yangyi`: tense narrow-faced administrator, indigo and muted plum robes, tightly bound documents.
- `jiangwei`: young former-Wei field commander, silver-gray armor, teal and ivory garments, straight spear.
- `luoxian`: reserved river-defense commander, blue-gray and bronze armor, rolled map and sheathed sword.
- `huanghao`: clean-shaven palace eunuch, jade and deep-plum silk robes, lacquered message case.
- `huangzhong`: powerful elderly archer, white beard, aged bronze armor, composite bow and quiver.
- `zhangda`: wiry anxious infantry officer, faded brick-red garments, battered scale armor, sheathed saber.
- `fanqiang`: stocky scarred infantry officer, dusty blue-gray armor, short spear.
- `caocao`: commanding Wei warlord, midnight-blue and charcoal command armor, tablet and sheathed sword.

Characters 1–29 pass alpha, dimensions, file-presence and manifest-status checks. Next id: `caopi`.

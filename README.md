# QXP → InDesign Converter

An Adobe InDesign ExtendScript that converts QuarkXPress `.qxd` / `.qxt` files
to native InDesign `.indd` format — with automatic link resolution, text-overflow
detection, font auditing, and a detailed conversion report.

---

## Requirements

| Requirement | Detail |
|---|---|
| **Adobe InDesign** | CS4 or later (CC recommended) |
| **QXP Converter plug-in** | Included in InDesign CS4+. For QXP 5–9 files use InDesign CC 2019+ |
| **Operating system** | macOS or Windows |
| **QuarkXPress version** | QXP 3.3 – 4.x (all InDesign versions) · QXP 5 – 9.x (InDesign CC 2019+) |

> **Need to convert QXP 2015/2016/2017/2019/2020/2023 files?**
> These newer formats are not supported by InDesign's built-in converter.
> Consider **[Markzware Q2ID](https://markzware.com/products/q2id/)** or the
> **Quark IDXT** export plug-in, then rerun this script on the resulting QXD.

---

## Installation

### macOS
```
~/Library/Preferences/Adobe InDesign/<version>/Scripts/Scripts Panel/
```

### Windows
```
%APPDATA%\Adobe\InDesign\<version>\<language>\Scripts\Scripts Panel\
```

**Quick path from InDesign:**
1. Open the **Scripts** panel: `Window ▸ Utilities ▸ Scripts`
2. Right-click **User** and choose **Reveal in Finder / Explorer**
3. Drop `QXP_to_InDesign_Converter.jsx` into that folder
4. It will appear in the panel immediately — no restart needed

---

## Usage

1. Open Adobe InDesign (no document needs to be open)
2. In the **Scripts** panel, double-click `QXP_to_InDesign_Converter`
3. Follow the four-step wizard:

   | Step | Action |
   |---|---|
   | **Welcome** | Read requirements, click *Select Files* |
   | **Source** | Pick a single `.qxd` file **or** a whole folder for batch conversion |
   | **Options** | Choose link handling, text overflow, and output preferences |
   | **Report** | Review the conversion summary; optionally save it as a `.txt` file |

4. Converted `.indd` files are saved **next to the originals** (or with a
   `_converted` suffix if an `.indd` already exists there).

---

## What the Script Does

### 1 — Opens QXD via InDesign's built-in converter
`app.open()` invokes InDesign's QuarkXPress Converter plug-in transparently.
Paragraph styles, character styles, colors, layers, master pages, and page
geometry are all migrated by the plug-in.

### 2 — Resolves missing links
For every linked image/graphic that InDesign cannot find the script searches:

- The source file's own folder
- `Links/`, `links/`, `Images/`, `images/`, `Assets/`, `assets/`, `Photos/`, `Graphics/`
- The parent folder and its `Links/` / `images/` sub-folders
- Sub-folders up to 4 levels deep (configurable)

Successfully relinked files are noted in the report; unresolved ones are flagged
as warnings so you can find them manually via InDesign's Links panel.

### 3 — Updates out-of-date links
Any link whose file has changed since the QXD was last saved is updated
automatically (option can be disabled).

### 4 — Checks text overflow
Every text frame is tested for overflow. Where supported (InDesign CS5.5+),
the script applies *Auto-size: Height Only* to recover hidden text. Remaining
overflow frames are counted and flagged for manual review.

### 5 — Audits fonts
All fonts used by the document are checked. Missing fonts are listed by name
in the report so you can install or substitute them.

### 6 — Audits page items & master pages
- Locked items are counted and noted (not automatically unlocked)
- Hidden items are noted
- Master spreads are listed by name
- Paragraph styles that carry QXP conversion prefixes (`[Converted]`, `QXP_…`)
  are highlighted for review

### 7 — Saves as `.indd`
The document is saved in the current InDesign version's native format alongside
the original source file.

---

## Options Reference

| Option | Default | Description |
|---|---|---|
| Auto-relink missing images | On | Searches common locations for missing files |
| Update out-of-date links | On | Calls `link.update()` on stale links |
| Search sub-folders | On | Recurses up to 4 levels when hunting for links |
| Auto-height on overflow frames | On | Applies auto-size to overflowing text frames |
| Close document after saving | Off | Closes the converted doc to free memory (batch) |
| Add `_converted` suffix | On | Avoids overwriting an existing `.indd` |

---

## Known Limitations

| Issue | Notes |
|---|---|
| QXP 5–9 on older InDesign | Requires InDesign CC 2019+ or a third-party converter |
| QXP 2015+ formats | Not supported by the built-in plug-in |
| Xtension-dependent content | Interactive widgets, proprietary Xtension objects may be lost |
| Colour profiles | ICC profile assignments are migrated but should be verified |
| Linked EPS / PDF boxes | Complex nested QXP group objects may need manual adjustment |
| Tabs and indents | Some tab leader styles may differ after conversion |
| Anchored boxes | Quark's runaround / anchored items are approximated |

---

## Troubleshooting

**"QuarkXPress Converter plug-in is not installed"**
Check that the plug-in exists at `<InDesign app>/Plug-Ins/File Formats/`. If it
is missing, reinstall InDesign and ensure "QuarkXPress Converter" is ticked in
the installer.

**File opens but looks wrong**
Run *Window ▸ Links* to review any remaining missing links. Run
*Type ▸ Find Font* to substitute missing fonts.

**Script throws an error on older InDesign**
The `AutoSizingTypeEnum` auto-size code requires CS5.5+. The script catches
this gracefully but you may see a warning — this is harmless.

**Batch conversion is slow**
Each file must open and save through InDesign's full converter. For very large
batches, consider enabling *Close document after saving* in the options to
keep memory usage low.

---

## File Structure

```
QXPConversion/
└── QXP_to_InDesign_Converter.jsx   — the script (only file needed)
└── README.md                        — this document
```

---

## License

MIT — free for personal and commercial use. No warranty expressed or implied.

// =============================================================================
// QXP_to_InDesign_Converter.jsx
// Adobe InDesign ExtendScript — QuarkXPress to InDesign Conversion Utility
//
// Created by Ben for Brands
// https://www.benforbrands.co.uk
// https://tools.benforbrands.co.uk
//
// VERSION: 1.2.0
// COMPATIBILITY: Adobe InDesign CS4 / CC and later
//
// INSTALLATION:
//   Place this file in your InDesign Scripts folder:
//   Mac: ~/Library/Preferences/Adobe InDesign/<version>/Scripts/Scripts Panel/
//   Win: %APPDATA%\Adobe\InDesign\<version>\<language>\Scripts\Scripts Panel\
//
// USAGE:
//   Window > Utilities > Scripts — double-click this script to run.
//
// REQUIREMENTS:
//   • The QuarkXPress Converter plug-in must be installed in InDesign.
//     (Included by default in InDesign CS4+. For QXP 7–2020 files you may
//      need Markzware's Q2ID or the official Quark IDXT exporter instead.)
//   • QXD/QXT files up to QuarkXPress 4.x are supported natively.
//     InDesign CC (2019+) supports up to QXP 9.x with the built-in converter.
//
// WHAT IT DOES:
//   1. Lets you pick one or more .qxd / .qxt files (or a whole folder).
//   2. Opens each file using InDesign's built-in QuarkXPress converter.
//   3. Attempts to resolve missing / out-of-date links automatically.
//   4. Reports text overflow, missing fonts, and locked items.
//   5. Saves each result as a native .indd file next to the original.
//   6. Produces a detailed conversion report you can save to disk.
// =============================================================================

#target indesign

(function () {

    // -------------------------------------------------------------------------
    // CONSTANTS & CONFIG
    // -------------------------------------------------------------------------

    var VERSION = "1.2.0";

    var SEARCH_SUBFOLDERS = true;   // hunt for missing links inside sub-folders
    var MAX_SEARCH_DEPTH  = 4;      // max folder depth for link searching

    // Folders to search (relative to the source file's parent folder)
    var LINK_SEARCH_DIRS = [
        "",           // same folder as source
        "Links",
        "links",
        "Images",
        "images",
        "Assets",
        "assets",
        "Photos",
        "photos",
        "Graphics",
        "graphics",
        "../Links",
        "../links",
        "../Images",
        "../images"
    ];

    // =========================================================================
    // ENTRY POINT
    // =========================================================================

    main();

    function main() {
        if (!(app instanceof Application)) {
            alert("This script must be run from within Adobe InDesign.");
            return;
        }

        if (!showWelcomeDialog()) { return; }

        var files = selectFiles();
        if (!files || files.length === 0) {
            alert("No files selected. Script cancelled.");
            return;
        }

        var conversionOptions = showOptionsDialog();
        if (!conversionOptions) { return; }

        var report = [];
        for (var i = 0; i < files.length; i++) {
            report.push(convertFile(files[i], conversionOptions));
        }

        showReport(report);
    }

    // =========================================================================
    // UI — WELCOME DIALOG
    // =========================================================================

    function showWelcomeDialog() {
        var dlg = new Window("dialog", "QXP \u2192 InDesign Converter  v" + VERSION);
        dlg.alignChildren = "fill";
        dlg.margins = 20;

        var grp = dlg.add("group");
        grp.orientation = "column";
        grp.alignChildren = "left";
        grp.spacing = 5;

        grp.add("statictext", undefined,
            "This script converts QuarkXPress files (.qxd / .qxt) to");
        grp.add("statictext", undefined,
            "native Adobe InDesign format (.indd).");
        grp.add("statictext", undefined, " ");

        grp.add("statictext", undefined, "Requirements:");
        addBullet(grp, "InDesign CS4 or later with the QXP Converter plug-in.");
        addBullet(grp, "For QXP 5-9 files: InDesign CC 2019+ (built-in) or");
        addBullet(grp, "  Markzware Q2ID / Quark IDXT plug-in.");
        addBullet(grp, "Linked images accessible at their original paths.");

        grp.add("statictext", undefined, " ");
        grp.add("statictext", undefined, "Converted .indd files are saved alongside the originals.");

        var btnGrp = dlg.add("group");
        btnGrp.alignment = "right";
        btnGrp.add("button", undefined, "Cancel", { name: "cancel" });
        var ok = btnGrp.add("button", undefined, "Select Files \u00BB", { name: "ok" });
        ok.active = true;

        return (dlg.show() === 1);
    }

    // =========================================================================
    // UI — FILE / FOLDER SELECTION
    // =========================================================================

    function selectFiles() {
        var dlg = new Window("dialog", "Select Source Files");
        dlg.alignChildren = "fill";
        dlg.margins = 20;

        dlg.add("statictext", undefined, "What would you like to convert?");

        var radioGrp = dlg.add("group");
        radioGrp.orientation = "column";
        radioGrp.alignChildren = "left";
        var rSingle = radioGrp.add("radiobutton", undefined, "Single .qxd / .qxt file");
        var rBatch  = radioGrp.add("radiobutton", undefined, "All QXP files in a folder (batch)");
        rSingle.value = true;

        var btnGrp = dlg.add("group");
        btnGrp.alignment = "right";
        btnGrp.add("button", undefined, "Cancel", { name: "cancel" });
        var ok = btnGrp.add("button", undefined, "Browse\u2026", { name: "ok" });
        ok.active = true;

        if (dlg.show() !== 1) { return []; }

        var files = [];

        if (rSingle.value) {
            var f = File.openDialog(
                "Select a QuarkXPress file",
                "QuarkXPress Files:*.qxd,*.QXD,*.qxt,*.QXT;All Files:*.*"
            );
            if (f) { files.push(f); }
        } else {
            var folder = Folder.selectDialog(
                "Select the folder containing QuarkXPress files"
            );
            if (folder) {
                files = collectQXPFiles(folder);
                if (files.length === 0) {
                    alert("No .qxd or .qxt files found in that folder.");
                }
            }
        }

        return files;
    }

    function collectQXPFiles(folder) {
        return folder.getFiles(function (f) {
            return (f instanceof File) && /\.(qxd|qxt)$/i.test(f.name);
        });
    }

    // =========================================================================
    // UI — OPTIONS DIALOG
    // =========================================================================

    function showOptionsDialog() {
        var dlg = new Window("dialog", "Conversion Options");
        dlg.alignChildren = "fill";
        dlg.margins = 20;

        // --- Links section ---
        var linksPanel = dlg.add("panel", undefined, "Missing Links");
        linksPanel.alignChildren = "left";
        linksPanel.margins = 15;

        var chkRelink    = linksPanel.add("checkbox", undefined,
            "Attempt to auto-relink missing images");
        chkRelink.value  = true;

        var chkUpdate    = linksPanel.add("checkbox", undefined,
            "Update out-of-date links");
        chkUpdate.value  = true;

        var chkSubfolders = linksPanel.add("checkbox", undefined,
            "Search sub-folders for missing files (depth " + MAX_SEARCH_DEPTH + ")");
        chkSubfolders.value = SEARCH_SUBFOLDERS;

        // --- Text section ---
        var textPanel = dlg.add("panel", undefined, "Text Frames");
        textPanel.alignChildren = "left";
        textPanel.margins = 15;

        var chkAutoSize = textPanel.add("checkbox", undefined,
            "Try auto-height on overflowing text frames");
        chkAutoSize.value = true;

        // --- Output section ---
        var outPanel = dlg.add("panel", undefined, "Output");
        outPanel.alignChildren = "left";
        outPanel.margins = 15;

        var chkClose = outPanel.add("checkbox", undefined,
            "Close converted document after saving");
        chkClose.value = false;

        var chkSuffix = outPanel.add("checkbox", undefined,
            "Add _converted suffix if .indd already exists");
        chkSuffix.value = true;

        // --- Buttons ---
        var btnGrp = dlg.add("group");
        btnGrp.alignment = "right";
        btnGrp.add("button", undefined, "Cancel", { name: "cancel" });
        var ok = btnGrp.add("button", undefined, "Convert", { name: "ok" });
        ok.active = true;

        if (dlg.show() !== 1) { return null; }

        return {
            relink:       chkRelink.value,
            update:       chkUpdate.value,
            subfolders:   chkSubfolders.value,
            autoSize:     chkAutoSize.value,
            closeAfter:   chkClose.value,
            addSuffix:    chkSuffix.value
        };
    }

    // =========================================================================
    // CONVERSION — MAIN
    // =========================================================================

    function convertFile(qxdFile, opts) {
        var result = {
            fileName:          qxdFile.name,
            filePath:          qxdFile.fsName,
            success:           false,
            outputPath:        "",
            errors:            [],
            warnings:          [],
            info:              [],
            linkReport:        [],
            overflowCount:     0,
            missingFonts:      []
        };

        var doc = null;

        try {
            // ------------------------------------------------------------------
            // 1. OPEN THE QXD FILE
            // ------------------------------------------------------------------
            doc = openQXDFile(qxdFile, result);
            if (!doc) { return result; }

            result.info.push("Document opened successfully via InDesign converter.");

            // ------------------------------------------------------------------
            // 2. PROCESS LINKS
            // ------------------------------------------------------------------
            processLinks(doc, qxdFile, opts, result);

            // ------------------------------------------------------------------
            // 3. TEXT FRAMES
            // ------------------------------------------------------------------
            checkTextOverflow(doc, opts, result);

            // ------------------------------------------------------------------
            // 4. FONTS
            // ------------------------------------------------------------------
            checkFonts(doc, result);

            // ------------------------------------------------------------------
            // 5. PAGE ITEMS / MASTER PAGES
            // ------------------------------------------------------------------
            auditPageItems(doc, result);
            auditMasterPages(doc, result);

            // ------------------------------------------------------------------
            // 6. SAVE AS .INDD
            // ------------------------------------------------------------------
            var savedPath = saveAsInDesign(doc, qxdFile, opts, result);

            if (savedPath) {
                result.success    = true;
                result.outputPath = savedPath;
                result.info.push("Saved: " + savedPath);
            }

            // ------------------------------------------------------------------
            // 7. OPTIONALLY CLOSE
            // ------------------------------------------------------------------
            if (opts.closeAfter && doc.isValid) {
                doc.close(SaveOptions.NO);
                result.info.push("Document closed (unsaved copy discarded).");
            }

        } catch (e) {
            result.errors.push("Unexpected error: " + e.message + " (line " + e.line + ")");
            // Try to clean up the open document if something blew up
            if (doc && doc.isValid) {
                try { doc.close(SaveOptions.NO); } catch (ce) { /* ignore */ }
            }
        }

        return result;
    }

    // =========================================================================
    // OPEN QXD FILE
    // =========================================================================

    function openQXDFile(qxdFile, result) {
        if (!qxdFile.exists) {
            result.errors.push("File not found: " + qxdFile.fsName);
            return null;
        }

        var doc = null;

        try {
            // app.open() calls InDesign's file-type converters automatically.
            // The second argument (false) suppresses the UI conversion progress.
            // This works as long as the QXP Converter plug-in is installed.
            doc = app.open(qxdFile, false);
        } catch (e) {
            var msg = e.message || String(e);

            if (/plug.?in|converter/i.test(msg)) {
                result.errors.push(
                    "QuarkXPress Converter plug-in is not installed or not active. " +
                    "For QXP 5+ files consider Markzware Q2ID. Details: " + msg
                );
            } else if (/format|version|corrupt/i.test(msg)) {
                result.errors.push(
                    "File format not supported or file is corrupt. " +
                    "InDesign natively supports QXP up to v4.x (CS4) or v9.x (CC 2019+). " +
                    "Details: " + msg
                );
            } else {
                result.errors.push("Could not open file: " + msg);
            }

            return null;
        }

        if (!doc || !doc.isValid) {
            result.errors.push("File opened but returned an invalid document object.");
            return null;
        }

        return doc;
    }

    // =========================================================================
    // LINKS
    // =========================================================================

    function processLinks(doc, sourceFile, opts, result) {
        var sourceFolder = sourceFile.parent;
        var links        = doc.links;
        var total        = links.length;

        result.info.push("Total linked items found: " + total);

        var missing    = 0;
        var outOfDate  = 0;
        var embedded   = 0;
        var ok         = 0;

        for (var i = links.length - 1; i >= 0; i--) {
            // Iterate backwards — relinking can shift indices
            var link    = links[i];
            var status  = link.status;
            var lInfo   = { name: link.name, status: statusLabel(status), resolved: false };

            try {
                if (status === LinkStatus.LINK_MISSING) {
                    missing++;
                    if (opts.relink) {
                        lInfo.resolved = relinkMissing(link, sourceFolder, opts.subfolders, result);
                        if (!lInfo.resolved) {
                            result.warnings.push("Could not auto-relink: " + link.name);
                        }
                    }
                } else if (status === LinkStatus.LINK_OUT_OF_DATE) {
                    outOfDate++;
                    if (opts.update) {
                        try {
                            link.update();
                            lInfo.resolved = true;
                            result.info.push("Updated link: " + link.name);
                        } catch (ue) {
                            result.warnings.push("Update failed for: " + link.name + " — " + ue.message);
                        }
                    }
                } else if (status === LinkStatus.LINK_EMBEDDED) {
                    embedded++;
                } else {
                    ok++;
                }
            } catch (le) {
                result.warnings.push("Error checking link [" + link.name + "]: " + le.message);
            }

            result.linkReport.push(lInfo);
        }

        result.info.push(
            "Link summary — OK: " + ok +
            ", Missing: " + missing +
            ", Out-of-date: " + outOfDate +
            ", Embedded: " + embedded
        );
    }

    function statusLabel(s) {
        switch (s) {
            case LinkStatus.LINK_MISSING:     return "Missing";
            case LinkStatus.LINK_OUT_OF_DATE: return "Out-of-date";
            case LinkStatus.LINK_EMBEDDED:    return "Embedded";
            case LinkStatus.NORMAL:           return "OK";
            default:                          return "Unknown (" + s + ")";
        }
    }

    function relinkMissing(link, sourceFolder, searchSubfolders, result) {
        var name = link.name;

        // Build ordered list of candidate folders
        var candidates = [];
        for (var i = 0; i < LINK_SEARCH_DIRS.length; i++) {
            var d = LINK_SEARCH_DIRS[i];
            candidates.push(new Folder(sourceFolder.fsName + (d ? "/" + d : "")));
        }

        // Check each candidate
        for (var c = 0; c < candidates.length; c++) {
            var found = findFileInFolder(candidates[c], name, searchSubfolders, 0);
            if (found) {
                try {
                    link.relink(found);
                    result.info.push("Relinked \u2714 " + name + "  \u2192  " + found.fsName);
                    return true;
                } catch (re) {
                    // Keep trying other locations
                }
            }
        }

        return false;
    }

    function findFileInFolder(folder, fileName, recurse, depth) {
        if (!folder || !folder.exists || depth > MAX_SEARCH_DEPTH) { return null; }

        // Direct hit
        var candidate = new File(folder.fsName + "/" + fileName);
        if (candidate.exists) { return candidate; }

        // Recurse into sub-folders
        if (recurse) {
            try {
                var children = folder.getFiles();
                for (var i = 0; i < children.length; i++) {
                    if (children[i] instanceof Folder) {
                        var found = findFileInFolder(children[i], fileName, true, depth + 1);
                        if (found) { return found; }
                    }
                }
            } catch (e) { /* access denied or similar — skip */ }
        }

        return null;
    }

    // =========================================================================
    // TEXT OVERFLOW
    // =========================================================================

    function checkTextOverflow(doc, opts, result) {
        var overflowing = 0;
        var autoSized   = 0;

        try {
            var frames = doc.textFrames;
            for (var i = 0; i < frames.length; i++) {
                var tf = frames[i];
                try {
                    if (!tf.overflows) { continue; }
                    overflowing++;

                    if (opts.autoSize) {
                        try {
                            // Try height-only auto-size first (CS5.5+)
                            tf.textFramePreferences.autoSizingType =
                                AutoSizingTypeEnum.HEIGHT_ONLY;
                            tf.textFramePreferences.autoSizingReferencePoint =
                                AutoSizingReferenceEnum.TOP_LEFT_POINT;
                            autoSized++;
                        } catch (as1) {
                            // Fallback: try height-and-width
                            try {
                                tf.textFramePreferences.autoSizingType =
                                    AutoSizingTypeEnum.HEIGHT_AND_WIDTH;
                                autoSized++;
                            } catch (as2) {
                                // Auto-sizing not available on this version — skip silently
                            }
                        }
                    }
                } catch (tfErr) {
                    // Frame may have been deleted or is invalid
                }
            }
        } catch (e) {
            result.warnings.push("Could not fully check text overflow: " + e.message);
        }

        result.overflowCount = overflowing;

        if (overflowing > 0) {
            var msg = overflowing + " text frame(s) with overflowing text detected.";
            if (autoSized > 0) {
                msg += " Auto-size applied to " + autoSized + " frame(s).";
            }
            msg += " Manual review recommended.";
            result.warnings.push(msg);
        }
    }

    // =========================================================================
    // FONTS
    // =========================================================================

    function checkFonts(doc, result) {
        try {
            var fonts   = doc.fonts;
            var missing = [];
            for (var i = 0; i < fonts.length; i++) {
                var f = fonts[i];
                if (f.status === FontStatus.NOT_AVAILABLE) {
                    missing.push(f.name);
                }
            }
            result.missingFonts = missing;

            if (missing.length > 0) {
                result.warnings.push(
                    missing.length + " missing font(s): " + missing.join(", ")
                );
            } else {
                result.info.push("All fonts resolved.");
            }
        } catch (e) {
            result.warnings.push("Could not enumerate fonts: " + e.message);
        }
    }

    // =========================================================================
    // PAGE ITEMS AUDIT
    // =========================================================================

    function auditPageItems(doc, result) {
        var lockedCount   = 0;
        var hiddenCount   = 0;

        try {
            var spreads = doc.spreads;
            for (var s = 0; s < spreads.length; s++) {
                var items = spreads[s].allPageItems;
                for (var i = 0; i < items.length; i++) {
                    try {
                        if (items[i].locked)  { lockedCount++; }
                        if (!items[i].visible){ hiddenCount++; }
                    } catch (ie) { /* skip inaccessible items */ }
                }
            }
        } catch (e) {
            result.warnings.push("Error during page items audit: " + e.message);
        }

        if (lockedCount > 0) {
            result.warnings.push(lockedCount + " locked item(s) found — review before editing.");
        }
        if (hiddenCount > 0) {
            result.info.push(hiddenCount + " hidden item(s) found.");
        }
    }

    // =========================================================================
    // MASTER PAGES AUDIT
    // =========================================================================

    function auditMasterPages(doc, result) {
        try {
            var masters     = doc.masterSpreads;
            var masterNames = [];
            for (var i = 0; i < masters.length; i++) {
                masterNames.push(masters[i].name || ("[Master " + i + "]"));
            }
            result.info.push(
                masters.length + " master spread(s): " + masterNames.join(", ")
            );
        } catch (e) {
            result.warnings.push("Could not audit master pages: " + e.message);
        }

        // Note any converted styles
        try {
            var paraStyles = doc.paragraphStyles;
            var converted  = [];
            for (var j = 0; j < paraStyles.length; j++) {
                var name = paraStyles[j].name;
                if (/^\[converted\]|^QXP_/i.test(name)) {
                    converted.push(name);
                }
            }
            if (converted.length > 0) {
                result.warnings.push(
                    converted.length + " paragraph style(s) carry conversion prefixes — review: " +
                    converted.slice(0, 5).join(", ") +
                    (converted.length > 5 ? " … (+" + (converted.length - 5) + " more)" : "")
                );
            }
        } catch (e) { /* non-critical */ }
    }

    // =========================================================================
    // SAVE AS INDESIGN
    // =========================================================================

    function saveAsInDesign(doc, sourceFile, opts, result) {
        try {
            var base        = sourceFile.fsName.replace(/\.(qxd|qxt)$/i, "");
            var outputFile  = new File(base + ".indd");

            if (outputFile.exists && opts.addSuffix) {
                outputFile = new File(base + "_converted.indd");
            }

            // Ensure parent folder exists (it should, but be safe)
            if (!outputFile.parent.exists) {
                outputFile.parent.create();
            }

            doc.save(outputFile);   // saves in current InDesign version format
            return outputFile.fsName;

        } catch (e) {
            result.errors.push("Save failed: " + e.message);
            return null;
        }
    }

    // =========================================================================
    // REPORT
    // =========================================================================

    function showReport(results) {
        var allOK  = true;
        var lines  = [];

        lines.push("QXP \u2192 InDesign Conversion Report");
        lines.push("Generated: " + new Date().toString());
        lines.push("Script version: " + VERSION);
        lines.push(repeat("=", 60));
        lines.push("");

        for (var i = 0; i < results.length; i++) {
            var r = results[i];
            if (!r.success) { allOK = false; }

            lines.push("FILE: " + r.fileName);
            lines.push("PATH: " + r.filePath);
            lines.push("STATUS: " + (r.success ? "\u2714 SUCCESS" : "\u2718 FAILED"));

            if (r.success && r.outputPath) {
                lines.push("OUTPUT: " + r.outputPath);
            }

            if (r.errors.length) {
                lines.push("");
                lines.push("Errors (" + r.errors.length + "):");
                pushBullets(lines, r.errors, "  \u2718 ");
            }

            if (r.warnings.length) {
                lines.push("");
                lines.push("Warnings (" + r.warnings.length + "):");
                pushBullets(lines, r.warnings, "  \u26A0 ");
            }

            if (r.info.length) {
                lines.push("");
                lines.push("Info:");
                pushBullets(lines, r.info, "  \u2022 ");
            }

            if (r.linkReport.length) {
                lines.push("");
                lines.push("Links (" + r.linkReport.length + "):");
                for (var l = 0; l < r.linkReport.length; l++) {
                    var lnk = r.linkReport[l];
                    lines.push(
                        "  " + lnk.name +
                        "  [" + lnk.status + "]" +
                        (lnk.resolved ? "  \u2714 resolved" : "")
                    );
                }
            }

            if (r.overflowCount > 0) {
                lines.push("");
                lines.push("Overflowing text frames: " + r.overflowCount + " (manual fix may be needed)");
            }

            if (r.missingFonts.length > 0) {
                lines.push("");
                lines.push("Missing fonts (" + r.missingFonts.length + "):");
                pushBullets(lines, r.missingFonts, "  \u2022 ");
            }

            lines.push("");
            lines.push(repeat("-", 60));
            lines.push("");
        }

        var reportText = lines.join("\n");

        // ---  Display window  ---
        var dlg = new Window("dialog", "Conversion Report  —  " + results.length + " file(s)");
        dlg.alignChildren = "fill";
        dlg.margins = 20;
        dlg.preferredSize.width = 680;

        var headline = dlg.add("statictext", undefined,
            allOK ? "\u2714  All files converted successfully."
                  : "\u26A0  Conversion finished with errors \u2014 see report below."
        );
        headline.graphics.foregroundColor =
            headline.graphics.newPen(
                dlg.graphics.PenType.SOLID_COLOR,
                allOK ? [0, 0.5, 0, 1] : [0.7, 0.1, 0.1, 1],
                1
            );

        dlg.add("edittext", [0, 0, 640, 420], reportText, {
            multiline: true,
            readonly:  true,
            scrolling: true
        });

        var btnGrp = dlg.add("group");
        btnGrp.alignment = "right";

        var saveBtn  = btnGrp.add("button", undefined, "Save Report\u2026");
        btnGrp.add("button", undefined, "Close", { name: "ok" });

        saveBtn.onClick = function () {
            var rf = File.saveDialog("Save Conversion Report", "Text Files:*.txt");
            if (rf) {
                try {
                    rf.encoding = "UTF-8";
                    rf.open("w");
                    rf.write(reportText);
                    rf.close();
                    alert("Report saved to:\n" + rf.fsName);
                } catch (we) {
                    alert("Could not save report: " + we.message);
                }
            }
        };

        dlg.show();
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    function addBullet(group, text) {
        group.add("statictext", undefined, "  \u2022 " + text);
    }

    function pushBullets(arr, items, prefix) {
        for (var i = 0; i < items.length; i++) {
            arr.push(prefix + items[i]);
        }
    }

    function repeat(ch, n) {
        var s = "";
        for (var i = 0; i < n; i++) { s += ch; }
        return s;
    }

})();

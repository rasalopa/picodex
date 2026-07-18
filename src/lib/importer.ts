/**
 * Pure planning logic for the ROM drag & drop importer.
 *
 * Given the file names of a drop and the current library, decides what should
 * happen to each file *before* any SD card write occurs: files whose
 * extension maps to a known system are added, files already present in that
 * system's games folder (or repeated within the same drop) are flagged as
 * duplicates, and everything else — junk dotfiles, unknown extensions — is
 * rejected. The actual copying lives in `components/DropImport.tsx`; this
 * module has no DOM dependencies so it stays unit-testable.
 */

import type { LibraryFile } from './sdcard.ts';
import { systemForExtension, type System } from './systems.ts';

/** What the importer decided to do with one dropped file. */
export type ImportVerdict = 'add' | 'duplicate' | 'unknown-type';

/** Planned outcome for one dropped file name. */
export interface ImportPlanItem {
  /** Dropped file name, exactly as received. */
  fileName: string;
  /** System matched by the file extension, or `null` for unknown/junk names. */
  system: System | null;
  /** What to do with the file: copy it, skip it, or reject it. */
  verdict: 'add' | 'duplicate' | 'unknown-type';
}

/**
 * Classifies each dropped file name against the systems registry and the
 * ROMs already on the card.
 *
 * Rules, applied in order per name:
 * 1. Junk names starting with `'.'` (which covers macOS `._` AppleDouble
 *    files and `.DS_Store`) → `'unknown-type'`.
 * 2. No system matches the extension ({@link systemForExtension}) →
 *    `'unknown-type'`.
 * 3. A file with the same name (case-insensitive) already exists in that
 *    system's games folder — same `gamesDir`, matching how systems share
 *    folders (gb/gbc, ws/wsc, ngp/ngc) — or appeared earlier in this same
 *    drop → `'duplicate'`.
 * 4. Otherwise → `'add'`.
 *
 * @param fileNames Names of the dropped files, in drop order.
 * @param existing Current library files (from `scanLibrary`).
 * @returns One plan item per input name, in the same order.
 */
export function planImport(
  fileNames: readonly string[],
  existing: readonly LibraryFile[],
): ImportPlanItem[] {
  // Existing ROM names per games folder, lowercased for case-insensitive
  // comparison (FAT file systems on SD cards are case-insensitive).
  const existingByDir = new Map<string, Set<string>>();
  for (const file of existing) {
    let names = existingByDir.get(file.system.gamesDir);
    if (names === undefined) {
      names = new Set();
      existingByDir.set(file.system.gamesDir, names);
    }
    names.add(file.fileName.toLowerCase());
  }

  // Names already planned as 'add' in this drop, keyed by target folder.
  const plannedInDrop = new Set<string>();

  return fileNames.map((fileName): ImportPlanItem => {
    if (fileName.startsWith('.')) {
      return { fileName, system: null, verdict: 'unknown-type' };
    }
    const system = systemForExtension(fileName);
    if (system === null) {
      return { fileName, system: null, verdict: 'unknown-type' };
    }
    const lowerName = fileName.toLowerCase();
    const dropKey = `${system.gamesDir}/${lowerName}`;
    const onCard = existingByDir.get(system.gamesDir)?.has(lowerName) ?? false;
    if (onCard || plannedInDrop.has(dropKey)) {
      return { fileName, system, verdict: 'duplicate' };
    }
    plannedInDrop.add(dropKey);
    return { fileName, system, verdict: 'add' };
  });
}

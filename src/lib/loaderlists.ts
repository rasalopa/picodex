/**
 * Parsers for the pico-loader's binary compatibility lists on the SD card —
 * `/_pico/aplist.bin`, `/_pico/savelist.bin` and `/_pico/patchlist.bin` —
 * plus the per-game lookup that mirrors how the loader consumes them.
 *
 * Authoritative sources (pico-loader-enhanced repository):
 *
 * - `aplist.bin`: headerless array of 16-byte little-endian entries; layout
 *   in `common/ApList.h` (`static_assert(sizeof(ApListEntry) == 0x10)`), bit
 *   packing spelled out by the converter's `ApList/ApListFactory.cs`. Lookup
 *   semantics in `common/ApList.cpp` (`ApList::FindEntry`): exact
 *   (gameCode, gameVersion) match, no fallback across versions.
 * - `savelist.bin`: headerless array of 8-byte little-endian entries; layout
 *   in `arm7/source/loader/SaveList.h` (`static_assert(sizeof(SaveListEntry)
 *   == 8)`) and `SaveList/SaveListFactory.cs`. Lookup semantics in
 *   `arm7/source/loader/SaveList.cpp`: match on gameCode alone.
 * - `patchlist.bin`: `u32 entryCount` followed by `entryCount` 8-byte header
 *   entries whose 24-bit offsets point to the patch bodies; layout in
 *   `arm7/source/loader/PatchList.h`, writer in
 *   `PatchList/PatchListFactory.cs`. Lookup semantics in
 *   `arm7/source/loader/PatchList.cpp`: exact (gameCode, gameVersion) match.
 *
 * The loader keys the AP and patch lookups on the ROM header's
 * `softwareVersion` byte (`NdsLoader.cpp` calls `FindEntry(gameCode,
 * softwareVersion)`), extracted here by `parseNdsSoftwareVersion` in
 * {@link import('./rom')}. Save handling is more layered
 * (`CardSaveArranger::SetupCardSave`): the ROM header's
 * `nandBackupRegionStart` is checked *first* and, when non-zero, sizes the
 * `.sav` straight from the header without ever consulting `savelist.bin`;
 * only otherwise does the savelist decide the size, falling back to
 * `DEFAULT_SAVE_SIZE` (512 KiB) when the game is not listed. {@link
 * compatForGame} mirrors that exact order.
 *
 * Parsing tolerance mirrors the loader's factories, which are deliberately
 * lax. `SaveListFactory`/`ApListFactory` compute their entry count as
 * `f_size / sizeof(entry)` (integer division), so any trailing bytes that do
 * not complete a final entry are ignored rather than rejected — the parsers
 * here floor the same way. `SaveListEntry::Dump` has an `unknown` branch for
 * a `saveType` byte outside the `CardSaveType` enum and `GetSaveSize` does
 * not depend on the type, so an out-of-range save type is kept (surfaced as
 * `'unknown'`), never a reason to reject the file. `patchlist.bin` is the
 * exception: `PatchListFactory` reads the whole file up front and every
 * offset is driven by the header's `entryCount`, so a structurally broken
 * file (truncated header, out-of-bounds offset) yields a whole-file `null`.
 * All three parsers are pure `DataView` code and never throw. Game codes are
 * decoded byte-for-byte with `String.fromCharCode` and kept even when
 * non-printable — the list is the loader's truth, not ours to filter.
 */

/**
 * Save memory type of a listed game, mirroring the loader's `CardSaveType`
 * enum (`common/CardSaveType.h`: None = 0, Eeprom = 1, Flash = 2, Nand = 3).
 * `'unknown'` covers a wire byte outside that enum: the loader keeps such an
 * entry (its `SaveListEntry::Dump` has an `unknown` branch and `GetSaveSize`
 * ignores the type), so we surface it rather than discard the row.
 */
export type SaveType = 'none' | 'eeprom' | 'flash' | 'nand' | 'unknown';

/** Decoded `savelist.bin` entry (`arm7/source/loader/SaveList.h`). */
export interface SaveListEntry {
  /** 4-character game code, decoded LSB-first from the packed u32. */
  gameCode: string;
  /** Save memory type. */
  saveType: SaveType;
  /**
   * Save size in bytes, `1 << log2Size` as `SaveListEntry::GetSaveSize`
   * computes it; 0 when the stored log2 is 0 (no save, `saveType` 'none').
   */
  saveSizeBytes: number;
}

/** Decoded `aplist.bin` entry (`common/ApList.h`). */
export interface ApListEntry {
  /** 4-character game code, decoded LSB-first from the packed u32. */
  gameCode: string;
  /** ROM revision this entry targets (info bits 0–4). */
  gameVersion: number;
  /**
   * Human-readable DS Protect version, e.g. `'v1.26'` — the enum index in
   * info bits 5–9 resolved through `common/DSProtectVersion.h`, formatted
   * like `ApListEntry::Dump`. `'unknown'` for indices past the enum.
   */
  dsProtectVersion: string;
}

/** Decoded `patchlist.bin` header entry (`arm7/source/loader/PatchList.h`). */
export interface PatchListEntry {
  /** 4-character game code, decoded LSB-first from the packed u32. */
  gameCode: string;
  /** ROM revision this entry targets (packed u32 bits 0–7). */
  gameVersion: number;
  /**
   * Number of patches in the entry body: the `patchCount` u16 that the
   * 24-bit file offset (packed u32 bits 8–31) points at, after `u16 length`.
   */
  patchCount: number;
}

/**
 * The three loader lists as read from an SD card. A `null` list means the
 * file is unavailable: absent for the tolerant `ap`/`save` parsers (which
 * otherwise always produce an array, floored to whole entries), or absent or
 * structurally unreadable for `patch` (whose parser returns `null`). {@link
 * compatForGame} reports `'list-unavailable'` for a `null` ap/patch list
 * rather than silently reading it as "nothing needed".
 */
export interface LoaderLists {
  ap: ApListEntry[] | null;
  save: SaveListEntry[] | null;
  patch: PatchListEntry[] | null;
}

/**
 * Save size the loader assumes for games missing from `savelist.bin`:
 * `DEFAULT_SAVE_SIZE` (512 KiB) in `arm7/source/loader/CardSaveArranger.cpp`.
 */
export const DEFAULT_SAVE_SIZE_BYTES = 512 * 1024;

/**
 * End of the NAND read/write region (`NAND_RW_REGION_END`,
 * `CardSaveArranger.cpp`); a NAND save spans from `nandBackupRegionStart`
 * (scaled to bytes) up to here.
 */
const NAND_RW_REGION_END = 0x07a00000;

/**
 * NAND backup-region block size in NTR (DS) mode (`NTR_NAND_BLOCK_SIZE`,
 * `CardSaveArranger.cpp`): the header's `nandBackupRegionStart` is a count of
 * these blocks.
 */
const NTR_NAND_BLOCK_SIZE = 0x20000;

/**
 * NAND backup-region block size in TWL (DSi) mode (`TWL_NAND_BLOCK_SIZE`,
 * `CardSaveArranger.cpp`); the loader picks this over the NTR size when the
 * header's `SupportsDsiMode()` bit is set.
 */
const TWL_NAND_BLOCK_SIZE = 0x80000;

/** Byte size of one `aplist.bin` entry (`sizeof(ApListEntry)` == 0x10). */
const AP_LIST_ENTRY_SIZE = 16;

/** Byte size of one `savelist.bin` entry (`sizeof(SaveListEntry)` == 8). */
const SAVE_LIST_ENTRY_SIZE = 8;

/** Byte size of one `patchlist.bin` header entry (u32 + packed u32). */
const PATCH_LIST_HEADER_ENTRY_SIZE = 8;

/**
 * DS Protect version strings by enum index, in the exact declaration order
 * of `common/DSProtectVersion.h` (identical to the converter's
 * `ApList/DSProtectVersion.cs`), formatted like `ApListEntry::Dump` in
 * `common/ApList.cpp`. Note the order is not sorted: index 0 is v1.06,
 * index 1 is v1.05, and v1.00_2 was appended last at index 20.
 */
const DS_PROTECT_VERSION_NAMES: readonly string[] = [
  'v1.06',
  'v1.05',
  'v1.08',
  'v1.10',
  'v1.20',
  'v1.22',
  'v1.23',
  'v1.23Z',
  'v1.25',
  'v1.26',
  'v1.27',
  'v1.28',
  'v2.00',
  'v2.01',
  'v2.03',
  'v2.05',
  'v2.00s',
  'v2.01s',
  'v2.03s',
  'v2.05s',
  'v1.00_2',
];

/**
 * Save types by wire value, mirroring `common/CardSaveType.h` (0-3). A byte
 * past this table maps to `'unknown'`, kept rather than rejected — see
 * {@link parseSaveList}.
 */
const SAVE_TYPES: readonly SaveType[] = ['none', 'eeprom', 'flash', 'nand'];

/** Wraps a Uint8Array (possibly a view into a larger buffer) in a DataView. */
function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/**
 * Decodes a packed game code u32 into its 4 characters, LSB first — the
 * inverse of the converter's `GameCodeHelper.GameCodeToUint` (`c0 | c1 << 8
 * | c2 << 16 | c3 << 24`). Non-printable bytes are kept as-is: the lists
 * are the loader's truth and are matched byte-for-byte.
 */
function decodeGameCode(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

/**
 * Parses the contents of `/_pico/aplist.bin`.
 *
 * Entry layout (16 bytes, little-endian, `common/ApList.h` +
 * `ApListFactory.cs`): u32 gameCode; u16 info with gameVersion in bits 0–4,
 * the DS Protect version enum index in bits 5–9 and dsProtectFunctionMask
 * in bits 10–15; u16 regularOverlayId; u16 sOverlayId; u24 regularOffset;
 * u24 sOffset. Only the fields PicoDex surfaces are decoded — the overlay
 * ids and offsets are patch-application internals.
 *
 * The entry count is floored like `ApListFactory` (`f_size /
 * sizeof(ApListEntry)`): trailing bytes that do not complete a final 16-byte
 * entry are ignored, never a reason to reject the file.
 *
 * @param bytes Raw file contents.
 * @returns The decoded entries in file order; an empty file, or one shorter
 *   than a single entry, yields `[]`.
 */
export function parseApList(bytes: Uint8Array): ApListEntry[] {
  const view = viewOf(bytes);
  const entries: ApListEntry[] = [];
  for (
    let offset = 0;
    offset + AP_LIST_ENTRY_SIZE <= bytes.byteLength;
    offset += AP_LIST_ENTRY_SIZE
  ) {
    const info = view.getUint16(offset + 4, true);
    const dsProtectIndex = (info >> 5) & 0x1f;
    entries.push({
      gameCode: decodeGameCode(view, offset),
      gameVersion: info & 0x1f,
      dsProtectVersion: DS_PROTECT_VERSION_NAMES[dsProtectIndex] ?? 'unknown',
    });
  }
  return entries;
}

/**
 * Parses the contents of `/_pico/savelist.bin`.
 *
 * Entry layout (8 bytes, little-endian, `arm7/source/loader/SaveList.h` +
 * `SaveListFactory.cs`): u32 gameCode; u8 saveType (0 none, 1 eeprom,
 * 2 flash, 3 nand); u8 log2 of the save size (0 = no save); u16 reserved.
 * `saveSizeBytes` is computed like `SaveListEntry::GetSaveSize`:
 * `log2 == 0 ? 0 : 1 << log2`.
 *
 * Tolerance mirrors `SaveListFactory` and `SaveListEntry`: the entry count is
 * floored (`f_size / sizeof(SaveListEntry)`), so trailing bytes are ignored,
 * and a `saveType` byte outside the `CardSaveType` enum is kept as
 * `'unknown'` (the loader's `Dump` has that branch and `GetSaveSize` ignores
 * the type) — neither is a reason to reject the file.
 *
 * @param bytes Raw file contents.
 * @returns The decoded entries in file order; an empty file, or one shorter
 *   than a single entry, yields `[]`.
 */
export function parseSaveList(bytes: Uint8Array): SaveListEntry[] {
  const view = viewOf(bytes);
  const entries: SaveListEntry[] = [];
  for (
    let offset = 0;
    offset + SAVE_LIST_ENTRY_SIZE <= bytes.byteLength;
    offset += SAVE_LIST_ENTRY_SIZE
  ) {
    const log2Size = view.getUint8(offset + 5);
    entries.push({
      gameCode: decodeGameCode(view, offset),
      saveType: SAVE_TYPES[view.getUint8(offset + 4)] ?? 'unknown',
      saveSizeBytes: log2Size === 0 ? 0 : 2 ** log2Size,
    });
  }
  return entries;
}

/**
 * Parses the contents of `/_pico/patchlist.bin`.
 *
 * Layout (`arm7/source/loader/PatchList.h` + `PatchListFactory.cs`): a u32
 * entryCount, then entryCount 8-byte header entries `{ u32 gameCode; u32
 * packed }` where `packed` holds gameVersion in bits 0–7 and a 24-bit file
 * offset in bits 8–31. Each offset points from the start of the file to a
 * patch body `{ u16 length; u16 patchCount; ... }`; the body's patch data
 * itself is not decoded, only `patchCount` is surfaced.
 *
 * @param bytes Raw file contents.
 * @returns The decoded entries in header order (entryCount 0 yields `[]`),
 *   or `null` when the header is truncated, the declared count does not fit
 *   in the file, or an offset points outside the file.
 */
export function parsePatchList(bytes: Uint8Array): PatchListEntry[] | null {
  if (bytes.byteLength < 4) {
    return null;
  }
  const view = viewOf(bytes);
  const entryCount = view.getUint32(0, true);
  if (4 + entryCount * PATCH_LIST_HEADER_ENTRY_SIZE > bytes.byteLength) {
    return null;
  }
  const entries: PatchListEntry[] = [];
  for (let i = 0; i < entryCount; i++) {
    const offset = 4 + i * PATCH_LIST_HEADER_ENTRY_SIZE;
    const packed = view.getUint32(offset + 4, true);
    const bodyOffset = packed >>> 8;
    if (bodyOffset + 4 > bytes.byteLength) {
      return null;
    }
    entries.push({
      gameCode: decodeGameCode(view, offset),
      gameVersion: packed & 0xff,
      patchCount: view.getUint16(bodyOffset + 2, true),
    });
  }
  return entries;
}

/**
 * Which of the loader's three ROM paths applies, because that decides whether
 * the lists say anything at all. `NdsLoader.cpp:201-239` wraps the whole
 * save/anti-piracy/patch block in `if (!isHomebrew)`, and inside it routes
 * `IsDsiWare()` titles to DsiWareSaveArranger rather than CardSaveArranger.
 * Only `'retail'` goes through the list-driven path this module models.
 */
export type RomKind = 'retail' | 'homebrew' | 'dsiware';

/** Per-game compatibility summary derived from the three loader lists. */
export interface GameCompat {
  /** Which loader path applies. Everything below is scoped to it. */
  kind: RomKind;
  /**
   * Save handling, resolved in `CardSaveArranger::SetupCardSave`'s order.
   * `source` says where the size came from: `'nand-header'` when the ROM
   * header's `nandBackupRegionStart` is non-zero (the loader sizes the save
   * from the header and never reads `savelist.bin`), `'list'` for a
   * `savelist.bin` row, `'default'` when the game is unlisted or the savelist
   * is missing (the loader falls back to {@link DEFAULT_SAVE_SIZE_BYTES}).
   *
   * The last two are not list outcomes at all: `'dsiware-header'` is the
   * `.pub`/`.prv` pair DsiWareSaveArranger creates from the TWL header, and
   * `'homebrew-none'` records that the loader creates no save file whatsoever.
   * `saveType` is `null` for all three of `'default'`, `'dsiware-header'` and
   * `'homebrew-none'`.
   */
  save: {
    saveType: SaveType | null;
    sizeBytes: number;
    /** Second DSiWare save file, 0 when the title declares none. */
    privateSizeBytes?: number;
    source: 'nand-header' | 'list' | 'default' | 'dsiware-header' | 'homebrew-none';
  };
  /**
   * Anti-piracy patching. `'not-listed'` when no aplist entry exists for the
   * game code; `'applies'` when an entry matches the ROM's exact revision;
   * `'version-mismatch'` when entries exist for the code but none for this
   * revision — the loader will not patch it; `'list-unavailable'` when
   * `aplist.bin` is absent, so there is nothing to check against;
   * `'not-applicable'` when the loader's AP step does not run for this ROM
   * kind at all.
   *
   * `'not-listed'` deliberately does NOT mean "this game needs no fix". The
   * loader also carries a hardcoded per-gamecode AP table on the ARM9 side
   * (`Arm9Patcher::AddGamePatches`, e.g. Golden Sun Dark Dawn and Dragon Ball
   * Origins 2) whose entries are absent from `aplist.bin` on purpose, and this
   * module cannot see it. Callers must word this status as a statement about
   * the list, never as reassurance about the game.
   */
  ap: {
    status: 'not-listed' | 'applies' | 'version-mismatch' | 'list-unavailable' | 'not-applicable';
    /** DS Protect version of the matching entry, `null` unless 'applies'. */
    dsProtectVersion: string | null;
    /** Revisions listed for this game code, in file order. */
    entryVersions: number[];
    /** The ROM revision used for the lookup, `null` when unreadable. */
    romVersion: number | null;
  };
  /**
   * Binary patching (patchlist.bin). Statuses mirror `ap`, and so does the
   * caveat: `patchlist.bin` holds only the ARM7-applied patches, while
   * `Arm9Patcher::AddGameSpecificPatches` hardcodes a second, larger table
   * this module cannot see. `'not-listed'` is a fact about the list only.
   */
  patch: {
    status: 'not-listed' | 'applies' | 'version-mismatch' | 'list-unavailable' | 'not-applicable';
    /** Patch count of the matching entry, 0 unless 'applies'. */
    patchCount: number;
    /** Revisions listed for this game code, in file order. */
    entryVersions: number[];
  };
}

/**
 * Computes a game's compatibility summary the way the loader would look it
 * up: aplist and patchlist match on the exact (gameCode, gameVersion) pair
 * with no fallback across versions (`ApList::FindEntry`,
 * `PatchList::FindEntry`), the savelist matches on gameCode alone
 * (`SaveList::FindEntry`).
 *
 * Save handling follows `CardSaveArranger::SetupCardSave` in order: a
 * non-zero `nand.backupRegionStart` wins outright (the loader sizes the save
 * from the ROM header and never consults `savelist.bin`), then a savelist
 * row, then the {@link DEFAULT_SAVE_SIZE_BYTES} default.
 *
 * @param lists The parsed lists. A `null` `ap`/`patch` list yields status
 *   `'list-unavailable'` (nothing to check against), never a false
 *   `'not-listed'`; a `null`/absent savelist falls through to the
 *   default save size.
 * @param gameCode 4-character game code from the ROM header.
 * @param romVersion ROM revision (header byte 0x1E), or `null` when the
 *   header was unreadable. `null` falls back to revision 0 for matching —
 *   the overwhelmingly common revision — and the UI softens its wording via
 *   the echoed `ap.romVersion`.
 * @param nand The ROM header's NAND-save fields (`nandBackupRegionStart` and
 *   whether the cart is DSi-capable, from `parseNdsNandBackupRegionStart` /
 *   `parseNdsSupportsDsiMode`), or `null`/omitted when unknown. Only a
 *   `backupRegionStart > 0` changes the save verdict.
 * @returns The {@link GameCompat} for the game.
 */
/**
 * The patchlist.bin lookup, shared by retail AND DSiWare.
 *
 * The loader runs `HandleGameSpecificPatches()` inside a second, separate
 * `if (!isHomebrew)` block (`NdsLoader.cpp:299-311`) that does NOT consult
 * `IsDsiWare()` - only the save and anti-piracy steps are inside that branch.
 * So a DSiWare title whose (gameCode, revision) is listed really does get those
 * patches at boot, and reporting `not-applicable` for it would be false.
 */
function patchForGame(
  patchList: PatchListEntry[] | null,
  gameCode: string,
  matchVersion: number,
): GameCompat['patch'] {
  if (patchList === null) {
    return { status: 'list-unavailable', patchCount: 0, entryVersions: [] };
  }
  const entries = patchList.filter((entry) => entry.gameCode === gameCode);
  const match = entries.find((entry) => entry.gameVersion === matchVersion);
  return {
    status: entries.length === 0 ? 'not-listed' : match ? 'applies' : 'version-mismatch',
    patchCount: match ? match.patchCount : 0,
    entryVersions: entries.map((entry) => entry.gameVersion),
  };
}

export function compatForGame(
  lists: LoaderLists,
  gameCode: string,
  romVersion: number | null,
  nand?: { backupRegionStart: number; twl: boolean } | null,
  rom?: { kind: RomKind; dsiWareSaveBytes?: { publicBytes: number; privateBytes: number } } | null,
): GameCompat {
  const kind = rom?.kind ?? 'retail';

  // The loader runs none of the list-driven steps for these two, so answering
  // from the lists would describe code that never executes on this ROM.
  const matchVersion = romVersion ?? 0;

  if (kind !== 'retail') {
    const dsi = kind === 'dsiware';
    return {
      kind,
      save: dsi
        ? {
            saveType: null,
            sizeBytes: rom?.dsiWareSaveBytes?.publicBytes ?? 0,
            privateSizeBytes: rom?.dsiWareSaveBytes?.privateBytes ?? 0,
            source: 'dsiware-header',
          }
        : { saveType: null, sizeBytes: 0, source: 'homebrew-none' },
      ap: {
        status: 'not-applicable',
        dsProtectVersion: null,
        entryVersions: [],
        romVersion,
      },
      // Homebrew skips everything. DSiWare does NOT skip the patch step: it lives
      // in a separate `if (!isHomebrew)` block that never checks IsDsiWare, so a
      // listed DSiWare title is patched at boot like any other. See patchForGame.
      patch: dsi
        ? patchForGame(lists.patch, gameCode, matchVersion)
        : { status: 'not-applicable', patchCount: 0, entryVersions: [] },
    };
  }

  let save: GameCompat['save'];
  if (nand && nand.backupRegionStart > 0) {
    // NAND save: the loader sizes it straight from the header and ignores the
    // savelist. blockSize is TWL- vs NTR-mode dependent; the subtraction is
    // a u32 in the loader, so a nonsensical (too-large) start would wrap —
    // guard it to a non-negative size here.
    const blockSize = nand.twl ? TWL_NAND_BLOCK_SIZE : NTR_NAND_BLOCK_SIZE;
    const sizeBytes = Math.max(0, NAND_RW_REGION_END - nand.backupRegionStart * blockSize);
    save = { saveType: 'nand', sizeBytes, source: 'nand-header' };
  } else {
    const saveEntry = lists.save?.find((entry) => entry.gameCode === gameCode);
    save = saveEntry
      ? { saveType: saveEntry.saveType, sizeBytes: saveEntry.saveSizeBytes, source: 'list' }
      : { saveType: null, sizeBytes: DEFAULT_SAVE_SIZE_BYTES, source: 'default' };
  }

  let ap: GameCompat['ap'];
  if (lists.ap === null) {
    ap = { status: 'list-unavailable', dsProtectVersion: null, entryVersions: [], romVersion };
  } else {
    const apEntries = lists.ap.filter((entry) => entry.gameCode === gameCode);
    const apMatch = apEntries.find((entry) => entry.gameVersion === matchVersion);
    ap = {
      status: apEntries.length === 0 ? 'not-listed' : apMatch ? 'applies' : 'version-mismatch',
      dsProtectVersion: apMatch ? apMatch.dsProtectVersion : null,
      entryVersions: apEntries.map((entry) => entry.gameVersion),
      romVersion,
    };
  }

  const patch = patchForGame(lists.patch, gameCode, matchVersion);

  return { kind, save, ap, patch };
}

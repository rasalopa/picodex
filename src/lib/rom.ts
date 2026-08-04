/**
 * ROM header parsing: extraction of the 4-character game code that retail
 * NDS and GBA cartridges carry in their headers.
 *
 * The game code is the stable identity the launcher uses to key covers,
 * icons and per-game data (`_pico/covers/nds/<CODE>.bmp`, gamedata entries,
 * ...). Homebrew ROMs often hold garbage (or zeros) at that spot, so the
 * parsers return `null` unless all four characters are printable ASCII —
 * mirroring `isUsableGameCode` in the launcher's JsonGameDataService.
 */

/** Byte offset of the 4-character game code inside an NDS ROM header. */
const NDS_GAME_CODE_OFFSET = 0x0c;

/**
 * Byte offset of the software version (ROM revision) inside an NDS ROM
 * header: the `softwareVersion` field of `nds_header_ntr_t` in the loader's
 * `common/ndsHeader.h`.
 */
const NDS_SOFTWARE_VERSION_OFFSET = 0x1e;

/**
 * Byte offset of the `unitCode` byte in an NDS ROM header (`nds_header_ntr_t`,
 * `common/ndsHeader.h`).
 */
const NDS_UNIT_CODE_OFFSET = 0x12;

/**
 * `unitCode` bit that marks DSi-mode (TWL) capability:
 * `NDS_HEADER_UNIT_CODE_SUPPORTS_DSI_MODE` (`1 << 1`) in `common/ndsHeader.h`.
 * Note bit 0 is a different flag (`NOT_SUPPORTS_DS_MODE`), so the check is
 * this specific bit, not merely "unitCode is non-zero".
 */
const NDS_UNIT_CODE_SUPPORTS_DSI_MODE = 1 << 1;

/**
 * Byte offset of the u16 `nandBackupRegionStart` field in an NDS ROM header
 * (`nds_header_ntr_t`, `common/ndsHeader.h`): it sits right before `gap98`,
 * at 0x96.
 */
const NDS_NAND_BACKUP_REGION_START_OFFSET = 0x96;

/**
 * The four fields the loader's homebrew test reads (`NdsLoader.cpp:171-173`):
 * `makerCode` (u16), the two autoload-done hook addresses (u32) and
 * `arm7LoadAddress` (u32). Verified against real ROMs: retail carts carry a
 * printable maker code and non-zero hooks, devkitPro homebrew zeroes both.
 */
const NDS_MAKER_CODE_OFFSET = 0x10;
const NDS_ARM7_LOAD_ADDRESS_OFFSET = 0x38;
const NDS_ARM9_AUTOLOAD_HOOK_OFFSET = 0x70;
const NDS_ARM7_AUTOLOAD_HOOK_OFFSET = 0x74;

/** At or above this, the loader considers the ARM7 binary homebrew-placed. */
const NDS_ARM7_LOAD_ADDRESS_HOMEBREW_MIN = 0x03000000;

/**
 * TWL header fields behind `IsDsiWare()` (`common/ndsHeader.h:142-146`) and the
 * DSiWare save sizes the loader's DsiWareSaveArranger uses.
 *
 * `twlFlags` is at 0x1C, NOT 0x1BF. The header carries two similarly named bytes
 * and `IsDsiWare()` reads the first one, so this offset comes from counting the
 * struct in `common/ndsHeader.h` rather than from sampling ROMs:
 *
 *     gameTitle[12] 0x00 | gameCode 0x0C | makerCode[2] 0x10 | unitCode 0x12
 *     encryptionSeedSelect 0x13 | deviceCapacity 0x14 | gap15[7] 0x15
 *     twlFlags 0x1C | flags 0x1D | softwareVersion 0x1E
 *
 * 0x1BF is `twlFlags2`, a different field. It was used here first and looked
 * right because bit 0 happens to agree with `twlFlags` on every DSiWare title on
 * the test card - a two-ROM sample that could not discriminate. Do not verify
 * offsets by sampling.
 */
const NDS_TWL_FLAGS_OFFSET = 0x1c;
const NDS_TITLE_ID_OFFSET = 0x230;
const NDS_TWL_PUBLIC_SAV_SIZE_OFFSET = 0x238;
const NDS_TWL_PRIVATE_SAV_SIZE_OFFSET = 0x23c;

/** Byte offset of the 4-character game code inside a GBA ROM header. */
const GBA_GAME_CODE_OFFSET = 0xac;

/**
 * Bytes a caller must read for every parser in this module to be able to
 * answer. Exported so callers slice against the parsers rather than against a
 * number of their own: reading short does not fail loudly, it just makes the
 * deepest parsers return `null`, which reads downstream as "unreadable header"
 * for every ROM. Driven by {@link parseNdsDsiWareSaveSizes}, the deepest one
 * (the TWL private save size ends at 0x240).
 */
export const NDS_HEADER_PARSE_BYTES = NDS_TWL_PRIVATE_SAV_SIZE_OFFSET + 4;

/**
 * Tells whether a game code is usable as a game's identity.
 *
 * Usable means exactly 4 characters, each printable ASCII (0x21–0x7E).
 * This mirrors the launcher's `isUsableGameCode` (JsonGameDataService),
 * which rejects the garbage bytes homebrew headers keep where retail games
 * store their code.
 *
 * @param code Candidate game code string.
 * @returns `true` when the code can safely identify a game.
 */
export function isUsableGameCode(code: string): boolean {
  if (code.length !== 4) {
    return false;
  }
  for (let i = 0; i < 4; i++) {
    const c = code.charCodeAt(i);
    if (c < 0x21 || c > 0x7e) {
      return false;
    }
  }
  return true;
}

/**
 * Reads 4 header bytes at `offset` as an ASCII game code, or `null` when the
 * buffer is too short or any character is not printable ASCII.
 */
function parseGameCodeAt(bytes: Uint8Array, offset: number): string | null {
  if (bytes.length < offset + 4) {
    return null;
  }
  const code = String.fromCharCode(
    bytes[offset],
    bytes[offset + 1],
    bytes[offset + 2],
    bytes[offset + 3],
  );
  return isUsableGameCode(code) ? code : null;
}

/**
 * Extracts the game code from an NDS ROM header (4 ASCII characters at
 * offset 0xC, e.g. `'AMCE'` for Mario Kart DS USA).
 *
 * @param bytes ROM bytes; only the first 0x10 bytes are needed, so passing
 *   just a header slice is fine.
 * @returns The 4-character game code, or `null` when the buffer is too short
 *   or the header holds a non-printable (garbage/homebrew) code.
 */
export function parseNdsGameCode(bytes: Uint8Array): string | null {
  return parseGameCodeAt(bytes, NDS_GAME_CODE_OFFSET);
}

/**
 * Extracts the software version (ROM revision) from an NDS ROM header: the
 * single byte at offset 0x1E, `softwareVersion` in the loader's
 * `common/ndsHeader.h`. Retail carts almost always ship revision 0; re-issues
 * bump it (e.g. `v1.1` prints as revision 1). The loader keys its AP and
 * patch lists on this byte, so PicoDex needs it to mirror those lookups.
 *
 * @param bytes ROM bytes; only the first 0x1F bytes are needed, so passing
 *   just a header slice is fine.
 * @returns The revision byte (0–255), or `null` when the buffer is shorter
 *   than 0x1F bytes.
 */
export function parseNdsSoftwareVersion(bytes: Uint8Array): number | null {
  if (bytes.length < NDS_SOFTWARE_VERSION_OFFSET + 1) {
    return null;
  }
  return bytes[NDS_SOFTWARE_VERSION_OFFSET];
}

/**
 * Tells whether an NDS ROM header advertises DSi-mode (TWL) capability: bit 1
 * of the `unitCode` byte at offset 0x12, exactly as `SupportsDsiMode()` in the
 * loader's `common/ndsHeader.h` tests it (`unitCode &
 * NDS_HEADER_UNIT_CODE_SUPPORTS_DSI_MODE`, `1 << 1`). The loader reads this to
 * pick the NAND save block size — 0x80000 in TWL mode, 0x20000 in NTR mode
 * (`CardSaveArranger::SetupCardSave`) — so a NAND-save size can only be
 * computed correctly alongside this bit.
 *
 * @param bytes ROM bytes; only the first 0x13 bytes are needed, so passing
 *   just a header slice is fine.
 * @returns `true` for DSi-capable (TWL) carts, `false` for DS-only ones, or
 *   `null` when the buffer is shorter than 0x13 bytes.
 */
export function parseNdsSupportsDsiMode(bytes: Uint8Array): boolean | null {
  if (bytes.length < NDS_UNIT_CODE_OFFSET + 1) {
    return null;
  }
  return (bytes[NDS_UNIT_CODE_OFFSET] & NDS_UNIT_CODE_SUPPORTS_DSI_MODE) !== 0;
}

/**
 * Reads the `nandBackupRegionStart` field from an NDS ROM header: the u16 at
 * offset 0x96, little-endian (`nds_header_ntr_t`, `common/ndsHeader.h`). A
 * non-zero value marks a NAND-backed save, and the loader
 * (`CardSaveArranger::SetupCardSave`) sizes that save straight from this field
 * — ignoring `savelist.bin` entirely — as `NAND_RW_REGION_END -
 * nandBackupRegionStart * blockSize`. Retail cartridge saves (EEPROM/Flash)
 * leave it 0; only a handful of NAND-save titles (e.g. WarioWare D.I.Y.) set
 * it.
 *
 * @param bytes ROM bytes; only the first 0x98 bytes are needed, so passing
 *   just a header slice is fine.
 * @returns The u16 value (0 for the common non-NAND case), or `null` when the
 *   buffer is shorter than 0x98 bytes.
 */
export function parseNdsNandBackupRegionStart(bytes: Uint8Array): number | null {
  if (bytes.length < NDS_NAND_BACKUP_REGION_START_OFFSET + 2) {
    return null;
  }
  return (
    bytes[NDS_NAND_BACKUP_REGION_START_OFFSET] |
    (bytes[NDS_NAND_BACKUP_REGION_START_OFFSET + 1] << 8)
  );
}

/** Little-endian u32 read, `null` when the buffer is too short. */
function readU32(bytes: Uint8Array, offset: number): number | null {
  if (bytes.length < offset + 4) {
    return null;
  }
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

/**
 * Tells whether the loader will treat this ROM as homebrew, using its own test
 * verbatim (`NdsLoader.cpp:171-173`): a zero maker code, OR both autoload-done
 * hooks zero, OR an ARM7 load address at 0x03000000 or above.
 *
 * This matters because the loader wraps its whole save/anti-piracy/patch block
 * in `if (!isHomebrew)`. For homebrew it creates no save file and applies no
 * patches, so every verdict drawn from `savelist.bin`, `aplist.bin` or
 * `patchlist.bin` is about code that never runs. Note the test is not "the game
 * code is unreadable": devkitPro homebrew commonly ships the printable
 * placeholder `####`, which {@link parseNdsGameCode} accepts.
 *
 * @param bytes ROM bytes; the first 0x78 are enough.
 * @returns `true` when the loader's homebrew path applies, or `null` when the
 *   buffer is too short to tell.
 */
export function parseNdsIsHomebrew(bytes: Uint8Array): boolean | null {
  const arm7LoadAddress = readU32(bytes, NDS_ARM7_LOAD_ADDRESS_OFFSET);
  const arm9Hook = readU32(bytes, NDS_ARM9_AUTOLOAD_HOOK_OFFSET);
  const arm7Hook = readU32(bytes, NDS_ARM7_AUTOLOAD_HOOK_OFFSET);
  if (
    bytes.length < NDS_MAKER_CODE_OFFSET + 2 ||
    arm7LoadAddress === null ||
    arm9Hook === null ||
    arm7Hook === null
  ) {
    return null;
  }
  return (
    (bytes[NDS_MAKER_CODE_OFFSET] === 0 && bytes[NDS_MAKER_CODE_OFFSET + 1] === 0) ||
    (arm9Hook === 0 && arm7Hook === 0) ||
    arm7LoadAddress >= NDS_ARM7_LOAD_ADDRESS_HOMEBREW_MIN
  );
}

/**
 * Tells whether this is a DSiWare title, using `IsDsiWare()` from the loader's
 * `common/ndsHeader.h` verbatim: bit 0 of `twlFlags` set AND bit 2 of the high
 * half of `titleId` set. Deliberately not the same as DSi-mode capability (see
 * {@link parseNdsSupportsDsiMode}); DS-mode DSiWare exists.
 *
 * The loader routes these to DsiWareSaveArranger instead of CardSaveArranger,
 * so they never touch `savelist.bin`, `aplist.bin` or `patchlist.bin`.
 *
 * @param bytes ROM bytes; the first 0x238 are enough.
 * @returns `true` for DSiWare, or `null` when the buffer is too short.
 */
export function parseNdsIsDsiWare(bytes: Uint8Array): boolean | null {
  const titleIdHigh = readU32(bytes, NDS_TITLE_ID_OFFSET + 4);
  if (bytes.length < NDS_TWL_FLAGS_OFFSET + 1 || titleIdHigh === null) {
    return null;
  }
  return (bytes[NDS_TWL_FLAGS_OFFSET] & 1) !== 0 && (titleIdHigh & 4) !== 0;
}

/**
 * Reads the DSiWare save sizes a title declares in its TWL header
 * (`twlPublicSavSize` and `twlPrivateSavSize`). The loader creates a `.pub`
 * and, when non-zero, a `.prv` of exactly these sizes, which is why a DSiWare
 * title's real save has nothing to do with `savelist.bin`.
 *
 * @param bytes ROM bytes; the first 0x240 are enough.
 * @returns The two sizes in bytes, or `null` when the buffer is too short.
 */
export function parseNdsDsiWareSaveSizes(
  bytes: Uint8Array,
): { publicBytes: number; privateBytes: number } | null {
  const publicBytes = readU32(bytes, NDS_TWL_PUBLIC_SAV_SIZE_OFFSET);
  const privateBytes = readU32(bytes, NDS_TWL_PRIVATE_SAV_SIZE_OFFSET);
  if (publicBytes === null || privateBytes === null) {
    return null;
  }
  return { publicBytes, privateBytes };
}

/**
 * Extracts the game code from a GBA ROM header (4 ASCII characters at
 * offset 0xAC, e.g. `'BPEE'` for Pokemon Emerald USA).
 *
 * @param bytes ROM bytes; only the first 0xB0 bytes are needed, so passing
 *   just a header slice is fine.
 * @returns The 4-character game code, or `null` when the buffer is too short
 *   or the header holds a non-printable (garbage/homebrew) code.
 */
export function parseGbaGameCode(bytes: Uint8Array): string | null {
  return parseGameCodeAt(bytes, GBA_GAME_CODE_OFFSET);
}

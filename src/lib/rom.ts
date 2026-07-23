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

/** Byte offset of the 4-character game code inside a GBA ROM header. */
const GBA_GAME_CODE_OFFSET = 0xac;

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

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

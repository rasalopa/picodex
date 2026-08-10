/**
 * Remembers the card you were last working on, so a return visit is one click
 * instead of the folder picker plus a full rescan.
 *
 * Why this needs IndexedDB
 * ------------------------
 * What has to survive is a `FileSystemDirectoryHandle`, the browser's own token
 * for "this folder, with this permission". It is structured-cloneable but not
 * serialisable, so `JSON.stringify` turns it into `{}` and localStorage cannot
 * hold it.
 *
 * The handle alone is not access. Permission is granted per visit, and asking
 * for it again needs a user gesture, so reopening is deliberately two steps:
 * `loadLastCard` reads the handle and reports whether it is still usable
 * (`ready`), and only when it is not does the app need a click to ask. Nothing
 * here ever prompts on its own.
 */

import { HANDLE_STORE, withStore } from './idb';

const KEY = 'lastCard';

/** A remembered card and whether it can be read without asking the user again. */
export interface LastCard {
  handle: FileSystemDirectoryHandle;
  /** True when permission is still granted, so the card can be opened silently. */
  ready: boolean;
}

/** Remembers `handle` as the card to offer on the next visit. */
export async function rememberCard(handle: FileSystemDirectoryHandle): Promise<void> {
  await withStore(HANDLE_STORE, 'readwrite', (store) => store.put(handle, KEY));
}

/** Drops the remembered card, so the next visit starts with the picker. */
export async function forgetCard(): Promise<void> {
  await withStore(HANDLE_STORE, 'readwrite', (store) => store.delete(KEY));
}

/**
 * Whatever comes back out of the store is whatever some past version of PicoDex
 * put in, so it is checked rather than trusted: a stale shape would otherwise
 * reach the app as a handle and fail somewhere far from here.
 */
function isDirectoryHandle(value: unknown): value is FileSystemDirectoryHandle {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as FileSystemHandle).kind === 'directory' &&
    typeof (value as FileSystemDirectoryHandle).name === 'string'
  );
}

/**
 * Returns the remembered card, or null when there is none. Only queries the
 * permission, never asks for it, so this is safe to call on page load.
 */
export async function loadLastCard(): Promise<LastCard | null> {
  const stored = await withStore<unknown>(HANDLE_STORE, 'readonly', (store) => store.get(KEY));
  if (!isDirectoryHandle(stored)) {
    return null;
  }
  if (typeof stored.queryPermission !== 'function') {
    return { handle: stored, ready: false };
  }
  try {
    const state = await stored.queryPermission({ mode: 'readwrite' });
    return { handle: stored, ready: state === 'granted' };
  } catch {
    // handle for a card that is no longer around
    return { handle: stored, ready: false };
  }
}

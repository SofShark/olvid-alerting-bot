// In-process cache of the Olvid daemon's discussion state.
//
// Populated once at server boot (updaterClient.init) and then kept in
// sync by the daemon's push events (updaterClient.startUpdater listeners:
// onDiscussionNew, onDiscussionTitleUpdated, onGroupDeleted,
// onGroupPhotoUpdated, onContactPhotoUpdated).
//
// Design decision — TWO maps, not one composite map:
//   · daemon events update ONE facet at a time (title OR photo, never
//     both); two maps let each callback do a single .set() with zero
//     read-modify-write ceremony,
//   · photos are 10-100KB blobs; the /api/discussions list only needs
//     {id, title} — iterating one map keeps that response small and
//     avoids pulling every binary into the JSON response path,
//   · a discussion can exist without a photo, and (in edge cases) a
//     photo event can land before the discussion is registered — two
//     independent maps handle both without pretending one implies the
//     other.
//
// Everything is in-process memory. Restart = cold cache; the updater's
// init() rebuilds it. No persistence needed — the daemon is authoritative.

import type { datatypes } from "@olvid/bot-node";
import type { DiscussionModel } from "~~/shared/types/discussion";

// Keyed by the daemon's bigint discussion id (which the photo events
// reuse as the group/contact id for on{Group,Contact}PhotoUpdated).
const discussionsById = new Map<bigint, datatypes.Discussion>();
const photosById = new Map<bigint, Uint8Array>();

/** SDK type → wire type. Kept here so consumers of the repo never touch
 *  @olvid/bot-node datatypes directly — that boundary stays in this file. */
function toModel(d: datatypes.Discussion): DiscussionModel {
  return {
    id: String(d.id),
    title: d.title + (d.identifier?.case === "groupId" ? " (group)" : ""),
  };
}

export const olvidDiscussionRepository = {
  // ── Seeding + full replacement ──────────────────────────────────────────

  /** Called by updaterClient.init() for each discussion loaded at boot.
   *  `photo` may be null when the daemon has none stored. */
  add(d: datatypes.Discussion, photo: Uint8Array | null): void {
    discussionsById.set(d.id, d);
    if (photo) photosById.set(d.id, photo);
  },

  // ── Event-driven mutations (called from updater listeners) ──────────────

  /** onDiscussionNew — daemon just registered a fresh discussion. */
  addDiscussion(d: datatypes.Discussion): void {
    discussionsById.set(d.id, d);
  },

  /** onDiscussionTitleUpdated — clone-and-swap so we don't mutate the SDK
   *  object in place (defensive; the SDK's proto-generated objects
   *  aren't guaranteed to tolerate reassignment). */
  updateTitle(id: bigint, newTitle: string): void {
    const current = discussionsById.get(id);
    if (!current) return; // race: unknown discussion, nothing to update
    discussionsById.set(id, { ...current, title: newTitle });
  },

  /** onGroupPhotoUpdated / onContactPhotoUpdated. */
  updatePhoto(id: bigint, newPhoto: Uint8Array): void {
    photosById.set(id, newPhoto);
  },

  /** onGroupDeleted (or any equivalent removal). Clears both facets so a
   *  later addDiscussion() with the same id starts fresh. */
  remove(id: bigint): void {
    discussionsById.delete(id);
    photosById.delete(id);
  },

  // ── Reads (used by API handlers + notifierService) ─────────────────────

  /** GET /api/discussions — the "list every discussion the user can
   *  target" endpoint. Cheap: metadata only, no binaries. */
  listModels(): DiscussionModel[] {
    return Array.from(discussionsById.values()).map(toModel);
  },

  /** Single-model lookup — used when we need a title for a specific id
   *  (bundle rendering, view-mode summaries, etc.). */
  getModel(id: bigint): DiscussionModel | null {
    const d = discussionsById.get(id);
    return d ? toModel(d) : null;
  },

  /** GET /api/discussions/photo/[id] — the binary. Null on cache-miss;
   *  the handler translates that to a 404. */
  getPhoto(id: bigint): Uint8Array | null {
    return photosById.get(id) ?? null;
  },

  // ── Introspection (debug / tests) ───────────────────────────────────────

  size(): { discussions: number; photos: number } {
    return { discussions: discussionsById.size, photos: photosById.size };
  },
};

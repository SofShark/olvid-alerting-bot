// Olvid discussion as the frontend handles it.
export const DiscussionKind = {
  Contact: "contact",
  Group: "group",
} as const;
export type DiscussionKind = (typeof DiscussionKind)[keyof typeof DiscussionKind];

export type DiscussionModel = {
  id: string; // Stored as BigInt in the DB, but serialized to string for JSON safety.
  title: string;
  kind: DiscussionKind;
  /** `data:image/jpeg;base64,…` URL when the daemon shipped a photo for
   *  this discussion; `null` otherwise. Server-side cache embeds the
   *  bytes at boot; the client uses this directly — no per-photo fetch. */
  photoDataUrl: string | null;
};

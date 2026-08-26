// Wrapper around the Olvid bot daemon (@olvid/bot-node).
// Renamed from `daemonClient` — "daemon" was ambiguous (which daemon?).
// This is specifically the Olvid messaging daemon.
//
// Responsibilities:
//   - Send a message to one or more Olvid discussions.
//   - List the available discussions (for the destination selector).
//
// External SDK boundary — keep all Olvid-specific shapes here so the rest
// of the server speaks our own domain (discussion ids, message strings).
// If we ever swap providers (Slack, Discord, …), only this file changes.

import { OlvidClient, datatypes } from "@olvid/bot-node";
type MessageId = datatypes.MessageId;
const client = new OlvidClient();

/** Every message the bot sends is OUTBOUND from its own perspective —
 *  the SDK enum value is 2. Kept as a named constant so consumers
 *  don't hardcode magic numbers when reconstructing MessageId shapes
 *  from a persisted bigint id. */
const OUTBOUND: datatypes.MessageId["type"] = 2;

export const olvidClient = {
  async sendMessage(discussions: bigint[], message: string) {

    let allOk = true;
    await Promise.allSettled(discussions.map((discussionId) =>
        client.messageSend({
          discussionId: discussionId,
          body: message, 
        }).then(() => {
          console.log(`[olvidClient] Message sent to discussion: ${discussionId}`);
        }).catch((error: any) => {
          allOk = false;
          console.error(
            `[olvidClient] Failed to send to discussion ${discussionId}:`,
            error?.message ?? error,
          );
        })
      )
    );

    return allOk;
  },

  /**
   * Send a single message and return its outbound id so the caller
   * can track it (delete / edit later). Separate from `sendMessage`
   * because most callers (notifier fan-out) don't need the id and
   * would pay for the extra wiring; the invite flow does.
   *
   * Return shape:
   *   { ok: true, messageId }   — daemon accepted and produced an id
   *   { ok: true, messageId: undefined }
   *                              — daemon accepted but returned no id
   *                                (shouldn't happen; treat as success)
   *   { ok: false }              — send failed (caught + logged)
   */
  async sendMessageOne(
    discussionId: bigint,
    body: string,
  ): Promise<{ ok: boolean; messageId?: bigint }> {
    try {
      const sent = await client.messageSend({ discussionId, body });
      console.log(
        `✅ [Olvid] Message sent to discussion: ${discussionId}`,
      );
      return { ok: true, messageId: sent.id?.id };
    } catch (error: any) {
      console.error(
        "❌ [Olvid] An error occurred while sending a message:",
        error,
      );
      return { ok: false };
    }
  },

  /**
   * Revoke a previously-sent outbound message. `deleteEverywhere: true`
   * removes it from the invitee's inbox too — the whole point when
   * cancelling a pending invitation. Returns a boolean so the caller
   * (delete-user flow) can log the outcome without cascading failure.
   */
  async deleteOutboundMessage(id: bigint): Promise<boolean> {
    try {
      await client.messageDelete({
        messageId : { type: OUTBOUND, id },
        deleteEverywhere: true,
      });
      console.log(`✅ [Olvid] Message ${id} deleted`);
      return true;
    } catch (error: any) {
      console.error(
        `❌ [Olvid] Failed to delete message ${id}:`,
        error,
      );
      return false;
    }
  },

  // Olvid's MessageId is a composite { type: INBOUND|OUTBOUND, id: bigint }.
  async editMessage(messageId: MessageId, newBody: string) {
    try {
      await client.messageUpdateBody({ messageId, updatedBody: newBody });
      console.log(`✅ [Olvid] Message edited:`, messageId.id);
      return true;
    } catch (error: any) {
      console.error(
        "❌ [Olvid] An error occurred while editing a message:",
        error,
      );
      return false;
    }
  },

  async getDiscussions(): Promise<datatypes.Discussion[]> {
    try {
      const discussions = client.discussionList();
      const arrayDiscussions: any[] = [];

      try {
        for await (const discussion of discussions) {
          if (!discussion || !discussion.id) continue;
          arrayDiscussions.push(discussion);
        }
      } catch (error: any) {
        console.warn("⚠️ Async request ended abruptly:", error);
      }

      return arrayDiscussions;
    } catch (error: any) {
      console.error(
        "❌ [Olvid] A critical error occurred while getting discussions",
        error,
      );
      // Empty array on fatal failure — frontend keeps working with no destinations.
      return [];
    }
  },

  async getDiscussionPhoto(discussionId: bigint) {
    try {
      const avatar = await client.discussionDownloadPhoto({ discussionId });
      return avatar;
    } catch (error: any) {
      console.error(
        "❌ [Olvid] A critical error occurred while getting discussion photo",
        error,
      );
      return null;
    }
  },
};

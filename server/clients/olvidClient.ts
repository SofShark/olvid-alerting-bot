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

import { OlvidClient } from "@olvid/bot-node";

const client = new OlvidClient()

export const olvidClient = {

  async sendMessage(discussions: bigint[], message: string) {
    try {
      
      for (const discussionId of discussions) {
        await client.messageSend({
          discussionId: discussionId,
          body: message,
        });
        console.log(`✅ [Olvid] Message sent to discussion: ${discussionId}`);
      }
      return true;
    } catch (error: any) {
      console.error(
        "❌ [Olvid] An error occurred while sending a message:",
        error,
      );
      return false;
    }
  },

  async getDiscussions() {
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

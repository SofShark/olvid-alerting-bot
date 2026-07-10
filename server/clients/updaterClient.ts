import { OlvidClient, datatypes } from "@olvid/bot-node";
type MessageId = datatypes.MessageId;
const updater = new OlvidClient()

updater.onDiscussionNew({
  callback: (discussion: datatypes.Discussion) => {
    console.log(`✅ [Olvid] New discussion created: ${discussion.id}`);
  },
});

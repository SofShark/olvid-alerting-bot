// One Olvid discussion as the frontend handles it. The DB stores discussion
// ids as BigInt[] inside Bundle.discussion_list; we serialize to string at
// the API boundary so JSON.stringify doesn't choke on BigInt and the
// frontend can hold the value in a normal string field.
//
// `title` is already formatted on the server: "Display Name" for direct
// chats, "Display Name (group)" for groups.

export type DiscussionModel = {
  id: string;
  title: string;
};

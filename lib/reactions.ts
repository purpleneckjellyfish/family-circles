/** Shared reaction set. Kept out of the server-actions module so the client can import it. */
export const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

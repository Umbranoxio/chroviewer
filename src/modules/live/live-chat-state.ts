import type { LiveChatMessage } from './generated/proto/scoresaber/live/v1/chat_pb';

export const retainedChatMessages = 100;

export function chatMessageKey(message: LiveChatMessage) {
  return message.messageId || `${message.matchId}:${String(message.roomSequence)}`;
}

export function uniqueChatMessages(messages: LiveChatMessage[], limit = retainedChatMessages) {
  const unique = new Map(messages.map((message) => [chatMessageKey(message), message]));
  return [...unique.values()].sort(compareChatMessages).slice(-limit);
}

export function upsertChatMessage(messages: LiveChatMessage[], message: LiveChatMessage, limit = retainedChatMessages) {
  const key = chatMessageKey(message);
  return uniqueChatMessages([...messages.filter((candidate) => chatMessageKey(candidate) !== key), message], limit);
}

function compareChatMessages(left: LiveChatMessage, right: LiveChatMessage) {
  if (left.roomSequence < right.roomSequence) return -1;
  if (left.roomSequence > right.roomSequence) return 1;
  return 0;
}

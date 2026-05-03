/**
 * Backend uses a Gemini-style turn shape: `role` is one of `user` /
 * `model` and the payload field is `text` (not `content`). Respect that
 * exactly in the wire types — history sent back to the server must
 * round-trip without translation.
 *
 * The UI uses the same shape internally. `ChatbotUIMessage` adds id /
 * createdAt / delivery status so the rendered list can key, sort, and
 * surface per-message retry for failures.
 */

export type ChatbotRole = 'user' | 'model';

export interface ChatbotTurn {
  role: ChatbotRole;
  text: string;
}

export interface ChatbotAskResponse {
  response: string;
}

export type ChatbotMessageStatus = 'sending' | 'sent' | 'error';

export interface ChatbotUIMessage extends ChatbotTurn {
  id: string;
  createdAt: string;
  status: ChatbotMessageStatus;
  errorText?: string;
}

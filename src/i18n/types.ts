import { fr } from "./fr";

export type MessageKey = keyof typeof fr;
export type Messages = Record<MessageKey, string>;

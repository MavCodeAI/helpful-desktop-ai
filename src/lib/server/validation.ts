import { z } from "zod";

/** Shared primitives used across /api/* routes. */
export const nonEmptyString = z.string().trim().min(1);
export const messageContent = z.string().trim().min(1).max(4000);
export const chatRole = z.enum(["user", "assistant", "system"]);
export const chatMessage = z.object({ role: chatRole, content: messageContent });
export const chatBody = z.object({ messages: z.array(chatMessage).min(1).max(200) });

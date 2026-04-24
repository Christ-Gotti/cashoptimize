/**
 * POST /api/chat
 *   Streaming chat completion, RAG-backed sur les données tréso de l'org.
 *   Body : { message: string; history?: [{role, content}]; orgId: string }
 */

import { requireUser } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { organizationMembers, chatConversations, chatMessages } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { streamChatResponse } from "@/lib/ai/chat";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { message, history = [], orgId, conversationId } = (await req.json()) as {
      message: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
      orgId: string;
      conversationId?: string;
    };

    // Authz
    const member = await db
      .select()
      .from(organizationMembers)
      .where(and(eq(organizationMembers.orgId, orgId), eq(organizationMembers.userId, user.id)))
      .limit(1);
    if (member.length === 0) return new Response("Forbidden", { status: 403 });

    // Persist conversation + message
    let conv = conversationId
      ? (await db.select().from(chatConversations).where(eq(chatConversations.id, conversationId)).limit(1))[0]
      : null;

    if (!conv) {
      const [created] = await db
        .insert(chatConversations)
        .values({ orgId, userId: user.id, title: message.slice(0, 60) })
        .returning();
      conv = created;
    }

    await db.insert(chatMessages).values({ conversationId: conv.id, role: "user", content: message });

    // Stream response
    const stream = await streamChatResponse({ orgId, userMessage: message, history });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let fullResponse = "";
        try {
          for await (const chunk of stream) {
            if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
              const text = chunk.delta.text;
              fullResponse += text;
              controller.enqueue(encoder.encode(text));
            }
          }
          // Save assistant message
          await db
            .insert(chatMessages)
            .values({ conversationId: conv!.id, role: "assistant", content: fullResponse })
            .catch(() => {});
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Conversation-Id": conv.id,
      },
    });
  } catch (err) {
    console.error("[api/chat]", err);
    return new Response((err as Error).message, { status: 500 });
  }
}

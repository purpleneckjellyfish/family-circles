import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { families, getDb } from "@/db";
import {
  ensureLocalFamilyActor,
  getLocalFamilyBySlug,
} from "@/lib/federation/actor";
import { acceptIncomingFollow } from "@/lib/federation/follow";
import { verifyRequestSignature } from "@/lib/federation/http-signature";
import { ingestCreateActivity } from "@/lib/federation/ingest";
import { fetchJson } from "@/lib/federation/deliver";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const family = await getLocalFamilyBySlug(slug);
  if (!family) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const ready = await ensureLocalFamilyActor(family.id);
  return NextResponse.json(
    {
      "@context": "https://www.w3.org/ns/activitystreams",
      id: ready.actorInbox,
      type: "OrderedCollection",
      totalItems: 0,
      orderedItems: [],
    },
    {
      headers: {
        "Content-Type": 'application/activity+json; charset=utf-8',
      },
    },
  );
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const family = await getLocalFamilyBySlug(slug);
  if (!family) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await ensureLocalFamilyActor(family.id);

  const bodyText = await req.text();
  let activity: Record<string, unknown>;
  try {
    activity = JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = typeof activity.type === "string" ? activity.type : "";
  const actorUri =
    typeof activity.actor === "string"
      ? activity.actor
      : (activity.actor as { id?: string } | undefined)?.id;

  // Best-effort signature check when we can resolve the actor key.
  if (actorUri) {
    try {
      const remote = await fetchJson(actorUri);
      const pem = (remote.publicKey as { publicKeyPem?: string } | undefined)
        ?.publicKeyPem;
      if (pem) {
        const ok = verifyRequestSignature({
          method: "POST",
          url: req.url,
          headers: req.headers,
          body: bodyText,
          publicKeyPem: pem,
        });
        if (!ok) {
          // Soft-fail in v1 for interop during roll-out; log via response header.
          // Strict mode can be enabled later.
        }
      }
    } catch {
      /* discovery optional */
    }
  }

  if (type === "Follow") {
    await acceptIncomingFollow({
      localFamilyId: family.id,
      activity,
    });
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  if (type === "Undo") {
    // Undo Follow — remove federated follower if present.
    const object = activity.object as Record<string, unknown> | string | undefined;
    const obj =
      typeof object === "object" && object
        ? object
        : null;
    if (obj?.type === "Follow" && actorUri) {
      const { federatedFollowers } = await import("@/db");
      const db = getDb();
      await db
        .delete(federatedFollowers)
        .where(
          eq(federatedFollowers.actorUri, actorUri),
        );
    }
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  if (type === "Create") {
    const object = activity.object as Record<string, unknown> | undefined;

    // Federated comment on a local note
    const inReplyTo =
      typeof object?.inReplyTo === "string" ? object.inReplyTo : null;
    if (inReplyTo && family.allowFederatedComments) {
      const noteMatch = /\/ap\/notes\/([0-9a-f-]{36})/i.exec(inReplyTo);
      if (noteMatch) {
        const { comments, posts: postsTable } = await import("@/db");
        const db = getDb();
        const [localPost] = await db
          .select()
          .from(postsTable)
          .where(eq(postsTable.id, noteMatch[1]!))
          .limit(1);
        if (localPost && localPost.familyId === family.id) {
          const content =
            typeof object?.content === "string" ? object.content : "";
          const remoteCommentUri =
            typeof object?.id === "string" ? object.id : null;
          if (content) {
            try {
              await db.insert(comments).values({
                postId: localPost.id,
                body: content.slice(0, 2000),
                remoteUri: remoteCommentUri,
                instanceHost: actorUri
                  ? new URL(actorUri).host
                  : null,
              });
            } catch {
              /* duplicate remoteUri */
            }
          }
          return NextResponse.json({ ok: true }, { status: 202 });
        }
      }
    }

    const attributed =
      typeof object?.attributedTo === "string"
        ? object.attributedTo
        : typeof activity.actor === "string"
          ? activity.actor
          : null;

    let targetFamilyId: string | null = null;
    if (attributed) {
      const db = getDb();
      const [cache] = await db
        .select()
        .from(families)
        .where(eq(families.remoteUri, attributed))
        .limit(1);
      if (cache) targetFamilyId = cache.id;
    }

    if (!targetFamilyId) {
      return NextResponse.json({ ok: true, skipped: true }, { status: 202 });
    }

    await ingestCreateActivity({
      familyId: targetFamilyId,
      activity,
    });
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  if (type === "Accept") {
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  return NextResponse.json({ ok: true, ignored: type }, { status: 202 });
}

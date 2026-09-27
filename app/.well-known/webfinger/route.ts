import { NextResponse } from "next/server";

import { getLocalFamilyBySlug, ensureLocalFamilyActor } from "@/lib/federation/actor";
import { familyActorUrl, localHost } from "@/lib/federation/urls";

export const runtime = "nodejs";

/**
 * WebFinger discovery: acct:slug@host → ActivityPub family actor.
 * Example: /.well-known/webfinger?resource=acct:smith@circles.example.com
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const resource = url.searchParams.get("resource") || "";
  const match = /^acct:([^@]+)@([^@]+)$/i.exec(resource.trim());
  if (!match) {
    return NextResponse.json(
      { error: "Expected resource=acct:slug@host" },
      { status: 400 },
    );
  }
  const [, username, host] = match;
  if (host!.toLowerCase() !== localHost().toLowerCase()) {
    return NextResponse.json({ error: "Wrong host" }, { status: 404 });
  }

  const family = await getLocalFamilyBySlug(username!);
  if (!family) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await ensureLocalFamilyActor(family.id);
  const href = family.remoteUri || familyActorUrl(family.slug);

  return NextResponse.json(
    {
      subject: `acct:${family.slug}@${localHost()}`,
      aliases: [href, `${new URL(href).origin}/families/${family.slug}`],
      links: [
        {
          rel: "self",
          type: "application/activity+json",
          href,
        },
        {
          rel: "http://webfinger.net/rel/profile-page",
          type: "text/html",
          href: `${new URL(href).origin}/families/${family.slug}`,
        },
      ],
    },
    {
      headers: {
        "Content-Type": "application/jrd+json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}

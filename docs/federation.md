# Federation (Phase 8)

Family Circles instances can **follow each other** with an ActivityPub-style protocol. Families are the actors. Media stays on the **origin** host; followers keep lightweight post rows and proxy/view origin URLs.

## Requirements

- **HTTPS** in production (`APP_URL=https://…`) — same as web push
- Both hosts running Family Circles Phase 8+
- Open `/ap/*` and `/.well-known/webfinger` through your reverse proxy

## Discovery

| Form | Example |
| --- | --- |
| HTML profile | `https://aunt.example/families/smith` |
| Actor IRI | `https://aunt.example/ap/families/smith` |
| WebFinger | `acct:smith@aunt.example` |

WebFinger:

```http
GET /.well-known/webfinger?resource=acct:smith@aunt.example
```

Returns a `self` link of type `application/activity+json` to the family actor.

## Actor document

`GET /ap/families/{slug}` → ActivityStreams `Group` with `inbox`, `outbox`, `followers`, and `publicKey` (RSA-2048) for HTTP Signatures.

Also:

- `GET /ap/families/{slug}/outbox` — recent local Creates
- `POST /ap/families/{slug}/inbox` — Follow / Create / Accept / Undo
- `GET /ap/notes/{postId}` — Note object
- `GET /ap/media/{id}` — **origin** binary for federated attachments (UUID)

## Follow another Unraid host

1. On host A, create a local circle (this publishes the actor + keys).
2. On host B, open **Browse** → **Follow a remote circle**.
3. Paste `https://host-a/families/slug` or `acct:slug@host-a`.
4. Host A auto-**Accept**s Follows (v1 policy for family Unraid sharing).
5. New memories on A fan out as `Create(Note)` to B’s follower inbox; B caches posts under a remote circle row.
6. B’s home feed merges them with local posts (by `postedAt`).

Cross-instance Follow is sent **as your owned local circle’s actor** (you need at least one local circle).

## Media

- Attachments in Notes point at `https://origin/ap/media/{uuid}`.
- On the follower instance, media rows store `remoteUri` only (`storagePath` null).
- Authenticated `/api/media/{id}` **proxies** the origin URL (no mandatory mirror).

## Comments policy (v1)

| Direction | Behavior |
| --- | --- |
| View remote posts | Yes, if you follow |
| Comment on remote | Yes if remote `allowFederatedComments` (default **true**) — delivered as `Create(Note)` with `inReplyTo` |
| Contribute photos to remote | **Not in v1** (needs remote auth/consent) |

Local families expose `fc:allowFederatedComments` on the actor document. Owners can change the column later via DB/admin; UI toggle can land in a polish pass.

## HTTP Signatures

Outbound deliveries use cavage-style HTTP Signatures (`(request-target) host date digest`). Inbound verification is best-effort in v1 (interop-friendly); tighten once all peers ship the same build.

## Dual-instance smoke (manual)

1. Two Compose stacks (different `APP_URL` / ports) or two Unraid boxes.
2. Create circle on A; post a photo.
3. From B (with a local circle owned): follow A’s URL.
4. Confirm B home feed shows the remote memory; open the photo (proxied).
5. Post again on A; confirm Create arrives on B without re-follow.
6. Comment from B if comments allowed.

Single-box automated smoke covers actor / WebFinger / outbox / ingest without a second host (`scripts/phase8-federation-smoke.ts`).

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Discover fails | HTTPS? WebFinger path proxied? Actor `GET` returns JSON |
| Follow errors “Create a local circle first” | Own a circle on the following instance |
| No posts after follow | Outbox reachable; inbox not blocked; check app logs for delivery errors |
| Photos broken on follower | Origin `/ap/media/{id}` public; proxy can reach origin |
| Comments rejected | Remote `allow_federated_comments`; you follow that circle |

## Related

- [`docs/unraid.md`](./unraid.md) — volumes, TLS, VAPID
- [`AGENTS.md`](../AGENTS.md) — code map

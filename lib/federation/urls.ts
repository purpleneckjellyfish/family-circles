import { env } from "@/lib/env";

/** Origin used in actor IRIs — APP_URL without trailing slash. */
export function federationOrigin() {
  return env.appUrl.replace(/\/$/, "");
}

export function localHost() {
  try {
    return new URL(federationOrigin()).host;
  } catch {
    return "localhost";
  }
}

export function familyActorUrl(slug: string) {
  return `${federationOrigin()}/ap/families/${encodeURIComponent(slug)}`;
}

export function familyInboxUrl(slug: string) {
  return `${familyActorUrl(slug)}/inbox`;
}

export function familyOutboxUrl(slug: string) {
  return `${familyActorUrl(slug)}/outbox`;
}

export function familyFollowersUrl(slug: string) {
  return `${familyActorUrl(slug)}/followers`;
}

export function noteUrl(postId: string) {
  return `${federationOrigin()}/ap/notes/${postId}`;
}

export function federatedMediaUrl(mediaId: string) {
  return `${federationOrigin()}/ap/media/${mediaId}`;
}

export function webfingerAcct(slug: string) {
  return `acct:${slug}@${localHost()}`;
}

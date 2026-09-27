import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Roles on a family circle.
 * - owner / adult: full family members who manage content
 * - follower: can contribute/comment per invite policy (local or federated later)
 */
export const membershipRoleEnum = pgEnum("membership_role", [
  "owner",
  "adult",
  "follower",
]);

/** Local media is always stored under DATA_DIR; remote media references origin URLs. */
export const mediaKindEnum = pgEnum("media_kind", ["image", "video"]);

export const followStatusEnum = pgEnum("follow_status", [
  "pending",
  "accepted",
  "rejected",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash"),
    /** ActivityPub actor IRI for this person when federation is enabled (Phase 8). */
    remoteUri: text("remote_uri"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("users_email_uidx").on(table.email),
    uniqueIndex("users_remote_uri_uidx").on(table.remoteUri),
  ],
);

/**
 * A family circle is the primary social actor.
 * Local families have null remoteUri; federated follows point at a remote actor.
 */
export const families = pgTable(
  "families",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    summary: text("summary"),
    /** Canonical ActivityPub actor URI (null = local-only until published). */
    remoteUri: text("remote_uri"),
    /** Host that owns this family actor, e.g. circles.example.com */
    instanceHost: text("instance_host"),
    actorInbox: text("actor_inbox"),
    actorOutbox: text("actor_outbox"),
    actorSharedInbox: text("actor_shared_inbox"),
    publicKeyPem: text("public_key_pem"),
    privateKeyPem: text("private_key_pem"),
    allowFederatedComments: boolean("allow_federated_comments")
      .default(true)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("families_slug_uidx").on(table.slug),
    uniqueIndex("families_remote_uri_uidx").on(table.remoteUri),
    index("families_instance_host_idx").on(table.instanceHost),
  ],
);

export const familyMemberships = pgTable(
  "family_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: membershipRoleEnum("role").notNull().default("adult"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("family_memberships_family_user_uidx").on(
      table.familyId,
      table.userId,
    ),
    index("family_memberships_user_idx").on(table.userId),
  ],
);

/**
 * Follows cover both same-instance and remote families.
 * For remote follows, familyId points at a local cache row of the remote actor.
 */
export const follows = pgTable(
  "follows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    followerUserId: uuid("follower_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    status: followStatusEnum("status").notNull().default("accepted"),
    /** Remote Follow activity URI when the follow is federated. */
    remoteUri: text("remote_uri"),
    instanceHost: text("instance_host"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("follows_follower_family_uidx").on(
      table.followerUserId,
      table.familyId,
    ),
    index("follows_family_idx").on(table.familyId),
  ],
);

/**
 * Remote ActivityPub actors that follow a *local* family.
 * Used to fan-out Create activities when someone posts in the circle.
 */
export const federatedFollowers = pgTable(
  "federated_followers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    actorUri: text("actor_uri").notNull(),
    inboxUri: text("inbox_uri").notNull(),
    sharedInboxUri: text("shared_inbox_uri"),
    publicKeyPem: text("public_key_pem"),
    status: followStatusEnum("status").notNull().default("accepted"),
    followActivityUri: text("follow_activity_uri"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("federated_followers_family_actor_uidx").on(
      table.familyId,
      table.actorUri,
    ),
    index("federated_followers_family_idx").on(table.familyId),
  ],
);

/** People who can be tagged in memories (kids may have no user account). */
export const people = pgTable(
  "people",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    linkedUserId: uuid("linked_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    birthday: date("birthday"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("people_family_idx").on(table.familyId)],
);

/** Recurring circle milestones (anniversaries, etc.) matched by month-day. */
export const milestoneKindEnum = pgEnum("milestone_kind", [
  "anniversary",
  "other",
]);

export const milestones = pgTable(
  "milestones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    kind: milestoneKindEnum("kind").notNull().default("anniversary"),
    /** Original date; throwbacks match month + day each year. */
    occursOn: date("occurs_on").notNull(),
    personId: uuid("person_id").references(() => people.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("milestones_family_idx").on(table.familyId),
    index("milestones_occurs_on_idx").on(table.occursOn),
  ],
);

export const albums = pgTable(
  "albums",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("albums_family_idx").on(table.familyId)],
);

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    body: text("body"),
    /** When the memory happened (EXIF/user-chosen); distinct from postedAt. */
    memoryDate: date("memory_date"),
    postedAt: timestamp("posted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    /** ActivityPub object URI for federated posts cached locally. */
    remoteUri: text("remote_uri"),
    instanceHost: text("instance_host"),
    /** True when this row is a lightweight remote object, not authored here. */
    isRemote: boolean("is_remote").default(false).notNull(),
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("posts_remote_uri_uidx").on(table.remoteUri),
    index("posts_family_posted_idx").on(table.familyId, table.postedAt),
    index("posts_memory_date_idx").on(table.memoryDate),
  ],
);

export const albumPosts = pgTable(
  "album_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    albumId: uuid("album_id")
      .notNull()
      .references(() => albums.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("album_posts_album_post_uidx").on(table.albumId, table.postId),
  ],
);

export const media = pgTable(
  "media",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    kind: mediaKindEnum("kind").notNull().default("image"),
    /** Relative path under DATA_DIR for local files; unused for remote-only media. */
    storagePath: text("storage_path"),
    /** Origin URL for federated media — never mandatory to mirror locally. */
    remoteUri: text("remote_uri"),
    mimeType: text("mime_type"),
    width: integer("width"),
    height: integer("height"),
    durationMs: integer("duration_ms"),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("media_post_idx").on(table.postId),
    index("media_kind_idx").on(table.kind),
  ],
);

export const postPeople = pgTable(
  "post_people",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("post_people_post_person_uidx").on(table.postId, table.personId),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    remoteUri: text("remote_uri"),
    instanceHost: text("instance_host"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("comments_post_idx").on(table.postId),
    uniqueIndex("comments_remote_uri_uidx").on(table.remoteUri),
  ],
);

export const invites = pgTable(
  "invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    role: membershipRoleEnum("role").notNull().default("adult"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("invites_token_uidx").on(table.token)],
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("push_subscriptions_endpoint_uidx").on(table.endpoint),
    index("push_subscriptions_user_idx").on(table.userId),
  ],
);

/** How new-family-post alerts are delivered. */
export const notificationModeEnum = pgEnum("notification_mode", [
  "instant",
  "digest",
  "off",
]);

export const notificationPreferences = pgTable("notification_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Master switch — false disables all web push from this app. */
  pushEnabled: boolean("push_enabled").default(true).notNull(),
  mode: notificationModeEnum("mode").notNull().default("instant"),
  /** Local wall-clock quiet window, HH:MM (24h). Null = no quiet hours. */
  quietHoursStart: text("quiet_hours_start"),
  quietHoursEnd: text("quiet_hours_end"),
  /** IANA timezone for quiet hours + digest (e.g. America/Chicago). */
  timezone: text("timezone").notNull().default("UTC"),
  /** Local hour (0–23) to flush digest / post-quiet-hours queue. */
  digestHour: integer("digest_hour").notNull().default(8),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Deferred push payloads (quiet hours or digest mode). */
export const notificationDigestItems = pgTable(
  "notification_digest_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    postId: uuid("post_id").references(() => posts.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    urlPath: text("url_path").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  },
  (table) => [
    index("notification_digest_user_pending_idx").on(
      table.userId,
      table.deliveredAt,
    ),
  ],
);

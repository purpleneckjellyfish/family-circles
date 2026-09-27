import { isInQuietHours, localHour } from "../lib/push";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

// Fixed instant: 2026-09-27 15:30 UTC
const noonish = new Date("2026-09-27T15:30:00.000Z");

assert(
  isInQuietHours(noonish, "UTC", "22:00", "07:00") === false,
  "afternoon UTC not in overnight quiet",
);
assert(
  isInQuietHours(new Date("2026-09-27T23:00:00.000Z"), "UTC", "22:00", "07:00") ===
    true,
  "23:00 UTC in overnight quiet",
);
assert(
  isInQuietHours(new Date("2026-09-27T06:00:00.000Z"), "UTC", "22:00", "07:00") ===
    true,
  "06:00 UTC in overnight quiet",
);
assert(
  isInQuietHours(noonish, "UTC", "12:00", "18:00") === true,
  "15:30 in daytime quiet",
);
assert(isInQuietHours(noonish, "UTC", null, null) === false, "no quiet hours");

assert(localHour(new Date("2026-09-27T08:15:00.000Z"), "UTC") === 8, "local hour");

console.log(JSON.stringify({ ok: true }));

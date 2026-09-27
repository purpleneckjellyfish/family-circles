import Link from "next/link";

const links = [
  { suffix: "", label: "Feed" },
  { suffix: "/browse", label: "Browse" },
  { suffix: "/people", label: "People" },
  { suffix: "/albums", label: "Albums" },
  { suffix: "/milestones", label: "Milestones" },
  { suffix: "/export", label: "Export" },
] as const;

/** Shared circle sub-nav for feed / browse / export and admin lists. */
export function FamilySubnav({
  slug,
  active,
}: {
  slug: string;
  active?:
    | "feed"
    | "browse"
    | "people"
    | "albums"
    | "milestones"
    | "export";
}) {
  return (
    <nav className="mt-6 flex flex-wrap gap-3 text-sm">
      {links.map((item) => {
        const key =
          item.suffix === ""
            ? "feed"
            : (item.suffix.slice(1) as typeof active);
        const href = `/families/${slug}${item.suffix}`;
        const isActive = active === key;
        return (
          <Link
            key={item.label}
            href={href}
            className={
              isActive
                ? "font-medium text-ink"
                : "text-forest underline-offset-4 hover:underline"
            }
            aria-current={isActive ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

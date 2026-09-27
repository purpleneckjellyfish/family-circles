export const OCCASION_LABELS: Record<string, string> = {
  christmas: "Christmas",
  birthday: "Birthday",
  easter: "Easter",
  other: "Other",
};

export function occasionBrowseTitle(occasion: string, year: number) {
  return `${OCCASION_LABELS[occasion] ?? occasion} ${year}`;
}

export function occasionHref(slug: string, occasion: string, year: number) {
  return `/families/${slug}/browse/occasions/${occasion}?year=${year}`;
}

export function seasonRank(season: string): number {
  const match = season.match(/(20\d{2})/);
  const year = match ? Number(match[1]) : 0;
  const normalized = season.toLowerCase();
  const phase = normalized.includes("summer")
    ? 5
    : normalized.includes("resort") || normalized.includes("cruise")
      ? 4
      : normalized.includes("fall") || normalized.includes("autumn")
        ? 3
        : normalized.includes("spring")
          ? 2
          : normalized.includes("winter")
            ? 1
            : 0;
  return year * 10 + phase;
}

export function sortSeasons(seasons: string[]): string[] {
  return [...new Set(seasons.filter(Boolean))].sort(
    (a, b) => seasonRank(b) - seasonRank(a) || b.localeCompare(a),
  );
}

export function seasonSlug(season: string): string {
  return season.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
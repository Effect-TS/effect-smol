export type MigrationMode = "safe" | "aggressive";

function normalizeMode(raw: string | undefined): MigrationMode {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "aggressive") {
    return "aggressive";
  }

  return "safe";
}

export function getMigrationMode(): MigrationMode {
  return normalizeMode(process.env.EFFECT_V4_MODE);
}

export function isAggressiveMode(): boolean {
  return getMigrationMode() === "aggressive";
}

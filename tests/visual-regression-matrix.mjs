// Visual capture matrix and shard partitioning shared by the regression
// runner (tests/visual-regression.mjs) and the partition self-check
// (tests/visual-shard-check.mjs). Both import from here so the runner
// cannot silently disagree with its own verification.
export function buildCaptureMatrix(scenarios, viewports) {
  const viewportById = new Map(viewports.map((viewport) => [viewport.id, viewport]));
  const matrix = scenarios.flatMap((scenarioDefinition) => scenarioDefinition.profiles.map((profile) => {
    const viewport = viewportById.get(profile.viewport);
    if (!viewport) throw new Error(`Unknown visual viewport ${profile.viewport} for ${scenarioDefinition.scenarioId}.`);
    return {
      scenario: scenarioDefinition,
      locale: profile.locale,
      theme: profile.theme,
      viewport,
      name: `${scenarioDefinition.routeId}__${scenarioDefinition.stateId}__${profile.locale}__${profile.theme}__${viewport.id}.png`,
    };
  }));
  const names = matrix.map(({ name }) => name);
  if (new Set(names).size !== names.length) throw new Error("Visual scenario matrix produced duplicate capture names; stateId values must be unique per route.");
  return matrix;
}

export function parseVisualShard(rawValue) {
  if (rawValue === undefined || rawValue.trim() === "") return null;
  const match = rawValue.trim().match(/^(\d+)\/(\d+)$/);
  if (!match) throw new Error(`VISUAL_SHARD must look like "1/2", received ${rawValue}.`);
  const index = Number.parseInt(match[1], 10);
  const total = Number.parseInt(match[2], 10);
  if (index < 1 || total < 1 || index > total) {
    throw new Error(`VISUAL_SHARD index must satisfy 1 <= index <= total, received ${rawValue}.`);
  }
  return Object.freeze({ index, total });
}

// Contiguous slices in manifest order. With total=2 the first shard holds
// ceil(N/2) captures and the second holds floor(N/2). A null shard selects
// the whole matrix, so unset VISUAL_SHARD changes nothing.
export function selectVisualShard(captures, shard) {
  if (!shard) return captures;
  const perShard = Math.ceil(captures.length / shard.total);
  const start = (shard.index - 1) * perShard;
  return captures.slice(start, Math.min(start + perShard, captures.length));
}

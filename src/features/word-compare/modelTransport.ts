/** Undo the sharing in compare.py `extract_document_model_compact`.
 *
 * Python writes each shared object once: an inventory entry's property facts as `{"$f":k}` into
 * `$facts`, and any other occurrence of an inventory entry as `{"$src":index}`. Restoring shares
 * the same objects again, so the model equals the plain extraction JSON. A model without
 * `$facts` is returned unchanged. */
export function restoreModelTransport<T extends object>(model: T): T {
  const transport = model as T & { $facts?: unknown[]; sourceInventory?: Array<{ normalizedProperties?: Record<string, unknown> }> };
  const facts = transport.$facts;
  if (!Array.isArray(facts)) return model;
  delete transport.$facts;
  const inventory = transport.sourceInventory ?? [];
  const fact = (stub: unknown) => {
    const index = (stub as { $f?: unknown } | null)?.$f;
    if (typeof index !== "number" || !(index in facts)) throw new Error("Invalid model transport fact.");
    return facts[index];
  };
  for (const entry of inventory) {
    const properties = entry.normalizedProperties;
    if (properties) for (const name of Object.keys(properties)) properties[name] = fact(properties[name]);
  }
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index++) value[index] = visit(value[index]);
      return value;
    }
    if (!value || typeof value !== "object") return value;
    const record = value as Record<string, unknown>;
    if ("$src" in record) {
      const index = record.$src;
      if (typeof index !== "number" || !(index in inventory) || Object.keys(record).length !== 1) throw new Error("Invalid model transport reference.");
      return inventory[index];
    }
    for (const key of Object.keys(record)) record[key] = visit(record[key]);
    return record;
  };
  const record = transport as unknown as Record<string, unknown>;
  for (const key of Object.keys(record)) if (key !== "sourceInventory") record[key] = visit(record[key]);
  return model;
}

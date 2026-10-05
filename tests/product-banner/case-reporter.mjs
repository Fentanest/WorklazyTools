// Machine-readable, top-level Node test outcomes; stdout noise cannot count as a pass.
export default async function* report(source) {
  for await (const { type, data } of source) {
    if (["test:pass", "test:fail"].includes(type) && data.nesting === 0) {
      yield JSON.stringify({ name: data.name, status: data.skip || data.todo ? "NOT_RUN" : type === "test:pass" ? "PASS" : "FAIL" }) + "\n";
    }
  }
}

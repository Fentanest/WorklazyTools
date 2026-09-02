import assert from "node:assert/strict";
import test from "node:test";

import { offloadConcatSegment, withMountedConcatSegments } from "../../src/features/video-studio/videoConcatSegments.ts";

class FakeConcatFileSystem {
  readonly files = new Map<string, Uint8Array>();
  readonly directories = new Set<string>();
  readonly mountedDirectories = new Set<string>();
  readonly calls: string[] = [];

  async readFile(path: string) {
    this.calls.push(`read:${path}`);
    const data = this.files.get(path);
    if (!data) throw new Error(`Missing ${path}`);
    return data;
  }

  async deleteFile(path: string) {
    this.calls.push(`delete-file:${path}`);
    return this.files.delete(path);
  }

  async createDir(path: string) {
    this.calls.push(`create-dir:${path}`);
    this.directories.add(path);
    return true;
  }

  async mount(_type: unknown, _options: unknown, path: string) {
    this.calls.push(`mount:${path}`);
    this.mountedDirectories.add(path);
    return true;
  }

  async unmount(path: string) {
    this.calls.push(`unmount:${path}`);
    return this.mountedDirectories.delete(path);
  }

  async deleteDir(path: string) {
    this.calls.push(`delete-dir:${path}`);
    return this.directories.delete(path);
  }
}

test("concat segments become Blobs and leave MEMFS immediately after each read", async () => {
  const filesystem = new FakeConcatFileSystem();
  filesystem.files.set("segment-0.mp4", Uint8Array.from([1, 2, 3, 4]));

  const segment = await offloadConcatSegment(filesystem as never, "segment-0.mp4");

  assert.equal(filesystem.files.size, 0);
  assert.equal(segment.name, "segment-0.mp4");
  assert.deepEqual(new Uint8Array(await segment.data.arrayBuffer()), Uint8Array.from([1, 2, 3, 4]));
  assert.deepEqual(filesystem.calls, ["read:segment-0.mp4", "delete-file:segment-0.mp4"]);
});

for (const scenario of ["success", "failure", "cancel"] as const) {
  test(`concat segment WORKERFS ownership leaves zero residue after ${scenario}`, async () => {
    const filesystem = new FakeConcatFileSystem();
    const segment = { name: "segment-0.mp4", data: new Blob([Uint8Array.from([1, 2, 3])]) };
    const operation = async (names: readonly string[]) => {
      assert.deepEqual(names, ["/concat-segments/segment-0.mp4"]);
      assert.deepEqual([...filesystem.mountedDirectories], ["/concat-segments"]);
      if (scenario === "failure") throw new Error("join failed");
      if (scenario === "cancel") throw new DOMException("canceled", "AbortError");
      return "joined";
    };

    if (scenario === "success") {
      assert.equal(await withMountedConcatSegments(filesystem as never, "/concat-segments", [segment], operation), "joined");
    } else {
      await assert.rejects(
        withMountedConcatSegments(filesystem as never, "/concat-segments", [segment], operation),
        scenario === "cancel" ? { name: "AbortError" } : /join failed/,
      );
    }

    assert.equal(filesystem.mountedDirectories.size, 0);
    assert.equal(filesystem.directories.size, 0);
    assert.deepEqual(filesystem.calls, [
      "create-dir:/concat-segments",
      "mount:/concat-segments",
      "unmount:/concat-segments",
      "delete-dir:/concat-segments",
    ]);
  });
}

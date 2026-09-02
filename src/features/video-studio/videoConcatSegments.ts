import type { FFmpeg, FFFSType } from "@ffmpeg/ffmpeg";

type ConcatSegmentFileSystem = Pick<FFmpeg, "readFile" | "deleteFile" | "createDir" | "mount" | "unmount" | "deleteDir">;
const workerFsType = "WORKERFS" as FFFSType;

export interface ConcatSegmentBlob {
  name: string;
  data: Blob;
}

export async function offloadConcatSegment(filesystem: ConcatSegmentFileSystem, name: string): Promise<ConcatSegmentBlob> {
  const data = await filesystem.readFile(name);
  if (typeof data === "string") throw new Error("The concat segment is not binary data.");
  const buffer = data.byteOffset === 0 && data.byteLength === data.buffer.byteLength
    ? data.buffer
    : data.slice().buffer;
  const blob = new Blob([buffer as ArrayBuffer]);
  const deleted = await filesystem.deleteFile(name);
  if (!deleted) throw new Error(`Unable to release concat segment ${name}.`);
  return { name, data: blob };
}

export async function withMountedConcatSegments<T>(
  filesystem: ConcatSegmentFileSystem,
  mountPoint: string,
  segments: readonly ConcatSegmentBlob[],
  operation: (absoluteSegmentNames: readonly string[]) => Promise<T>,
): Promise<T> {
  let directoryCreated = false;
  let mounted = false;
  try {
    const created = await filesystem.createDir(mountPoint);
    if (!created) throw new Error(`Unable to create concat segment directory ${mountPoint}.`);
    directoryCreated = true;
    mounted = await filesystem.mount(workerFsType, { blobs: [...segments] }, mountPoint);
    if (!mounted) throw new Error(`Unable to mount concat segments at ${mountPoint}.`);
    return await operation(segments.map(({ name }) => `${mountPoint}/${name}`));
  } finally {
    let cleanupError: unknown;
    if (mounted) {
      try {
        const unmounted = await filesystem.unmount(mountPoint);
        if (!unmounted) throw new Error(`Unable to unmount concat segments at ${mountPoint}.`);
      } catch (error) {
        cleanupError = error;
      }
    }
    if (directoryCreated) {
      try {
        const deleted = await filesystem.deleteDir(mountPoint);
        if (!deleted) throw new Error(`Unable to delete concat segment directory ${mountPoint}.`);
      } catch (error) {
        cleanupError ??= error;
      }
    }
    if (cleanupError) throw cleanupError;
  }
}

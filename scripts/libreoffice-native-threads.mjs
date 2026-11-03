/** Keep the pinned runtime's four ready slots available before a synchronous LOK call.
 * A newly spawned pthread needs the JS event loop to finish loading. Publishing
 * it to native code before that can deadlock a synchronous load/save/join.
 */
export async function reserveNativeThreads(pool, minimum = 4) {
  if (!pool || !Array.isArray(pool.unusedWorkers) ||
      typeof pool.allocateUnusedWorker !== 'function' || typeof pool.loadWasmModuleToWorker !== 'function') {
    throw new Error('office-thread-pool-unavailable');
  }
  if (pool.unusedWorkers.some(worker => !worker.loaded)) throw new Error('office-thread-pool-not-ready');
  while (pool.unusedWorkers.length < minimum) {
    pool.allocateUnusedWorker();
    // Keep this worker out of the native allocator until its loaded reply.
    const worker = pool.unusedWorkers.pop();
    if (!worker) throw new Error('office-thread-worker-missing');
    try {
      await pool.loadWasmModuleToWorker(worker);
      if (!worker.loaded) throw new Error('office-thread-worker-not-ready');
    } catch (error) {
      worker.terminate();
      throw error;
    }
    pool.unusedWorkers.push(worker);
  }
}

/** These anchors belong to the SHA-pinned 2.3.1 worker, not arbitrary releases. */
export function patchNativeThreadReadiness(source) {
  const start = source.indexOf('function Re(l){');
  const end = source.indexOf('function ve(l){', start);
  if (start < 0 || end < start) throw new Error('LibreOffice conversion handler anchor changed');
  let handler = source.slice(start, end);
  const loading = 'R(l.id,30,"Loading document..."),';
  if (handler.split(loading).length !== 2 || handler.split('c.documentSaveAs(').length !== 4) {
    throw new Error('LibreOffice native call anchors changed');
  }
  handler = handler.replace('function Re(l){', 'async function Re(l){')
    .replace(loading, `${loading}await worklazyReserveThreads(PThread),`)
    .replaceAll('c.documentSaveAs(', 'await worklazyReserveThreads(PThread),c.documentSaveAs(');
  // Keep finally/destroy synchronous: the existing cleanup ping must not
  // overtake document destruction after the PDF result has been posted.
  return `const worklazyReserveThreads=${reserveNativeThreads.toString()};\n${source.slice(0, start)}${handler}${source.slice(end)}`;
}

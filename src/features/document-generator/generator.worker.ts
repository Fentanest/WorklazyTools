/// <reference lib="webworker" />
import { parseGeneratorData } from './input.ts';
import { generatorErrorCode } from './errors.ts';
import { inspectGeneratorTemplate, renderGeneratorDocument } from './template.ts';
import type { GeneratorWorkerRequest, GeneratorWorkerResponse } from './workerProtocol.ts';
const worker = self as unknown as DedicatedWorkerGlobalScope;
worker.onmessage = async ({data}: MessageEvent<GeneratorWorkerRequest>) => {
  try {
    let response: GeneratorWorkerResponse;
    if (data.type === 'inspect') response = {id: data.id, type: 'inspect', variables: inspectGeneratorTemplate(new Uint8Array(data.buffer))};
    else if (data.type === 'parse') {
      const book = await parseGeneratorData(data.fileName, data.buffer);
      response = {id: data.id, type: 'parse', book};
    } else {
      worker.postMessage({id: data.id, type: 'progress', phase: 'rendering'} satisfies GeneratorWorkerResponse);
      const output = renderGeneratorDocument(new Uint8Array(data.buffer), data.values);
      response = {id: data.id, type: 'render', buffer: output.buffer as ArrayBuffer};
    }
    worker.postMessage(response, response.type === 'render' ? [response.buffer] : []);
  } catch (error) {
    worker.postMessage({id: data.id, type: 'error', code: generatorErrorCode(error, data.type === 'parse' ? 'DAMAGED_DATA' : 'GENERATION_FAILED')} satisfies GeneratorWorkerResponse);
  }
};

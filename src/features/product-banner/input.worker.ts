import { classifyInputError, parseInputBytes } from "./inputParser.ts";
import { extractInputProducts, summarizeSheets } from "./inputMapping.ts";
import type { InputWorkerRequest } from "./inputClient.ts";

const workerScope = self as unknown as { onmessage: ((event: MessageEvent<InputWorkerRequest>) => void) | null; postMessage: (message: unknown) => void };
workerScope.onmessage = ({ data }) => {
  try {
    workerScope.postMessage({ type: "progress", progress: 0, phase: "parsing" });
    const book = parseInputBytes(data.buffer);
    workerScope.postMessage({ type: "progress", progress: 0.7, phase: "mapping" });
    const result = data.type === "inspect" ? summarizeSheets(book) : extractInputProducts(book, data.fileIndex, data.fileName, data.selections);
    workerScope.postMessage({ type: "progress", progress: 1, phase: "complete" });
    workerScope.postMessage({ type: "result", result });
  } catch (error) { workerScope.postMessage({ type: "error", code: classifyInputError(error).code }); }
};

export type ExcelCompareSide = "left" | "right";

export interface ExcelCompareInspectionRequest {
  pairId: number;
  side: ExcelCompareSide;
  file: File;
  token: number;
  controller: AbortController;
}

export class ExcelCompareInspectionRequests {
  private nextToken = 0;
  private readonly active = new Map<string, ExcelCompareInspectionRequest>();

  begin(pairId: number, side: ExcelCompareSide, file: File) {
    this.cancel(pairId, side);
    const request = { pairId, side, file, token: ++this.nextToken, controller: new AbortController() };
    this.active.set(requestKey(pairId, side), request);
    return request;
  }

  isCurrent(request: ExcelCompareInspectionRequest) {
    const current = this.active.get(requestKey(request.pairId, request.side));
    return current?.token === request.token && current.file === request.file;
  }

  finish(request: ExcelCompareInspectionRequest) {
    if (!this.isCurrent(request)) return false;
    this.active.delete(requestKey(request.pairId, request.side));
    return true;
  }

  cancel(pairId: number, side: ExcelCompareSide) {
    const key = requestKey(pairId, side);
    this.active.get(key)?.controller.abort();
    this.active.delete(key);
  }

  cancelPair(pairId: number) {
    this.cancel(pairId, "left");
    this.cancel(pairId, "right");
  }

  cancelAll() {
    for (const request of this.active.values()) request.controller.abort();
    this.active.clear();
  }
}

function requestKey(pairId: number, side: ExcelCompareSide) {
  return `${pairId}:${side}`;
}

export function createSharedStringValueLookup(xml: string): (index: number) => boolean;
export function countWorksheetDataRows(
  xml: string,
  sharedStringHasValue?: (index: number) => boolean,
  maximum?: number,
): number;

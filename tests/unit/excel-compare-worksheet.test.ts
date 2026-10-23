import assert from "node:assert/strict";
import test from "node:test";
import { columnAddress, worksheetAxisWindow, worksheetCellIndex, worksheetRecordIndex } from "../../src/features/excel-compare/worksheetProjection.ts";
import type { ExcelCompareRecord } from "../../src/features/excel-compare/types.ts";
import type { SpreadsheetSheetData } from "../../src/features/spreadsheet-core/inputAdapter.ts";

test("worksheet windows keep source D4/D7 addresses after hiding and reversing", () => {
  assert.deepEqual(worksheetAxisWindow(7,1,40,new Set([1,2,3,5,6])),[4,7]);
  assert.deepEqual(worksheetAxisWindow(7,1,40,new Set([1,2,3,5,6]),true),[7,4]);
  assert.equal(columnAddress(worksheetAxisWindow(8,1,12,new Set([1,2,3]))[0]),"D");
  assert.equal(columnAddress(27),"AA");
  assert.equal(worksheetAxisWindow(1_048_576,1,40,new Set()).length,40);
  assert.deepEqual(worksheetAxisWindow(0,1,40,new Set()),[]);
});
test("matrix cell/row highlights use engine source coordinates for mapped and grouped records", () => {
  const records: ExcelCompareRecord[] = [
    { recordId:"run:1",status:"changed",leftRow:4,rightRow:7,leftColumn:4,rightColumn:2,key:"k",displayKey:"k",leftValue:"before",rightValue:"after",change:"FORMULA",reason:"FORMULA" },
    { recordId:"run:2",status:"matched",leftRow:8,rightRow:10,leftColumn:null,rightColumn:null,key:"",displayKey:"",leftValue:"1 + 2",rightValue:"3",change:"RECONCILIATION",reason:"MANY_TO_ONE",sourceRows:{left:[8,9],right:[10]} },
    { recordId:"run:3",status:"duplicate",leftRow:null,rightRow:null,leftColumn:null,rightColumn:null,key:"d",displayKey:"d",leftValue:"",rightValue:"",change:"KEY",reason:"DUPLICATE_KEY",leftRows:[11,12],rightRows:[15],leftValues:["a","b"],rightValues:["c"] },
  ];
  const left=worksheetRecordIndex(records,"left"),right=worksheetRecordIndex(records,"right");
  assert.equal(left.cells.get("4:4")?.[0],records[0]);assert.equal(right.cells.get("7:2")?.[0],records[0]);
  assert.equal(left.rows.get(9)?.[0],records[1]);assert.equal(left.rows.get(12)?.[0],records[2]);assert.equal(right.rows.get(15)?.[0],records[2]);
  assert.equal(left.cells.has("7:2"),false);
});
test("source indexing includes unchanged and header cells without generating comparison decisions", () => {
  const header=Object.freeze({row:1,column:4,address:"D1",value:"Header"});
  const unchanged=Object.freeze({row:7,column:4,address:"D7",value:"unchanged",formula:"1+1",cachedValue:2,style:{numFmt:"0.00"}});
  const sheet=Object.freeze({name:"Source",rowCount:7,columnCount:4,cells:Object.freeze([header,unchanged])}) as unknown as SpreadsheetSheetData;
  const index=worksheetCellIndex(sheet);assert.equal(index.get("1:4"),header);assert.equal(index.get("7:4"),unchanged);
  assert.equal(worksheetRecordIndex([],"left").cells.size,0);assert.equal(unchanged.address,"D7");
});

import assert from "node:assert/strict";
import test from "node:test";
import { clearRecipes, deleteRecipe, EXCEL_CLEANER_RECIPES_KEY as KEY, MAX_RECIPES_BYTES, readRecipes, saveRecipe } from "../../src/features/excel-cleaner/recipeStore.ts";
const empty = { version: 1, rules: [] };
function memory(initial: string | null = null) {
  let value = initial, writes = 0;
  return { getItem: (_key: string) => value, setItem: (_key: string, next: string) => { value = next; writes++; }, removeItem: (_key: string) => { value = null; }, get value() { return value; }, get writes() { return writes; } };
}
test("explicit save persists only name, date and validated rules, then loads and deletes", () => {
  const storage = memory(); assert.deepEqual(readRecipes(storage).recipes, []); assert.equal(storage.writes, 0);
  const pipeline = { version: 1, rules: [{ type: "find-replace", id: "00000000-0000-4000-8000-000000000001", find: "private find", replace: "replacement" }] };
  const saved = saveRecipe("  Cleaning  ", pipeline, storage); assert.equal(saved.status, "ok");
  assert.deepEqual(Object.keys(JSON.parse(storage.value!)[0]).sort(), ["name", "pipeline", "savedAt"]);
  assert.equal(readRecipes(storage).recipes[0].name, "Cleaning");
  assert.equal(deleteRecipe(saved.recipes[0], storage).recipes.length, 0);
  assert.equal(clearRecipes(storage).status, "ok"); assert.equal(storage.value, null);
});
test("names accept 1 to 40 Unicode characters and reject empty or 41", () => {
  const s=memory(); for (const name of ["", "   ", "a".repeat(41), "😀".repeat(41)]) assert.equal(saveRecipe(name, empty, s).status,"name");
  for (const name of ["a", "가".repeat(40), "😀".repeat(40)]) assert.equal(saveRecipe(name, empty, s).status,"ok");
  assert.equal(s.writes,3);
});
test("20 recipes accepted; 21st leaves bytes unchanged", () => {
  const s=memory(); for(let i=0;i<20;i++) assert.equal(saveRecipe(`r${i}`,empty,s).status,"ok");
  const before=s.value; assert.equal(saveRecipe("r21",empty,s).status,"limit"); assert.equal(s.value,before); assert.equal(s.writes,20);
});
test("total UTF-8 limit includes recipe envelope and is atomic", () => {
  const s=memory(); const rule=(i:number)=>({type:"find-replace",id:`00000000-0000-4000-8000-${String(i).padStart(12,"0")}`,find:"가".repeat(1000),replace:"x".repeat(1000)});
  const large={version:1,rules:Array.from({length:40},(_,i)=>rule(i))};
  assert.equal(saveRecipe("one",large,s).status,"ok"); const before=s.value;
  assert.equal(saveRecipe("two",large,s).status,"size"); assert.equal(s.value,before);assert.equal(s.writes,1);
  assert.ok(new TextEncoder().encode(s.value!).byteLength<=MAX_RECIPES_BYTES);
});
test("damaged JSON, metadata, pipeline and oversized storage are ignored without writes", () => {
  for(const raw of ["{", "null", "{}", '[{"name":"x","savedAt":0,"pipeline":{"version":2,"rules":[]}}]',JSON.stringify([{name:"x",savedAt:-1,pipeline:empty}]), JSON.stringify(Array.from({length:21},()=>({name:"x",savedAt:0,pipeline:empty}))), " ".repeat(MAX_RECIPES_BYTES+1)]) {
    const s=memory(raw); assert.equal(readRecipes(s).status,"corrupt"); assert.deepEqual(readRecipes(s).recipes,[]);
    assert.equal(saveRecipe("new",empty,s).status,"corrupt");assert.equal(s.value,raw);assert.equal(s.writes,0);
    assert.equal(clearRecipes(s).status,"ok");assert.equal(s.value,null);
  }
});
test("invalid pipeline and oversized pipeline cannot write or smuggle file data", () => {
 const s=memory(); for(const value of [{version:2,rules:[]},{...empty,files:["contents"]},{...empty,rows:[["file content"]]}," ".repeat(MAX_RECIPES_BYTES+1)]) assert.equal(saveRecipe("test",value,s).status,"invalid");
 assert.equal(s.writes,0);
});
test("quota/security exceptions preserve original bytes and report storage failure", () => {
 const initial=JSON.stringify([{name:"existing",savedAt:0,pipeline:empty}]);
 for(const error of [new DOMException("quota","QuotaExceededError"),new DOMException("blocked","SecurityError")]) {
  const s=memory(initial); s.setItem=()=>{throw error;}; assert.equal(saveRecipe("new",empty,s).status,"storage");assert.equal(s.value,initial);
  assert.equal(deleteRecipe(readRecipes(s).recipes[0],s).status,"storage");assert.equal(s.value,initial);
 }
 const blocked={getItem:()=>{throw new Error("blocked");},setItem:()=>{throw new Error("must not write");},removeItem:()=>{throw new Error("blocked");}};
 assert.equal(readRecipes(blocked).status,"storage"); assert.equal(saveRecipe("x",empty,blocked).status,"storage");assert.equal(clearRecipes(blocked).status,"storage");
 assert.equal(KEY,"worklazy:excel-cleaner-recipes");
});
test("deletion matches selected record after another tab shifts its index", () => {
 const s=memory(); saveRecipe("first",empty,s); const saved=saveRecipe("second",empty,s);deleteRecipe(saved.recipes[0],s);
 assert.equal(deleteRecipe(saved.recipes[1],s).recipes.length,0);
});

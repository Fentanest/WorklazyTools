export function generatePassword(length: number, groups: string[]) {
  if (!groups.length) return "";
  const all = groups.join("");
  const output = groups.map((group) => secureCharacter(group));
  while (output.length < length) output.push(secureCharacter(all));
  for (let index = output.length - 1; index > 0; index -= 1) {
    const other = secureIndex(index + 1);
    [output[index], output[other]] = [output[other], output[index]];
  }
  return output.slice(0, length).join("");
}

function secureCharacter(source: string) { return source[secureIndex(source.length)]; }
function secureIndex(max: number) {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const array = new Uint32Array(1);
  do crypto.getRandomValues(array); while (array[0] >= limit);
  return array[0] % max;
}

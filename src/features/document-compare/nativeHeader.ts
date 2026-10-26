/** Capability hint only. ZIP identity is resolved by the comparison client. */
export async function hasNativeHeader(file: Pick<File,'slice'>) {
  const bytes=new Uint8Array(await file.slice(0,8).arrayBuffer());
  return bytes.length===8 && [0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1].every((value,index)=>bytes[index]===value);
}

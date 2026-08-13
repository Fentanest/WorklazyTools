declare module "officecrypto-tool" {
  interface OfficeCryptoOptions {
    password: string;
    type?: "standard";
  }

  interface OfficeCrypto {
    decrypt(input: Uint8Array | ArrayBuffer, options: OfficeCryptoOptions): Promise<Uint8Array>;
    encrypt(input: Uint8Array | ArrayBuffer, options: OfficeCryptoOptions): Uint8Array;
    isEncrypted(input: Uint8Array | ArrayBuffer): boolean;
  }

  const officeCrypto: OfficeCrypto;
  export default officeCrypto;
}

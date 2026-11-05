import { DecryptCommand, EncryptCommand, KMSClient } from "@aws-sdk/client-kms"
import type { Cipher } from "../auth.ts"

export class KmsCipher implements Cipher {
  constructor(
    private readonly keyId: string,
    private readonly client = new KMSClient({}),
  ) {}
  async seal(value: string, context: string): Promise<string> {
    const result = await this.client.send(
      new EncryptCommand({ KeyId: this.keyId, Plaintext: Buffer.from(value), EncryptionContext: { session: context } }),
    )
    if (!result.CiphertextBlob) throw new Error("Encryption failed")
    return Buffer.from(result.CiphertextBlob).toString("base64")
  }
  async open(value: string, context: string): Promise<string> {
    const result = await this.client.send(
      new DecryptCommand({
        KeyId: this.keyId,
        CiphertextBlob: Buffer.from(value, "base64"),
        EncryptionContext: { session: context },
      }),
    )
    if (!result.Plaintext) throw new Error("Decryption failed")
    return Buffer.from(result.Plaintext).toString("utf8")
  }
}

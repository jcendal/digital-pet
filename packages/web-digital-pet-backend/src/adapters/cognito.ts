import { createHash } from "node:crypto"
import { CognitoIdentityProviderClient, DescribeUserPoolClientCommand } from "@aws-sdk/client-cognito-identity-provider"
import { OnlineError, record } from "@jcendal/digital-pet-online/contracts.ts"
import { createRemoteJWKSet, jwtVerify } from "jose"
import type { IdentityProvider, Tokens } from "../auth.ts"

export class CognitoProvider implements IdentityProvider {
  private readonly keys: ReturnType<typeof createRemoteJWKSet>
  private secret: Promise<string> | undefined
  constructor(
    private readonly config: { issuer: string; domain: string; clientId: string; poolId: string; callback: string },
  ) {
    this.keys = createRemoteJWKSet(new URL(`${config.issuer}/.well-known/jwks.json`))
  }

  authorize(provider: "Google", state: string, nonce: string, verifier: string): string {
    const url = new URL("/oauth2/authorize", this.config.domain)
    url.search = new URLSearchParams({
      response_type: "code",
      client_id: this.config.clientId,
      redirect_uri: this.config.callback,
      scope: "openid email",
      identity_provider: provider,
      state,
      nonce,
      code_challenge_method: "S256",
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    }).toString()
    return url.href
  }

  private clientSecret(): Promise<string> {
    this.secret ??= new CognitoIdentityProviderClient({})
      .send(new DescribeUserPoolClientCommand({ UserPoolId: this.config.poolId, ClientId: this.config.clientId }))
      .then((result) => {
        if (!result.UserPoolClient?.ClientSecret) throw new Error("Missing OAuth client secret")
        return result.UserPoolClient.ClientSecret
      })
      .catch((error: unknown) => {
        this.secret = undefined
        throw error
      })
    return this.secret
  }

  private async request(path: string, fields: Record<string, string>): Promise<Response> {
    return fetch(new URL(path, this.config.domain), {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${this.config.clientId}:${await this.clientSecret()}`).toString("base64")}`,
      },
      body: new URLSearchParams(fields),
      redirect: "error",
    })
  }

  private async tokens(fields: Record<string, string>, nonce?: string): Promise<Tokens> {
    const response = await this.request("/oauth2/token", fields)
    if (!response.ok) throw new OnlineError("provider-login-required", 401)
    const data = record(await response.json())
    if (
      typeof data.id_token !== "string" ||
      typeof data.access_token !== "string" ||
      typeof data.refresh_token !== "string"
    )
      throw new OnlineError("invalid-provider-response", 502)
    const identity = await jwtVerify(data.id_token, this.keys, {
      issuer: this.config.issuer,
      audience: this.config.clientId,
      algorithms: ["RS256"],
    })
    const access = await jwtVerify(data.access_token, this.keys, { issuer: this.config.issuer, algorithms: ["RS256"] })
    if (
      !identity.payload.sub ||
      identity.payload.token_use !== "id" ||
      (nonce !== undefined && identity.payload.nonce !== nonce) ||
      access.payload.token_use !== "access" ||
      access.payload.client_id !== this.config.clientId ||
      access.payload.sub !== identity.payload.sub ||
      !access.payload.exp
    )
      throw new OnlineError("invalid-provider-token", 401)
    return {
      subject: identity.payload.sub,
      refreshToken: data.refresh_token,
      accessExpiresAt: access.payload.exp * 1000,
    }
  }

  exchange(code: string, nonce: string, verifier: string): Promise<Tokens> {
    return this.tokens(
      { grant_type: "authorization_code", code, redirect_uri: this.config.callback, code_verifier: verifier },
      nonce,
    )
  }
  refresh(token: string): Promise<Tokens> {
    return this.tokens({ grant_type: "refresh_token", refresh_token: token })
  }
  async revoke(token: string): Promise<void> {
    const response = await this.request("/oauth2/revoke", { token })
    if (!response.ok) throw new Error("Provider revocation failed")
  }
}

import {
  ApiGatewayManagementApiClient,
  GetConnectionCommand,
  GoneException,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi"
import type { SocketDelivery } from "../realtime.ts"

export class GatewayDelivery implements SocketDelivery {
  private readonly client: ApiGatewayManagementApiClient
  constructor(endpoint: string) {
    this.client = new ApiGatewayManagementApiClient({ endpoint })
  }
  async connected(connectionId: string): Promise<boolean> {
    try {
      await this.client.send(new GetConnectionCommand({ ConnectionId: connectionId }))
      return true
    } catch (error) {
      if (error instanceof GoneException) return false
      throw error
    }
  }
  async send(connectionId: string, value: unknown): Promise<boolean> {
    try {
      await this.client.send(
        new PostToConnectionCommand({ ConnectionId: connectionId, Data: Buffer.from(JSON.stringify(value)) }),
      )
      return true
    } catch (error) {
      if (error instanceof GoneException) return false
      throw error
    }
  }
}

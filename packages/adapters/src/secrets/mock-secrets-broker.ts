import type { SecretsBroker } from "../interfaces.ts";

export class MockSecretsBroker implements SecretsBroker {
  async getVirtualToken(scope: string): Promise<{ token: string; expiresAt: Date }> {
    return {
      token: `mock-token-for-${scope}`,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    };
  }
}

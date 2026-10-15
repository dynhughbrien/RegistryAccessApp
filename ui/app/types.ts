// Mirrors the payload/response types of api/check-registry.function.ts
// (the UI and api projects have separate TypeScript roots).
export interface CheckRegistryPayload {
  tenantId: string;
  credentialId: string;
}

export interface TagResult {
  repo: string;
  tag: string;
  available: boolean;
  status: number;
  digest?: string;
}

export interface CheckRegistryResult {
  registry: string;
  authOk: boolean;
  authStatus: number;
  results: TagResult[];
}

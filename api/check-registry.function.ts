import { credentialVaultClient } from '@dynatrace-sdk/client-classic-environment-v2';

const CODEMODULE_TAGS = ['all', 'java', 'nodejs', 'go', 'apache', 'nginx', 'php', 'dotnet'];

const TARGETS: { repo: string; tags: string[] }[] = [
  { repo: 'linux/oneagent', tags: ['latest'] },
  { repo: 'linux/oneagent-codemodules', tags: CODEMODULE_TAGS },
  { repo: 'linux/oneagent-codemodules-musl', tags: CODEMODULE_TAGS },
  { repo: 'linux/activegate', tags: ['latest'] },
];

const MANIFEST_ACCEPT = [
  'application/vnd.docker.distribution.manifest.v2+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.oci.image.index.v1+json',
].join(', ');

const TENANT_ID_PATTERN = /^[a-z0-9-]{3,64}$/i;

export interface CheckRegistryPayload {
  tenantId: string;
  /** ID of a Credential Vault token credential (CREDENTIALS_VAULT-...) holding the PaaS token. */
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

const CREDENTIAL_ID_PATTERN = /^CREDENTIALS_VAULT-[A-Za-z0-9]+$/;

/**
 * Probes the tenant registry (<tenantId>.live.dynatrace.com) with a PaaS token read from the
 * Credential Vault. The token is only used to build the Authorization header and is never
 * returned or logged.
 */
export default async function (payload: CheckRegistryPayload): Promise<CheckRegistryResult> {
  const tenantId = payload?.tenantId?.trim();
  const credentialId = payload?.credentialId?.trim();
  if (!tenantId || !TENANT_ID_PATTERN.test(tenantId)) {
    throw new Error('A valid tenant ID is required.');
  }
  if (!credentialId || !CREDENTIAL_ID_PATTERN.test(credentialId)) {
    throw new Error('A valid Credential Vault ID (CREDENTIALS_VAULT-...) is required.');
  }

  const credential = await credentialVaultClient.getCredentialsDetails({ id: credentialId });
  const token = 'token' in credential && typeof credential.token === 'string' ? credential.token : '';
  if (!token) {
    throw new Error('The credential does not contain a token. Use a Token-type credential.');
  }

  const registry = `${tenantId}.live.dynatrace.com`;
  const headers = { Authorization: `Basic ${btoa(`${tenantId}:${token}`)}` };

  const authResponse = await fetch(`https://${registry}/v2/`, { headers });
  if (authResponse.status !== 200) {
    return { registry, authOk: false, authStatus: authResponse.status, results: [] };
  }

  const probes = TARGETS.flatMap(({ repo, tags }) => tags.map((tag) => ({ repo, tag })));
  const results = await Promise.all(
    probes.map(async ({ repo, tag }): Promise<TagResult> => {
      const response = await fetch(`https://${registry}/v2/${repo}/manifests/${tag}`, {
        method: 'HEAD',
        headers: { ...headers, Accept: MANIFEST_ACCEPT },
      });
      const digest = response.headers.get('docker-content-digest') ?? undefined;
      return { repo, tag, available: response.status === 200, status: response.status, digest };
    }),
  );

  return { registry, authOk: true, authStatus: authResponse.status, results };
}

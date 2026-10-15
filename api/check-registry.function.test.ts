const fetchMock = jest.fn();
globalThis.fetch = fetchMock;

const getCredentialsDetails = jest.fn();
jest.mock('@dynatrace-sdk/client-classic-environment-v2', () => ({
  credentialVaultClient: { getCredentialsDetails: (...args: unknown[]) => getCredentialsDetails(...args) },
}));

import checkRegistry from './check-registry.function';

describe('check-registry.function', () => {
  const credentialId = 'CREDENTIALS_VAULT-ABC123';

  beforeEach(() => {
    fetchMock.mockReset();
    getCredentialsDetails.mockReset().mockResolvedValue({ token: 'secret' });
  });

  it('rejects an invalid tenant id without calling the registry', async () => {
    await expect(checkRegistry({ tenantId: 'bad/host', credentialId })).rejects.toThrow('tenant ID');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a malformed credential id', async () => {
    await expect(checkRegistry({ tenantId: 'abc12345', credentialId: 'nope' })).rejects.toThrow('Credential Vault ID');
    expect(getCredentialsDetails).not.toHaveBeenCalled();
  });

  it('sends the vault token as basic auth', async () => {
    fetchMock.mockResolvedValueOnce({ status: 401, headers: new Headers() });
    await checkRegistry({ tenantId: 'abc12345', credentialId });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Basic ${btoa('abc12345:secret')}`);
  });

  it('reports auth failure and skips probing', async () => {
    fetchMock.mockResolvedValueOnce({ status: 401, headers: new Headers() });
    const result = await checkRegistry({ tenantId: 'abc12345', credentialId });
    expect(result).toMatchObject({ authOk: false, authStatus: 401, results: [] });
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('returns digests for available tags', async () => {
    fetchMock.mockImplementation(async (url: string) => ({
      status: url.endsWith('/v2/') || url.includes('oneagent/manifests') ? 200 : 404,
      headers: new Headers({ 'docker-content-digest': 'sha256:abc' }),
    }));
    const result = await checkRegistry({ tenantId: 'abc12345', credentialId });
    expect(result.authOk).toBe(true);
    expect(result.results).toHaveLength(18);
    expect(result.results.find((r) => r.repo === 'linux/oneagent')).toMatchObject({
      available: true,
      digest: 'sha256:abc',
    });
  });
});

import React, { useState } from "react";
import { getEnvironmentUrl } from "@dynatrace-sdk/app-environment";
import { useAppFunction } from "@dynatrace-sdk/react-hooks";
import { Button } from "@dynatrace/strato-components/buttons";
import { CodeSnippet, MessageContainer } from "@dynatrace/strato-components/content";
import { FormField, Label, TextInput } from "@dynatrace/strato-components/forms";
import { Flex } from "@dynatrace/strato-components/layouts";
import { DataTable, type DataTableColumnDef } from "@dynatrace/strato-components/tables";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import type { CheckRegistryPayload, CheckRegistryResult, TagResult } from "../types";

const defaultTenantId = (): string => {
  try {
    return new URL(getEnvironmentUrl()).hostname.split(".")[0];
  } catch {
    return "";
  }
};

const columns: DataTableColumnDef<TagResult>[] = [
  { id: "repo", header: "Repository", accessor: "repo" },
  { id: "tag", header: "Tag", accessor: "tag" },
  {
    id: "status",
    header: "Status",
    accessor: (row: TagResult) =>
      row.available ? "Available" : `Not available (${row.status})`,
  },
  { id: "digest", header: "Digest", accessor: (row: TagResult) => row.digest ?? "" },
];

// Credential Vault ID (an identifier, not the secret) of the PaaS token credential.
const DEFAULT_CREDENTIAL_ID = "CREDENTIALS_VAULT-3CFD8A68DC89BB83";

const emptyPayload: CheckRegistryPayload = { tenantId: "", credentialId: "" };

export const RegistryCheck = () => {
  const [tenantId, setTenantId] = useState(defaultTenantId);
  const [credentialId, setCredentialId] = useState(DEFAULT_CREDENTIAL_ID);
  const [payload, setPayload] = useState<CheckRegistryPayload>(emptyPayload);

  const { data, error, isLoading, refetch } = useAppFunction<CheckRegistryResult>(
    { name: "check-registry", data: payload },
    { autoFetch: false, autoFetchOnUpdate: true },
  );

  const canRun = tenantId.trim() !== "" && credentialId.trim() !== "" && !isLoading;

  const run = () => {
    const next = { tenantId: tenantId.trim(), credentialId: credentialId.trim() };
    if (next.tenantId === payload.tenantId && next.credentialId === payload.credentialId) {
      void refetch();
    } else {
      setPayload(next);
    }
  };

  const firstAvailable = data?.results.find((r) => r.available);

  return (
    <Flex flexDirection="column" padding={32} gap={16}>
      <Heading level={1}>Tenant Registry</Heading>
      <Paragraph>
        Check that your tenant registry credentials work and which Dynatrace images and tags
        are available. The PaaS token is stored in the Credential Vault (Token type, AppEngine scope)
        and read by the app backend. It never reaches the browser.
      </Paragraph>

      <Flex flexDirection="column" gap={12} style={{ maxWidth: 560 }}>
        <FormField>
          <Label>Tenant ID</Label>
          <TextInput value={tenantId} onChange={setTenantId} placeholder="abc12345" />
        </FormField>
        <FormField>
          <Label>Credential Vault ID of the PaaS token</Label>
          <TextInput
            value={credentialId}
            onChange={setCredentialId}
            placeholder="CREDENTIALS_VAULT-…"
          />
        </FormField>
        <Flex>
          <Button variant="accent" onClick={run} disabled={!canRun}>
            {isLoading ? "Checking…" : "Check registry"}
          </Button>
        </Flex>
      </Flex>

      {error && (
        <MessageContainer variant="critical">
          <MessageContainer.Title>Registry check failed</MessageContainer.Title>
          <MessageContainer.Description>
            {error.message}. If this is a network error, add{" "}
            {tenantId || "<tenant>"}.live.dynatrace.com under Settings → Limit outbound
            connections.
          </MessageContainer.Description>
        </MessageContainer>
      )}

      {data && !data.authOk && (
        <MessageContainer variant="critical">
          <MessageContainer.Title>Authentication failed ({data.authStatus})</MessageContainer.Title>
          <MessageContainer.Description>
            The token is invalid, expired or missing the PaaS (Installer download) scope.
          </MessageContainer.Description>
        </MessageContainer>
      )}

      {data?.authOk && (
        <>
          <MessageContainer variant="success">
            <MessageContainer.Title>Authenticated to {data.registry}</MessageContainer.Title>
          </MessageContainer>
          <DataTable data={data.results} columns={columns} sortable>
            <DataTable.Pagination defaultPageSize={20} />
          </DataTable>
          {firstAvailable && (
            <CodeSnippet language="bash">
              {`docker pull ${data.registry}/${firstAvailable.repo}:${firstAvailable.tag}`}
            </CodeSnippet>
          )}
        </>
      )}
    </Flex>
  );
};

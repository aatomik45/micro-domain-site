import { getAPIBaseURL } from "./config";

export interface DomainRecord {
  id: number;
  domain_key: string;
  domain_name: string | null;
  state_json: string;
  updated_at: string | null;
}

interface DomainListResponse {
  items: DomainRecord[];
  total: number;
  skip: number;
  limit: number;
}

function getDomainsBaseUrl(): string {
  return `${getAPIBaseURL()}/api/v1/entities/domains`;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function saveDomain(
  domainKey: string,
  domainName: string,
  stateJson: string,
  existingId?: number
): Promise<DomainRecord> {
  const payload = {
    domain_key: domainKey,
    domain_name: domainName || "Untitled Domain",
    state_json: stateJson,
    updated_at: new Date().toISOString(),
  };

  if (existingId) {
    return requestJson<DomainRecord>(`${getDomainsBaseUrl()}/${existingId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  return requestJson<DomainRecord>(getDomainsBaseUrl(), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loadDomainByKey(domainKey: string): Promise<DomainRecord | null> {
  try {
    const query = encodeURIComponent(JSON.stringify({ domain_key: domainKey }));
    const response = await requestJson<DomainListResponse>(
      `${getDomainsBaseUrl()}?query=${query}&limit=1`
    );

    return response.items?.[0] ?? null;
  } catch (error) {
    console.warn("[loadDomainByKey] Failed to load domain:", error);
    return null;
  }
}

// lib/bridge.ts
/**
 * Wrapper client pour Bridge API v3 (agrégateur bancaire DSP2).
 * Docs : https://docs.bridgeapi.io
 */

const BRIDGE_BASE = "https://api.bridgeapi.io";

function baseHeaders() {
  if (!process.env.BRIDGE_CLIENT_ID || !process.env.BRIDGE_CLIENT_SECRET) {
    throw new Error("BRIDGE_CLIENT_ID / BRIDGE_CLIENT_SECRET not set");
  }
  return {
    "Client-Id": process.env.BRIDGE_CLIENT_ID,
    "Client-Secret": process.env.BRIDGE_CLIENT_SECRET,
    "Bridge-Version": process.env.BRIDGE_API_VERSION ?? "2025-01-15",
    "Content-Type": "application/json",
  };
}

function authHeaders(accessToken: string) {
  return { ...baseHeaders(), Authorization: `Bearer ${accessToken}` };
}

// ========== USERS ==========
export type BridgeUser = { uuid: string; external_user_id?: string };

export async function createBridgeUser(externalUserId: string): Promise<BridgeUser> {
  const res = await fetch(`${BRIDGE_BASE}/v3/aggregation/users`, {
    method: "POST",
    headers: baseHeaders(),
    body: JSON.stringify({ external_user_id: externalUserId }),
  });
  if (!res.ok) throw new Error(`createBridgeUser failed: ${res.status} ${await res.text()}`);
  return await res.json();
}

export async function authenticateUser(userUuid: string): Promise<{ access_token: string; expires_at: string }> {
  const res = await fetch(`${BRIDGE_BASE}/v3/aggregation/authorization/token`, {
    method: "POST",
    headers: baseHeaders(),
    body: JSON.stringify({ user_uuid: userUuid }),
  });
  if (!res.ok) throw new Error(`authenticateUser failed: ${res.status} ${await res.text()}`);
  return await res.json();
}

// ========== CONNECT SESSION ==========
export async function createConnectSession(params: {
  accessToken: string;
  userEmail: string;
}): Promise<{ url: string; id: string }> {
  const res = await fetch(`${BRIDGE_BASE}/v3/aggregation/connect-sessions`, {
    method: "POST",
    headers: authHeaders(params.accessToken),
    body: JSON.stringify({
      user_email: params.userEmail,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error("[Bridge] createConnectSession error body:", errText);
    throw new Error(`createConnectSession failed: ${res.status} ${errText}`);
  }
  return await res.json();
}

// ========== ACCOUNTS ==========
export type BridgeAccount = {
  id: number;
  name: string;
  balance: number;
  currency_code: string;
  iban?: string;
  item_id: number;
  bank?: { id: number; name: string; logo_url?: string };
};

export async function listAccounts(accessToken: string): Promise<BridgeAccount[]> {
  const res = await fetch(`${BRIDGE_BASE}/v3/aggregation/accounts`, { headers: authHeaders(accessToken) });
  if (!res.ok) throw new Error(`listAccounts failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.resources ?? [];
}

// ========== ITEMS (bank connections) ==========
export async function listItems(accessToken: string) {
  const res = await fetch(`${BRIDGE_BASE}/v3/aggregation/items`, { headers: authHeaders(accessToken) });
  if (!res.ok) throw new Error(`listItems failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return (data.resources ?? []) as Array<{ id: number; status: string; bank?: { id: number; name: string; logo_url?: string } }>;
}

// ========== TRANSACTIONS ==========
export type BridgeTransaction = {
  id: number;
  account_id: number;
  description: string;
  raw_description: string;
  amount: number;
  currency_code: string;
  date: string;
  value_date?: string;
  is_deleted: boolean;
  counterparty?: { name?: string; iban?: string };
};

export async function listTransactions(params: { accessToken: string; accountId?: number; since?: string; limit?: number }): Promise<BridgeTransaction[]> {
  const query = new URLSearchParams();
  if (params.accountId) query.set("account_id", String(params.accountId));
  if (params.since) query.set("since", params.since);
  query.set("limit", String(params.limit ?? 500));

  const res = await fetch(`${BRIDGE_BASE}/v3/aggregation/transactions?${query.toString()}`, { headers: authHeaders(params.accessToken) });
  if (!res.ok) throw new Error(`listTransactions failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.resources ?? [];
}

import { authSession } from "../auth/session";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

export class InventoryApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "InventoryApiError";
  }
}

export interface Ingredient {
  id: string;
  code: string;
  name: string;
  unit: "G" | "ML" | "PCS";
  stockQuantity: number;
  version: number;
  isActive: boolean;
  status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  updatedAt: string;
}

// Một nguyên liệu trong phiếu nhập kho.
export interface InventoryReceiptItem {
  ingredientId: string;
  code: string;
  name: string;
  unit: "G" | "ML" | "PCS";
  quantityAdded: number;
  stockBefore: number;
  stockAfter: number;
}

// Một phiếu nhập kho có thể chứa nhiều nguyên liệu.
export interface InventoryReceipt {
  receiptId: string;
  receivedByUserId: string;
  note: string | null;
  createdAt: string;
  items: InventoryReceiptItem[];
}

// Dữ liệu gửi lên khi tạo phiếu nhập kho.
export interface ReceiveInventoryStockPayload {
  items: Array<{
    ingredientId: string;
    quantity: number;
  }>;
  note?: string;
}

function handleUnauthorized(token: string, status: number) {
  if (status === 401) {
    authSession.invalidate(token);
  }
}

/**
 * Lấy danh sách nguyên liệu trong kho.
 */
export async function getInventoryApi(
  token: string,
  options: { q?: string; status?: string; cursor?: string } = {},
) {
  const query = new URLSearchParams(
    Object.entries(options).filter(([, value]) => !!value) as [
      string,
      string,
    ][],
  );

  const response = await fetch(`${API_BASE_URL}/staff/inventory?${query}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });

  handleUnauthorized(token, response.status);

  const json = await response.json().catch(() => null);

  if (
    !response.ok ||
    !Array.isArray(json?.data) ||
    !json?.meta ||
    (json.meta.nextCursor !== null &&
      typeof json.meta.nextCursor !== "string")
  ) {
    throw new InventoryApiError(
      json?.error?.message ?? "Không thể tải danh sách nguyên liệu.",
      response.status,
      json?.error?.code,
    );
  }

  return json as {
    data: Ingredient[];
    meta: { nextCursor: string | null };
  };
}

/**
 * Tạo phiếu nhập kho gồm nhiều nguyên liệu.
 */
export async function receiveInventoryStockApi(
  token: string,
  payload: ReceiveInventoryStockPayload,
): Promise<InventoryReceipt> {
  const response = await fetch(
    `${API_BASE_URL}/staff/inventory/receipts`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  handleUnauthorized(token, response.status);

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    throw new InventoryApiError(
      json?.error?.message ??
        json?.message ??
        "Không thể nhập nguyên liệu vào kho.",
      response.status,
      json?.error?.code,
    );
  }

  if (!json?.data || !Array.isArray(json.data.items)) {
    throw new InventoryApiError(
      "Phản hồi nhập kho từ máy chủ không hợp lệ.",
      response.status,
    );
  }

  return json.data as InventoryReceipt;
}

/**
 * Lấy lịch sử các phiếu nhập kho.
 */
export async function getInventoryReceiptsApi(
  token: string,
): Promise<InventoryReceipt[]> {
  const response = await fetch(
    `${API_BASE_URL}/staff/inventory/receipts`,
    {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  handleUnauthorized(token, response.status);

  const json = await response.json().catch(() => null);

  if (!response.ok || !Array.isArray(json?.data)) {
    throw new InventoryApiError(
      json?.error?.message ??
        json?.message ??
        "Không thể tải lịch sử nhập kho.",
      response.status,
      json?.error?.code,
    );
  }

  return json.data as InventoryReceipt[];
}

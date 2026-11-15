
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

export interface InventoryReceipt {
  receiptId: string;
  ingredientId: string;
  receivedByUserId: string;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  createdAt: string;
}

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

  if (response.status === 401) authSession.invalidate(token);

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
 * Ghi nhận nhập thêm nguyên liệu vào kho.
 * Backend đồng thời cập nhật tồn kho và lưu lịch sử nhập.
 */
export async function receiveInventoryStockApi(
  token: string,
  ingredientId: string,
  quantity: number,
): Promise<InventoryReceipt> {
  const response = await fetch(
    `${API_BASE_URL}/staff/inventory/${encodeURIComponent(ingredientId)}/receipts`,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ quantity }),
    },
  );

  if (response.status === 401) authSession.invalidate(token);

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

  if (!json || !json.data) {
    throw new InventoryApiError(
      "Phản hồi nhập kho từ máy chủ không hợp lệ.",
      response.status,
    );
  }

  return json.data as InventoryReceipt;
}

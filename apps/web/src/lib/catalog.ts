export interface Product {
  id: string;
  name: string;
  description: string;
  basePrice: number;
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

function isProduct(value: unknown): value is Product {
  if (value === null || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return typeof p.id === 'string' && typeof p.name === 'string' &&
    typeof p.description === 'string' && typeof p.basePrice === 'number' &&
    Number.isFinite(p.basePrice) && p.basePrice >= 0;
}

export async function fetchProducts(baseUrl: string, signal?: AbortSignal): Promise<Product[]> {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/products`, { signal });
  if (!response.ok) throw new Error('Không tải được menu. Vui lòng thử lại.');
  const payload: unknown = await response.json();
  if (payload === null || typeof payload !== 'object') throw new Error('Dữ liệu menu không hợp lệ.');
  const result = payload as Record<string, unknown>;
  if (result.success !== true || !Array.isArray(result.data) || !result.data.every(isProduct)) {
    throw new Error('Dữ liệu menu không hợp lệ.');
  }
  return result.data;
}

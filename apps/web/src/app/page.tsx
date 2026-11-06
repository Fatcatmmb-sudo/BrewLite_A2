'use client';

import { useEffect, useState } from 'react';
import { fetchProducts, formatPrice, type Product } from '@/lib/catalog';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api/v1';

export default function MenuPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchProducts(apiBaseUrl, controller.signal)
      .then(setProducts)
      .catch(() => {
        if (!controller.signal.aborted) setError('Không tải được menu. Vui lòng thử lại.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt]);

  function retry() {
    setError('');
    setLoading(true);
    setAttempt(value => value + 1);
  }

  return <main>
    <header><p className="brand">BREWLITE</p><h1>Menu đồ uống</h1><p>Chọn món yêu thích của bạn.</p></header>
    {loading ? <p role="status">Đang tải menu…</p> : error ?
      <div role="alert"><p>{error}</p><button onClick={retry}>Thử lại</button></div> :
      products.length === 0 ? <p>Chưa có đồ uống đang bán.</p> :
      <ul className="menu">{products.map(product => <li key={product.id}>
        <h2>{product.name}</h2><p>{product.description}</p><strong>{formatPrice(product.basePrice)}</strong>
      </li>)}</ul>}
  </main>;
}

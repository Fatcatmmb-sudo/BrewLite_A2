import type { OrderDetail } from '../types';
import { OrderStatusBadge } from './OrderStatusBadge';

const formatVnd = (amount: number) => `${amount.toLocaleString('vi-VN')} đ`;

const formatPreference = (level: number | null) => level === null ? 'Công thức chuẩn' : `${level}%`;

export function OrderDetailView({
  order,
  onRetryPayment,
  isPaying = false,
  onRequestRefund,
}: {
  order: OrderDetail;
  onRetryPayment?: () => void;
  isPaying?: boolean;
  onRequestRefund?: () => void;
}) {
  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-[#E8DFC8] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#B85D36]">Mã đơn BrewLite</p>
            <h1 className="mt-1 font-serif text-3xl font-black text-[#163D2C]">{order.orderNumber}</h1>
            <p className="mt-2 text-sm text-[#756A63]">
              {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(order.createdAt))}
            </p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
      </div>

      <div className="rounded-2xl border border-[#E8DFC8] bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-serif text-xl font-black text-[#163D2C]">Món trong đơn</h2>
        <div className="mt-4 divide-y divide-[#EEE6DB]">
          {order.items.map((item) => (
            <article key={item.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex justify-between gap-4">
                <div>
                  <h3 className="font-bold text-[#1A1612]">{item.productName}</h3>
                  <p className="mt-1 text-sm text-[#756A63]">Size {item.size} · {item.quantity} món</p>
                  <p className="mt-1 text-xs text-[#756A63]">Đường: {formatPreference(item.sugarLevel)} · Đá: {formatPreference(item.iceLevel)}</p>
                  {item.toppings.length > 0 && <p className="mt-1 text-xs text-[#756A63]">Topping: {item.toppings.map((topping) => topping.name).join(', ')}</p>}
                  {item.note && <p className="mt-1 text-xs italic text-[#756A63]">Ghi chú: {item.note}</p>}
                </div>
                <strong className="shrink-0 font-mono text-sm text-[#163D2C]">{formatVnd(item.lineTotal)}</strong>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[#E8DFC8] bg-white p-5 shadow-sm sm:p-6">
        <div className="space-y-2 text-sm text-[#756A63]">
          <div className="flex justify-between"><span>Tạm tính</span><span>{formatVnd(order.subtotal)}</span></div>
          <div className="flex justify-between"><span>Khuyến mãi</span><span>-{formatVnd(order.discountAmount)}</span></div>
          <div className="flex justify-between border-t border-[#EEE6DB] pt-3 text-base font-black text-[#163D2C]"><span>Tổng tiền</span><span>{formatVnd(order.total)}</span></div>
          {order.status === 'PENDING' && onRetryPayment && (
            <button
              type="button"
              onClick={onRetryPayment}
              disabled={isPaying}
              aria-busy={isPaying}
              className="mt-4 w-full rounded-full bg-rose-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-rose-700 active:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPaying ? 'Đang khởi tạo thanh toán...' : 'Thanh toán lại →'}
            </button>
          )}

          {order.status === 'PAID' && !order.refundRequest && onRequestRefund && (
            <div className="pt-3">
              <button
                type="button"
                onClick={onRequestRefund}
                className="w-full rounded-full border border-[#C99C54] bg-[#FBF5EA] px-5 py-3 text-sm font-bold text-[#856334] shadow-sm transition hover:bg-[#F5EAD5] active:bg-[#EBDABF]"
              >
                💰 Yêu cầu hoàn tiền
              </button>
            </div>
          )}

          {order.status === 'PAID' && order.refundRequest?.status === 'PENDING' && (
            <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
              <span className="text-base">⏳</span>
              <div>
                <p className="font-bold">Đang chờ Barista duyệt hoàn tiền</p>
                <p className="mt-0.5 text-[11px] text-amber-700">Lý do: &ldquo;{order.refundRequest.reason}&rdquo;</p>
              </div>
            </div>
          )}

          {order.status === 'PAID' && order.refundRequest?.status === 'APPROVED' && (
            <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-green-200 bg-green-50 p-3.5 text-xs text-green-900">
              <span className="text-base">✅</span>
              <div>
                <p className="font-bold">Đã hoàn tiền vào điểm tích lũy</p>
                <p className="mt-0.5 text-[11px] text-green-700">Cộng {order.total.toLocaleString('vi-VN')} điểm thành công.</p>
              </div>
            </div>
          )}

          {order.status === 'PAID' && order.refundRequest?.status === 'REJECTED' && (
            <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900">
              <span className="text-base">❌</span>
              <div>
                <p className="font-bold">Yêu cầu hoàn tiền bị từ chối</p>
                {order.refundRequest.rejectReason && (
                  <p className="mt-0.5 text-[11px] text-rose-700">Lý do: &ldquo;{order.refundRequest.rejectReason}&rdquo;</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

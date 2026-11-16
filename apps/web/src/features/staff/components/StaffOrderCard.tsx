import { useState } from "react";
import { StaffIcon } from "./StaffIcon";
import { OrderStatusBadge } from "../../orders/components/OrderStatusBadge";
import type { StaffColumn, StaffOrder } from "../types";

const formatVnd = (amount: number) => `${amount.toLocaleString("vi-VN")} đ`;
const formatLevel = (level: number | null) =>
  level === null ? "chuẩn" : `${level}%`;
const formatTime = (iso: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    timeStyle: "short",
    dateStyle: "short",
  }).format(new Date(iso));

interface StaffOrderCardProps {
  order: StaffOrder;
  column: StaffColumn;
  busy: boolean;
  disabled: boolean;
  onAdvance: (order: StaffOrder, column: StaffColumn) => void;
  onApproveRefund?: (order: StaffOrder) => void;
  onRejectRefund?: (order: StaffOrder, reason: string) => void;
  refundBusy?: boolean;
}

export function StaffOrderCard({
  order,
  column,
  busy,
  disabled,
  onAdvance,
  onApproveRefund,
  onRejectRefund,
  refundBusy = false,
}: StaffOrderCardProps) {
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Chỉ hiển thị khu vực hoàn tiền ở cột PAID & khi có refundRequest PENDING
  const hasPendingRefund =
    order.status === "PAID" && order.refundRequest?.status === "PENDING";

  return (
    <article
      style={{
        borderTopColor:
          order.status === "PAID"
            ? "#C99C54"
            : order.status === "PREPARING"
              ? "#83966D"
              : "#5A9787",
      }}
      aria-label={`Đơn ${order.orderNumber}`}
      className="overflow-hidden rounded-xl border border-[#DEE3D8] border-t-[3px] bg-white p-5 shadow-[0_2px_6px_#163D2C05]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="break-all font-mono text-sm font-bold text-[#163D2C]"
            title={order.orderNumber}
          >
            {order.orderNumber}
          </p>
          <p className="mt-1 text-xs text-[#756A63]">
            Vào quầy lúc {formatTime(order.updatedAt)}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <ul className="mt-3 space-y-2 border-t border-[#EEE6DB] pt-3">
        {order.items.map((item) => (
          <li key={item.id} className="text-sm">
            <p className="font-bold text-[#1A1612]">
              {item.quantity} × {item.productName}{" "}
              <span className="font-medium text-[#756A63]">
                (size {item.size})
              </span>
            </p>
            <p className="mt-0.5 text-xs text-[#756A63]">
              Đường {formatLevel(item.sugarLevel)} · Đá{" "}
              {formatLevel(item.iceLevel)}
            </p>
            {item.toppings.length > 0 && (
              <p className="mt-0.5 text-xs text-[#756A63]">
                Topping:{" "}
                {item.toppings.map((topping) => topping.name).join(", ")}
              </p>
            )}
            {item.note && (
              <p className="mt-2 rounded-lg border-l-2 border-[#C69B61] bg-[#FBF5EA] px-3 py-2 text-xs text-[#856334]">
                Ghi chú: {item.note}
              </p>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#EEE6DB] pt-3">
        <strong className="font-mono text-sm text-[#163D2C]">
          {formatVnd(order.total)}
        </strong>
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => onAdvance(order, column)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#163D2C] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#0F2E21] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#163D2C] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Đang cập nhật…" : column.actionLabel}
          <StaffIcon
            name={column.nextStatus === "COMPLETED" ? "check" : "arrow"}
            width="15"
            height="15"
          />
        </button>
      </div>

      {/* ===== KHU VỰC DUYỆT HOÀN TIỀN – CHỈ HIỆN Ở CỘT PAID KHI CÓ PENDING REFUND ===== */}
      {hasPendingRefund && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-2">
            <span className="text-base">💰</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-amber-900">
                Yêu cầu hoàn tiền từ khách
              </p>
              {order.refundRequest?.reason && (
                <p className="mt-1 text-xs text-amber-700 italic">
                  &ldquo;{order.refundRequest.reason}&rdquo;
                </p>
              )}
            </div>
          </div>

          {!showRejectInput ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={disabled || refundBusy}
                onClick={() => onApproveRefund?.(order)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {refundBusy ? "Đang xử lý…" : "✓ Duyệt hoàn tiền"}
              </button>
              <button
                type="button"
                disabled={disabled || refundBusy}
                onClick={() => setShowRejectInput(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                ✗ Từ chối
              </button>
            </div>
          ) : (
            <div className="mt-3">
              <label
                htmlFor={`reject-reason-${order.id}`}
                className="text-xs font-bold text-rose-800"
              >
                Lý do từ chối <span className="text-rose-500">*</span>
              </label>
              <textarea
                id={`reject-reason-${order.id}`}
                rows={2}
                maxLength={300}
                placeholder="Nhập lý do từ chối..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                disabled={refundBusy}
                className="mt-1 w-full resize-none rounded-lg border border-rose-200 bg-white p-2 text-xs outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 disabled:opacity-60"
                autoFocus
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={disabled || refundBusy || rejectReason.trim().length < 5}
                  onClick={() => {
                    onRejectRefund?.(order, rejectReason.trim());
                    setShowRejectInput(false);
                    setRejectReason("");
                  }}
                  className="rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {refundBusy ? "Đang xử lý…" : "Xác nhận từ chối"}
                </button>
                <button
                  type="button"
                  disabled={refundBusy}
                  onClick={() => {
                    setShowRejectInput(false);
                    setRejectReason("");
                  }}
                  className="rounded-lg border border-[#DDE2D7] px-3 py-2 text-xs font-semibold text-[#163D2C]"
                >
                  Hủy
                </button>
              </div>
              <p className="mt-1 text-[10px] text-rose-600">
                Tối thiểu 5 ký tự.
              </p>
            </div>
          )}
        </div>
      )}
    </article>
  );
}


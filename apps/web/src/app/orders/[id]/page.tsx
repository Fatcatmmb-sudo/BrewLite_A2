"use client";

import { useAuthSession } from "@/features/auth/use-auth-session";
import {
    getCheckoutOrderItems,
    readPendingCheckout,
    writeCheckoutCoupon,
    writePendingCheckout,
} from "@/features/checkout/session";
import { useOrderPaymentRetry } from "@/features/checkout/use-order-payment-retry";
import {
    cancelOrderApi,
    getOrderDetailApi,
    OrdersApiError,
    requestRefundApi,
} from "@/features/orders/api";
import { OrderDetailView } from "@/features/orders/components/OrderDetailView";
import { PaymentApiError } from "@/features/payments/api";
import { cartStore } from "@/stores/cart-store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const { status, token } = useAuthSession();
  const query = useQuery({
    queryKey: ["order-detail", token, params.id],
    enabled: status === "authenticated" && !!token && !!params.id,
    queryFn: () => getOrderDetailApi(token!, params.id!),
    retry: false,
  });
  const client = useQueryClient();
  const retryOrderPayment = useOrderPaymentRetry();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [now, setNow] = useState(Date.now);

  // --- Trạng thái UI hoàn tiền ---
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const refundReasonRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Tự động focus ô nhập lý do khi mở modal
  useEffect(() => {
    if (showRefundModal) {
      setTimeout(() => refundReasonRef.current?.focus(), 50);
    }
  }, [showRefundModal]);

  const order = status === "authenticated" ? query.data : undefined;

  const expiresAtMs = order?.reservationExpiresAt
    ? new Date(order.reservationExpiresAt).getTime()
    : null;
  const remainingMs = expiresAtMs !== null ? Math.max(0, expiresAtMs - now) : null;
  const isExpired = expiresAtMs !== null && remainingMs === 0;

  // Tự động kiểm tra trạng thái từ máy chủ khi thời gian giữ chỗ kết thúc
  useEffect(() => {
    if (isExpired && order && ["PENDING", "PAYMENT_FAILED"].includes(order.status)) {
      const interval = setInterval(() => {
        void query.refetch();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isExpired, order?.status, query]);

  const cancel = useMutation({
    mutationFn: () => cancelOrderApi(token!, params.id),
    onSuccess: async (cancelledOrder) => {
      setConfirmCancel(false);
      const storage = window.sessionStorage;
      const checkout = readPendingCheckout(storage);
      if (checkout?.orderId === cancelledOrder.id) {
        if (!checkout.cartItemsRemoved && cartStore.removeOrderItems(getCheckoutOrderItems(checkout))) {
          writeCheckoutCoupon(storage, null);
        }
        writePendingCheckout(storage, null);
      }
      await client.invalidateQueries({
        queryKey: ["order-detail", token, params.id],
      });
      await client.invalidateQueries({ queryKey: ["orders-history"] });
    },
    onError: () => {
      void query.refetch();
    },
  });

  // Gửi yêu cầu hoàn tiền (Customer)
  const refundMutation = useMutation({
    mutationFn: () => requestRefundApi(token!, params.id, refundReason.trim()),
    onSuccess: async () => {
      setShowRefundModal(false);
      setRefundReason("");
      await client.invalidateQueries({
        queryKey: ["order-detail", token, params.id],
      });
    },
  });

  const handleRetryPayment = async () => {
    if (!token || !order || isPaying || isExpired) return;
    setIsPaying(true);
    setPaymentError(null);
    try {
      await retryOrderPayment(token, order.id);
    } catch (err: unknown) {
      if (err instanceof PaymentApiError && err.code === "ORDER_EXPIRED") {
        setPaymentError("Đơn hàng đã hết hạn giữ chỗ và không thể thanh toán.");
        void query.refetch();
      } else {
        setPaymentError(
          err instanceof Error
            ? err.message
            : "Có lỗi xảy ra khi xử lý thanh toán."
        );
      }
    } finally {
      setIsPaying(false);
    }
  };

  const error =
    status === "anonymous"
      ? "Vui lòng đăng nhập để xem đơn hàng."
      : !params.id
        ? "Không tìm thấy mã đơn hàng."
        : query.error instanceof OrdersApiError &&
            [403, 404].includes(query.error.status)
          ? "Không tìm thấy đơn hàng hoặc bạn không có quyền xem đơn này."
          : query.error?.message;

  const canRequestRefund = order?.status === "PAID" && !order.refundRequest;

  return (
    <main className="min-h-screen bg-[#FBF8F3] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <Link href="/orders" className="text-sm font-bold text-[#163D2C]">
          ← Lịch sử đơn hàng
        </Link>
        {!order && !error && (
          <div className="mt-6 rounded-2xl border border-[#E8DFC8] bg-white p-10 text-center text-sm font-semibold text-[#756A63]">
            Đang tải chi tiết đơn hàng...
          </div>
        )}
        {error && (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
            <h1 className="font-serif text-2xl font-black text-rose-900">
              Không thể mở đơn hàng
            </h1>
            <p className="mt-2 text-sm text-rose-700">{error}</p>
            <button
              type="button"
              onClick={() => {
                if (status === "authenticated") void query.refetch();
              }}
              className="mt-5 rounded-full bg-[#163D2C] px-5 py-2.5 text-sm font-bold text-white"
            >
              Thử lại
            </button>
          </div>
        )}
        {order && (
          <div className="mt-6">
            <OrderDetailView
              order={order}
              onRetryPayment={isExpired || order.status !== "PENDING" ? undefined : () => void handleRetryPayment()}
              isPaying={isPaying}
              onRequestRefund={canRequestRefund ? () => {
                setShowRefundModal(true);
                refundMutation.reset();
              } : undefined}
            />

            {["PENDING", "PAYMENT_FAILED"].includes(order.status) && (
              <div className="mt-5 space-y-4">
                {isExpired ? (
                  <div
                    role="alert"
                    className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900"
                  >
                    <div className="flex items-center gap-2 font-bold">
                      <span>⏰</span>
                      <span>Đơn hàng đã hết thời hạn thanh toán</span>
                    </div>
                    <p className="mt-1 text-xs text-amber-700">
                      Thời gian giữ chỗ 15 phút đã kết thúc. Đơn hàng đang được hệ thống tự động hủy và hoàn trả nguyên liệu về kho.
                    </p>
                  </div>
                ) : (
                  <section className="rounded-2xl border border-[#E8DFC8] bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEE6DB] pb-4">
                      <div>
                        <h2 className="font-serif text-lg font-black text-[#163D2C]">
                          Thanh toán đơn hàng
                        </h2>
                        <p className="mt-0.5 text-xs text-[#756A63]">
                          Vui lòng hoàn tất thanh toán trước khi thời gian giữ chỗ kết thúc.
                        </p>
                      </div>
                      {remainingMs !== null && (
                        <div className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                          <span>Còn lại:</span>
                          <span className="font-mono text-sm">
                            {Math.floor(remainingMs / 60000)}:
                            {String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, "0")}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4">
                      <label className="text-xs font-bold uppercase tracking-wider text-[#756A63]">
                        Chọn phương thức thanh toán
                      </label>
                      <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                        <button
                          type="button"
                          aria-pressed="true"
                          className="flex items-center justify-between rounded-xl border border-[#163D2C] bg-[#F2F6F3] p-3 text-left font-bold text-[#163D2C]"
                        >
                          <span className="text-xs font-semibold">Cổng VNPay</span>
                          <span className="text-[10px] text-[#8C7A6B]">QR/Thẻ</span>
                        </button>
                      </div>
                    </div>

                    {paymentError && (
                      <div
                        role="alert"
                        className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"
                      >
                        {paymentError}
                      </div>
                    )}

                    {order.status === "PAYMENT_FAILED" && (
                      <button
                        type="button"
                        disabled={isPaying || isExpired}
                        onClick={() => void handleRetryPayment()}
                        className="mt-5 w-full rounded-full bg-[#163D2C] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#1f4f38] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isPaying
                          ? "Đang khởi tạo thanh toán..."
                          : `Thanh toán lại ${order.total.toLocaleString("vi-VN")} đ`}
                      </button>
                    )}
                  </section>
                )}

                <section className="rounded-2xl border border-[#E8DFC8] bg-white p-5 text-sm">
                  <p className="text-[#756A63]">
                    Bạn có thể hủy đơn nếu không còn nhu cầu mua.
                  </p>
                  {confirmCancel ? (
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        disabled={cancel.isPending}
                        onClick={() => cancel.mutate()}
                        className="rounded-full bg-rose-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
                      >
                        {cancel.isPending ? "Đang hủy…" : "Xác nhận hủy đơn"}
                      </button>
                      <button
                        disabled={cancel.isPending}
                        onClick={() => setConfirmCancel(false)}
                        className="rounded-full border px-4 py-2"
                      >
                        Giữ đơn
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setConfirmCancel(true);
                        cancel.reset();
                      }}
                      className="mt-4 font-semibold text-rose-700 underline"
                    >
                      Hủy đơn hàng
                    </button>
                  )}
                </section>
              </div>
            )}

            {cancel.error && (
              <p
                role="alert"
                className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
              >
                {cancel.error.message}
              </p>
            )}

            {/* ===== KHU VỰC HOÀN TIỀN (CUSTOMER) ===== */}
            {order.status === "PAID" && (
              <section className="mt-5 rounded-2xl border border-[#E8DFC8] bg-white p-5 shadow-sm sm:p-6">
                <h2 className="font-serif text-base font-bold text-[#163D2C]">
                  Hoàn tiền bằng điểm tích lũy
                </h2>
                <p className="mt-1 text-xs text-[#756A63]">
                  Nếu có sự cố với đơn hàng, bạn có thể yêu cầu hoàn tiền dưới dạng điểm tích lũy. Barista sẽ xem xét và phê duyệt tại quầy.
                </p>

                {canRequestRefund && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowRefundModal(true);
                      refundMutation.reset();
                    }}
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#C99C54] bg-[#FBF5EA] px-5 py-2.5 text-sm font-bold text-[#856334] transition hover:bg-[#F5EAD5]"
                  >
                    <span>💰</span>
                    Yêu cầu hoàn tiền
                  </button>
                )}

                {order.refundRequest?.status === "PENDING" && (
                  <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <span className="mt-0.5 text-lg">⏳</span>
                    <div>
                      <p className="text-sm font-bold text-amber-900">
                        Đang chờ Barista duyệt hoàn tiền
                      </p>
                      <p className="mt-1 text-xs text-amber-700">
                        Lý do bạn gửi:{" "}
                        <span className="italic">
                          &ldquo;{order.refundRequest.reason}&rdquo;
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-amber-600">
                        Yêu cầu gửi lúc{" "}
                        {new Intl.DateTimeFormat("vi-VN", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(order.refundRequest.createdAt))}
                      </p>
                    </div>
                  </div>
                )}

                {order.refundRequest?.status === "APPROVED" && (
                  <div className="mt-4 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
                    <span className="mt-0.5 text-lg">✅</span>
                    <div>
                      <p className="text-sm font-bold text-green-900">
                        Hoàn tiền đã được duyệt
                      </p>
                      <p className="mt-1 text-xs text-green-700">
                        Điểm tích lũy tương đương{" "}
                        <strong>
                          {order.total.toLocaleString("vi-VN")} điểm
                        </strong>{" "}
                        đã được cộng vào tài khoản của bạn.
                      </p>
                    </div>
                  </div>
                )}

                {order.refundRequest?.status === "REJECTED" && (
                  <div className="mt-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
                    <span className="mt-0.5 text-lg">❌</span>
                    <div>
                      <p className="text-sm font-bold text-rose-900">
                        Yêu cầu hoàn tiền bị từ chối
                      </p>
                      {order.refundRequest.rejectReason && (
                        <p className="mt-1 text-xs text-rose-700">
                          Lý do từ chối:{" "}
                          <span className="italic">
                            &ldquo;{order.refundRequest.rejectReason}&rdquo;
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>

      {/* ===== MODAL GỬI YÊU CẦU HOÀN TIỀN ===== */}
      {showRefundModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="refund-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !refundMutation.isPending) {
              setShowRefundModal(false);
              setRefundReason("");
              refundMutation.reset();
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2
              id="refund-modal-title"
              className="font-serif text-xl font-bold text-[#163D2C]"
            >
              Yêu cầu hoàn tiền
            </h2>
            <p className="mt-1 text-xs text-[#756A63]">
              Mô tả lý do bạn muốn hoàn tiền. Barista sẽ xem xét và phê duyệt tại quầy.
            </p>

            <label
              htmlFor="refund-reason"
              className="mt-4 block text-xs font-bold uppercase tracking-wider text-[#756A63]"
            >
              Lý do hoàn tiền <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="refund-reason"
              ref={refundReasonRef}
              rows={4}
              maxLength={500}
              placeholder="Ví dụ: Đơn hàng bị lỗi, sản phẩm không đúng yêu cầu..."
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              disabled={refundMutation.isPending}
              className="mt-2 w-full resize-none rounded-xl border border-[#DDE2D7] p-3 text-sm text-[#1A1612] outline-none focus:border-[#163D2C] focus:ring-1 focus:ring-[#163D2C] disabled:opacity-60"
            />
            <p className="mt-1 text-right text-[11px] text-[#9A9A9A]">
              {refundReason.length}/500
            </p>

            {refundMutation.isError && (
              <div
                role="alert"
                className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"
              >
                {refundMutation.error instanceof Error
                  ? refundMutation.error.message
                  : "Có lỗi xảy ra. Vui lòng thử lại."}
              </div>
            )}

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                disabled={refundMutation.isPending || refundReason.trim().length < 10}
                onClick={() => refundMutation.mutate()}
                className="flex-1 rounded-full bg-[#163D2C] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1f4f38] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {refundMutation.isPending ? "Đang gửi…" : "Gửi yêu cầu"}
              </button>
              <button
                type="button"
                disabled={refundMutation.isPending}
                onClick={() => {
                  setShowRefundModal(false);
                  setRefundReason("");
                  refundMutation.reset();
                }}
                className="rounded-full border border-[#DDE2D7] px-5 py-3 text-sm font-semibold text-[#163D2C] transition hover:bg-[#F5F4EF] disabled:opacity-50"
              >
                Hủy bỏ
              </button>
            </div>
            <p className="mt-3 text-center text-[11px] text-[#9A9A9A]">
              Tối thiểu 10 ký tự. Mỗi đơn chỉ được gửi một yêu cầu.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}


"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import {
  getInventoryApi,
  getInventoryReceiptsApi,
  receiveInventoryStockApi,
  InventoryApiError,
  type Ingredient,
  type InventoryReceipt,
  type ReceiveInventoryStockPayload,
} from "../inventory-api";

import { StaffIcon } from "./StaffIcon";

const statusLabels = {
  IN_STOCK: "Còn hàng",
  LOW_STOCK: "Sắp hết",
  OUT_OF_STOCK: "Hết hàng",
};

const unitLabels = {
  G: "g",
  ML: "ml",
  PCS: "cái",
};

const fieldClass =
  "w-full rounded-xl border border-[#DDE2D7] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#527353]";

type Tab = "inventory" | "history";

type SelectedItem = {
  ingredientId: string;
  code: string;
  name: string;
  unit: Ingredient["unit"];
  quantity: string;
};

function messageOf(error: unknown) {
  if (error instanceof InventoryApiError && error.status === 403) {
    return "Tài khoản của bạn không có quyền nhập kho.";
  }

  return error instanceof Error
    ? error.message
    : "Đã có lỗi xảy ra khi nhập kho.";
}

function formatNumber(value: number) {
  return value.toLocaleString("vi-VN");
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("vi-VN");
}

export function InventoryPanel({ token }: { token: string }) {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>("inventory");

  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [cursor, setCursor] = useState<string>();

  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [selectedItems, setSelectedItems] = useState<
    Record<string, SelectedItem>
  >({});

  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");

  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Lấy danh sách nguyên liệu.
  const inventory = useQuery({
    queryKey: ["staff-inventory", token, q, status, cursor],
    queryFn: () => getInventoryApi(token, { q, status, cursor }),
    retry: false,
    refetchInterval: 15000,
  });

  // Chỉ tải lịch sử khi người dùng mở tab lịch sử.
  const history = useQuery({
    queryKey: ["staff-inventory-receipts", token],
    queryFn: () => getInventoryReceiptsApi(token),
    enabled: activeTab === "history",
    retry: false,
  });

  // Gửi một phiếu nhập gồm nhiều nguyên liệu.
  const receive = useMutation({
    mutationFn: (payload: ReceiveInventoryStockPayload) =>
      receiveInventoryStockApi(token, payload),

    onMutate: () => {
      setActionError(null);
      setSuccessMessage(null);
    },

    onSuccess: (receipt) => {
      setSelectedItems({});
      setSupplier("");
      setNote("");
      setShowReceiptForm(false);

      setSuccessMessage(
        `Nhập kho thành công: ${receipt.items.length} nguyên liệu trong phiếu ${receipt.receiptId}.`,
      );
    },

    onError: (error) => {
      setActionError(messageOf(error));
    },

    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["staff-inventory", token],
        }),
        queryClient.invalidateQueries({
          queryKey: ["staff-inventory-receipts", token],
        }),
      ]);
    },
  });

  // Thêm hoặc bỏ một nguyên liệu khỏi phiếu đang nhập.
  function toggleIngredient(item: Ingredient) {
    setSelectedItems((current) => {
      const next = { ...current };

      if (next[item.id]) {
        delete next[item.id];
      } else {
        next[item.id] = {
          ingredientId: item.id,
          code: item.code,
          name: item.name,
          unit: item.unit,
          quantity: "1",
        };
      }

      return next;
    });

    setActionError(null);
    setSuccessMessage(null);
  }

  // Thay đổi số lượng của một dòng trong phiếu.
  function updateQuantity(ingredientId: string, value: string) {
    setSelectedItems((current) => ({
      ...current,
      [ingredientId]: {
        ...current[ingredientId],
        quantity: value,
      },
    }));
  }

  // Kiểm tra và gửi phiếu nhập kho.
  function handleReceive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const items = Object.values(selectedItems);

    if (items.length === 0) {
      setActionError("Bạn cần chọn ít nhất một nguyên liệu.");
      return;
    }

    const payloadItems: ReceiveInventoryStockPayload["items"] = [];

    for (const item of items) {
      const quantity = Number(item.quantity);

      if (
        !Number.isSafeInteger(quantity) ||
        quantity < 1 ||
        quantity > 2147483647
      ) {
        setActionError(
          `Số lượng nhập của ${item.name} phải là số nguyên từ 1 đến 2.147.483.647.`,
        );
        return;
      }

      payloadItems.push({
        ingredientId: item.ingredientId,
        quantity,
      });
    }

    receive.mutate({
      items: payloadItems,
      supplier: supplier.trim() || undefined,
      note: note.trim() || undefined,
    });
  }

  const ingredients = inventory.data?.data ?? [];
  const selectedList = Object.values(selectedItems);

  return (
    <section aria-label="Theo dõi kho nguyên liệu">
      <div className="mb-6 rounded-2xl border border-[#DEE3D8] bg-[#EDF1E7] p-5">
        <h2 className="font-serif text-xl font-semibold">
          Quản lý nguyên liệu trong ca
        </h2>

        <p className="mt-2 text-sm leading-6 text-[#6B7867]">
          Barista có thể theo dõi tồn kho, nhập thêm nhiều nguyên liệu trong
          cùng một phiếu và xem lại lịch sử nhập kho. Hệ thống tự động cập nhật
          số lượng khi xử lý đơn hàng.
        </p>
      </div>

      {/* Hai tab chính */}
      <div className="mb-5 flex flex-wrap gap-2 border-b border-[#DEE3D8] pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("inventory")}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
            activeTab === "inventory"
              ? "bg-[#163D2C] text-white"
              : "border border-[#DDE2D7] bg-white text-[#526052]"
          }`}
        >
          Tồn kho
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
            activeTab === "history"
              ? "bg-[#163D2C] text-white"
              : "border border-[#DDE2D7] bg-white text-[#526052]"
          }`}
        >
          Lịch sử nhập kho
        </button>
      </div>

      {actionError && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
        >
          {actionError}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800"
        >
          {successMessage}
        </div>
      )}

      {/* TAB TỒN KHO */}
      {activeTab === "inventory" && (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-[#263B2B]">
                Danh sách nguyên liệu
              </h3>
              <p className="mt-1 text-xs text-[#788276]">
                Chọn nhiều nguyên liệu để tạo một phiếu nhập kho.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowReceiptForm((value) => !value);
                setActionError(null);
                setSuccessMessage(null);
              }}
              className="rounded-xl bg-[#163D2C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#28543D]"
            >
              {showReceiptForm ? "Đóng phiếu nhập" : "Nhập kho mới"}
            </button>
          </div>

          {/* Form phiếu nhập nhiều nguyên liệu */}
          {showReceiptForm && (
            <form
              onSubmit={handleReceive}
              className="mb-6 rounded-2xl border border-[#DDE2D7] bg-[#F8F9F5] p-4 sm:p-5"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-[#263B2B]">
                  Phiếu nhập kho mới
                </h3>

                <span className="rounded-full bg-[#E7EEE2] px-3 py-1 text-xs font-semibold text-[#507141]">
                  {selectedList.length} nguyên liệu đã chọn
                </span>
              </div>

              {selectedList.length === 0 ? (
                <p className="mb-4 rounded-xl bg-white p-4 text-sm text-[#788276]">
                  Chưa có nguyên liệu nào. Nhấn nút &quot;Thêm vào phiếu&quot; ở danh sách bên dưới.
                </p>
              ) : (
                <div className="mb-4 space-y-3">
                  {selectedList.map((item) => (
                    <div
                      key={item.ingredientId}
                      className="grid grid-cols-1 items-end gap-3 rounded-xl border border-[#E2E6DD] bg-white p-3 sm:grid-cols-[1fr_160px_auto]"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[#263B2B]">
                          {item.name}
                        </p>
                        <p className="mt-1 text-xs text-[#788276]">
                          {item.code} · {unitLabels[item.unit]}
                        </p>
                      </div>

                      <label className="block">
                        <span className="mb-1 block text-xs text-[#6D786F]">
                          Số lượng ({unitLabels[item.unit]})
                        </span>

                        <input
                          type="number"
                          min="1"
                          max="2147483647"
                          step="1"
                          required
                          value={item.quantity}
                          disabled={receive.isPending}
                          onChange={(event) =>
                            updateQuantity(
                              item.ingredientId,
                              event.target.value,
                            )
                          }
                          className={fieldClass}
                        />
                      </label>

                      <button
                        type="button"
                        disabled={receive.isPending}
                        onClick={() => toggleIngredient({
                          id: item.ingredientId,
                          code: item.code,
                          name: item.name,
                          unit: item.unit,
                          stockQuantity: 0,
                          version: 0,
                          isActive: true,
                          status: "IN_STOCK",
                          updatedAt: "",
                        })}
                        className="rounded-xl border border-rose-200 px-3 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                      >
                        Bỏ chọn
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label>
                  <span className="mb-1 block text-xs font-medium text-[#6D786F]">
                    Nhà cung cấp (không bắt buộc)
                  </span>
                  <input
                    value={supplier}
                    onChange={(event) => setSupplier(event.target.value)}
                    maxLength={150}
                    disabled={receive.isPending}
                    placeholder="Tên nhà cung cấp"
                    className={fieldClass}
                  />
                </label>

                <label>
                  <span className="mb-1 block text-xs font-medium text-[#6D786F]">
                    Ghi chú (không bắt buộc)
                  </span>
                  <input
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    maxLength={2000}
                    disabled={receive.isPending}
                    placeholder="Thông tin thêm về phiếu nhập"
                    className={fieldClass}
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={receive.isPending || selectedList.length === 0}
                  className="rounded-xl bg-[#163D2C] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#28543D] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {receive.isPending ? "Đang nhập kho..." : "Xác nhận nhập kho"}
                </button>

                <button
                  type="button"
                  disabled={receive.isPending}
                  onClick={() => {
                    setSelectedItems({});
                    setSupplier("");
                    setNote("");
                    setActionError(null);
                  }}
                  className="rounded-xl border border-[#DDE2D7] bg-white px-5 py-2.5 text-sm font-semibold text-[#526052] disabled:opacity-50"
                >
                  Xóa phiếu
                </button>
              </div>
            </form>
          )}

          {/* Tìm kiếm và lọc */}
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <form
              className="flex min-w-0 flex-1 gap-2 sm:max-w-md"
              onSubmit={(event) => {
                event.preventDefault();
                setQ(search.trim());
                setCursor(undefined);
              }}
            >
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#DDE2D7] bg-white px-3">
                <StaffIcon name="search" width="17" height="17" />

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  maxLength={100}
                  placeholder="Tên hoặc mã nguyên liệu..."
                  aria-label="Tìm nguyên liệu"
                  className="w-full min-w-0 py-2.5 text-sm outline-none"
                />
              </label>

              <button className="rounded-xl bg-[#163D2C] px-4 text-sm font-semibold text-white">
                Tìm
              </button>
            </form>

            <select
              aria-label="Lọc trạng thái kho"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setCursor(undefined);
              }}
              className={`${fieldClass} sm:w-auto`}
            >
              <option value="">Tất cả trạng thái</option>

              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={inventory.isFetching}
              onClick={() => void inventory.refetch()}
              className="flex items-center gap-2 rounded-xl border border-[#DDE2D7] px-4 py-2.5 text-sm disabled:opacity-50"
            >
              <StaffIcon name="refresh" width="16" height="16" />
              Làm mới
            </button>
          </div>

          {inventory.isPending && (
            <p
              role="status"
              className="rounded-2xl bg-white p-10 text-center text-sm text-[#6D786F]"
            >
              Đang tải danh sách nguyên liệu...
            </p>
          )}

          {inventory.isError && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
            >
              {messageOf(inventory.error)}
              <button
                type="button"
                onClick={() => void inventory.refetch()}
                className="ml-2 font-semibold underline"
              >
                Thử lại
              </button>
            </div>
          )}

          {inventory.data && (
            <>
              <div className="space-y-3">
                {ingredients.length === 0 ? (
                  <p className="rounded-2xl bg-white p-8 text-center text-sm text-[#788276]">
                    Không tìm thấy nguyên liệu phù hợp.
                  </p>
                ) : (
                  ingredients.map((item) => {
                    const isSelected = Boolean(selectedItems[item.id]);

                    return (
                      <article
                        key={item.id}
                        className="grid grid-cols-2 items-center gap-3 rounded-2xl border border-[#E1E5DC] bg-white p-4 sm:grid-cols-[1fr_auto_auto_auto]"
                      >
                        <div className="col-span-2 min-w-0 sm:col-span-1">
                          <h4 className="truncate text-sm font-semibold text-[#263B2B]">
                            {item.name}
                          </h4>
                          <p className="mt-1 text-xs text-[#788276]">
                            Mã: {item.code}
                          </p>
                        </div>

                        <div className="text-left sm:text-right">
                          <p className="text-xs text-[#788276]">
                            Tồn kho
                          </p>
                          <p className="font-mono text-sm font-semibold">
                            {formatNumber(item.stockQuantity)}{" "}
                            <span className="font-sans text-xs font-normal text-[#7B847B]">
                              {unitLabels[item.unit]}
                            </span>
                          </p>
                        </div>

                        <span
                          className={`justify-self-start rounded-full px-3 py-1 text-[11px] font-semibold ${
                            item.status === "IN_STOCK"
                              ? "bg-[#EDF3E8] text-[#507141]"
                              : item.status === "LOW_STOCK"
                                ? "bg-[#FBF0DB] text-[#956827]"
                                : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {statusLabels[item.status]}
                        </span>

                        <button
                          type="button"
                          disabled={
                            !item.isActive ||
                            receive.isPending ||
                            !showReceiptForm
                          }
                          onClick={() => toggleIngredient(item)}
                          className={`col-span-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 sm:col-span-1 ${
                            isSelected
                              ? "border border-rose-200 bg-rose-50 text-rose-700"
                              : "bg-[#163D2C] text-white hover:bg-[#28543D]"
                          }`}
                        >
                          {isSelected ? "Bỏ chọn" : "Thêm vào phiếu"}
                        </button>
                      </article>
                    );
                  })
                )}
              </div>

              {/* Phân trang */}
              <div className="mt-6 flex items-center justify-end gap-4 text-sm">
                <button
                  type="button"
                  disabled={
                    !inventory.data.meta.nextCursor ||
                    inventory.isFetching
                  }
                  onClick={() =>
                    setCursor(inventory.data.meta.nextCursor ?? undefined)
                  }
                  className="font-semibold text-[#28543D] disabled:opacity-30"
                >
                  Trang tiếp →
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* TAB LỊCH SỬ NHẬP KHO */}
      {activeTab === "history" && (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-[#263B2B]">
                Lịch sử phiếu nhập kho
              </h3>
              <p className="mt-1 text-xs text-[#788276]">
                Hiển thị tối đa 50 phiếu nhập gần nhất.
              </p>
            </div>

            <button
              type="button"
              disabled={history.isFetching}
              onClick={() => void history.refetch()}
              className="flex items-center gap-2 rounded-xl border border-[#DDE2D7] px-4 py-2.5 text-sm disabled:opacity-50"
            >
              <StaffIcon name="refresh" width="16" height="16" />
              Làm mới
            </button>
          </div>

          {history.isPending && (
            <p
              role="status"
              className="rounded-2xl bg-white p-10 text-center text-sm text-[#6D786F]"
            >
              Đang tải lịch sử nhập kho...
            </p>
          )}

          {history.isError && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
            >
              {messageOf(history.error)}
              <button
                type="button"
                onClick={() => void history.refetch()}
                className="ml-2 font-semibold underline"
              >
                Thử lại
              </button>
            </div>
          )}

          {history.data && (
            <ReceiptHistory receipts={history.data} />
          )}
        </div>
      )}
    </section>
  );
}

function ReceiptHistory({
  receipts,
}: {
  receipts: InventoryReceipt[];
}) {
  if (receipts.length === 0) {
    return (
      <p className="rounded-2xl bg-white p-8 text-center text-sm text-[#788276]">
        Chưa có phiếu nhập kho nào.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {receipts.map((receipt) => (
        <article
          key={receipt.receiptId}
          className="overflow-hidden rounded-2xl border border-[#E1E5DC] bg-white"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E8EBE4] bg-[#F8F9F5] p-4">
            <div>
              <h4 className="text-sm font-semibold text-[#263B2B]">
                Phiếu nhập kho
              </h4>
              <p className="mt-1 break-all font-mono text-[11px] text-[#788276]">
                {receipt.receiptId}
              </p>
            </div>

            <p className="text-xs text-[#6D786F]">
              {formatDate(receipt.createdAt)}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 border-b border-[#E8EBE4] p-4 text-xs sm:grid-cols-2">
            <p>
              <span className="text-[#788276]">Người nhập: </span>
              <span className="break-all font-medium">
                {receipt.receivedByUserId}
              </span>
            </p>

            <p>
              <span className="text-[#788276]">Nhà cung cấp: </span>
              <span className="font-medium">
                {receipt.supplier || "Không có thông tin"}
              </span>
            </p>

            {receipt.note && (
              <p className="sm:col-span-2">
                <span className="text-[#788276]">Ghi chú: </span>
                <span>{receipt.note}</span>
              </p>
            )}
          </div>

          <div className="overflow-x-auto p-4">
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead>
                <tr className="border-b border-[#E8EBE4] text-[#788276]">
                  <th className="pb-3 pr-3 font-medium">Nguyên liệu</th>
                  <th className="pb-3 pr-3 text-right font-medium">
                    Số lượng nhập
                  </th>
                  <th className="pb-3 pr-3 text-right font-medium">
                    Tồn trước
                  </th>
                  <th className="pb-3 text-right font-medium">
                    Tồn sau
                  </th>
                </tr>
              </thead>

              <tbody>
                {receipt.items.map((item) => (
                  <tr
                    key={item.ingredientId}
                    className="border-b border-[#F0F1ED] last:border-0"
                  >
                    <td className="py-3 pr-3">
                      <p className="font-semibold text-[#263B2B]">
                        {item.name}
                      </p>
                      <p className="mt-1 text-[#788276]">
                        {item.code}
                      </p>
                    </td>

                    <td className="py-3 pr-3 text-right font-semibold">
                      +{formatNumber(item.quantityAdded)}{" "}
                      {unitLabels[item.unit]}
                    </td>

                    <td className="py-3 pr-3 text-right">
                      {formatNumber(item.stockBefore)}{" "}
                      {unitLabels[item.unit]}
                    </td>

                    <td className="py-3 text-right font-semibold text-[#507141]">
                      {formatNumber(item.stockAfter)}{" "}
                      {unitLabels[item.unit]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ))}
    </div>
  );
}

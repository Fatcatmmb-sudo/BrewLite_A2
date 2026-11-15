
"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import {
  getInventoryApi,
  receiveInventoryStockApi,
  InventoryApiError,
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

function messageOf(error: unknown) {
  if (error instanceof InventoryApiError && error.status === 403) {
    return "Tài khoản của bạn không có quyền nhập kho.";
  }

  return error instanceof Error
    ? error.message
    : "Đã có lỗi xảy ra khi nhập kho.";
}

export function InventoryPanel({ token }: { token: string }) {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [cursor, setCursor] = useState<string>();

  const [selectedIngredientId, setSelectedIngredientId] =
    useState<string | null>(null);

  const [quantity, setQuantity] = useState("1");
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const queryKey = ["staff-inventory", token, q, status, cursor];

  const inventory = useQuery({
    queryKey,
    queryFn: () => getInventoryApi(token, { q, status, cursor }),
    retry: false,
    refetchInterval: 15000,
  });

  const receive = useMutation({
    mutationFn: ({
      ingredientId,
      quantity,
    }: {
      ingredientId: string;
      quantity: number;
    }) => receiveInventoryStockApi(token, ingredientId, quantity),

    onMutate: () => {
      setActionError(null);
      setSuccessMessage(null);
    },

    onSuccess: (receipt, variables) => {
      const ingredient = inventory.data?.data.find(
        (item) => item.id === variables.ingredientId,
      );

      const unit = ingredient
        ? unitLabels[ingredient.unit]
        : "";

      setSelectedIngredientId(null);
      setQuantity("1");

      setSuccessMessage(
        `Nhập kho thành công: ${receipt.quantity.toLocaleString("vi-VN")} ${unit}. Tồn kho mới: ${receipt.stockAfter.toLocaleString("vi-VN")} ${unit}.`,
      );
    },

    onError: (error) => {
      setActionError(messageOf(error));
    },

    // Thành công hay thất bại đều tải lại dữ liệu kho.
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["staff-inventory", token],
      }),
  });

  function handleReceive(
    event: React.FormEvent<HTMLFormElement>,
    ingredientId: string,
  ) {
    event.preventDefault();

    const parsedQuantity = Number(quantity);

    if (
      !Number.isSafeInteger(parsedQuantity) ||
      parsedQuantity < 1 ||
      parsedQuantity > 2147483647
    ) {
      setActionError(
        "Số lượng nhập phải là số nguyên từ 1 đến 2.147.483.647.",
      );
      return;
    }

    receive.mutate({
      ingredientId,
      quantity: parsedQuantity,
    });
  }

  return (
    <section aria-label="Theo dõi kho nguyên liệu">
      <div className="mb-6 rounded-2xl border border-[#DEE3D8] bg-[#EDF1E7] p-5">
        <h2 className="font-serif text-xl font-semibold">
          Quản lý nguyên liệu trong ca
        </h2>

        <p className="mt-2 text-sm leading-6 text-[#6B7867]">
          Barista có thể theo dõi tồn kho và ghi nhận nguyên liệu nhập thêm.
          Hệ thống tự động cập nhật số lượng khi xử lý đơn hàng.
          Ngưỡng sắp hết: ≤ 500 g, 1.000 ml hoặc 10 cái.
          Số lượng bằng 0 là hết hàng.
        </p>
      </div>

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
              placeholder="Tên hoặc mã nguyên liệu…"
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

      {inventory.isPending && (
        <p
          role="status"
          className="rounded-2xl bg-white p-10 text-center text-sm text-[#6D786F]"
        >
          Đang tải nguyên liệu…
        </p>
      )}

      {inventory.isError && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700"
        >
          <p>{inventory.error.message}</p>

          <button
            type="button"
            onClick={() => void inventory.refetch()}
            className="mt-3 font-bold underline"
          >
            Thử lại
          </button>
        </div>
      )}

      {inventory.data && (
        <div className="overflow-hidden rounded-2xl border border-[#DEE3D8] bg-white">
          <div className="flex justify-between border-b border-[#E5E8E0] px-5 py-4">
            <h2 className="text-sm font-bold">Danh sách nguyên liệu</h2>

            <span className="text-xs text-[#7B847B]">
              {inventory.data.data.length} nguyên liệu trên trang
            </span>
          </div>

          {inventory.data.data.length === 0 ? (
            <p className="p-12 text-center text-sm text-[#7B847B]">
              Không có nguyên liệu phù hợp.
            </p>
          ) : (
            <ul className="divide-y divide-[#EDF0E9]">
              {inventory.data.data.map((item) => {
                const isSelected = selectedIngredientId === item.id;

                return (
                  <li
                    key={item.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-5 sm:flex sm:flex-wrap sm:gap-6"
                  >
                    <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F1F3ED] text-[#698060] sm:flex">
                      <StaffIcon name="box" />
                    </span>

                    <div className="col-span-2 min-w-0 flex-1 sm:col-span-1">
                      <h3 className="break-words text-sm font-semibold">
                        {item.name}
                      </h3>

                      <p className="mt-1 text-[11px] text-[#889183]">
                        {item.code}
                        {!item.isActive && " · Ngừng sử dụng"}
                      </p>
                    </div>

                    <span className="min-w-20 text-left font-mono text-sm font-semibold sm:text-right">
                      {item.stockQuantity.toLocaleString("vi-VN")}{" "}
                      <span className="font-sans text-xs font-normal text-[#7B847B]">
                        {unitLabels[item.unit]}
                      </span>
                    </span>

                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
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
                      disabled={!item.isActive || receive.isPending}
                      aria-expanded={isSelected}
                      aria-controls={`receive-${item.id}`}
                      onClick={() => {
                        setSelectedIngredientId(
                          isSelected ? null : item.id,
                        );
                        setQuantity("1");
                        setActionError(null);
                        setSuccessMessage(null);
                      }}
                      className="col-span-2 rounded-xl bg-[#163D2C] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#28543D] disabled:cursor-not-allowed disabled:opacity-40 sm:col-span-1"
                    >
                      {isSelected ? "Đóng" : "Nhập kho"}
                    </button>

                    {isSelected && (
                      <form
                        id={`receive-${item.id}`}
                        onSubmit={(event) =>
                          handleReceive(event, item.id)
                        }
                        className="col-span-2 w-full rounded-xl border border-[#DEE3D8] bg-[#F8F9F5] p-4 sm:basis-full"
                      >
                        <h4 className="mb-3 text-sm font-semibold">
                          Nhập thêm: {item.name}
                        </h4>

                        <label
                          htmlFor={`quantity-${item.id}`}
                          className="mb-2 block text-xs font-medium text-[#6D786F]"
                        >
                          Số lượng nhập ({unitLabels[item.unit]})
                        </label>

                        <input
                          id={`quantity-${item.id}`}
                          type="number"
                          min="1"
                          max="2147483647"
                          step="1"
                          required
                          value={quantity}
                          disabled={receive.isPending}
                          onChange={(event) =>
                            setQuantity(event.target.value)
                          }
                          className={fieldClass}
                        />

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="submit"
                            disabled={receive.isPending || !quantity.trim()}
                            className="rounded-xl bg-[#163D2C] px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                          >
                            {receive.isPending
                              ? "Đang nhập kho…"
                              : "Xác nhận nhập kho"}
                          </button>

                          <button
                            type="button"
                            disabled={receive.isPending}
                            onClick={() => {
                              setSelectedIngredientId(null);
                              setActionError(null);
                            }}
                            className="rounded-xl border border-[#DDE2D7] bg-white px-5 py-2.5 text-xs font-semibold disabled:opacity-50"
                          >
                            Hủy
                          </button>
                        </div>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex justify-between border-t border-[#E5E8E0] px-5 py-4 text-xs">
            <button
              type="button"
              disabled={!cursor}
              onClick={() => setCursor(undefined)}
              className="font-semibold disabled:opacity-30"
            >
              Về trang đầu
            </button>

            <button
              type="button"
              disabled={
                !inventory.data.meta.nextCursor || receive.isPending
              }
              onClick={() =>
                setCursor(inventory.data.meta.nextCursor ?? undefined)
              }
              className="font-semibold disabled:opacity-30"
            >
              Trang tiếp →
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

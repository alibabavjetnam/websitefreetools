/** Tiền điện sinh hoạt bậc thang Việt Nam (chưa VAT). Nguồn: QĐ 2892/QĐ-BCT, áp dụng từ 01/11/2026 (5 bậc) */
export interface Tier { upTo: number; price: number }
export const TARIFFS: Record<string, { label: string; tiers: Tier[] }> = {
  '2026-11': { label: '01/11/2026', tiers: [{ upTo: 100, price: 1901 }, { upTo: 200, price: 2289 }, { upTo: 400, price: 2894 }, { upTo: 700, price: 3456 }, { upTo: Infinity, price: 3844 }] },
  '2025-05': { label: '10/05/2025', tiers: [{ upTo: 50, price: 1984 }, { upTo: 100, price: 2050 }, { upTo: 200, price: 2380 }, { upTo: 300, price: 2998 }, { upTo: 400, price: 3350 }, { upTo: Infinity, price: 3460 }] },
};
export interface BillLine { from: number; to: number; kwh: number; price: number; amount: number }
/** households: số hộ dùng chung công tơ (định mức mỗi bậc nhân lên); dayFactor: số ngày tính / số ngày tháng (định mức theo ngày) */
export function calcBill(kwh: number, tiers: Tier[], households = 1, dayFactor = 1): { lines: BillLine[]; subtotal: number } {
  const lines: BillLine[] = [];
  let prev = 0, left = Math.max(0, kwh), subtotal = 0;
  for (const t of tiers) {
    if (left <= 0) break;
    const cap = t.upTo === Infinity ? Infinity : Math.round(t.upTo * households * dayFactor);
    const span = cap === Infinity ? left : Math.max(0, cap - prev);
    const used = Math.min(left, span);
    if (used > 0) {
      const amount = used * t.price;
      lines.push({ from: prev + 1, to: prev + used, kwh: used, price: t.price, amount });
      subtotal += amount;
    }
    left -= used;
    prev = cap;
  }
  return { lines, subtotal };
}
/** Tìm số kWh tương ứng với số tiền (đã gồm VAT) bằng chia đôi */
export function kwhForMoney(money: number, tiers: Tier[], vat: number, households = 1): number {
  let lo = 0, hi = 100000;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (calcBill(mid, tiers, households).subtotal * (1 + vat) > money) hi = mid; else lo = mid;
  }
  return Math.floor(lo);
}

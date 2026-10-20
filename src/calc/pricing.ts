/** Tính giá bán và lợi nhuận cho hàng bán online (sàn TMĐT, website, mạng xã hội) */

export interface PricingCosts {
  /** Giá vốn một sản phẩm */
  cost: number;
  /** Phí cố định trên mỗi đơn: hỗ trợ vận chuyển, đóng gói, quà tặng… */
  fixedPerOrder: number;
  /** Chi phí quảng cáo trung bình cho mỗi đơn */
  adsPerOrder: number;
  /** Phí sàn / hoa hồng, % trên giá bán */
  platformPct: number;
  /** Phí thanh toán, % trên giá bán */
  paymentPct: number;
  /** Thuế khoán / thuế trên doanh thu, % trên giá bán */
  taxPct: number;
}

export interface PricingResult {
  price: number;
  percentFees: number;
  fixedFees: number;
  profit: number;
  /** Biên lợi nhuận trên giá bán, % */
  margin: number;
  /** Lợi nhuận trên giá vốn, % */
  markup: number;
}

const pctTotal = (c: PricingCosts) => (c.platformPct + c.paymentPct + c.taxPct) / 100;

export function profitAt(price: number, c: PricingCosts): PricingResult {
  const percentFees = price * pctTotal(c);
  const fixedFees = c.fixedPerOrder + c.adsPerOrder;
  const profit = price - c.cost - percentFees - fixedFees;
  return {
    price,
    percentFees,
    fixedFees,
    profit,
    margin: price > 0 ? (profit / price) * 100 : 0,
    markup: c.cost > 0 ? (profit / c.cost) * 100 : 0,
  };
}

/** Giá bán cần đặt để đạt biên lợi nhuận mong muốn (% trên giá bán). null nếu tổng % phí + biên lợi nhuận ≥ 100% */
export function priceForMargin(marginPct: number, c: PricingCosts): PricingResult | null {
  const denom = 1 - pctTotal(c) - marginPct / 100;
  if (denom <= 0) return null;
  return profitAt((c.cost + c.fixedPerOrder + c.adsPerOrder) / denom, c);
}

/** Giá hoà vốn (lợi nhuận bằng 0) */
export const breakEvenPrice = (c: PricingCosts): number | null => priceForMargin(0, c)?.price ?? null;

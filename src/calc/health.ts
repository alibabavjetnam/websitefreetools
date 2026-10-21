/** Công thức sức khoẻ: BMI, BMR, TDEE và calo tiêu hao theo hoạt động. */

export type Sex = 'male' | 'female';

export interface BmiResult {
  bmi: number;
  category: string;
  /** Khoảng cân nặng khoẻ mạnh theo chuẩn châu Á (BMI 18.5–22.9) */
  healthyMin: number;
  healthyMax: number;
}

/** BMI = cân nặng (kg) / (chiều cao m)^2. Phân loại theo ngưỡng châu Á (phù hợp người Việt). */
export function bmi(weightKg: number, heightCm: number): BmiResult {
  const h = heightCm / 100;
  const value = weightKg / (h * h);
  let category: string;
  if (value < 18.5) category = 'Thiếu cân';
  else if (value < 23) category = 'Bình thường';
  else if (value < 25) category = 'Thừa cân';
  else if (value < 30) category = 'Béo phì độ I';
  else category = 'Béo phì độ II';
  return {
    bmi: value,
    category,
    healthyMin: 18.5 * h * h,
    healthyMax: 22.9 * h * h,
  };
}

/** BMR theo công thức Mifflin–St Jeor (chính xác hơn Harris–Benedict). */
export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return base + (sex === 'male' ? 5 : -161);
}

export interface ActivityLevel {
  id: string;
  label: string;
  factor: number;
  hint: string;
}
export const ACTIVITY_LEVELS: ActivityLevel[] = [
  { id: 'sedentary', label: 'Ít vận động', factor: 1.2, hint: 'Làm việc văn phòng, ít đi lại, hầu như không tập.' },
  { id: 'light', label: 'Vận động nhẹ', factor: 1.375, hint: 'Tập nhẹ 1–3 buổi/tuần.' },
  { id: 'moderate', label: 'Vận động vừa', factor: 1.55, hint: 'Tập vừa 3–5 buổi/tuần.' },
  { id: 'active', label: 'Vận động nhiều', factor: 1.725, hint: 'Tập nặng 6–7 buổi/tuần.' },
  { id: 'veryActive', label: 'Vận động rất nhiều', factor: 1.9, hint: 'Lao động nặng hoặc tập 2 lần/ngày.' },
];

/** TDEE = BMR × hệ số vận động (tổng năng lượng tiêu hao mỗi ngày). */
export const tdee = (bmrValue: number, factor: number): number => bmrValue * factor;

/** Tỷ lệ eo/hông — chỉ báo nguy cơ tim mạch. */
export function waistHipRisk(waist: number, hip: number, sex: Sex): { ratio: number; level: string } {
  const ratio = waist / hip;
  const high = sex === 'male' ? 0.9 : 0.85;
  const mid = sex === 'male' ? 0.85 : 0.8;
  return { ratio, level: ratio >= high ? 'Nguy cơ cao' : ratio >= mid ? 'Nguy cơ trung bình' : 'Nguy cơ thấp' };
}

/** Nhóm hoạt động và chỉ số MET (Compendium of Physical Activities). */
export interface Activity {
  name: string;
  met: number;
  group: string;
}
export const ACTIVITIES: Activity[] = [
  { group: 'Đi lại', name: 'Đi bộ chậm (3 km/h)', met: 2.8 },
  { group: 'Đi lại', name: 'Đi bộ nhanh (5,5 km/h)', met: 4.3 },
  { group: 'Đi lại', name: 'Leo cầu thang', met: 8.0 },
  { group: 'Chạy', name: 'Chạy bộ nhẹ (8 km/h)', met: 8.3 },
  { group: 'Chạy', name: 'Chạy (10 km/h)', met: 9.8 },
  { group: 'Chạy', name: 'Chạy nhanh (12 km/h)', met: 11.8 },
  { group: 'Đạp xe', name: 'Đạp xe thong thả (<16 km/h)', met: 4.0 },
  { group: 'Đạp xe', name: 'Đạp xe vừa (19–22 km/h)', met: 8.0 },
  { group: 'Đạp xe', name: 'Đạp xe nhanh (>22 km/h)', met: 10.0 },
  { group: 'Thể thao', name: 'Bơi lội', met: 7.0 },
  { group: 'Thể thao', name: 'Cầu lông', met: 5.5 },
  { group: 'Thể thao', name: 'Bóng đá', met: 7.0 },
  { group: 'Thể thao', name: 'Bóng rổ', met: 6.5 },
  { group: 'Thể thao', name: 'Tennis', met: 7.3 },
  { group: 'Thể thao', name: 'Bóng bàn', met: 4.0 },
  { group: 'Phòng tập', name: 'Tập tạ (vừa)', met: 5.0 },
  { group: 'Phòng tập', name: 'Yoga', met: 3.0 },
  { group: 'Phòng tập', name: 'Nhảy dây', met: 11.0 },
  { group: 'Phòng tập', name: 'Aerobic', met: 6.5 },
  { group: 'Việc nhà', name: 'Dọn nhà, lau nhà', met: 3.3 },
  { group: 'Việc nhà', name: 'Làm vườn', met: 4.0 },
  { group: 'Việc nhà', name: 'Nấu ăn', met: 2.5 },
];

/** Calo tiêu hao = MET × 3.5 × kg / 200 × phút. */
export const caloriesBurned = (met: number, weightKg: number, minutes: number): number =>
  (met * 3.5 * weightKg) / 200 * minutes;

/** Lượng nước khuyến nghị mỗi ngày (ml): ~35 ml/kg, cộng thêm khi vận động. */
export const waterTarget = (weightKg: number, exerciseMinutes = 0): number =>
  Math.round((weightKg * 35 + (exerciseMinutes / 30) * 350) / 50) * 50;

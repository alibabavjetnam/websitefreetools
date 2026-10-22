/** Danh sách quốc gia với múi giờ IANA và các thành phố lớn, để hiển thị đồng hồ thế giới. */
export interface Zone { city: string; tz: string }
export interface Country { country: string; code: string; flag: string; zones: Zone[] }

export const COUNTRIES: Country[] = [
  { country: 'Việt Nam', code: 'VN', flag: '🇻🇳', zones: [{ city: 'Hà Nội / TP.HCM', tz: 'Asia/Ho_Chi_Minh' }] },
  { country: 'Thái Lan', code: 'TH', flag: '🇹🇭', zones: [{ city: 'Bangkok', tz: 'Asia/Bangkok' }] },
  { country: 'Singapore', code: 'SG', flag: '🇸🇬', zones: [{ city: 'Singapore', tz: 'Asia/Singapore' }] },
  { country: 'Nhật Bản', code: 'JP', flag: '🇯🇵', zones: [{ city: 'Tokyo', tz: 'Asia/Tokyo' }] },
  { country: 'Hàn Quốc', code: 'KR', flag: '🇰🇷', zones: [{ city: 'Seoul', tz: 'Asia/Seoul' }] },
  { country: 'Trung Quốc', code: 'CN', flag: '🇨🇳', zones: [{ city: 'Bắc Kinh / Thượng Hải', tz: 'Asia/Shanghai' }] },
  { country: 'Ấn Độ', code: 'IN', flag: '🇮🇳', zones: [{ city: 'New Delhi', tz: 'Asia/Kolkata' }] },
  { country: 'Indonesia', code: 'ID', flag: '🇮🇩', zones: [{ city: 'Jakarta', tz: 'Asia/Jakarta' }] },
  { country: 'Malaysia', code: 'MY', flag: '🇲🇾', zones: [{ city: 'Kuala Lumpur', tz: 'Asia/Kuala_Lumpur' }] },
  { country: 'Philippines', code: 'PH', flag: '🇵🇭', zones: [{ city: 'Manila', tz: 'Asia/Manila' }] },
  { country: 'UAE', code: 'AE', flag: '🇦🇪', zones: [{ city: 'Dubai', tz: 'Asia/Dubai' }] },
  { country: 'Nga', code: 'RU', flag: '🇷🇺', zones: [{ city: 'Moscow', tz: 'Europe/Moscow' }] },
  { country: 'Anh', code: 'GB', flag: '🇬🇧', zones: [{ city: 'London', tz: 'Europe/London' }] },
  { country: 'Pháp', code: 'FR', flag: '🇫🇷', zones: [{ city: 'Paris', tz: 'Europe/Paris' }] },
  { country: 'Đức', code: 'DE', flag: '🇩🇪', zones: [{ city: 'Berlin', tz: 'Europe/Berlin' }] },
  { country: 'Ý', code: 'IT', flag: '🇮🇹', zones: [{ city: 'Rome', tz: 'Europe/Rome' }] },
  { country: 'Tây Ban Nha', code: 'ES', flag: '🇪🇸', zones: [{ city: 'Madrid', tz: 'Europe/Madrid' }] },
  { country: 'Hà Lan', code: 'NL', flag: '🇳🇱', zones: [{ city: 'Amsterdam', tz: 'Europe/Amsterdam' }] },
  { country: 'Thổ Nhĩ Kỳ', code: 'TR', flag: '🇹🇷', zones: [{ city: 'Istanbul', tz: 'Europe/Istanbul' }] },
  { country: 'Hoa Kỳ', code: 'US', flag: '🇺🇸', zones: [
    { city: 'New York (ET)', tz: 'America/New_York' },
    { city: 'Chicago (CT)', tz: 'America/Chicago' },
    { city: 'Denver (MT)', tz: 'America/Denver' },
    { city: 'Los Angeles (PT)', tz: 'America/Los_Angeles' },
  ] },
  { country: 'Canada', code: 'CA', flag: '🇨🇦', zones: [{ city: 'Toronto', tz: 'America/Toronto' }, { city: 'Vancouver', tz: 'America/Vancouver' }] },
  { country: 'Brazil', code: 'BR', flag: '🇧🇷', zones: [{ city: 'São Paulo', tz: 'America/Sao_Paulo' }] },
  { country: 'Mexico', code: 'MX', flag: '🇲🇽', zones: [{ city: 'Mexico City', tz: 'America/Mexico_City' }] },
  { country: 'Úc', code: 'AU', flag: '🇦🇺', zones: [{ city: 'Sydney', tz: 'Australia/Sydney' }, { city: 'Perth', tz: 'Australia/Perth' }] },
  { country: 'New Zealand', code: 'NZ', flag: '🇳🇿', zones: [{ city: 'Auckland', tz: 'Pacific/Auckland' }] },
  { country: 'Nam Phi', code: 'ZA', flag: '🇿🇦', zones: [{ city: 'Johannesburg', tz: 'Africa/Johannesburg' }] },
  { country: 'Ai Cập', code: 'EG', flag: '🇪🇬', zones: [{ city: 'Cairo', tz: 'Africa/Cairo' }] },
];

/** Độ lệch của một múi giờ so với UTC tại thời điểm `at`, tính bằng phút (dương = sớm hơn UTC). */
export function tzOffsetMinutes(tz: string, at = new Date()): number {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(at)) map[p.type] = p.value;
  const asUtc = Date.UTC(+map.year, +map.month - 1, +map.day, +map.hour === 24 ? 0 : +map.hour, +map.minute, +map.second);
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

/** Chênh lệch giờ giữa hai múi (giờ, có thể lẻ 0.5): tz so với tzBase. */
export function offsetHours(tz: string, at = new Date(), tzBase = 'Asia/Ho_Chi_Minh'): number {
  return Math.round(((tzOffsetMinutes(tz, at) - tzOffsetMinutes(tzBase, at)) / 60) * 2) / 2;
}

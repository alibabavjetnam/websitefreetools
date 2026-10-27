/** Bảng đơn vị đo: hệ số quy về đơn vị gốc của từng loại. Nhiệt độ dùng hàm riêng. */

export interface Unit {
  id: string;
  symbol: string;
  /** Giá trị 1 đơn vị này tính theo đơn vị gốc */
  f?: number;
  /** Đổi sang / từ đơn vị gốc (chỉ cho nhiệt độ, tiêu hao nhiên liệu) */
  to?: (x: number) => number;
  from?: (x: number) => number;
}
export interface Category { id: string; units: Unit[]; defFrom: string; defTo: string }

const IN = 0.0254, FT = 0.3048, YD = 0.9144, MI = 1609.344, LB = 0.45359237, GAL = 3.785411784, FLOZ = 0.0295735295625;

export const CATEGORIES: Category[] = [
  { id: 'length', defFrom: 'cm', defTo: 'in', units: [
    { id: 'mm', symbol: 'mm', f: 0.001 }, { id: 'cm', symbol: 'cm', f: 0.01 }, { id: 'm', symbol: 'm', f: 1 }, { id: 'km', symbol: 'km', f: 1000 },
    { id: 'in', symbol: 'in', f: IN }, { id: 'ft', symbol: 'ft', f: FT }, { id: 'yd', symbol: 'yd', f: YD }, { id: 'mi', symbol: 'mi', f: MI },
    { id: 'nmi', symbol: 'nmi', f: 1852 }, { id: 'um', symbol: 'µm', f: 1e-6 }, { id: 'nm', symbol: 'nm', f: 1e-9 }, { id: 'ly', symbol: 'ly', f: 9.4607304725808e15 },
  ] },
  { id: 'weight', defFrom: 'kg', defTo: 'lb', units: [
    { id: 'mg', symbol: 'mg', f: 1e-6 }, { id: 'g', symbol: 'g', f: 0.001 }, { id: 'kg', symbol: 'kg', f: 1 }, { id: 't', symbol: 't', f: 1000 },
    { id: 'oz', symbol: 'oz', f: LB / 16 }, { id: 'lb', symbol: 'lb', f: LB }, { id: 'st', symbol: 'st', f: LB * 14 },
    { id: 'ust', symbol: 'US ton', f: LB * 2000 }, { id: 'ct', symbol: 'ct', f: 0.0002 }, { id: 'luong', symbol: 'lượng', f: 0.0375 },
  ] },
  { id: 'temp', defFrom: 'c', defTo: 'f', units: [
    { id: 'c', symbol: '°C', to: (x) => x, from: (x) => x },
    { id: 'f', symbol: '°F', to: (x) => ((x - 32) * 5) / 9, from: (x) => (x * 9) / 5 + 32 },
    { id: 'k', symbol: 'K', to: (x) => x - 273.15, from: (x) => x + 273.15 },
    { id: 'r', symbol: '°R', to: (x) => ((x - 491.67) * 5) / 9, from: (x) => ((x + 273.15) * 9) / 5 },
  ] },
  { id: 'area', defFrom: 'm2', defTo: 'ft2', units: [
    { id: 'mm2', symbol: 'mm²', f: 1e-6 }, { id: 'cm2', symbol: 'cm²', f: 1e-4 }, { id: 'm2', symbol: 'm²', f: 1 }, { id: 'ha', symbol: 'ha', f: 1e4 }, { id: 'km2', symbol: 'km²', f: 1e6 },
    { id: 'in2', symbol: 'in²', f: IN * IN }, { id: 'ft2', symbol: 'ft²', f: FT * FT }, { id: 'yd2', symbol: 'yd²', f: YD * YD }, { id: 'ac', symbol: 'ac', f: 4046.8564224 }, { id: 'mi2', symbol: 'mi²', f: MI * MI },
    { id: 'sao', symbol: 'sào', f: 360 }, { id: 'mau', symbol: 'mẫu', f: 3600 },
  ] },
  { id: 'volume', defFrom: 'l', defTo: 'gal', units: [
    { id: 'ml', symbol: 'ml', f: 0.001 }, { id: 'l', symbol: 'l', f: 1 }, { id: 'm3', symbol: 'm³', f: 1000 }, { id: 'cm3', symbol: 'cm³', f: 0.001 },
    { id: 'tsp', symbol: 'tsp', f: FLOZ / 6 }, { id: 'tbsp', symbol: 'tbsp', f: FLOZ / 2 }, { id: 'floz', symbol: 'fl oz', f: FLOZ }, { id: 'cup', symbol: 'cup', f: FLOZ * 8 },
    { id: 'pt', symbol: 'pt', f: FLOZ * 16 }, { id: 'qt', symbol: 'qt', f: FLOZ * 32 }, { id: 'gal', symbol: 'gal', f: GAL },
    { id: 'ukgal', symbol: 'UK gal', f: 4.54609 }, { id: 'in3', symbol: 'in³', f: 0.016387064 }, { id: 'ft3', symbol: 'ft³', f: 28.316846592 }, { id: 'bbl', symbol: 'bbl', f: 158.987294928 },
  ] },
  { id: 'speed', defFrom: 'kmh', defTo: 'mph', units: [
    { id: 'ms', symbol: 'm/s', f: 1 }, { id: 'kmh', symbol: 'km/h', f: 1 / 3.6 }, { id: 'mph', symbol: 'mph', f: MI / 3600 }, { id: 'kn', symbol: 'kn', f: 1852 / 3600 },
    { id: 'fts', symbol: 'ft/s', f: FT }, { id: 'mach', symbol: 'Mach', f: 340.29 }, { id: 'c', symbol: 'c', f: 299792458 },
  ] },
  { id: 'time', defFrom: 'h', defTo: 'min', units: [
    { id: 'ms', symbol: 'ms', f: 0.001 }, { id: 's', symbol: 's', f: 1 }, { id: 'min', symbol: 'min', f: 60 }, { id: 'h', symbol: 'h', f: 3600 },
    { id: 'd', symbol: 'd', f: 86400 }, { id: 'wk', symbol: 'wk', f: 604800 }, { id: 'mo', symbol: 'mo', f: 2629746 }, { id: 'yr', symbol: 'yr', f: 31556952 },
  ] },
  { id: 'data', defFrom: 'mb', defTo: 'gb', units: [
    { id: 'bit', symbol: 'bit', f: 0.125 }, { id: 'b', symbol: 'B', f: 1 }, { id: 'kb', symbol: 'KB', f: 1e3 }, { id: 'mb', symbol: 'MB', f: 1e6 }, { id: 'gb', symbol: 'GB', f: 1e9 }, { id: 'tb', symbol: 'TB', f: 1e12 },
    { id: 'kib', symbol: 'KiB', f: 1024 }, { id: 'mib', symbol: 'MiB', f: 1024 ** 2 }, { id: 'gib', symbol: 'GiB', f: 1024 ** 3 }, { id: 'tib', symbol: 'TiB', f: 1024 ** 4 },
  ] },
  { id: 'pressure', defFrom: 'bar', defTo: 'psi', units: [
    { id: 'pa', symbol: 'Pa', f: 1 }, { id: 'kpa', symbol: 'kPa', f: 1000 }, { id: 'mpa', symbol: 'MPa', f: 1e6 }, { id: 'bar', symbol: 'bar', f: 1e5 },
    { id: 'psi', symbol: 'psi', f: 6894.757293168 }, { id: 'atm', symbol: 'atm', f: 101325 }, { id: 'mmhg', symbol: 'mmHg', f: 133.322387415 },
  ] },
  { id: 'energy', defFrom: 'kcal', defTo: 'kj', units: [
    { id: 'j', symbol: 'J', f: 1 }, { id: 'kj', symbol: 'kJ', f: 1000 }, { id: 'cal', symbol: 'cal', f: 4.184 }, { id: 'kcal', symbol: 'kcal', f: 4184 },
    { id: 'wh', symbol: 'Wh', f: 3600 }, { id: 'kwh', symbol: 'kWh', f: 3.6e6 }, { id: 'btu', symbol: 'BTU', f: 1055.05585262 }, { id: 'ev', symbol: 'eV', f: 1.602176634e-19 },
  ] },
  { id: 'power', defFrom: 'kw', defTo: 'hp', units: [
    { id: 'w', symbol: 'W', f: 1 }, { id: 'kw', symbol: 'kW', f: 1000 }, { id: 'hp', symbol: 'hp', f: 745.69987158 }, { id: 'ps', symbol: 'PS', f: 735.49875 }, { id: 'btuh', symbol: 'BTU/h', f: 0.29307107 },
  ] },
  { id: 'fuel', defFrom: 'l100', defTo: 'mpg', units: [
    // gốc: km/l
    { id: 'kml', symbol: 'km/l', to: (x) => x, from: (x) => x },
    { id: 'l100', symbol: 'l/100 km', to: (x) => 100 / x, from: (x) => 100 / x },
    { id: 'mpg', symbol: 'mpg (US)', to: (x) => (x * MI) / 1000 / GAL, from: (x) => (x * 1000 * GAL) / MI },
    { id: 'mpguk', symbol: 'mpg (UK)', to: (x) => (x * MI) / 1000 / 4.54609, from: (x) => (x * 1000 * 4.54609) / MI },
  ] },
  { id: 'angle', defFrom: 'deg', defTo: 'rad', units: [
    { id: 'deg', symbol: '°', f: Math.PI / 180 }, { id: 'rad', symbol: 'rad', f: 1 }, { id: 'grad', symbol: 'grad', f: Math.PI / 200 },
    { id: 'arcmin', symbol: '′', f: Math.PI / 10800 }, { id: 'arcsec', symbol: '″', f: Math.PI / 648000 }, { id: 'turn', symbol: 'turn', f: 2 * Math.PI },
  ] },
];

export function convert(cat: Category, value: number, from: string, to: string): number {
  const u1 = cat.units.find((u) => u.id === from) as Unit;
  const u2 = cat.units.find((u) => u.id === to) as Unit;
  const base = u1.to ? u1.to(value) : value * (u1.f as number);
  return u2.from ? u2.from(base) : base / (u2.f as number);
}

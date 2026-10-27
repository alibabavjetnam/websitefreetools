/** Quy đổi điểm và tính GPA theo tín chỉ. Hàm thuần. */

/** Điểm chữ kiểu Mỹ (phổ biến nhất) → điểm hệ 4 */
export const LETTER_POINTS: [string, number][] = [
  ['A+', 4.0], ['A', 4.0], ['A-', 3.7], ['B+', 3.3], ['B', 3.0], ['B-', 2.7], ['C+', 2.3], ['C', 2.0], ['C-', 1.7], ['D+', 1.3], ['D', 1.0], ['D-', 0.7], ['F', 0],
];

/** Thang 10 Việt Nam (quy chế đào tạo tín chỉ) → điểm chữ và hệ 4 */
export function vn10(score: number): { letter: string; p4: number } {
  if (score >= 8.5) return { letter: 'A', p4: 4.0 };
  if (score >= 8.0) return { letter: 'B+', p4: 3.5 };
  if (score >= 7.0) return { letter: 'B', p4: 3.0 };
  if (score >= 6.5) return { letter: 'C+', p4: 2.5 };
  if (score >= 5.5) return { letter: 'C', p4: 2.0 };
  if (score >= 5.0) return { letter: 'D+', p4: 1.5 };
  if (score >= 4.0) return { letter: 'D', p4: 1.0 };
  return { letter: 'F', p4: 0 };
}

/** Phần trăm (thang 100 kiểu Mỹ) → điểm chữ và hệ 4 */
export function pct100(score: number): { letter: string; p4: number } {
  const cuts: [number, string][] = [[97, 'A+'], [93, 'A'], [90, 'A-'], [87, 'B+'], [83, 'B'], [80, 'B-'], [77, 'C+'], [73, 'C'], [70, 'C-'], [67, 'D+'], [63, 'D'], [60, 'D-'], [-Infinity, 'F']];
  const letter = (cuts.find(([c]) => score >= c) as [number, string])[1];
  return { letter, p4: (LETTER_POINTS.find(([l]) => l === letter) as [string, number])[1] };
}

export interface Course { credits: number; p4: number; counts: boolean }

/** GPA có trọng số tín chỉ; bỏ qua môn không tính điểm */
export function gpa(courses: Course[]): { gpa: number; credits: number; points: number } {
  let credits = 0;
  let points = 0;
  for (const c of courses) {
    if (!c.counts || !(c.credits > 0) || !Number.isFinite(c.p4)) continue;
    credits += c.credits;
    points += c.credits * c.p4;
  }
  return { gpa: credits ? points / credits : NaN, credits, points };
}

/** Xếp loại tốt nghiệp theo hệ 4 (quy chế đại học Việt Nam) */
export function vnRank(g: number): 'excellent' | 'veryGood' | 'good' | 'average' | 'weak' {
  if (g >= 3.6) return 'excellent';
  if (g >= 3.2) return 'veryGood';
  if (g >= 2.5) return 'good';
  if (g >= 2.0) return 'average';
  return 'weak';
}

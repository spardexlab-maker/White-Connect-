/** Home sample collection («تحليل منزلي»): wording shared by the patient app and the lab. */
export type HomeLabStatus = 'requested' | 'scheduled' | 'on_the_way' | 'collected' | 'rejected' | 'cancelled';

export const homeLabStatus: Record<HomeLabStatus, { label: string; tone: 'neutral' | 'info' | 'accent' | 'warning' | 'success' | 'danger'; patient: string }> = {
  requested: { label: 'طلب جديد', tone: 'warning', patient: 'وصل طلبك للمختبر — بانتظار تحديد الموعد' },
  scheduled: { label: 'مجدول', tone: 'info', patient: 'حُدّد موعد الزيارة' },
  on_the_way: { label: 'بالطريق', tone: 'accent', patient: 'المختص بالطريق إليك' },
  collected: { label: 'سُحبت العينة', tone: 'success', patient: 'سُحبت العينة — النتيجة تظهر هنا حال جهوزها' },
  rejected: { label: 'مرفوض', tone: 'danger', patient: 'اعتذر المختبر عن الطلب' },
  cancelled: { label: 'ملغى', tone: 'neutral', patient: 'ألغيت الطلب' },
};

export const homeLabWindows = [
  { id: 'morning', label: 'صباحاً (8–12)' },
  { id: 'noon', label: 'ظهراً (12–4)' },
  { id: 'evening', label: 'مساءً (4–8)' },
] as const;
export type HomeLabWindow = (typeof homeLabWindows)[number]['id'];
export const homeLabWindowLabel = (w: string) => homeLabWindows.find((x) => x.id === w)?.label ?? w;

/** The patient's progress line: the steps in order, and how far the request got. */
export const homeLabSteps: HomeLabStatus[] = ['requested', 'scheduled', 'on_the_way', 'collected'];
export function homeLabStep(status: string): number {
  if (status === 'collected') return homeLabSteps.length;   // every step done
  const i = homeLabSteps.indexOf(status as HomeLabStatus);
  return i < 0 ? -1 : i;
}

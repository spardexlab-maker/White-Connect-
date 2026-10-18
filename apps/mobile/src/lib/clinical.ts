export interface RxItem {
  line_no: number; display_name: string; dose: number | null; dose_unit: string | null; route: string | null;
  frequency_text: string | null; interval_hours: number | null; duration_days: number | null; start_date: string | null;
  quantity: number | null; quantity_unit: string | null; instructions: string | null; as_needed: boolean; max_daily: string | null;
}
export interface RxDoc {
  rx_number: string; version_no: number; approved_at?: string;
  practitioner: { full_name: string; title: string | null; license_number: string | null };
  facility: { name: string; branch: string; address: string | null; phone: string | null };
  patient: { full_name: string; public_code: string; sex: 'male' | 'female' | null; birth_year: number | null };
  items: RxItem[];
  status?: string; verify_token?: string | null;
}

/** Written exactly as the doctor entered it — nothing is computed or interpreted. */
export function itemLine(i: RxItem): string {
  return [
    i.dose != null ? `${Number(i.dose)} ${i.dose_unit ?? ''}`.trim() : null,
    i.route, i.frequency_text,
    i.interval_hours ? `كل ${i.interval_hours} ساعة` : null,
    i.duration_days ? `لمدة ${i.duration_days} يوم` : null,
    i.as_needed ? 'عند اللزوم' : null,
    i.max_daily ? `الحد الأقصى: ${i.max_daily}` : null,
  ].filter(Boolean).join(' · ');
}

export interface LabResult {
  id: string; version_no: number; status: 'draft' | 'released' | 'superseded'; value_text: string | null; value_numeric: number | null;
  unit: string | null; reference_range: string | null; lab_flag: string | null; notes: string | null; released_at: string | null;
  correction_reason: string | null;
}
export interface LabDetail {
  order: { id: string; order_number: string; status: string; created_at: string };
  lab: string; patient: { full_name: string; public_code: string };
  ordering_doctor: string | null;
  items: { id: string; name: string; status: string; released_at: string | null; catalog: { unit: string | null; reference_range_text: string | null };
           results: LabResult[] }[];
}

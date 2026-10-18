import { z } from 'zod';

const trimmed = z.string().trim();

/** Reception "name only" booking: the NAME is the only required field (§4). */
export const quickBookingSchema = z.object({
  fullName: trimmed.min(1, 'الاسم مطلوب').max(200, 'الاسم طويل جداً'),
  phone: trimmed.regex(/^[+0-9 ()-]{6,20}$/, 'رقم الهاتف غير صحيح').optional().or(z.literal('')),
  sex: z.enum(['female', 'male']).optional(),
  birthYear: z.coerce.number().int().min(1900).max(new Date().getFullYear()).optional(),
});

export const patientRegistrationSchema = z.object({
  fullName: trimmed.min(2, 'اكتب الاسم الكامل').max(200),
  sex: z.enum(['female', 'male']).optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  phone: trimmed.regex(/^[+0-9 ()-]{6,20}$/, 'رقم الهاتف غير صحيح').optional().or(z.literal('')),
});

export const reasonSchema = trimmed.min(5, 'اكتب سبباً واضحاً (5 أحرف على الأقل)').max(500);

export function fieldErrors(result: z.SafeParseReturnType<unknown, unknown>): Record<string, string> {
  if (result.success) return {};
  const out: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const k = issue.path.join('.');
    if (!out[k]) out[k] = issue.message;
  }
  return out;
}

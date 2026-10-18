# التشغيل والنشر

## البيئات
| البيئة | قاعدة البيانات | الواجهة |
|---|---|---|
| تطوير محلي | `supabase start` (Docker) + `supabase/seed.sql` الاصطناعي | `pnpm dev` |
| السحابة (المشروع `utuwjykgubsqqescpiwz`) | يُطبق عليه `supabase/migrations` فقط — **لا يُشغل seed على بيئة فيها بيانات حقيقية** | استضافة frontend منفصلة (Vercel/Netlify/Cloudflare Pages) |

## تطبيق المخطط على المشروع السحابي
يتطلب مصادقة صاحب الحساب (لم تتم في هذه الجلسة):
```bash
supabase login                      # تفاعلي في المتصفح
supabase link --project-ref utuwjykgubsqqescpiwz
supabase db push                    # يطبق migrations بالتسلسل دون حذف بيانات
supabase gen types typescript --linked > packages/shared/src/database.types.ts
supabase functions deploy notifications-worker --no-verify-jwt
```
أو عبر Claude Code MCP بعد `claude /mcp` → supabase → Authenticate (`.mcp.json` جاهز ومقيد بالمشروع).

بعد التطبيق: فعّل `pg_cron` و`pg_net` من لوحة Extensions إن لم يُفعّلا، وشغّل security/performance advisors.

## الأسرار (Edge Functions → Secrets في اللوحة فقط)
| الاسم | الاستخدام |
|---|---|
| `WORKER_SHARED_SECRET` | سر عشوائي يرسله pg_cron للعامل |
| `APP_SUPABASE_SECRET_KEY` | اختياري؛ وإلا يستخدم العامل `SUPABASE_SERVICE_ROLE_KEY` المحقون تلقائياً |
| `PUSH_PROVIDER` / `SMS_PROVIDER` | فارغ = غير مهيأ (يُسجل الفشل بصدق). `mock` يعمل فقط مع `APP_ENV=development` |

المفتاح السري الذي شورك في المحادثة يجب **تدويره** قبل الإنتاج.

## جدولة العامل (بعد ضبط السر)
```sql
-- مرة واحدة من SQL editor، مع استبدال القيم:
select vault.create_secret('<WORKER_SHARED_SECRET>', 'worker_secret');
select cron.schedule('notifications-worker', '* * * * *', $$
  select net.http_post(
    url := 'https://utuwjykgubsqqescpiwz.supabase.co/functions/v1/notifications-worker',
    headers := jsonb_build_object('x-worker-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'worker_secret'))
  );
$$);
```
`expire-pending-appointments` يُجدول تلقائياً بالـmigration 0009 عند توفر pg_cron (وانتهاء المهلة يحدث أيضاً كسولاً داخل مسار الحجز).

## أول مشرف منصة
بعد إنشاء حسابه عبر Auth:
```sql
select private.bootstrap_platform_admin('admin@example.com');
```
ثم فعّل MFA (TOTP) لحسابه؛ `platform_settings.require_admin_mfa = true` افتراضياً.

## النسخ الاحتياطي والاستعادة (قرار مطلوب من المشغل)
* خطة Supabase تحدد النسخ اليومي/PITR. يجب الاتفاق على RPO/RTO وتجربة استعادة فعلية قبل أي بيانات حقيقية — **لم تُختبر بعد**.
* مكان الاستضافة، سياسة الاحتفاظ، الموافقات، واعتماد الوصفات قانونياً يجب حسمها وفق السوق المستهدف قبل الإطلاق.

## المراقبة
* العامل يسجل أعداداً ومعرفات فقط (لا محتوى صحي). صفوف `dead` في `notification_outbox` تظهر لمشرف المنصة ويمكن إعادة محاولتها (`admin_retry_dead_notification`).
* `access_audit` يسجل البحث عن المرضى، الدمج، تغيير الحالات، الدعوات، العضويات.

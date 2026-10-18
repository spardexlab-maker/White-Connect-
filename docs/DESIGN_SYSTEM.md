# نظام التصميم

المصدر الوحيد للقيم: `packages/shared/src/tokens.ts` ↔ `apps/web/src/styles/tokens.css`. صفحة الأمثلة الحية: `/dev/components` (لقطة: `screenshots/14-component-gallery-1440.png`).

## الهوية
اسم المنتج placeholder (`VITE_PRODUCT_NAME`، الافتراضي «منصة الرعاية»). أزرق طبي داكن + تركواز + رمادي فاتح. بلا تدرجات أو زجاجيات أو كروت أرقام عملاقة.

## الألوان (التباين مُتحقق آلياً ≥ 4.5:1 — `pnpm --filter @app/shared test`)
| الرمز | القيمة | الاستخدام |
|---|---|---|
| primary | `#123B5D` | الأزرار الأساسية، الشريط الجانبي |
| primary-hover | `#0B2A43` | |
| accent | `#0F766E` | التأكيد، التحديد، الوقت المختار |
| accent-soft | `#E6F4F1` | خلفية العناصر المحددة |
| canvas / surface | `#F5F7FA` / `#FFFFFF` | |
| text / muted | `#152536` / `#526171` | |
| border / border-strong | `#DCE3EB` / `#B8C4D1` | |
| success / warning-text / danger / information | `#166534` / `#92400E` / `#B91C1C` / `#1D4ED8` | مع خلفيات باهتة لكل منها |

الحالة دائماً **نص + أيقونة** (`AppointmentStatusBadge`, `QueueStatusBadge`) — لا لون فقط.

## الطباعة
IBM Plex Sans Arabic (OFL، مستضاف ذاتياً) مع fallback `Noto Sans Arabic, Segoe UI, Tahoma`. متن 15/16px، تسميات 13–14px، عناوين 20/24/32px، تباعد أسطر 1.7 للمتن.

## المسافات والأشكال
شبكة 4/8px (`--s-1..--s-12`)، حواف 8/10/14px، حدود خفيفة وظل واحد خفيف للعناصر العائمة فقط. منطقة لمس 44px للأفعال الأساسية.

## الحركة
120–200ms؛ تُلغى مع `prefers-reduced-motion`.

## المكونات (`apps/web/src/components/ui.tsx`)
Button (primary/accent/secondary/ghost/danger، loading، disabled)، TextField/SelectField/TextareaField (تسمية ثابتة، تلميح، خطأ بجانب الحقل مع `aria-describedby`)، Badge وحالات المواعيد/الطابور، Alert، EmptyState، ErrorState (مع إعادة المحاولة)، PermissionDenied، Skeleton/SkeletonList، OfflineBanner، Tabs (أسهم الكيبورد مع RTL)، Sheet ولوحة جانبية وConfirmDialog (focus trap + Esc)، Toast (aria-live مهذب)، Ltr (عزل الأرقام والمعرفات)، Avatar، PageHead.

## RTL
خصائص CSS منطقية (`inline-start/end`, `block-start/end`) في كل الأنماط. الهواتف والمعرفات والبريد وأكواد الحجز معزولة LTR بـ `<bdi dir="ltr">`. الشريط الجانبي المهني على اليمين. الأيقونات الاتجاهية فقط (أسهم التنقل) معكوسة يدوياً.

## الأنماط
* **المريض**: Mobile-first، تنقل سفلي بخمسة عناصر (يصبح علوياً ≥1024px)، زر حجز ثابت أسفل صفحة الطبيب لا يغطي المحتوى.
* **المهني**: شريط جانبي + شريط علوي فيه مبدل مساحة العمل (اسم الجهة، الدور، الفرع) والتاريخ والخروج. الجداول قابلة للتمرير داخل منطقة معنونة؛ اللوحات الجانبية تصبح ملء الشاشة على الهاتف.
* لا optimistic success: الأزرار تعرض «جارٍ الحفظ…» وتتعطل حتى رد الخادم، مع idempotency key.

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FileText, ShieldCheck, Trash2 } from 'lucide-react';
import { Alert } from '../../components/ui';

/** Who runs the platform. Values in [brackets] are still to be filled in by the owner (Spardex Lab). */
export const COMPANY = {
  brand: 'Spardex Lab',
  legalName: '[الاسم القانوني لشركة Spardex Lab]',
  registration: '[رقم تسجيل الشركة]',
  address: '[عنوان الشركة — المدينة، العراق]',
  email: '[بريد الخصوصية والدعم]',
  phone: '[رقم الدعم]',
  website: 'https://spardexlab.site',
};
const UPDATED = '25 تشرين الأول 2026';
const pending = Object.values(COMPANY).some((v) => v.startsWith('['));

/** Shows a company detail; one still to be filled in is highlighted so it is not missed. */
function C({ k }: { k: keyof typeof COMPANY }) {
  const v = COMPANY[k];
  return v.startsWith('[') ? <mark>{v}</mark> : <bdi>{v}</bdi>;
}

function LegalPage({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <main className="legal container stack" dir="rtl">
      <Link to="/patient" className="small row" style={{ gap: 6 }}><ArrowRight size={16} aria-hidden />الرجوع للمنصة</Link>
      <header className="stack-sm">
        <h1 className="row" style={{ fontSize: 'var(--f-h2)', gap: 10 }}>{icon}{title}</h1>
        <p className="small muted">آخر تحديث: {UPDATED} · تديرها <C k="brand" /></p>
      </header>
      {pending && <Alert tone="warning">بعض بيانات الشركة قيد الإكمال وتظهر بين قوسين.</Alert>}
      <article className="card stack legal-body">{children}</article>
      <nav className="small muted"><Link to="/privacy">سياسة الخصوصية</Link> · <Link to="/terms">شروط الاستخدام</Link> · <Link to="/account-deletion">حذف الحساب</Link></nav>
    </main>
  );
}

function Contact() {
  return (
    <ul>
      <li>الشركة: <C k="legalName" /> (<C k="brand" />)، رقم التسجيل: <C k="registration" /></li>
      <li>العنوان: <C k="address" /></li>
      <li>البريد: <C k="email" /> · الهاتف: <C k="phone" /></li>
      <li>الموقع: <C k="website" /></li>
    </ul>
  );
}

export function PrivacyPage() {
  return (
    <LegalPage title="سياسة الخصوصية" icon={<ShieldCheck size={26} aria-hidden />}>
      <section><h2>من نحن</h2>
        <p>هذه المنصة تربط المرضى بالأطباء والمختبرات والصيدليات في العراق: البحث والحجز، والوصفات، ونتائج التحاليل، وتذكير الأدوية. تديرها <C k="brand" />، وهي المسؤولة عن بياناتك على المنصة.</p>
      </section>
      <section><h2>البيانات اللي نجمعها</h2>
        <ul>
          <li><b>حسابك:</b> رقم الموبايل أو البريد الإلكتروني أو حساب Google اللي تدخل بيه.</li>
          <li><b>بياناتك الشخصية:</b> الاسم، تاريخ الميلاد، الجنس، والمحافظة.</li>
          <li><b>بياناتك الصحية:</b> الحجوزات، الزيارات، التشخيص، الوصفات، نتائج التحاليل، والملف الصحي (الأمراض، الأدوية، الحساسية) — يدخلها الطبيب أو المختبر أو الصيدلية اللي يعالجوك، أو أنت بنفسك.</li>
          <li><b>الموقع:</b> فقط إذا سمحت، حتى نرتب لك الأطباء والمختبرات الأقرب. ما نحفظ موقعك.</li>
          <li><b>الإشعارات:</b> رمز جهازك حتى نوصلك التذكيرات وتنبيهات الدور.</li>
          <li><b>المساعد الذكي:</b> النص اللي تكتبه يُرسل لمزود ذكاء اصطناعي حتى يقترح الاختصاص المناسب، وما نحفظ النص (نحفظ عدد الاستخدامات فقط).</li>
        </ul>
      </section>
      <section><h2>ليش نستعملها</h2>
        <p>حتى نشغّل الخدمة: نسجل دخولك، نحجز موعدك، نوصل وصفتك ونتائجك للجهة الصحيحة، ونذكّرك بأدويتك. ما نستعمل بياناتك الصحية للإعلانات، وما نبيعها لأي أحد.</p>
      </section>
      <section><h2>منو يشوف بياناتك</h2>
        <ul>
          <li><b>الجهات اللي تعالجك فقط</b> (الطبيب، المختبر، الصيدلية) وبحدود علاقة العلاج — كل وصول يُسجَّل.</li>
          <li><b>مزودو خدمة يشغّلون المنصة نيابة عنا:</b> استضافة قاعدة البيانات (Supabase)، استضافة الموقع (Cloudflare)، إرسال رمز التحقق على واتساب (OTPIQ)، والمساعد الذكي (Google Gemini). يستعملون البيانات فقط لتقديم هذي الخدمة.</li>
          <li><b>الجهات الرسمية</b> إذا طلبها القانون العراقي.</li>
        </ul>
      </section>
      <section><h2>حماية البيانات</h2>
        <p>الاتصال مشفّر، وكل جهة ما تشوف إلا مرضاها، وحسابات الموظفين محمية بالتحقق بخطوتين، وكل اطلاع على سجل طبي يُسجَّل في سجل تدقيق.</p>
      </section>
      <section><h2>الاحتفاظ والحذف</h2>
        <p>تكدر تحذف حسابك من التطبيق نفسه (حسابي ← حذف الحساب). عند الحذف نزيل طرق دخولك واسمك من الحساب، ونوقف التذكيرات والإشعارات، ونلغي حجوزاتك القادمة. السجل الطبي (الزيارات والوصفات والتحاليل) يبقى محفوظاً عند الجهات اللي عالجتك المدة اللي يفرضها القانون، بدون ارتباط بأي حساب. <Link to="/account-deletion">التفاصيل</Link>.</p>
      </section>
      <section><h2>حقوقك</h2>
        <p>تكدر تطّلع على بياناتك وتعدّل ملفك الصحي من التطبيق، وتطلب تصحيح أي معلومة طبية من الجهة اللي سجلتها، وتحذف حسابك متى ما تريد. لأي طلب تواصل ويانا على <C k="email" />.</p>
      </section>
      <section><h2>الأطفال</h2>
        <p>حساب الطفل يديره ولي أمره، وولي الأمر مسؤول عن البيانات اللي يدخلها.</p>
      </section>
      <section><h2>تغييرات السياسة</h2>
        <p>إذا غيّرنا هذي السياسة نحدّث التاريخ أعلاه، ونبلغك داخل التطبيق إذا كان التغيير مهم.</p>
      </section>
      <section><h2>تواصل ويانا</h2><Contact /></section>
    </LegalPage>
  );
}

export function TermsPage() {
  return (
    <LegalPage title="شروط الاستخدام" icon={<FileText size={26} aria-hidden />}>
      <section><h2>القبول</h2>
        <p>باستخدامك المنصة توافق على هذي الشروط وعلى <Link to="/privacy">سياسة الخصوصية</Link>. إذا ما توافق، لا تستخدم المنصة.</p>
      </section>
      <section><h2>طبيعة الخدمة</h2>
        <ul>
          <li>المنصة وسيلة للبحث والحجز وتنظيم سجلك الطبي، وما تقدّم علاجاً بنفسها. الخدمات الطبية يقدمها الأطباء والمختبرات والصيدليات، وكل جهة مسؤولة عن خدمتها.</li>
          <li>المساعد الذكي يقترح الاختصاص المناسب فقط؛ <b>ما يشخّص، وما يصف أدوية، وما يغيّر جرعات</b>، وما يغني عن مراجعة الطبيب.</li>
          <li><b>في الحالات الطارئة</b> لا تعتمد على المنصة: اتصل بالإسعاف أو روح لأقرب طوارئ فوراً.</li>
        </ul>
      </section>
      <section><h2>حسابك</h2>
        <p>تكون مسؤول عن صحة المعلومات اللي تدخلها وعن حماية رقمك وحسابك. لا تسجّل باسم شخص ثاني إلا إذا كنت ولي أمره.</p>
      </section>
      <section><h2>الحجوزات</h2>
        <p>بعض الجهات تؤكد الحجز قبل اعتماده. الأوقات والأسعار تحددها الجهة نفسها. إذا ما تكدر تحضر، ألغِ الحجز من التطبيق حتى يستفاد منه غيرك؛ تكرار عدم الحضور قد يحد من الحجز.</p>
      </section>
      <section><h2>الاستخدام المقبول</h2>
        <p>ممنوع إساءة استخدام المنصة: انتحال شخصية، إدخال معلومات كاذبة، محاولة الوصول لبيانات غيرك، أو تعطيل الخدمة. نكدر نوقف أي حساب يخالف هذا.</p>
      </section>
      <section><h2>حدود المسؤولية</h2>
        <p>نبذل جهدنا حتى تكون المنصة متاحة ودقيقة، لكن ما نضمن عدم انقطاعها. <C k="brand" /> غير مسؤولة عن القرارات الطبية أو جودة الخدمة اللي تقدمها الجهات الصحية، وفي حدود ما يسمح به القانون.</p>
      </section>
      <section><h2>إنهاء الحساب</h2>
        <p>تكدر تحذف حسابك بأي وقت من «حسابي». <Link to="/account-deletion">شنو يصير ببياناتك</Link>.</p>
      </section>
      <section><h2>القانون المطبّق</h2>
        <p>تخضع هذي الشروط لقوانين جمهورية العراق، وتختص بالنزاعات محاكم <C k="address" />.</p>
      </section>
      <section><h2>تواصل ويانا</h2><Contact /></section>
    </LegalPage>
  );
}

/** Public page about deleting an account (Google Play asks for a web link to it). */
export function AccountDeletionPage() {
  return (
    <LegalPage title="حذف الحساب" icon={<Trash2 size={26} aria-hidden />}>
      <section><h2>كيف تحذف حسابك</h2>
        <ol>
          <li>افتح التطبيق أو الموقع وسجّل دخولك.</li>
          <li>روح إلى <b>حسابي</b> ← <b>حذف الحساب</b> ← <b>احذف حسابي</b>.</li>
          <li>اكتب «حذف» للتأكيد. يُحذف الحساب فوراً.</li>
        </ol>
        <p><Link to="/patient/account" className="btn btn-secondary btn-sm">الذهاب إلى حسابي</Link></p>
        <p>ما تكدر تدخل؟ راسلنا من رقمك أو بريدك المسجّل على <C k="email" /> ونحذفه خلال 30 يوماً.</p>
      </section>
      <section><h2>شنو يُحذف</h2>
        <ul>
          <li>طرق الدخول: رقم الموبايل، البريد الإلكتروني، وربط Google.</li>
          <li>اسمك على الحساب، وأجهزة الإشعارات، والإشعارات، وتذكيرات الأدوية.</li>
          <li>حجوزاتك القادمة تُلغى.</li>
        </ul>
      </section>
      <section><h2>شنو يبقى ولماذا</h2>
        <p>السجل الطبي (الزيارات، التشخيص، الوصفات، نتائج التحاليل) يبقى محفوظاً عند الجهات الصحية اللي عالجتك، لأن القانون يلزمها بالاحتفاظ به، ويبقى سجل التدقيق لأغراض الأمان. هذا السجل ما يرتبط بعد الحذف بأي حساب. إذا سجّلت من جديد بنفس الرقم يكون حساباً جديداً فارغاً.</p>
      </section>
    </LegalPage>
  );
}

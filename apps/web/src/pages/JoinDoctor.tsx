import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, MapPin, Plus, Printer, Stethoscope, Trash2 } from 'lucide-react';
import { errorMessage } from '@app/shared';
import { productName, supabase } from '../lib/supabase';
import { unwrap, useAsync } from '../lib/useAsync';
import { Alert, Button, SelectField, TextField, TextareaField, useToast } from '../components/ui';

type Svc = { name: string; price: string; minutes: string };
const EMPTY = {
  title: 'د.', full_name: '', gender: '', specialty_id: '', specialty_other: '', sub_specialty: '', license_number: '', graduation_year: '',
  qualifications: '', years_experience: '', languages: 'العربية', phone: '', whatsapp: '', email: '',
  clinic_name: '', city_id: '', area: '', address: '', clinic_phone: '', working_hours: '', consultation_fee: '', appointment_minutes: '15',
  accepts_walk_in: true, bio: '', notes: '', consent: false, website: '',
};

/**
 * «استمارة انضمام طبيب»: a real doctor fills it in (no account needed), the
 * platform admin reviews it and sets up the clinic and the account. The same
 * page prints as a paper form for doctors who prefer to fill it by hand.
 */
export function JoinDoctor() {
  const toast = useToast();
  const cat = useAsync(async () => {
    const [sp, ct] = await Promise.all([
      unwrap(supabase.from('specialties').select('id, name_ar').eq('is_active', true).order('sort_order')),
      unwrap(supabase.from('cities').select('id, name_ar').eq('is_active', true).order('name_ar')),
    ]);
    return { specialties: (sp ?? []) as { id: string; name_ar: string }[], cities: (ct ?? []) as { id: string; name_ar: string }[] };
  }, []);
  const [f, setF] = useState(EMPTY);
  const [services, setServices] = useState<Svc[]>([{ name: 'كشفية', price: '', minutes: '15' }, { name: 'مراجعة', price: '', minutes: '10' }]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const ready = f.full_name.trim().length >= 3 && (f.specialty_id || f.specialty_other.trim()) && f.license_number.trim().length >= 2
    && f.phone.trim().length >= 7 && f.clinic_name.trim().length >= 2 && f.address.trim().length >= 5 && f.consent;

  const submit = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc('submit_provider_application', { p: {
      kind: 'doctor', ...f, specialty_id: f.specialty_id === 'other' ? '' : f.specialty_id,
      consultation_fee_minor: f.consultation_fee, latitude: coords?.lat ?? '', longitude: coords?.lng ?? '', services,
    } });
    setBusy(false);
    if (error) { toast(errorMessage(error), 'danger'); return; }
    setDone(String((data as { application_number?: string })?.application_number ?? ''));
    window.scrollTo({ top: 0 });
  };

  if (done) {
    return (
      <main className="auth-wrap">
        <div className="auth-card stack" style={{ maxWidth: 560 }}>
          <div className="row"><CheckCircle2 color="var(--c-success)" /><h1 style={{ fontSize: 'var(--f-h3)' }}>وصلتنا استمارتك، شكراً لك</h1></div>
          <p>رقم الطلب: <strong dir="ltr">{done}</strong></p>
          <p className="small">نتصل بك خلال أيام لتأكيد المعلومات وتفعيل حسابك. بعد التفعيل ترفع من «ملفي المهني» صورتك الشخصية، وصورة إجازة ممارسة المهنة، وشهاداتك، وصور العيادة.</p>
          <Link to="/" className="btn btn-secondary">العودة للرئيسية</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="join-wrap">
      <div className="join-card stack">
        <header className="row-between">
          <div className="stack-sm" style={{ gap: 2 }}>
            <span className="small muted">{productName}</span>
            <h1 style={{ fontSize: 'var(--f-h2)' }} className="row"><Stethoscope aria-hidden /> استمارة انضمام طبيب</h1>
            <span className="small muted">املأ المعلومات كما تريدها أن تظهر للمرضى. الحقول المعلَّمة (اختياري) يمكن تركها.</span>
          </div>
          <Button variant="ghost" size="sm" icon={<Printer size={16} />} className="no-print" onClick={() => window.print()}>طباعة الاستمارة</Button>
        </header>

        <section className="stack-sm">
          <h2 className="join-h">١. المعلومات الشخصية والمهنية</h2>
          <div className="join-grid">
            <SelectField label="اللقب" value={f.title} onChange={set('title')}>
              {['د.', 'أ.د.', 'أ.م.د.', 'م.د.', 'استشاري'].map((t) => <option key={t}>{t}</option>)}
            </SelectField>
            <TextField label="الاسم الكامل (كما يظهر للمرضى)" value={f.full_name} onChange={set('full_name')} autoComplete="name" />
            <SelectField label="الجنس" optional value={f.gender} onChange={set('gender')}>
              <option value="">—</option><option value="male">ذكر</option><option value="female">أنثى</option>
            </SelectField>
            <SelectField label="الاختصاص" value={f.specialty_id} onChange={set('specialty_id')}>
              <option value="">— اختر —</option>
              {cat.data?.specialties.map((s) => <option key={s.id} value={s.id}>{s.name_ar}</option>)}
              <option value="other">اختصاص آخر…</option>
            </SelectField>
            {f.specialty_id === 'other' && <TextField label="اكتب الاختصاص" value={f.specialty_other} onChange={set('specialty_other')} />}
            <TextField label="الاختصاص الدقيق" optional hint="مثلاً: قسطرة قلبية، أطفال حديثي الولادة" value={f.sub_specialty} onChange={set('sub_specialty')} />
            <TextField label="رقم إجازة ممارسة المهنة / هوية النقابة" ltr value={f.license_number} onChange={set('license_number')} />
            <TextField label="سنة التخرج" optional type="number" ltr min={1950} max={2100} value={f.graduation_year} onChange={set('graduation_year')} />
            <TextField label="سنوات الخبرة" optional type="number" ltr min={0} max={70} value={f.years_experience} onChange={set('years_experience')} />
            <TextField label="اللغات" optional value={f.languages} onChange={set('languages')} />
          </div>
          <TextareaField label="الشهادات والمؤهلات" optional hint="بكالوريوس طب وجراحة، بورد عراقي/عربي، ماجستير، زمالة…" rows={2} value={f.qualifications} onChange={set('qualifications')} />
        </section>

        <section className="stack-sm">
          <h2 className="join-h">٢. التواصل</h2>
          <div className="join-grid">
            <TextField label="رقم الهاتف" type="tel" ltr value={f.phone} onChange={set('phone')} autoComplete="tel" />
            <TextField label="واتساب" optional type="tel" ltr value={f.whatsapp} onChange={set('whatsapp')} />
            <TextField label="البريد الإلكتروني" optional hint="يصير اسم الدخول لحسابك" type="email" ltr value={f.email} onChange={set('email')} autoComplete="email" />
          </div>
        </section>

        <section className="stack-sm">
          <h2 className="join-h">٣. العيادة</h2>
          <div className="join-grid">
            <TextField label="اسم العيادة / المجمع" value={f.clinic_name} onChange={set('clinic_name')} />
            <SelectField label="المحافظة / المدينة" optional value={f.city_id} onChange={set('city_id')}>
              <option value="">—</option>
              {cat.data?.cities.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
            </SelectField>
            <TextField label="المنطقة" optional value={f.area} onChange={set('area')} />
            <TextField label="هاتف العيادة" optional type="tel" ltr value={f.clinic_phone} onChange={set('clinic_phone')} />
          </div>
          <TextareaField label="العنوان بالتفصيل" hint="الشارع، البناية، الطابق، أقرب نقطة دالة" rows={2} value={f.address} onChange={set('address')} />
          <div className="row no-print">
            <Button size="sm" variant="ghost" icon={<MapPin size={14} />}
                    onClick={() => navigator.geolocation?.getCurrentPosition((p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
                      () => toast('تعذّر تحديد الموقع — يكفي العنوان المكتوب.', 'danger'))}>
              {coords ? 'تم تحديد موقع العيادة ✓' : 'أنا الآن في العيادة — حدّد موقعها'}
            </Button>
          </div>
          <TextField label="أيام وساعات الدوام" hint="مثلاً: السبت–الخميس 4–9 مساءً، الجمعة عطلة" value={f.working_hours} onChange={set('working_hours')} />
        </section>

        <section className="stack-sm">
          <h2 className="join-h">٤. الخدمات والأسعار</h2>
          <div className="join-grid">
            <TextField label="سعر الكشفية (دينار)" optional type="number" ltr min={0} value={f.consultation_fee} onChange={set('consultation_fee')} />
            <TextField label="مدة الموعد (دقيقة)" optional type="number" ltr min={5} max={180} value={f.appointment_minutes} onChange={set('appointment_minutes')} />
            <label className="row" style={{ gap: 8, alignSelf: 'end', paddingBlockEnd: 10 }}>
              <input type="checkbox" checked={f.accepts_walk_in} onChange={(e) => setF({ ...f, accepts_walk_in: e.target.checked })} /> أستقبل مرضى بدون موعد
            </label>
          </div>
          <table className="join-svc">
            <thead><tr><th>الخدمة</th><th>السعر (دينار)</th><th>المدة (دقيقة)</th><th className="no-print" /></tr></thead>
            <tbody>
              {services.map((s, i) => (
                <tr key={i}>
                  <td><input className="input" aria-label={`الخدمة ${i + 1}`} value={s.name} onChange={(e) => setServices(services.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></td>
                  <td><input className="input" dir="ltr" type="number" min={0} aria-label={`سعر الخدمة ${i + 1}`} value={s.price} onChange={(e) => setServices(services.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} /></td>
                  <td><input className="input" dir="ltr" type="number" min={5} aria-label={`مدة الخدمة ${i + 1}`} value={s.minutes} onChange={(e) => setServices(services.map((x, j) => (j === i ? { ...x, minutes: e.target.value } : x)))} /></td>
                  <td className="no-print"><button type="button" className="icon-btn" aria-label="حذف" onClick={() => setServices(services.filter((_, j) => j !== i))}><Trash2 size={16} /></button></td>
                </tr>
              ))}
              {/* blank rows on the printed form */}
              {[0, 1, 2].map((i) => <tr key={`p${i}`} className="print-only"><td>&nbsp;</td><td /><td /></tr>)}
            </tbody>
          </table>
          {services.length < 30 && <div className="no-print"><Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => setServices([...services, { name: '', price: '', minutes: '' }])}>إضافة خدمة</Button></div>}
        </section>

        <section className="stack-sm">
          <h2 className="join-h">٥. نبذة للمرضى</h2>
          <TextareaField label="نبذة عنك" optional hint="سطرين أو ثلاثة: خبرتك، الحالات التي تعالجها" rows={3} value={f.bio} onChange={set('bio')} />
          <TextareaField label="ملاحظات لفريق المنصة" optional rows={2} value={f.notes} onChange={set('notes')} />
        </section>

        <Alert tone="info" title="تجهّز لاحقاً (بعد تفعيل الحساب)">
          صورة شخصية واضحة، صورة إجازة ممارسة المهنة أو هوية النقابة، الشهادات، وصور العيادة — ترفعها بنفسك من «ملفي المهني».
        </Alert>

        {/* bots fill hidden fields; people never see it */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website}
               onChange={set('website')} className="sr-only" />

        <label className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
          <input type="checkbox" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} style={{ marginBlockStart: 4 }} />
          <span>أقرّ بأن المعلومات أعلاه صحيحة، وأوافق على عرض اسمي واختصاصي وعيادتي وأسعاري للمرضى على المنصة بعد التحقق منها.</span>
        </label>
        <div className="print-only join-sign"><span>التوقيع: ....................................</span><span>التاريخ: ......../......../............</span></div>
        <div className="row no-print" style={{ gap: 'var(--s-2)' }}>
          <Button loading={busy} disabled={!ready} onClick={() => void submit()}>إرسال الاستمارة</Button>
          {!ready && <span className="small muted">أكمل: الاسم، الاختصاص، رقم الإجازة، الهاتف، اسم العيادة، العنوان، والإقرار.</span>}
        </div>
      </div>
    </main>
  );
}

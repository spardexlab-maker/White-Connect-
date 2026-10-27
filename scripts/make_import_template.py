"""Build the bulk-import Excel template (docs/import/abyad-import-template.xlsx).

One sheet per kind of row the owner fills: places, doctors (with prices and weekly hours), staff.
Dropdowns come from the platform's own lists so a typo can't slip in.
Usage: python3 scripts/make_import_template.py [out.xlsx]
"""
import sys
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation

OUT = sys.argv[1] if len(sys.argv) > 1 else 'docs/import/abyad-import-template.xlsx'
CITIES = ['كربلاء', 'بغداد', 'النجف', 'بابل', 'البصرة', 'الموصل', 'أربيل', 'السليمانية', 'كركوك', 'ديالى', 'ذي قار', 'الأنبار']
SPECIALTIES = ['باطنية', 'أطفال', 'نسائية وتوليد', 'جلدية', 'قلبية', 'أنف وأذن وحنجرة', 'عظام ومفاصل', 'عيون', 'أسنان',
               'مسالك بولية', 'جملة عصبية', 'طب نفسي', 'جراحة عامة', 'طب الأسرة']
TYPES = ['عيادة', 'صيدلية', 'مختبر']
ROLES = ['سكرتير', 'صيدلاني', 'موظف مختبر', 'معتمد نتائج المختبر']
DAYS = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']

NAVY, TEAL, MIST, EX = '123B5D', '0F766E', 'EEF3F6', '8296A8'
head_font = Font(name='Arial', bold=True, color='FFFFFF', size=11)
head_fill = PatternFill('solid', fgColor=NAVY)
req_fill = PatternFill('solid', fgColor=TEAL)
ex_font = Font(name='Arial', italic=True, color=EX)
thin = Side(style='thin', color='DCE5EC')
box = Border(left=thin, right=thin, top=thin, bottom=thin)

wb = Workbook()

def sheet(title, cols, examples, widths=None):
    ws = wb.create_sheet(title)
    ws.sheet_view.rightToLeft = True
    ws.freeze_panes = 'A3'
    for i, (name, required, hint) in enumerate(cols, start=1):
        c = ws.cell(row=1, column=i, value=name + (' *' if required else ''))
        c.font, c.fill, c.border = head_font, (req_fill if required else head_fill), box
        c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        h = ws.cell(row=2, column=i, value=hint)
        h.font, h.fill, h.border = Font(name='Arial', size=9, color='4A6175'), PatternFill('solid', fgColor=MIST), box
        h.alignment = Alignment(wrap_text=True, vertical='top')
        ws.column_dimensions[ws.cell(row=1, column=i).column_letter].width = (widths or {}).get(i, 20)
    ws.row_dimensions[1].height = 34
    ws.row_dimensions[2].height = 48
    for r, row in enumerate(examples, start=3):
        for i, v in enumerate(row, start=1):
            c = ws.cell(row=r, column=i, value=v)
            c.font, c.border = ex_font, box
    return ws

def dropdown(ws, col, source, rows=500):
    dv = DataValidation(type='list', formula1=source, allow_blank=True, showErrorMessage=True,
                        errorTitle='قيمة غير موجودة', error='اختر من القائمة المنسدلة.')
    ws.add_data_validation(dv)
    dv.add(f'{col}3:{col}{rows}')

# --- instructions -------------------------------------------------------------------------
info = wb.active
info.title = 'اقرأني'
info.sheet_view.rightToLeft = True
info.column_dimensions['A'].width = 110
lines = [
    ('أبيض — ملف إدخال البيانات بالجملة', Font(name='Arial', bold=True, size=16, color=NAVY)),
    ('', None),
    ('تعبّي هذا الملف مرة وحدة، وندخله للبرنامج كله بخطوة وحدة: المجمعات، العيادات والصيدليات والمختبرات، الأطباء بأسعارهم ودوامهم، والموظفين.', None),
    ('', None),
    ('الخطوات:', Font(name='Arial', bold=True, size=12, color=TEAL)),
    ('1) ورقة «الجهات»: سطر لكل مكان (عيادة، صيدلية، أو مختبر). اعطِ كل جهة رمز قصير خاص بيها، مثل K1 أو K2.', None),
    ('   - إذا الجهة داخل مجمع، اكتب اسم المجمع نفسه بكل سطر من جهاته (ونفس اسم الفرع) حتى تنربط ببعض.', None),
    ('   - إذا الجهة مستقلة، اترك «اسم المجمع» فارغ.', None),
    ('   - «رابط الموقع»: افتح المكان بخرائط Google ← مشاركة ← نسخ الرابط، والصقه هنا.', None),
    ('2) ورقة «الأطباء»: سطر لكل طبيب بكل جهة يشتغل بيها (إذا يداوم بعيادتين، سطرين).', None),
    ('   - الدوام: اكتب الوقت بنظام 24 ساعة، مثل 16:00-21:00. إذا عنده فترتين بنفس اليوم: 10:00-13:00, 17:00-21:00. اليوم العطلة اتركه فارغ.', None),
    ('   - الأسعار بالدينار العراقي بدون فواصل، مثل 25000.', None),
    ('3) ورقة «الموظفون»: السكرتير والصيدلاني وموظف المختبر. السكرتير يحتاج بريد الطبيب اللي يشتغل وياه.', None),
    ('', None),
    ('ملاحظات مهمة:', Font(name='Arial', bold=True, size=12, color=TEAL)),
    ('• الخانات الخضراء (عليها *) ضرورية. الرمادية اختيارية.', None),
    ('• السطور الرمادية المائلة أمثلة: امسحها أو اكتب فوقها.', None),
    ('• البريد الإلكتروني هو حساب الدخول. كل شخص يدخل بعدها بـ «الدخول بحساب Google» بنفس البريد، أو «نسيت كلمة المرور» حتى يختار كلمة مروره.', None),
    ('• الاختصاص والمحافظة والنوع والدور: اختارها من القائمة المنسدلة.', None),
    ('• قبل الإدخال نفحص الملف كله ونطلعلك تقرير بأي خطأ، وما ينضاف شي إلا إذا الملف كله سليم.', None),
]
for i, (t, f) in enumerate(lines, start=1):
    c = info.cell(row=i, column=1, value=t)
    c.font = f or Font(name='Arial', size=11)
    c.alignment = Alignment(wrap_text=True, vertical='top')

# --- places -------------------------------------------------------------------------------
places = sheet('الجهات', [
    ('رمز الجهة', True, 'رمز قصير خاص بيها: K1, K2…'),
    ('اسم الجهة', True, 'مثل: عيادات الواحة / صيدلية النور'),
    ('النوع', True, 'عيادة / صيدلية / مختبر'),
    ('اسم المجمع', False, 'فارغ = جهة مستقلة'),
    ('اسم الفرع', False, 'إذا للمجمع أكثر من فرع، مثل: فرع حي الحسين'),
    ('المحافظة', True, 'من القائمة'),
    ('المنطقة', True, 'الحي أو المنطقة'),
    ('العنوان', False, 'أقرب نقطة دالة'),
    ('رابط الموقع', True, 'رابط خرائط Google للمكان'),
    ('هاتف الجهة', False, '07xxxxxxxxx'),
    ('وصف قصير', False, 'يظهر للمرضى'),
], [
    ['K1', 'عيادات الواحة التخصصية', 'عيادة', 'مجمع الواحة الطبي', 'فرع حي البلدية', 'كربلاء', 'حي البلدية', 'قرب تقاطع البلدية', 'https://maps.app.goo.gl/xxxxxxxx', '07801234567', 'عيادات تخصصية بمكان واحد'],
    ['K2', 'صيدلية الواحة', 'صيدلية', 'مجمع الواحة الطبي', 'فرع حي البلدية', 'كربلاء', 'حي البلدية', 'الطابق الأرضي', 'https://maps.app.goo.gl/xxxxxxxx', '07801234568', ''],
    ['K3', 'صيدلية الرحمة', 'صيدلية', '', '', 'كربلاء', 'حي العباس', 'شارع الإسكان', 'https://maps.app.goo.gl/yyyyyyyy', '07709876543', ''],
], {2: 28, 4: 24, 5: 20, 8: 24, 9: 36, 11: 30})
dropdown(places, 'C', '"' + ','.join(TYPES) + '"')

# --- doctors ------------------------------------------------------------------------------
doc_cols = [
    ('رمز الجهة', True, 'من ورقة الجهات'),
    ('اسم الطبيب الكامل', True, 'كما يظهر للمرضى'),
    ('اللقب', False, 'د. / أ.د. / استشاري…'),
    ('الاختصاص', True, 'من القائمة'),
    ('البريد الإلكتروني', True, 'حساب الدخول للطبيب'),
    ('هاتف الطبيب', False, 'لا يظهر للمرضى'),
    ('رقم إجازة المزاولة', False, ''),
    ('نبذة', False, 'سطرين عن الطبيب'),
    ('سعر الكشفية', True, 'بالدينار: 25000'),
    ('مدة الكشفية (دقيقة)', True, '15 أو 20…'),
    ('سعر المراجعة', False, 'بالدينار'),
    ('مدة المراجعة (دقيقة)', False, ''),
] + [(d, False, '16:00-21:00') for d in DAYS]
doctors = sheet('الأطباء', doc_cols, [
    ['K1', 'علي حسين الكربلائي', 'د.', 'باطنية', 'dr.ali@example.com', '07701112233', 'IQ-12345', 'اختصاص باطنية وقلبية', 25000, 20, 15000, 10,
     '16:00-21:00', '16:00-21:00', '16:00-19:00, 19:30-21:30', '', '16:00-21:00', '', ''],
], {2: 26, 5: 28, 8: 26})
dropdown(doctors, 'D', "'قوائم'!$A$2:$A$" + str(len(SPECIALTIES) + 1))

# --- staff --------------------------------------------------------------------------------
staff = sheet('الموظفون', [
    ('رمز الجهة', True, 'من ورقة الجهات'),
    ('الاسم الكامل', True, ''),
    ('الدور', True, 'من القائمة'),
    ('البريد الإلكتروني', True, 'حساب الدخول'),
    ('الهاتف', False, ''),
    ('بريد الطبيب (للسكرتير)', False, 'السكرتير يشتغل ويّا طبيب واحد'),
], [
    ['K1', 'زينب عباس', 'سكرتير', 'rec.zainab@example.com', '07809990000', 'dr.ali@example.com'],
    ['K2', 'نور حيدر', 'صيدلاني', 'ph.noor@example.com', '', ''],
], {2: 24, 4: 28, 6: 30})
dropdown(staff, 'C', '"' + ','.join(ROLES) + '"')

# --- lists (dropdown sources) ---------------------------------------------------------------
lists = wb.create_sheet('قوائم')
lists.sheet_view.rightToLeft = True
lists['A1'], lists['B1'] = 'الاختصاصات', 'المحافظات'
for i, s in enumerate(SPECIALTIES, start=2): lists.cell(row=i, column=1, value=s)
for i, s in enumerate(CITIES, start=2): lists.cell(row=i, column=2, value=s)
dropdown(places, 'F', "'قوائم'!$B$2:$B$" + str(len(CITIES) + 1))
lists.sheet_state = 'hidden'

wb.save(OUT)
print('saved', OUT)

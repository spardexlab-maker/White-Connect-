import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { WorkspaceProvider } from './lib/workspace';
import { configMissing, productName } from './lib/supabase';
import { ToastProvider, Alert, SkeletonList } from './components/ui';
import { PatientLayout } from './layouts/PatientLayout';
import { RequireStaff, RequireStaffOrPatient, RequireWorkspaceRole, RequirePlatformAdmin } from './components/guards';
import { PatientHome } from './pages/patient/Home';
import { ProviderPage } from './pages/patient/Provider';
import { BookingFlow } from './pages/patient/Booking';
import { MyAppointments } from './pages/patient/Appointments';
import { Journey } from './pages/patient/Journey';
import { Notifications } from './pages/patient/Notifications';
import { Account } from './pages/patient/Account';
import { PatientRx } from './pages/patient/PatientRx';
import { Meds } from './pages/patient/Meds';
import { HomeLab } from './pages/patient/HomeLab';
import { LabOrderPage } from './pages/LabOrderPage';
import { PrintLab } from './pages/PrintLab';
import { MyHealth } from './pages/patient/Health';
import { AssistantPage } from './pages/patient/Assistant';
import { VerifyRx } from './pages/VerifyRx';
import { JoinDoctor } from './pages/JoinDoctor';
import { ResetPassword } from './pages/ResetPassword';

// Professional and admin areas are code-split so patients on mobile do not download them.
const ProLogin = lazy(() => import('./pages/pro/Login').then((m) => ({ default: m.ProLogin })));
const WorkspacePicker = lazy(() => import('./pages/pro/WorkspacePicker').then((m) => ({ default: m.WorkspacePicker })));
const AcceptInvite = lazy(() => import('./pages/pro/AcceptInvite').then((m) => ({ default: m.AcceptInvite })));
const ReceptionDashboard = lazy(() => import('./pages/pro/Reception').then((m) => ({ default: m.ReceptionDashboard })));
const DoctorToday = lazy(() => import('./pages/pro/DoctorToday').then((m) => ({ default: m.DoctorToday })));
const DoctorProfile = lazy(() => import('./pages/pro/DoctorProfile').then((m) => ({ default: m.DoctorProfile })));
const DoctorSchedule = lazy(() => import('./pages/pro/DoctorSchedule').then((m) => ({ default: m.DoctorSchedule })));
const OrganizationAdmin = lazy(() => import('./pages/pro/OrganizationAdmin').then((m) => ({ default: m.OrganizationAdmin })));
const AdminOverview = lazy(() => import('./pages/admin/Overview').then((m) => ({ default: m.AdminOverview })));
const AdminOrganizations = lazy(() => import('./pages/admin/Organizations').then((m) => ({ default: m.AdminOrganizations })));
const AdminMembers = lazy(() => import('./pages/admin/Members').then((m) => ({ default: m.AdminMembers })));
const AdminApplications = lazy(() => import('./pages/admin/Applications').then((m) => ({ default: m.AdminApplications })));
const AdminAudit = lazy(() => import('./pages/admin/Audit').then((m) => ({ default: m.AdminAudit })));
const DoctorSession = lazy(() => import('./pages/pro/DoctorSession').then((m) => ({ default: m.DoctorSession })));
const PharmacyInbox = lazy(() => import('./pages/pro/PharmacyInbox').then((m) => ({ default: m.PharmacyInbox })));
const PharmacyStock = lazy(() => import('./pages/pro/pharmacy/Stock').then((m) => ({ default: m.PharmacyStock })));
const PharmacySales = lazy(() => import('./pages/pro/pharmacy/Sales').then((m) => ({ default: m.PharmacySales })));
const PharmacyReports = lazy(() => import('./pages/pro/pharmacy/Reports').then((m) => ({ default: m.PharmacyReports })));
const FacilityReports = lazy(() => import('./pages/pro/FacilityReports').then((m) => ({ default: m.FacilityReports })));
const AdminReports = lazy(() => import('./pages/pro/FacilityReports').then((m) => ({ default: m.AdminReports })));
const AdminHealth = lazy(() => import('./pages/admin/Health').then((m) => ({ default: m.AdminHealth })));
const PrintReceipt = lazy(() => import('./pages/PrintReceipt').then((m) => ({ default: m.PrintReceipt })));
const ComplexDoctors = lazy(() => import('./pages/pro/ComplexDoctors').then((m) => ({ default: m.ComplexDoctors })));
const LabHomeRequests = lazy(() => import('./pages/pro/LabHomeRequests').then((m) => ({ default: m.LabHomeRequests })));
const PharmacyNotes = lazy(() => import('./pages/pro/PharmacyNotes').then((m) => ({ default: m.PharmacyNotes })));
const StaffInbox = lazy(() => import('./pages/pro/StaffInbox').then((m) => ({ default: m.StaffInbox })));
const LabWorkspace = lazy(() => import('./pages/pro/LabWorkspace').then((m) => ({ default: m.LabWorkspace })));
const PrintRx = lazy(() => import('./pages/PrintRx').then((m) => ({ default: m.PrintRx })));
const Security = lazy(() => import('./pages/pro/Security').then((m) => ({ default: m.Security })));
const ComponentGallery = lazy(() => import('./pages/dev/Gallery').then((m) => ({ default: m.ComponentGallery })));
const WorkspaceLayout = lazy(() => import('./layouts/WorkspaceLayout').then((m) => ({ default: m.WorkspaceLayout })));

function AdminReportsPage() {
  return (
    <div className="stack">
      <div className="w-page-head"><div className="stack-sm" style={{ gap: 2 }}><h1>التقارير والمالية</h1><div className="muted small">لكل مجمع أو جهة — أرقام تشغيلية فقط، بلا تفاصيل طبية</div></div></div>
      <AdminReports />
    </div>
  );
}

export function App() {
  if (configMissing) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <h1 style={{ fontSize: 'var(--f-h3)' }}>{productName}</h1>
          <Alert tone="warning" title="إعداد البيئة غير مكتمل">
            عرّف VITE_SUPABASE_URL و VITE_SUPABASE_PUBLISHABLE_KEY في ملف apps/web/.env.local (انظر .env.example).
          </Alert>
        </div>
      </div>
    );
  }
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <WorkspaceProvider>
            <Suspense fallback={<SkeletonList />}>
            <Routes>
              <Route path="/" element={<Navigate to="/patient" replace />} />

              {/* Patient experience (public discovery; account pages need sign-in) */}
              <Route path="/patient" element={<PatientLayout />}>
                <Route index element={<PatientHome />} />
                <Route path="provider/:facilityId/:practitionerId?" element={<ProviderPage />} />
                <Route path="book/:facilityId/:practitionerId?" element={<BookingFlow />} />
                <Route path="appointments" element={<MyAppointments />} />
                <Route path="journey" element={<Journey />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="account" element={<Account />} />
                <Route path="rx/:id" element={<PatientRx />} />
                <Route path="meds" element={<Meds />} />
                <Route path="home-lab" element={<HomeLab />} />
                <Route path="health" element={<MyHealth />} />
                <Route path="assistant" element={<AssistantPage />} />
                <Route path="labs/:orderId" element={<LabOrderPage back="/patient/journey" />} />
              </Route>

              {/* Professional portal */}
              <Route path="/login" element={<ProLogin />} />
              <Route path="/invite" element={<AcceptInvite />} />
              <Route path="/security" element={<RequireStaff><Security /></RequireStaff>} />
              <Route path="/workspace" element={<RequireStaff><WorkspacePicker /></RequireStaff>} />
              <Route element={<RequireStaff><WorkspaceLayout /></RequireStaff>}>
                <Route path="/workspace/reception" element={<RequireWorkspaceRole roles={['receptionist', 'doctor']}><ReceptionDashboard /></RequireWorkspaceRole>} />
                <Route path="/workspace/doctor" element={<RequireWorkspaceRole roles={['doctor']}><DoctorToday /></RequireWorkspaceRole>} />
                <Route path="/workspace/doctor/session/:encounterId" element={<RequireWorkspaceRole roles={['doctor']}><DoctorSession /></RequireWorkspaceRole>} />
                <Route path="/workspace/doctor/pharmacy-notes" element={<RequireWorkspaceRole roles={['doctor']}><PharmacyNotes /></RequireWorkspaceRole>} />
                <Route path="/workspace/notifications" element={<StaffInbox />} />
                <Route path="/workspace/doctor/lab/:orderId" element={<RequireWorkspaceRole roles={['doctor']}><LabOrderPage back="/workspace/doctor" /></RequireWorkspaceRole>} />
                <Route path="/workspace/doctor/schedule" element={<RequireWorkspaceRole roles={['doctor']}><DoctorSchedule /></RequireWorkspaceRole>} />
                <Route path="/workspace/doctor/profile" element={<RequireWorkspaceRole roles={['doctor']}><DoctorProfile /></RequireWorkspaceRole>} />
                <Route path="/workspace/pharmacy" element={<RequireWorkspaceRole roles={['pharmacist', 'pharmacy_staff']}><PharmacyInbox /></RequireWorkspaceRole>} />
                <Route path="/workspace/pharmacy/stock" element={<RequireWorkspaceRole roles={['pharmacist', 'pharmacy_staff']}><PharmacyStock /></RequireWorkspaceRole>} />
                <Route path="/workspace/pharmacy/sales" element={<RequireWorkspaceRole roles={['pharmacist', 'pharmacy_staff']}><PharmacySales /></RequireWorkspaceRole>} />
                <Route path="/workspace/pharmacy/reports" element={<RequireWorkspaceRole roles={['pharmacist']}><PharmacyReports /></RequireWorkspaceRole>} />
                <Route path="/workspace/lab" element={<RequireWorkspaceRole roles={['lab_technician', 'lab_approver']}><LabWorkspace /></RequireWorkspaceRole>} />
                <Route path="/workspace/pharmacy/doctors" element={<RequireWorkspaceRole roles={['pharmacist', 'pharmacy_staff']}><ComplexDoctors /></RequireWorkspaceRole>} />
                <Route path="/workspace/lab/home" element={<RequireWorkspaceRole roles={['lab_technician', 'lab_approver']}><LabHomeRequests /></RequireWorkspaceRole>} />
                <Route path="/workspace/lab/doctors" element={<RequireWorkspaceRole roles={['lab_technician', 'lab_approver']}><ComplexDoctors /></RequireWorkspaceRole>} />
                <Route path="/workspace/organization" element={<RequireWorkspaceRole roles={['organization_admin']}><OrganizationAdmin /></RequireWorkspaceRole>} />
                <Route path="/platform-admin" element={<RequirePlatformAdmin><AdminOverview /></RequirePlatformAdmin>} />
                <Route path="/platform-admin/organizations" element={<RequirePlatformAdmin><AdminOrganizations /></RequirePlatformAdmin>} />
                <Route path="/platform-admin/members" element={<RequirePlatformAdmin><AdminMembers /></RequirePlatformAdmin>} />
                <Route path="/workspace/organization/reports" element={<RequireWorkspaceRole roles={['organization_admin']}><FacilityReports /></RequireWorkspaceRole>} />
                <Route path="/platform-admin/health" element={<RequirePlatformAdmin><AdminHealth /></RequirePlatformAdmin>} />
                <Route path="/platform-admin/reports" element={<RequirePlatformAdmin><AdminReportsPage /></RequirePlatformAdmin>} />
                <Route path="/platform-admin/applications" element={<RequirePlatformAdmin><AdminApplications /></RequirePlatformAdmin>} />
                <Route path="/platform-admin/audit" element={<RequirePlatformAdmin><AdminAudit /></RequirePlatformAdmin>} />
              </Route>

              <Route path="/print/rx/:id" element={<RequireStaffOrPatient><PrintRx /></RequireStaffOrPatient>} />
              <Route path="/print/lab/:orderId" element={<RequireStaffOrPatient><PrintLab /></RequireStaffOrPatient>} />
              <Route path="/print/receipt/:id" element={<RequireStaffOrPatient><PrintReceipt /></RequireStaffOrPatient>} />
              <Route path="/verify/rx" element={<VerifyRx />} />
              <Route path="/join" element={<JoinDoctor />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dev/components" element={<ComponentGallery />} />
              <Route path="*" element={<Navigate to="/patient" replace />} />
            </Routes>
            </Suspense>
          </WorkspaceProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

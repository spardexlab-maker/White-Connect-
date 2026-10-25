import { Component, type ReactNode } from 'react';
import { isStaleBuild, reportError } from '../lib/errorReport';

/** A screen that crashed shows a way out (and is reported) instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) {
    if (isStaleBuild(error) && !sessionStorage.getItem('reloaded-for-update')) {
      sessionStorage.setItem('reloaded-for-update', '1');
      location.reload();
      return;
    }
    reportError(error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="auth-wrap" dir="rtl">
        <div className="auth-card stack" role="alert">
          <h1 style={{ fontSize: 'var(--f-h2)' }}>صار خلل بهاي الصفحة</h1>
          <p className="muted">وصلنا تنبيه بالمشكلة وراح نصلحها. جرّب تحدّث الصفحة.</p>
          <button type="button" className="btn btn-primary btn-block" onClick={() => location.reload()}>تحديث الصفحة</button>
          <a className="btn btn-ghost btn-block" href="/patient">الرجوع للرئيسية</a>
        </div>
      </main>
    );
  }
}

import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { productName } from '../lib/supabase';
import { ExplainerVideos } from '../components/ExplainerVideos';

/** Public page with every explainer film (linked from the sign-in screens and shareable on its own). */
export function VideosPage() {
  return (
    <main className="legal stack-lg" style={{ maxWidth: 1080 }}>
      <div className="row-between">
        <span className="brand"><img className="brand-logo" src="/logo-symbol.png" alt="" width={34} height={34} />{productName}</span>
        <Link to="/patient" className="btn btn-ghost btn-sm"><ArrowRight size={16} aria-hidden />الرئيسية</Link>
      </div>
      <div className="stack-sm">
        <h1>شرح {productName} بالفيديو</h1>
        <p className="muted">فيديو قصير لكل جهة: شنو يسوي البرنامج إلك، خطوة بخطوة.</p>
      </div>
      <ExplainerVideos audiences={['doctor', 'lab', 'pharmacy']} title="للأطباء والمختبرات والصيدليات" />
      <ExplainerVideos audiences={['patient']} title="للمرضى" />
    </main>
  );
}

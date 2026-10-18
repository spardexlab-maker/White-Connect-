import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { errorMessage } from '@app/shared';
import { supabase } from '../lib/supabase';
import { unwrap, useAsync } from '../lib/useAsync';
import { Alert, Button, ErrorState, SkeletonList } from '../components/ui';
import { RxDocument, type RxDoc } from '../components/clinical/RxDocument';

/**
 * Browser print view (A4/A5 → "Save as PDF" or a printer). Each print
 * click logs one 'printed' event; printing never sends or dispenses.
 * Silent auto-printing needs a local print service (not offered here).
 */
export function PrintRx() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const facilityId = params.get('facility');
  const [size, setSize] = useState<'A4' | 'A5'>('A5');
  const [logError, setLogError] = useState<string | null>(null);
  const doc = useAsync(async () => (await unwrap(supabase.rpc('prescription_document', { p_prescription_id: id! }))) as unknown as RxDoc, [id]);

  const print = async () => {
    setLogError(null);
    if (facilityId) {
      const { error } = await supabase.rpc('record_prescription_print', { p_prescription_id: id!, p_facility_id: facilityId });
      if (error) { setLogError(errorMessage(error)); return; }
    }
    window.print();
  };

  return (
    <main className="p-main stack" style={{ maxWidth: 900 }}>
      <div className="row no-print">
        <div className="segmented" role="group" aria-label="حجم الورق">
          <button aria-pressed={size === 'A5'} onClick={() => setSize('A5')}>A5</button>
          <button aria-pressed={size === 'A4'} onClick={() => setSize('A4')}>A4</button>
        </div>
        <Button icon={<Printer size={18} />} onClick={print} disabled={!doc.data || doc.data.status === 'cancelled'}>طباعة / حفظ PDF</Button>
      </div>
      {logError && <Alert tone="danger">{logError}</Alert>}
      {doc.status === 'loading' && <SkeletonList />}
      {doc.status === 'error' && <ErrorState error={doc.error} onRetry={doc.reload} />}
      {doc.data?.status === 'cancelled' && <Alert tone="danger" title="وصفة ملغاة">لا يمكن طباعتها للصرف.</Alert>}
      {doc.data && <div className="print-area"><RxDocument doc={doc.data} size={size} /></div>}
      <style>{`@media print { @page { size: ${size}; } }`}</style>
    </main>
  );
}

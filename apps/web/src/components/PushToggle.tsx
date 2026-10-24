import { useEffect, useState } from 'react';
import { BellOff, BellRing } from 'lucide-react';
import { enablePush, disablePush, pushState, type PushState } from '../lib/webPush';
import { Button, useToast } from './ui';

/** «فعّل إشعارات المتصفح» — appointments, results and reminders even when the site is closed. */
export function PushToggle({ compact = false }: { compact?: boolean }) {
  const toast = useToast();
  const [st, setSt] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void pushState().then(setSt); }, []);
  if (!st || st === 'unsupported') return null;
  if (st === 'denied') {
    return compact ? null : <span className="small muted">الإشعارات محظورة لهذا الموقع — فعّلها من إعدادات المتصفح (رمز القفل بجانب العنوان).</span>;
  }
  const on = async () => {
    setBusy(true);
    try {
      const r = await enablePush(); setSt(r);
      if (r === 'on') toast('فُعّلت الإشعارات على هذا المتصفح', 'success');
    } catch { toast('تعذّر تفعيل الإشعارات الآن؛ حاول بعد دقيقة.', 'danger'); }
    setBusy(false);
  };
  const off = async () => { setBusy(true); await disablePush().catch(() => undefined); setSt('off'); setBusy(false); };
  return st === 'on'
    ? (compact ? null : <Button size="sm" variant="ghost" icon={<BellOff size={16} />} loading={busy} onClick={() => void off()}>إيقاف إشعارات هذا المتصفح</Button>)
    : <Button size="sm" variant={compact ? 'secondary' : 'primary'} icon={<BellRing size={16} />} loading={busy} onClick={() => void on()}>تفعيل الإشعارات</Button>;
}

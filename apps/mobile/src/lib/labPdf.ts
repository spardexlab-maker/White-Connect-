import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { labReportDocument, type LabReport } from '@app/shared';
import { supabase } from './supabase';
import { unwrap } from './useAsync';

/** The lab report as a PDF: open the system print dialog (print / save as PDF) or share the file. */
export async function labReportPdf(orderId: string, mode: 'print' | 'share'): Promise<void> {
  const r = (await unwrap(supabase.rpc('lab_report', { p_order_id: orderId }))) as unknown as LabReport;
  const html = labReportDocument(r);
  if (mode === 'print') { await Print.printAsync({ html }); return; }
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `تقرير ${r.order_number}`, UTI: 'com.adobe.pdf' });
}

import { useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { usePatientCard, QrBlock } from '../../src/components/PatientCard';
import { Card, ErrorState, Loading, Screen, Text } from '../../src/components/ui';

/** Full-screen QR for scanning at reception. */
export default function CardScreen() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const card = usePatientCard(patientId);
  const { width } = useWindowDimensions();
  return (
    <Screen>
      {card.status === 'loading' && <Loading />}
      {card.status === 'error' && <Card><ErrorState error={card.error} onRetry={card.reload} /></Card>}
      {card.data && (
        <Card style={{ alignItems: 'center' }}>
          <Text variant="h3" style={{ textAlign: 'center' }}>{card.data.full_name}</Text>
          <QrBlock token={card.data.qr_token} code={card.data.public_code} size={Math.min(width - 96, 340)} />
          <Text variant="small" muted style={{ textAlign: 'center' }}>ارفع سطوع الشاشة إذا تعذّر المسح.</Text>
        </Card>
      )}
    </Screen>
  );
}

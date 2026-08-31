import React, { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { Button, Card, Chip, EmptyState, Notice, Row, Section, T } from '@dd/components/ui';
import type { AlterationType } from '@dd/domain/types';
import { applyAlterationDelta } from '@dd/engine/measurements';
import { useI18n, type StringKey } from '@dd/i18n';
import { track } from '@dd/services/analytics';
import { useOrdersStore } from '@dd/store/ordersStore';
import { useProfileStore } from '@dd/store/profileStore';
import { theme } from '@dd/theme/tokens';

const TYPES: { key: AlterationType; labelKey: StringKey; field: string | null; sign: -1 | 1 }[] = [
  { key: 'shorten', labelKey: 'alter.shorten', field: 'total_length', sign: -1 },
  { key: 'lengthen', labelKey: 'alter.lengthen', field: 'total_length', sign: 1 },
  { key: 'sleeve', labelKey: 'alter.sleeve', field: 'sleeve_length', sign: -1 },
  { key: 'width', labelKey: 'alter.width', field: 'chest', sign: -1 },
  { key: 'neck', labelKey: 'alter.neck', field: 'neck', sign: -1 },
  { key: 'other', labelKey: 'alter.other', field: null, sign: 1 },
];

/**
 * ALTERATIONS — and the learning loop they feed.
 *
 * After an alteration the app ASKS whether to update the saved measurement.
 * It never edits a measurement silently: a wrong automatic update would ruin
 * every future order, and the customer is the only one who can confirm the
 * garment actually fits better now.
 */
export default function AlterationRequest() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const { t, L } = useI18n();

  const order = useOrdersStore((s) => s.orders.find((o) => o.id === orderId));
  const requestAlteration = useOrdersStore((s) => s.requestAlteration);
  const markApplied = useOrdersStore((s) => s.markAlterationApplied);
  const measurements = useProfileStore((s) => s.measurements);
  const upsertMeasurement = useProfileStore((s) => s.upsertMeasurement);
  const customerId = useProfileStore((s) => s.customer.id);

  const [type, setType] = useState<AlterationType>('shorten');
  const [amount, setAmount] = useState('1');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState<{ alterationId: string; field: string | null; delta: number } | null>(null);
  const [applied, setApplied] = useState(false);

  const selected = useMemo(() => TYPES.find((x) => x.key === type)!, [type]);
  const profile = useMemo(() => {
    const profileId = order?.items[0]?.measurementProfileId;
    return measurements.find((m) => m.id === profileId) ?? measurements[0];
  }, [measurements, order]);

  if (!order) {
    return (
      <>
        <Stack.Screen options={{ title: t('alter.title') }} />
        <View style={{ flex: 1, backgroundColor: theme.color.bg, justifyContent: 'center' }}>
          <EmptyState title={t('error.notFound')} action={{ label: t('common.back'), onPress: () => router.back() }} />
        </View>
      </>
    );
  }

  const submit = () => {
    const numeric = Number(amount.replace(',', '.'));
    const delta = Number.isFinite(numeric) ? numeric * selected.sign : 0;
    const alteration = requestAlteration({
      orderId: order.id,
      orderItemId: order.items[0]?.id ?? '',
      customerId,
      type,
      delta: selected.field ? delta : null,
      measurementFieldKey: selected.field,
      notes: notes || null,
    });
    track('alteration_requested', { type, delta });
    setSubmitted({ alterationId: alteration.id, field: selected.field, delta });
  };

  const applyToProfile = () => {
    if (!submitted?.field || !profile) return;
    const updated = applyAlterationDelta(profile, submitted.field, submitted.delta);
    upsertMeasurement(updated);
    markApplied(submitted.alterationId, profile.id);
    setApplied(true);
  };

  const currentValue = submitted?.field && profile ? profile.values[submitted.field] : undefined;

  return (
    <>
      <Stack.Screen options={{ title: t('alter.title') }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.color.bg }}
        contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.xl, paddingBottom: theme.space.xxxl }}
      >
        <T variant="small" color={theme.color.textMuted}>
          {order.number}
        </T>

        {!submitted ? (
          <>
            <Section title={t('alter.type')}>
              <Row wrap gap={theme.space.sm}>
                {TYPES.map((x) => (
                  <Chip key={x.key} label={t(x.labelKey)} selected={type === x.key} onPress={() => setType(x.key)} />
                ))}
              </Row>
            </Section>

            {selected.field ? (
              <Section title={`${t('alter.amount')} (${t('common.cm')})`}>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  style={{
                    borderWidth: 1,
                    borderColor: theme.color.border,
                    borderRadius: theme.radius.sm,
                    padding: theme.space.md,
                    minHeight: theme.hit,
                    color: theme.color.text,
                  }}
                />
              </Section>
            ) : null}

            <Section title={t('measure.notes')}>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder={L({ ar: 'اكتب تفاصيل التعديل المطلوب', en: 'Describe the alteration' })}
                placeholderTextColor={theme.color.textFaint}
                style={{
                  borderWidth: 1,
                  borderColor: theme.color.border,
                  borderRadius: theme.radius.sm,
                  padding: theme.space.md,
                  minHeight: 90,
                  textAlignVertical: 'top',
                  color: theme.color.text,
                }}
              />
            </Section>

            <Button label={t('alter.submit')} onPress={submit} full size="lg" />
          </>
        ) : (
          <Card>
            <View style={{ gap: theme.space.md }}>
              <T variant="heading">{t('orders.thanks')}</T>
              {applied ? (
                <Notice text={t('alter.updated')} tone="success" />
              ) : submitted.field && profile && currentValue !== undefined ? (
                <>
                  <Notice
                    tone="info"
                    title={t('alter.updateAsk')}
                    text={L({
                      ar: `القيمة الحالية ${currentValue} سم ← ستصبح ${Math.round((currentValue + submitted.delta) * 10) / 10} سم في «${profile.name}».`,
                      en: `Current ${currentValue} cm → becomes ${Math.round((currentValue + submitted.delta) * 10) / 10} cm in "${profile.name}".`,
                    })}
                  />
                  <Button label={t('alter.updateApply')} onPress={applyToProfile} full />
                  <Button label={t('common.notNow')} variant="ghost" onPress={() => router.back()} full />
                </>
              ) : (
                <Notice
                  tone="info"
                  text={L({ ar: 'سيتواصل معك الخيّاط لتحديد تفاصيل التعديل.', en: 'Your tailor will contact you about the alteration.' })}
                />
              )}
              <Button label={t('common.done')} variant="secondary" onPress={() => router.back()} full />
            </View>
          </Card>
        )}
      </ScrollView>
    </>
  );
}

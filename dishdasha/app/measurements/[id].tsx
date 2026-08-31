import React, { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { MeasurementDiagram } from '@dd/components/MeasurementDiagram';
import { Badge, Button, Card, Chip, Notice, Row, Section, T } from '@dd/components/ui';
import { MEASUREMENT_TEMPLATES, getMeasurementTemplate } from '@dd/domain/measurementTemplates';
import type { MeasurementProfile, MeasurementStatus } from '@dd/domain/types';
import {
  convertValue,
  emptyValuesFor,
  hasBlockingIssues,
  validateMeasurements,
} from '@dd/engine/measurements';
import { useI18n, type StringKey } from '@dd/i18n';
import { track } from '@dd/services/analytics';
import { useProfileStore } from '@dd/store/profileStore';
import { theme } from '@dd/theme/tokens';
import { nowIso } from '@dd/utils/date';
import { uuid } from '@dd/utils/id';

/**
 * Measurement editor.
 *
 * Values are validated against the template's ranges plus a couple of
 * cross-field sanity checks. Warnings do not block saving — a real body can
 * be unusual — but errors do, because an impossible number always means a
 * typo.
 */
export default function MeasurementEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, L, lang } = useI18n();

  const measurements = useProfileStore((s) => s.measurements);
  const upsert = useProfileStore((s) => s.upsertMeasurement);
  const remove = useProfileStore((s) => s.removeMeasurement);
  const customerId = useProfileStore((s) => s.customer.id);

  const isNew = id === 'new';
  const existing = useMemo(() => measurements.find((m) => m.id === id), [measurements, id]);

  const [templateId, setTemplateId] = useState(existing?.templateId ?? 'tpl_om_dishdasha_default');
  const [name, setName] = useState(existing?.name ?? '');
  const [unit, setUnit] = useState<'cm' | 'in'>(existing?.unit ?? 'cm');
  const [fit, setFit] = useState<MeasurementProfile['fitPreference']>(existing?.fitPreference ?? 'regular');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [values, setValues] = useState<Record<string, number>>(
    existing?.values ?? emptyValuesFor(getMeasurementTemplate('tpl_om_dishdasha_default')),
  );

  const template = getMeasurementTemplate(templateId);
  const issues = useMemo(() => validateMeasurements(values, templateId, unit), [values, templateId, unit]);
  const blocked = hasBlockingIssues(issues);

  const changeUnit = (next: 'cm' | 'in') => {
    if (next === unit) return;
    const converted: Record<string, number> = {};
    for (const [key, value] of Object.entries(values)) converted[key] = convertValue(value, unit, next);
    setValues(converted);
    setUnit(next);
  };

  const save = () => {
    const profile: MeasurementProfile = {
      id: existing?.id ?? uuid(),
      customerId,
      name: name.trim() || L({ ar: 'مقاس جديد', en: 'New profile' }),
      templateId,
      garmentTypeId: 'OMANI_DISHDASHA',
      unit,
      // Self-entered profiles are labelled honestly; only a workshop can
      // promote one to tailor_verified.
      status: (existing?.status === 'tailor_verified' ? 'needs_review' : 'customer_entered') as MeasurementStatus,
      measuredBy: existing?.measuredBy ?? null,
      tailorBusinessId: existing?.tailorBusinessId ?? null,
      measuredAt: existing?.measuredAt ?? nowIso(),
      notes: notes || null,
      fitPreference: fit,
      values,
      customValues: existing?.customValues ?? [],
      updatedAt: nowIso(),
      deletedAt: null,
    };
    upsert(profile);
    track('measurement_saved', { templateId, unit, isNew });
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ title: isNew ? t('measure.add') : (existing?.name ?? t('measure.title')) }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.color.bg }}
        contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.xl, paddingBottom: theme.space.xxxl }}
      >
        {existing?.status === 'tailor_verified' ? (
          <Notice
            tone="warning"
            text={L({
              ar: 'هذا المقاس موثّق من الخيّاط. أي تعديل سيحوّله إلى «يحتاج مراجعة».',
              en: 'This profile is tailor verified. Editing it moves it to "needs review".',
            })}
          />
        ) : null}

        <Section title={t('measure.profileName')}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={L({ ar: 'مثال: مقاسي الحالي', en: 'e.g. My current fit' })}
            placeholderTextColor={theme.color.textFaint}
            style={inputStyle(lang)}
          />
        </Section>

        <Section title={t('measure.template')}>
          <Row wrap gap={theme.space.sm}>
            {MEASUREMENT_TEMPLATES.map((tpl) => (
              <Chip
                key={tpl.id}
                label={L(tpl.name)}
                selected={tpl.id === templateId}
                onPress={() => {
                  setTemplateId(tpl.id);
                  setValues((prev) => {
                    const next = emptyValuesFor(tpl);
                    // Keep values the customer already entered for shared fields.
                    for (const key of Object.keys(next)) if (prev[key] !== undefined) next[key] = prev[key];
                    return next;
                  });
                }}
              />
            ))}
          </Row>
        </Section>

        <Section title={t('measure.unit')}>
          <Row gap={theme.space.sm}>
            <Chip label={t('common.cm')} selected={unit === 'cm'} onPress={() => changeUnit('cm')} />
            <Chip label={t('common.in')} selected={unit === 'in'} onPress={() => changeUnit('in')} />
          </Row>
        </Section>

        <Section title={t('measure.fit')}>
          <Row gap={theme.space.sm}>
            {(['slim', 'regular', 'relaxed'] as const).map((f) => (
              <Chip key={f} label={t(`fit.${f}` as StringKey)} selected={fit === f} onPress={() => setFit(f)} />
            ))}
          </Row>
        </Section>

        <Section title={t('measure.title')} subtitle={t('measure.howTo')}>
          <View style={{ gap: theme.space.md }}>
            {template.fields.map((field) => {
              const fieldIssues = issues.filter((i) => i.fieldKey === field.key);
              const error = fieldIssues.find((i) => i.severity === 'error');
              const warning = fieldIssues.find((i) => i.severity === 'warning');
              return (
                <Card key={field.key}>
                  <Row gap={theme.space.md} align="flex-start">
                    <MeasurementDiagram illustration={field.illustration} width={78} height={110} />
                    <View style={{ flex: 1, gap: 8 }}>
                      <Row justify="space-between">
                        <T variant="small" weight="700">
                          {L(field.label)}
                        </T>
                        {field.required ? <Badge label={t('common.required')} tone="neutral" /> : null}
                      </Row>
                      <T variant="tiny" color={theme.color.textMuted}>
                        {L(field.howTo)}
                      </T>
                      <Row gap={theme.space.sm}>
                        <TextInput
                          value={values[field.key] !== undefined ? String(values[field.key]) : ''}
                          onChangeText={(text) => {
                            const numeric = Number(text.replace(',', '.'));
                            setValues({ ...values, [field.key]: Number.isFinite(numeric) ? numeric : 0 });
                          }}
                          keyboardType="decimal-pad"
                          style={[inputStyle(lang), { flex: 1, borderColor: error ? theme.color.danger : theme.color.border }]}
                        />
                        <T variant="small" color={theme.color.textMuted}>
                          {unit === 'cm' ? t('common.cm') : t('common.in')}
                        </T>
                      </Row>
                      {error ? (
                        <T variant="tiny" color={theme.color.danger}>
                          {L(error.message)}
                        </T>
                      ) : warning ? (
                        <T variant="tiny" color={theme.color.warning}>
                          {L(warning.message)}
                        </T>
                      ) : null}
                    </View>
                  </Row>
                </Card>
              );
            })}
          </View>
        </Section>

        <Section title={t('measure.notes')}>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            style={[inputStyle(lang), { minHeight: 90, textAlignVertical: 'top' }]}
          />
        </Section>

        {blocked ? <Notice text={t('measure.invalid')} tone="danger" /> : null}
        <Notice text={t('measure.customerWarn')} tone="warning" />

        <Button label={t('common.save')} onPress={save} disabled={blocked} full size="lg" />
        {existing ? (
          <Button
            label={t('common.delete')}
            variant="danger"
            onPress={() => {
              remove(existing.id);
              router.back();
            }}
            full
          />
        ) : null}
      </ScrollView>
    </>
  );
}

const inputStyle = (lang: 'ar' | 'en') => ({
  borderWidth: 1,
  borderColor: theme.color.border,
  borderRadius: theme.radius.sm,
  padding: theme.space.md,
  minHeight: theme.hit,
  color: theme.color.text,
  backgroundColor: theme.color.surface,
  textAlign: (lang === 'ar' ? 'right' : 'left') as 'right' | 'left',
});

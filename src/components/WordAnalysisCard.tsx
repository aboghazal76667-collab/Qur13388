import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';

import { AppText, Badge, Button, Card, Divider, Row } from './primitives';
import { useTheme } from '../theme/ThemeProvider';
import { displayRoot } from '../quran/arabic';
import type { WordAnalysis } from '../types/analysis';

/** Word statistics card: counts, forms, particles, and usage clusters. */
export function WordAnalysisCard({ analysis }: { analysis: WordAnalysis }) {
  const { spacing, palette } = useTheme();
  const [expanded, setExpanded] = useState(false);

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <Row gap={8}>
        <AppText variant="heading" weight="bold">
          {analysis.word}
        </AppText>
        {analysis.root ? <Badge label={`الجذر: ${displayRoot(analysis.root)}`} tone="accent" /> : null}
      </Row>

      <Row gap={16} style={{ marginTop: spacing.md }}>
        <Stat label="المواضع" value={analysis.occurrenceCount} />
        <Stat label="الآيات" value={analysis.verseCount} />
        <Stat label="الصيغ" value={analysis.distinctForms.length} />
        <Stat label="الأنماط" value={analysis.usagePatterns.length} />
      </Row>

      {analysis.distinctForms.length > 0 ? (
        <>
          <Divider spacingY={spacing.md} />
          <AppText variant="tiny" tone="faint" style={{ marginBottom: spacing.sm }}>
            أبرز الصيغ الواردة
          </AppText>
          <Row gap={6}>
            {analysis.distinctForms.slice(0, expanded ? 24 : 8).map((f) => (
              <View
                key={f.surface}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 999,
                  backgroundColor: palette.surfaceAlt,
                }}
              >
                <AppText variant="small">
                  {f.surface} <AppText variant="tiny" tone="faint">{`(${f.count})`}</AppText>
                </AppText>
              </View>
            ))}
          </Row>
        </>
      ) : null}

      {analysis.prepositionProfile.length > 0 ? (
        <>
          <Divider spacingY={spacing.md} />
          <AppText variant="tiny" tone="faint" style={{ marginBottom: spacing.sm }}>
            حروف الجر المصاحبة — تغيّرها كثيرًا ما يصاحب تغيّرًا في وجه الاستعمال
          </AppText>
          <Row gap={6}>
            {analysis.prepositionProfile.slice(0, 8).map((p) => (
              <Badge key={p.particle} label={`${p.particle} · ${p.count}`} tone="neutral" />
            ))}
          </Row>
        </>
      ) : null}

      {expanded && analysis.grammarProfile.length > 0 ? (
        <>
          <Divider spacingY={spacing.md} />
          <AppText variant="tiny" tone="faint" style={{ marginBottom: spacing.sm }}>
            الخصائص الصرفية
          </AppText>
          <Row gap={6}>
            {analysis.grammarProfile.map((g) => (
              <Badge key={g.feature} label={`${g.label} · ${g.count}`} tone="neutral" />
            ))}
          </Row>
        </>
      ) : null}

      {analysis.usagePatterns.length > 0 ? (
        <>
          <Divider spacingY={spacing.md} />
          <AppText variant="tiny" tone="faint" style={{ marginBottom: spacing.sm }}>
            أنماط الاستعمال داخل القرآن
          </AppText>
          {analysis.usagePatterns.slice(0, expanded ? 12 : 3).map((p) => (
            <View key={p.id} style={{ marginBottom: spacing.sm }}>
              <AppText variant="small" weight="medium">
                {p.label} — {p.verseKeys.length} موضعًا
              </AppText>
              <AppText variant="tiny" tone="faint" style={{ marginTop: 2 }}>
                {p.signals.join('، ')}
              </AppText>
            </View>
          ))}
        </>
      ) : null}

      <Row gap={8} style={{ marginTop: spacing.md }}>
        <Button
          label={expanded ? 'إخفاء التفاصيل' : 'عرض كل التفاصيل'}
          variant="ghost"
          onPress={() => setExpanded((v) => !v)}
          style={{ flex: 1 }}
        />
        <Button
          label="حلّل هذه الكلمة"
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: '/word/[form]',
              params: { form: analysis.word, root: analysis.root ?? '' },
            })
          }
          style={{ flex: 1 }}
        />
      </Row>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <AppText variant="heading" weight="bold" tone="accent">
        {value}
      </AppText>
      <AppText variant="tiny" tone="faint">
        {label}
      </AppText>
    </View>
  );
}

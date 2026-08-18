import React, { useMemo, useState } from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';

import {
  AppText,
  Card,
  Chip,
  Row,
  Screen,
  SectionTitle,
  Spacer,
} from '../src/components/primitives';
import { GraphView } from '../src/components/GraphView';
import { useTheme } from '../src/theme/ThemeProvider';
import { buildConceptGraph, EDGE_LABELS } from '../src/graph/builder';
import { CONCEPTS } from '../src/knowledge/concepts';

export default function GraphScreen() {
  const params = useLocalSearchParams<{ concept?: string }>();
  const { spacing } = useTheme();
  const [conceptId, setConceptId] = useState(params.concept ?? CONCEPTS[0].id);

  const graph = useMemo(() => buildConceptGraph(conceptId), [conceptId]);
  const concept = CONCEPTS.find((c) => c.id === conceptId);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'خريطة المعرفة' }} />

      <AppText variant="small" tone="muted">
        نموذج أوّلي لخريطة العلاقات: يربط المفهوم بجذوره، والجذور بالآيات، والادعاءات
        بأصحابها وبالآيات التي تستند إليها.
      </AppText>

      <Spacer size={spacing.lg} />
      <SectionTitle>اختر المفهوم</SectionTitle>
      <Row gap={6}>
        {CONCEPTS.map((c) => (
          <Chip
            key={c.id}
            label={c.labelArabic}
            selected={c.id === conceptId}
            onPress={() => setConceptId(c.id)}
            compact
          />
        ))}
      </Row>

      <Spacer size={spacing.lg} />
      <GraphView graph={graph} height={360} />

      {concept ? (
        <>
          <Spacer size={spacing.lg} />
          <Card>
            <AppText variant="small" weight="bold">
              {concept.labelArabic}
            </AppText>
            <AppText variant="small" tone="muted" style={{ marginTop: spacing.sm }}>
              {concept.summary}
            </AppText>
          </Card>
        </>
      ) : null}

      <Spacer size={spacing.lg} />
      <SectionTitle>أنواع العلاقات</SectionTitle>
      <Card>
        {Object.entries(EDGE_LABELS).map(([kind, label]) => (
          <AppText key={kind} variant="tiny" tone="muted" style={{ marginBottom: 4 }}>
            {kind} — {label}
          </AppText>
        ))}
      </Card>
    </Screen>
  );
}

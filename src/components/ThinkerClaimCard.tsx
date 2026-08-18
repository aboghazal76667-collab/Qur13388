import React from 'react';
import { View } from 'react-native';

import { AppText, Badge, Card, Divider, Row } from './primitives';
import { useTheme } from '../theme/ThemeProvider';
import { VerseCard } from './VerseCard';
import { DOCUMENTATION_LABELS } from '../knowledge/thinkers';
import type { ThinkerClaim } from '../types/knowledge';

/**
 * A recorded position, presented as a position — never as a finding.
 *
 * The source line is mandatory: a claim without one is filtered out upstream
 * and can never reach this component.
 */
export function ThinkerClaimCard({ claim, showVerses = true }: { claim: ThinkerClaim; showVerses?: boolean }) {
  const { spacing } = useTheme();

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <Row gap={6}>
        <Badge label="رأي مفكر" tone="caution" />
        <Badge
          label={DOCUMENTATION_LABELS[claim.documentation]}
          tone={claim.documentation === 'documented' ? 'good' : 'neutral'}
        />
      </Row>

      <AppText variant="tiny" tone="faint" style={{ marginTop: spacing.md }}>
        {claim.topicLabel}
      </AppText>

      <AppText variant="body" style={{ marginTop: 4 }}>
        {claim.claim}
      </AppText>

      {claim.reasoning ? (
        <>
          <Divider spacingY={spacing.md} />
          <AppText variant="tiny" tone="faint">
            طريقة استدلاله كما يعرضها
          </AppText>
          <AppText variant="small" tone="muted" style={{ marginTop: 4 }}>
            {claim.reasoning}
          </AppText>
        </>
      ) : null}

      {claim.source ? (
        <>
          <Divider spacingY={spacing.md} />
          <AppText variant="tiny" tone="faint">
            المصدر
          </AppText>
          <AppText variant="small" tone="muted" style={{ marginTop: 4 }}>
            {[claim.source.title, claim.source.author, claim.source.year, claim.source.locator]
              .filter(Boolean)
              .join(' — ')}
          </AppText>
        </>
      ) : null}

      {showVerses && claim.quranReferences.length > 0 ? (
        <View style={{ marginTop: spacing.md }}>
          <AppText variant="tiny" tone="faint" style={{ marginBottom: spacing.sm }}>
            الآيات التي يستند إليها
          </AppText>
          {claim.quranReferences.map((ref) => (
            <VerseCard key={ref.key} reference={ref} showFavorite={false} />
          ))}
        </View>
      ) : null}

      <AppText variant="tiny" tone="faint" style={{ marginTop: spacing.md }}>
        هذا عرض لموقف صاحبه، لا تبنٍّ له. اختبره بنفسك مقابل النص.
      </AppText>
    </Card>
  );
}

/** Rendered in place of claims when our records hold nothing. */
export function NoThinkerDataCard({ thinkerName, message }: { thinkerName: string; message: string }) {
  const { spacing } = useTheme();
  return (
    <Card tone="alt" style={{ marginBottom: spacing.md }}>
      <AppText variant="small" weight="bold">
        {thinkerName}
      </AppText>
      <AppText variant="small" tone="muted" style={{ marginTop: 6 }}>
        {message}
      </AppText>
    </Card>
  );
}

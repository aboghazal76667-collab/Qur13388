import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useI18n, type Strings } from '@/i18n';
import { useTheme } from '@/theme';
import type { CollectionReadiness, ReadinessIssue, ViewRole } from '@/services/readiness';
import { Banner, Card, ScoreBar, Text, scoreTone } from '@/ui';

/**
 * The 3D readiness panel.
 *
 * It answers "can these photos help build your child?" rather than "is this a
 * decent picture?", and it is bound by one rule the previous panel broke: it
 * may only name something it actually measured.
 *
 * So sharpness, light, framing and background appear — those come from real
 * pixel measurements. Face and body do not appear as scores, because nothing
 * looked for a face. Coverage is shown instead, built from what the parent told
 * us each photo shows, and the panel says plainly that this is how it knows.
 */

export function roleLabel(role: ViewRole, t: Strings): string {
  switch (role) {
    case 'face':
      return t.readiness.roleFace;
    case 'front_body':
      return t.readiness.roleFrontBody;
    case 'full_body':
      return t.readiness.roleFullBody;
    case 'side':
      return t.readiness.roleSide;
    case 'back':
      return t.readiness.roleBack;
    case 'detail':
      return t.readiness.roleDetail;
    default:
      return t.readiness.roleUnspecified;
  }
}

export function issueLabel(issue: ReadinessIssue, t: Strings): string {
  switch (issue.key) {
    case 'too_small':
      return t.readiness.issueTooSmall;
    case 'blurred':
      return t.readiness.issueBlurred;
    case 'too_dark':
      return t.readiness.issueTooDark;
    case 'too_bright':
      return t.readiness.issueTooBright;
    case 'low_contrast':
      return t.readiness.issueLowContrast;
    case 'subject_small':
      return t.readiness.issueSubjectSmall;
    case 'busy_background':
      return t.readiness.issueBusyBackground;
    case 'strong_colour_cast':
      return t.readiness.issueColourCast;
    case 'duplicate':
      return t.readiness.issueDuplicate;
    default:
      return '';
  }
}

export function ReadinessPanel({
  readiness,
  analysing,
  selectedPhotoId,
}: {
  readiness: CollectionReadiness | null;
  analysing: boolean;
  /** Issues are shown for the photo the parent is looking at. */
  selectedPhotoId?: string | null;
}) {
  const theme = useTheme();
  const { t, format, isRtl, formatNumber } = useI18n();

  if (analysing) {
    return (
      <Card>
        <Text variant="caption" color="textMuted">
          {t.readiness.analysing}
        </Text>
      </Card>
    );
  }

  if (!readiness || readiness.photos.length === 0) return null;

  const tone = scoreTone(readiness.score);
  const selected =
    readiness.photos.find((photo) => photo.photoId === selectedPhotoId) ?? readiness.photos[0];

  const missingNeeded = readiness.coverage.filter(
    (item) => item.state === 'missing' && item.importance === 'needed',
  );
  const missingHelpful = readiness.coverage.filter(
    (item) => item.state === 'missing' && item.importance === 'helpful',
  );

  const verdict =
    readiness.score >= 75
      ? t.readiness.enoughToStart
      : readiness.score >= 50
        ? t.readiness.couldBeBetter
        : t.readiness.notEnough;

  // Only measurements that were genuinely taken. Nothing here is an estimate
  // standing in for a model we do not have.
  const measured: { label: string; value: number }[] = [
    { label: t.readiness.measuredSharpness, value: Math.round(Math.min(1, selected.signals.sharpness / 0.35) * 100) },
    {
      label: t.readiness.measuredLight,
      value: Math.round(
        Math.max(0, 100 - selected.signals.clippedShadows * 120 - selected.signals.clippedHighlights * 120),
      ),
    },
    { label: t.readiness.measuredFraming, value: Math.round(selected.signals.subjectProminence * 100) },
    { label: t.readiness.measuredBackground, value: Math.round((1 - selected.signals.backgroundBusyness) * 100) },
  ];

  return (
    <Card>
      <View style={{ gap: theme.spacing.lg }}>
        <View
          style={{
            flexDirection: isRtl ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text variant="subheading">{t.readiness.title}</Text>
          <View
            style={{
              flexDirection: isRtl ? 'row-reverse' : 'row',
              alignItems: 'baseline',
              gap: theme.spacing.xs,
            }}
          >
            <Text variant="title" color={tone} autoAlign={false}>
              {formatNumber(readiness.score)}%
            </Text>
          </View>
        </View>

        <Text variant="caption" color="textMuted">
          {verdict}
        </Text>

        {/* Coverage — built from what the parent said each photo shows. */}
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="micro" color="textFaint">
            {t.readiness.coverage.toUpperCase()}
          </Text>
          {readiness.coverage.map((item) => (
            <View
              key={item.role}
              accessible
              accessibilityLabel={`${roleLabel(item.role, t)}: ${
                item.state === 'present' ? t.readiness.present : t.readiness.missing
              }`}
              style={{
                flexDirection: isRtl ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              <Ionicons
                name={item.state === 'present' ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={item.state === 'present' ? theme.colors.success : theme.colors.borderStrong}
              />
              <Text
                variant="caption"
                color={item.state === 'present' ? 'text' : 'textFaint'}
                style={{ flex: 1 }}
              >
                {roleLabel(item.role, t)}
              </Text>
              <Text variant="micro" color="textFaint" autoAlign={false}>
                {item.importance === 'needed' ? t.readiness.needed : t.readiness.helpful}
              </Text>
            </View>
          ))}
        </View>

        {missingNeeded.length > 0 || missingHelpful.length > 0 ? (
          <Text variant="caption" color="textMuted">
            {format(t.readiness.addAngle, {
              role: roleLabel((missingNeeded[0] ?? missingHelpful[0]).role, t).toLowerCase(),
            })}
          </Text>
        ) : null}

        {/* Measured optics for the photo currently selected. */}
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="micro" color="textFaint">
            {t.readiness.whatWeChecked.toUpperCase()}
          </Text>
          {measured.map((item) => (
            <ScoreBar key={item.label} label={item.label} score={item.value} />
          ))}
        </View>

        {selected.issues.length > 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            {selected.issues.map((issue) => (
              <View
                key={issue.key}
                style={{
                  flexDirection: isRtl ? 'row-reverse' : 'row',
                  gap: theme.spacing.sm,
                  alignItems: 'flex-start',
                }}
              >
                <Ionicons
                  name="bulb-outline"
                  size={14}
                  color={issue.severity === 'warning' ? theme.colors.warning : theme.colors.textFaint}
                />
                <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
                  {issueLabel(issue, t)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {readiness.duplicatePairs.length > 0 ? (
          <Banner tone="warning" body={t.readiness.duplicateWarning} />
        ) : null}

        {/* We cannot tell whether an odd-looking photo is a different scene or
            a different child, so we ask rather than assert. */}
        {readiness.outliers.length > 0 ? (
          <Banner tone="warning" body={t.readiness.outlierWarning} />
        ) : null}

        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="micro" color="textFaint">
            {t.readiness.checkedOnDevice}
          </Text>
          {/* The honesty line. It is generated from the capability flags, so it
              stops being shown the moment a real vision model is connected. */}
          {!readiness.capabilities.detectsFace ? (
            <Text variant="micro" color="textFaint">
              {t.readiness.whatWeCannot}
            </Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

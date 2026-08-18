import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Badge } from './primitives';
import { useTheme } from '../theme/ThemeProvider';
import { EVIDENCE_GRADES, gradeTone } from '../analysis/evidence';
import type { EvidenceDirectness } from '../types/analysis';

/**
 * Displays the directness grade with its meaning one tap away.
 *
 * The expanded note repeats the caveat deliberately: the scale measures
 * distance from the text, not correctness.
 */
export function EvidenceGradeBadge({
  grade,
  expandable = true,
}: {
  grade: EvidenceDirectness;
  expandable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { spacing } = useTheme();
  const info = EVIDENCE_GRADES[grade];

  const badge = <Badge label={`${info.grade} — ${info.label}`} tone={gradeTone(grade)} size="md" />;

  if (!expandable) return badge;

  return (
    <View style={{ gap: spacing.sm }}>
      <Pressable onPress={() => setOpen((v) => !v)}>{badge}</Pressable>
      {open ? (
        <View style={{ gap: 4 }}>
          <AppText variant="tiny" tone="muted">
            {info.description}
          </AppText>
          <AppText variant="tiny" tone="faint">
            هذا التصنيف يقيس مدى مباشرة العلاقة بالنص فقط، ولا يعني أن (أ) صحيح وأن (هـ) خطأ.
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

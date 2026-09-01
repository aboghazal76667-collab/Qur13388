import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useI18n } from '@dd/i18n';
import { theme } from '@dd/theme/tokens';
import { T } from '@dd/components/ui';

/**
 * The step rail.
 *
 * Numbered because the flow genuinely is a sequence — fabric before colour,
 * pattern before thread colours. It auto-scrolls the active step into view, so
 * a later step is never stranded off the edge of a narrow phone as it was in
 * V1.
 */
export const StepRail: React.FC<{
  steps: { key: string; label: string }[];
  activeKey: string;
  onSelect: (key: string) => void;
}> = ({ steps, activeKey, onSelect }) => {
  const { dir } = useI18n();
  const ref = useRef<ScrollView>(null);
  const index = steps.findIndex((s) => s.key === activeKey);

  useEffect(() => {
    // Keep the current step visible without the customer having to hunt.
    const approxItemWidth = 96;
    ref.current?.scrollTo({ x: Math.max(0, (index - 1) * approxItemWidth), animated: true });
  }, [index]);

  return (
    <View
      style={{
        backgroundColor: theme.color.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.color.border,
      }}
    >
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: theme.space.lg,
          paddingVertical: theme.space.sm,
          gap: theme.space.xs,
          flexDirection: dir === 'rtl' ? 'row-reverse' : 'row',
        }}
      >
        {steps.map((s, i) => {
          const active = s.key === activeKey;
          const done = i < index;
          return (
            <Pressable
              key={s.key}
              onPress={() => onSelect(s.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={{
                paddingHorizontal: theme.space.md,
                paddingVertical: 7,
                minHeight: 34,
                justifyContent: 'center',
                borderRadius: theme.radius.pill,
                backgroundColor: active ? theme.color.accent : 'transparent',
              }}
            >
              <T
                variant="tiny"
                weight={active ? '700' : '500'}
                color={
                  active ? theme.color.accentText : done ? theme.color.text : theme.color.textFaint
                }
              >
                {`${i + 1}. ${s.label}`}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

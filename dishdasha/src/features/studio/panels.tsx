import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import { FabricCard, PatternCard, PatternPreview } from '@dd/components/cards';
import { Badge, Card, Chip, Notice, Row, Section, T } from '@dd/components/ui';
import { Swatch } from '@dd/components/ui/Swatch';
import { getColor, getThreadColor } from '@dd/data/colors';
import { OMANI_DISHDASHA } from '@dd/domain/garments';
import type { DesignConfig, EmbroideryPattern, Fabric, GarmentColor, ThreadColor } from '@dd/domain/types';
import { contrastRatio } from '@dd/engine/color';
import { formatMoney } from '@dd/engine/money';
import { useI18n } from '@dd/i18n';
import { theme } from '@dd/theme/tokens';

/** Step 1 — fabric. */
export const FabricPanel: React.FC<{
  fabrics: Fabric[];
  config: DesignConfig;
  onSelect: (fabricId: string) => void;
}> = ({ fabrics, config, onSelect }) => {
  const { t, L } = useI18n();
  const groups = useMemo(() => {
    const byCategory = new Map<string, Fabric[]>();
    for (const fabric of fabrics.filter((f) => f.active)) {
      byCategory.set(fabric.category, [...(byCategory.get(fabric.category) ?? []), fabric]);
    }
    return [...byCategory.entries()];
  }, [fabrics]);

  const labels: Record<string, string> = {
    light_summer: L({ ar: 'صيفي خفيف', en: 'Light summer' }),
    daily: L({ ar: 'يومي', en: 'Daily' }),
    premium: L({ ar: 'فاخر', en: 'Premium' }),
    formal: L({ ar: 'رسمي', en: 'Formal' }),
    winter: L({ ar: 'شتوي', en: 'Winter' }),
    easy_care: L({ ar: 'سهل العناية', en: 'Easy care' }),
  };

  return (
    <View style={{ gap: theme.space.xl }}>
      {groups.map(([category, list]) => (
        <Section key={category} title={labels[category] ?? category}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.space.md }}>
            {list.map((fabric) => (
              <FabricCard
                key={fabric.id}
                fabric={fabric}
                selected={fabric.id === config.fabricId}
                onPress={() => onSelect(fabric.id)}
              />
            ))}
          </ScrollView>
        </Section>
      ))}
      <Notice text={t('checkout.colorDisclaimer')} tone="info" />
    </View>
  );
};

/** Step 2 — base colour, limited to what the chosen fabric actually comes in. */
export const ColorPanel: React.FC<{
  colors: GarmentColor[];
  fabric: Fabric | undefined;
  config: DesignConfig;
  onSelect: (colorId: string) => void;
}> = ({ colors, fabric, config, onSelect }) => {
  const { t, L } = useI18n();
  const available = useMemo(() => {
    const allowed = new Set(fabric?.colorIds ?? colors.map((c) => c.id));
    return colors.filter((c) => c.active && allowed.has(c.id));
  }, [colors, fabric]);

  const unavailable = useMemo(() => {
    const allowed = new Set(fabric?.colorIds ?? []);
    return colors.filter((c) => c.active && !allowed.has(c.id));
  }, [colors, fabric]);

  return (
    <View style={{ gap: theme.space.xl }}>
      <Section title={t('studio.step.color')} subtitle={fabric ? L(fabric.name) : undefined}>
        <Row wrap gap={theme.space.md}>
          {available.map((color) => (
            <Swatch
              key={color.id}
              hex={color.hex}
              label={L(color.name)}
              selected={color.id === config.baseColorId}
              onPress={() => onSelect(color.id)}
            />
          ))}
        </Row>
      </Section>
      {unavailable.length > 0 ? (
        <Section
          title={L({ ar: 'غير متوفر في هذا القماش', en: 'Not available in this fabric' })}
        >
          <Row wrap gap={theme.space.md}>
            {unavailable.slice(0, 10).map((color) => (
              <Swatch key={color.id} hex={color.hex} label={L(color.name)} disabled />
            ))}
          </Row>
        </Section>
      ) : null}
    </View>
  );
};

/** Step 3 — embroidery pattern. */
export const PatternPanel: React.FC<{
  patterns: EmbroideryPattern[];
  config: DesignConfig;
  onSelect: (patternId: string | null) => void;
}> = ({ patterns, config, onSelect }) => {
  const { t, L, lang } = useI18n();
  const families = useMemo(() => {
    const map = new Map<string, EmbroideryPattern[]>();
    for (const p of patterns.filter((x) => x.active && x.motif !== 'none')) {
      map.set(p.styleFamily, [...(map.get(p.styleFamily) ?? []), p]);
    }
    return [...map.entries()];
  }, [patterns]);

  const familyLabels: Record<string, string> = {
    omani_traditional: L({ ar: 'تقليدي عُماني', en: 'Omani traditional' }),
    omani_contemporary: L({ ar: 'عُماني معاصر', en: 'Omani contemporary' }),
    geometric: L({ ar: 'هندسي', en: 'Geometric' }),
    minimal: L({ ar: 'بسيط', en: 'Minimal' }),
  };

  return (
    <View style={{ gap: theme.space.xl }}>
      <Card onPress={() => onSelect(null)} style={{ borderColor: config.embroideryPatternId === null ? theme.color.accent : theme.color.border, borderWidth: config.embroideryPatternId === null ? 2 : 1 }}>
        <Row justify="space-between">
          <T variant="small" weight="700">
            {t('studio.noPattern')}
          </T>
          <T variant="tiny" color={theme.color.textMuted}>
            {formatMoney(0, lang)}
          </T>
        </Row>
      </Card>
      {families.map(([family, list]) => (
        <Section key={family} title={familyLabels[family] ?? family}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.space.md }}>
            {list.map((pattern) => (
              <PatternCard
                key={pattern.id}
                pattern={pattern}
                selected={pattern.id === config.embroideryPatternId}
                threadColorIds={pattern.id === config.embroideryPatternId ? config.threadColorIds : undefined}
                onPress={() => onSelect(pattern.id)}
              />
            ))}
          </ScrollView>
        </Section>
      ))}
    </View>
  );
};

/**
 * Step 4 — thread channels.
 *
 * Each channel is its own picker, and each change repaints only that thread.
 * A contrast warning appears when a chosen thread would nearly disappear into
 * the fabric — the one mistake that is expensive to discover after stitching.
 */
export const ThreadPanel: React.FC<{
  threads: ThreadColor[];
  pattern: EmbroideryPattern | undefined;
  config: DesignConfig;
  onSelect: (channelIndex: number, threadColorId: string) => void;
}> = ({ threads, pattern, config, onSelect }) => {
  const { t, L } = useI18n();
  const baseHex = getColor(config.baseColorId)?.hex ?? '#FFFFFF';

  if (!pattern || pattern.motif === 'none') {
    return <Notice text={t('studio.noPattern')} tone="info" />;
  }

  const channelKeys = ['studio.thread1', 'studio.thread2', 'studio.thread3'] as const;

  return (
    <View style={{ gap: theme.space.xl }}>
      <Notice text={t('studio.threadsHint')} tone="info" />
      <Row gap={theme.space.md} align="center">
        <View style={{ backgroundColor: theme.color.bgSunken, borderRadius: theme.radius.sm, padding: theme.space.sm }}>
          <PatternPreview pattern={pattern} threadColorIds={config.threadColorIds} width={52} height={88} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <T variant="small" weight="700">
            {L(pattern.name)}
          </T>
          <T variant="tiny" color={theme.color.textMuted}>
            {pattern.code} · {pattern.channelCount} {t('studio.thread')}
          </T>
        </View>
      </Row>

      {pattern.channels.map((channel, index) => {
        const selectedId = config.threadColorIds[index];
        const selectedThread = getThreadColor(selectedId);
        const ratio = selectedThread ? contrastRatio(baseHex, selectedThread.hex) : 99;
        const tooClose = ratio < 1.25;
        return (
          <Section
            key={channel.index}
            title={t(channelKeys[index] ?? 'studio.thread')}
            subtitle={L(channel.label)}
          >
            {tooClose ? (
              <Notice
                tone="warning"
                text={L({
                  ar: 'هذا الخيط قريب جداً من لون القماش وقد لا يظهر النقش بوضوح.',
                  en: 'This thread is very close to the fabric colour — the pattern may barely show.',
                })}
              />
            ) : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.space.md, paddingVertical: 4 }}>
              {threads
                .filter((th) => th.active)
                .map((thread) => (
                  <Swatch
                    key={thread.id}
                    hex={thread.hex}
                    label={L(thread.name)}
                    metallic={thread.metallic}
                    size={44}
                    selected={thread.id === selectedId}
                    onPress={() => onSelect(index, thread.id)}
                  />
                ))}
            </ScrollView>
          </Section>
        );
      })}
    </View>
  );
};

/** Step 5 — furakha colour and length. */
export const FurakhaPanel: React.FC<{
  threads: ThreadColor[];
  config: DesignConfig;
  onColor: (threadId: string) => void;
  onLength: (optionId: string) => void;
}> = ({ threads, config, onColor, onLength }) => {
  const { t, L } = useI18n();
  const lengthComponent = OMANI_DISHDASHA.components.find((c) => c.id === 'furakha_length');

  return (
    <View style={{ gap: theme.space.xl }}>
      <Section title={t('studio.furakhaColor')}>
        <Row wrap gap={theme.space.md}>
          {threads
            .filter((th) => th.active)
            .map((thread) => (
              <Swatch
                key={thread.id}
                hex={thread.hex}
                label={L(thread.name)}
                metallic={thread.metallic}
                size={44}
                selected={thread.id === config.furakhaColorId}
                onPress={() => onColor(thread.id)}
              />
            ))}
        </Row>
      </Section>
      {lengthComponent ? (
        <Section title={t('studio.furakhaLength')}>
          <Row wrap gap={theme.space.sm}>
            {lengthComponent.options.map((option) => (
              <Chip
                key={option.id}
                label={L(option.label)}
                selected={config.componentOptions.furakha_length === option.id}
                onPress={() => onLength(option.id)}
              />
            ))}
          </Row>
        </Section>
      ) : null}
    </View>
  );
};

/** Step 6 — collar, cuffs, pocket. */
export const DetailsPanel: React.FC<{
  config: DesignConfig;
  onSelect: (componentId: string, optionId: string) => void;
}> = ({ config, onSelect }) => {
  const { L, lang } = useI18n();
  const components = OMANI_DISHDASHA.components.filter((c) => c.id !== 'furakha_length');

  return (
    <View style={{ gap: theme.space.xl }}>
      {components.map((component) => (
        <Section key={component.id} title={L(component.label)}>
          <View style={{ gap: theme.space.sm }}>
            {component.options.map((option) => {
              const selected = config.componentOptions[component.id] === option.id;
              return (
                <Card
                  key={option.id}
                  onPress={() => onSelect(component.id, option.id)}
                  style={{ borderColor: selected ? theme.color.accent : theme.color.border, borderWidth: selected ? 2 : 1 }}
                >
                  <Row justify="space-between" align="flex-start">
                    <View style={{ flex: 1, gap: 3 }}>
                      <T variant="small" weight={selected ? '700' : '500'}>
                        {L(option.label)}
                      </T>
                      {option.description ? (
                        <T variant="tiny" color={theme.color.textMuted}>
                          {L(option.description)}
                        </T>
                      ) : null}
                    </View>
                    {option.surcharge > 0 ? (
                      <Badge label={`+ ${formatMoney(option.surcharge, lang)}`} tone="accent" />
                    ) : null}
                  </Row>
                </Card>
              );
            })}
          </View>
        </Section>
      ))}
    </View>
  );
};

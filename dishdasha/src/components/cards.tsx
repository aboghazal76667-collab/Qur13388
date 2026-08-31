import React from 'react';
import { Pressable, View } from 'react-native';

import { DishdashaFigure } from '@dd/components/dishdasha/DishdashaFigure';
import { PatternBandPreview } from '@dd/components/dishdasha/PatternBandPreview';
import { Badge, Card, Row, T } from '@dd/components/ui';
import { PaletteStrip } from '@dd/components/ui/Swatch';
import { colorHex, getColor, getThreadColor, threadHex } from '@dd/data/colors';
import { getFabric } from '@dd/data/fabrics';
import { getPattern } from '@dd/data/embroidery';
import { getTailor } from '@dd/data/tailors';
import type {
  Design,
  DesignConfig,
  EmbroideryPattern,
  Fabric,
  Order,
  PaletteSuggestion,
  TailorBusiness,
} from '@dd/domain/types';
import { formatMoney } from '@dd/engine/money';
import { customerStage } from '@dd/engine/orders';
import { useI18n } from '@dd/i18n';
import { theme } from '@dd/theme/tokens';
import { formatDate } from '@dd/utils/date';

/** One-line description of a configuration: fabric · colour · pattern. */
export const configSummary = (config: DesignConfig, L: (v: { ar: string; en: string } | string | undefined) => string) => {
  const fabric = getFabric(config.fabricId);
  const color = getColor(config.baseColorId);
  const pattern = getPattern(config.embroideryPatternId);
  return [L(fabric?.name), L(color?.name), pattern ? L(pattern.name) : null]
    .filter(Boolean)
    .join(' · ');
};

export const paletteHexes = (config: DesignConfig): string[] => [
  colorHex(config.baseColorId),
  ...config.threadColorIds.map((id) => threadHex(id)),
];

export const DesignCard: React.FC<{
  design: Design;
  onPress?: () => void;
  onToggleFavorite?: () => void;
  width?: number;
}> = ({ design, onPress, onToggleFavorite, width = 168 }) => {
  const { L, lang } = useI18n();
  return (
    <Card onPress={onPress} padded={false} style={{ width }}>
      <View style={{ backgroundColor: theme.color.bgSunken, alignItems: 'center', paddingVertical: theme.space.md }}>
        <DishdashaFigure config={design.config} width={92} height={144} transparentBackground />
      </View>
      <View style={{ padding: theme.space.md, gap: 6 }}>
        <Row justify="space-between">
          <T variant="small" weight="700" numberOfLines={1} style={{ flex: 1 }}>
            {design.name}
          </T>
          {onToggleFavorite ? (
            <Pressable onPress={onToggleFavorite} hitSlop={8} accessibilityRole="button">
              <T variant="small" color={design.isFavorite ? theme.color.accent : theme.color.textFaint}>
                {design.isFavorite ? '★' : '☆'}
              </T>
            </Pressable>
          ) : null}
        </Row>
        <T variant="tiny" color={theme.color.textMuted} numberOfLines={1}>
          {configSummary(design.config, L)}
        </T>
        <PaletteStrip hexes={paletteHexes(design.config)} size={14} />
        {design.priceSnapshot ? (
          <T variant="tiny" color={theme.color.accent} weight="700">
            {formatMoney(design.priceSnapshot.total, lang)}
          </T>
        ) : null}
      </View>
    </Card>
  );
};

export const PaletteCard: React.FC<{
  palette: PaletteSuggestion;
  onApply: () => void;
  compact?: boolean;
  previewConfig?: DesignConfig;
}> = ({ palette, onApply, compact, previewConfig }) => {
  const { t, L } = useI18n();
  const base = getColor(palette.baseColorId);
  const hexes = [
    colorHex(palette.baseColorId),
    ...palette.threadColorIds.map((id) => threadHex(id)),
  ];

  return (
    <Card onPress={onApply} padded={false} style={{ width: compact ? 210 : undefined }}>
      <Row align="stretch" gap={0}>
        {previewConfig ? (
          <View
            style={{
              backgroundColor: theme.color.bgSunken,
              paddingHorizontal: theme.space.sm,
              justifyContent: 'center',
            }}
          >
            <DishdashaFigure config={previewConfig} width={62} height={97} transparentBackground />
          </View>
        ) : null}
        <View style={{ flex: 1, padding: theme.space.md, gap: 8 }}>
          <Row justify="space-between">
            <Badge label={t(`personality.${palette.personality}` as const)} tone="accent" />
            <T variant="tiny" color={theme.color.textMuted} weight="700">
              {Math.round(palette.matchScore * 100)}% {t('stylist.match')}
            </T>
          </Row>
          <PaletteStrip hexes={hexes} size={18} label={L(base?.name)} />
          <T variant="tiny" color={theme.color.textMuted} numberOfLines={compact ? 3 : 5}>
            {L(palette.reason)}
          </T>
        </View>
      </Row>
    </Card>
  );
};

export const FabricCard: React.FC<{
  fabric: Fabric;
  onPress?: () => void;
  selected?: boolean;
  width?: number;
}> = ({ fabric, onPress, selected, width = 190 }) => {
  const { L, t, lang } = useI18n();
  const swatchColors = fabric.colorIds.slice(0, 5).map((id) => colorHex(id));
  return (
    <Card
      onPress={onPress}
      style={{ width, borderColor: selected ? theme.color.accent : theme.color.border, borderWidth: selected ? 2 : 1 }}
    >
      <View style={{ gap: 8 }}>
        <Row justify="space-between">
          <T variant="small" weight="700" numberOfLines={1} style={{ flex: 1 }}>
            {L(fabric.name)}
          </T>
          {!fabric.inStock ? <Badge label={t('error.fabricUnavailable')} tone="danger" /> : null}
        </Row>
        <T variant="tiny" color={theme.color.textFaint}>
          {fabric.brand} · {L(fabric.collection)}
        </T>
        <PaletteStrip hexes={swatchColors} size={16} />
        <Row justify="space-between">
          <T variant="tiny" color={theme.color.textMuted}>
            {fabric.composition ?? '—'}
          </T>
          <T variant="small" weight="700" color={theme.color.accent}>
            {formatMoney(fabric.pricePerGarment, lang)}
          </T>
        </Row>
      </View>
    </Card>
  );
};

export const PatternCard: React.FC<{
  pattern: EmbroideryPattern;
  onPress?: () => void;
  selected?: boolean;
  threadColorIds?: string[];
  width?: number;
}> = ({ pattern, onPress, selected, threadColorIds, width = 140 }) => {
  const { L, t, lang } = useI18n();
  const threads = threadColorIds ?? pattern.channels.map((c) => c.defaultThreadColorId);
  return (
    <Card
      onPress={onPress}
      padded={false}
      style={{ width, borderColor: selected ? theme.color.accent : theme.color.border, borderWidth: selected ? 2 : 1 }}
    >
      <View style={{ backgroundColor: theme.color.bgSunken, alignItems: 'center', paddingVertical: theme.space.sm }}>
        <PatternPreview pattern={pattern} threadColorIds={threads} />
      </View>
      <View style={{ padding: theme.space.md, gap: 4 }}>
        <Row justify="space-between">
          <T variant="tiny" weight="700" numberOfLines={1} style={{ flex: 1 }}>
            {L(pattern.name)}
          </T>
          {pattern.isNew ? <Badge label={t('common.new')} tone="success" /> : null}
        </Row>
        <T variant="tiny" color={theme.color.textFaint}>
          {pattern.code} · {pattern.channelCount} {t('studio.thread')}
        </T>
        {pattern.surcharge > 0 ? (
          <T variant="tiny" color={theme.color.accent} weight="700">
            + {formatMoney(pattern.surcharge, lang)}
          </T>
        ) : (
          <T variant="tiny" color={theme.color.textFaint}>
            {t('common.none')}
          </T>
        )}
      </View>
    </Card>
  );
};

/** Small standalone swatch of a pattern, drawn with the live thread colours. */
export const PatternPreview: React.FC<{
  pattern: EmbroideryPattern;
  threadColorIds: string[];
  width?: number;
  height?: number;
}> = ({ pattern, threadColorIds, width = 44, height = 76 }) => (
  <PatternBandPreview
    motif={pattern.motif}
    c1={threadHex(threadColorIds[0] ?? 'th_navy')}
    c2={threadHex(threadColorIds[1] ?? threadColorIds[0] ?? 'th_silver')}
    c3={threadHex(threadColorIds[2] ?? threadColorIds[0] ?? 'th_white')}
    width={width}
    height={height}
  />
);

export const TailorCard: React.FC<{
  tailor: TailorBusiness;
  onPress?: () => void;
  selected?: boolean;
}> = ({ tailor, onPress, selected }) => {
  const { L, t, lang } = useI18n();
  return (
    <Card
      onPress={onPress}
      style={{ borderColor: selected ? theme.color.accent : theme.color.border, borderWidth: selected ? 2 : 1 }}
    >
      <Row gap={theme.space.md} align="flex-start">
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: theme.radius.sm,
            backgroundColor: tailor.logoColor,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <T variant="small" weight="700" color="#FFFFFF">
            {tailor.logoInitials}
          </T>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Row justify="space-between">
            <T variant="small" weight="700" numberOfLines={1} style={{ flex: 1 }}>
              {L(tailor.name)}
            </T>
            {tailor.isDemoData ? <Badge label={t('common.demo')} tone="warning" /> : null}
          </Row>
          <T variant="tiny" color={theme.color.textMuted} numberOfLines={2}>
            {L(tailor.about)}
          </T>
          <Row gap={theme.space.md} wrap>
            <T variant="tiny" color={theme.color.textFaint}>
              {t('tailor.productionTime')}: {tailor.productionDays.min}–{tailor.productionDays.max} {t('common.days')}
            </T>
            <T variant="tiny" color={theme.color.accent} weight="700">
              {t('common.from')} {formatMoney(tailor.startingPrice, lang)}
            </T>
          </Row>
        </View>
      </Row>
    </Card>
  );
};

export const OrderCard: React.FC<{ order: Order; onPress?: () => void }> = ({ order, onPress }) => {
  const { t, L, lang } = useI18n();
  const tailor = getTailor(order.tailorBusinessId);
  const stage = customerStage(order.status);
  const first = order.items[0];
  return (
    <Card onPress={onPress} padded={false}>
      <Row align="stretch" gap={0}>
        {first ? (
          <View style={{ backgroundColor: theme.color.bgSunken, paddingHorizontal: theme.space.sm, justifyContent: 'center' }}>
            <DishdashaFigure config={first.config} width={62} height={97} transparentBackground />
          </View>
        ) : null}
        <View style={{ flex: 1, padding: theme.space.md, gap: 6 }}>
          <Row justify="space-between">
            <T variant="small" weight="700">
              {order.number}
            </T>
            <Badge
              label={t(`customerStatus.${stage}` as const)}
              tone={stage === 'delivered' ? 'success' : stage === 'ready' ? 'accent' : 'info'}
            />
          </Row>
          <T variant="tiny" color={theme.color.textMuted} numberOfLines={1}>
            {L(tailor?.name)}
          </T>
          {first ? (
            <T variant="tiny" color={theme.color.textFaint} numberOfLines={1}>
              {configSummary(first.config, L)}
            </T>
          ) : null}
          <Row justify="space-between">
            <T variant="tiny" color={theme.color.textFaint}>
              {formatDate(order.createdAt, lang)}
            </T>
            <T variant="small" weight="700" color={theme.color.accent}>
              {formatMoney(order.price.total, lang)}
            </T>
          </Row>
        </View>
      </Row>
    </Card>
  );
};

export const ThreadDot: React.FC<{ threadId: string; size?: number }> = ({ threadId, size = 16 }) => {
  const thread = getThreadColor(threadId);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: thread?.hex ?? '#CCC',
        borderWidth: 1,
        borderColor: theme.color.border,
      }}
    />
  );
};

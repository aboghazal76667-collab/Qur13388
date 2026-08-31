import React, { useMemo, useState } from 'react';
import { ScrollView, Switch, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';

import { Badge, Button, Card, Chip, Notice, Row, Section, T } from '@dd/components/ui';
import { Swatch } from '@dd/components/ui/Swatch';
import { hexToHsl, normalizeHex } from '@dd/engine/color';
import { formatMoney } from '@dd/engine/money';
import { ordersRevenue } from '@dd/engine/orders';
import { useI18n } from '@dd/i18n';
import { aiTelemetry } from '@dd/services/ai';
import { analytics, funnelCounts } from '@dd/services/analytics';
import { useCatalogStore } from '@dd/store/catalogStore';
import { useOrdersStore } from '@dd/store/ordersStore';
import { theme } from '@dd/theme/tokens';

/**
 * DEMO ADMIN.
 *
 * Enough to prove the merchant-controlled catalogue is real data and not
 * hardcoded UI: toggling a fabric off removes it from the studio immediately,
 * and a price edit flows through pricing everywhere. Persisted locally while
 * in demo mode.
 */
type Tab = 'catalog' | 'pricing' | 'metrics';

export default function Admin() {
  const { t, L, lang } = useI18n();
  const [tab, setTab] = useState<Tab>('catalog');

  const fabrics = useCatalogStore((s) => s.fabrics);
  const patterns = useCatalogStore((s) => s.patterns);
  const colors = useCatalogStore((s) => s.colors);
  const setFabricActive = useCatalogStore((s) => s.setFabricActive);
  const setFabricStock = useCatalogStore((s) => s.setFabricStock);
  const setFabricPrice = useCatalogStore((s) => s.setFabricPrice);
  const setPatternActive = useCatalogStore((s) => s.setPatternActive);
  const setPatternSurcharge = useCatalogStore((s) => s.setPatternSurcharge);
  const addColor = useCatalogStore((s) => s.addColor);
  const resetCatalog = useCatalogStore((s) => s.resetCatalog);

  const orders = useOrdersStore((s) => s.orders);

  const [newColorHex, setNewColorHex] = useState('#');
  const [newColorName, setNewColorName] = useState('');

  const funnel = useMemo(() => funnelCounts(analytics.recent(300)), []);
  const aiLogs = aiTelemetry.all();

  return (
    <>
      <Stack.Screen options={{ title: t('admin.title') }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.color.bg }}
        contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.xl, paddingBottom: theme.space.xxxl }}
      >
        <Notice text={t('admin.localOnly')} tone="warning" />
        <Row gap={theme.space.sm}>
          <Chip label={t('admin.catalog')} selected={tab === 'catalog'} onPress={() => setTab('catalog')} />
          <Chip label={t('admin.pricing')} selected={tab === 'pricing'} onPress={() => setTab('pricing')} />
          <Chip label={t('admin.metrics')} selected={tab === 'metrics'} onPress={() => setTab('metrics')} />
        </Row>

        {tab === 'catalog' ? (
          <>
            <Section title={t('admin.fabrics')}>
              <View style={{ gap: theme.space.sm }}>
                {fabrics.map((fabric) => (
                  <Card key={fabric.id}>
                    <Row justify="space-between" align="flex-start">
                      <View style={{ flex: 1, gap: 4 }}>
                        <T variant="small" weight="700">
                          {L(fabric.name)}
                        </T>
                        <T variant="tiny" color={theme.color.textFaint}>
                          {fabric.brand} · {formatMoney(fabric.pricePerGarment, lang)}
                        </T>
                        <Row gap={theme.space.sm}>
                          <Badge label={fabric.inStock ? 'in stock' : 'out of stock'} tone={fabric.inStock ? 'success' : 'danger'} />
                          <Badge label={String(fabric.colorIds.length) + ' colours'} tone="neutral" />
                        </Row>
                      </View>
                      <View style={{ gap: theme.space.sm, alignItems: 'flex-end' }}>
                        <Switch
                          value={fabric.active}
                          onValueChange={(v) => setFabricActive(fabric.id, v)}
                          trackColor={{ true: theme.color.accent, false: theme.color.border }}
                        />
                        <Chip
                          label={fabric.inStock ? L({ ar: 'إيقاف المخزون', en: 'Mark out' }) : L({ ar: 'توفير', en: 'Mark in' })}
                          onPress={() => setFabricStock(fabric.id, !fabric.inStock)}
                          small
                        />
                      </View>
                    </Row>
                  </Card>
                ))}
              </View>
            </Section>

            <Section title={t('admin.patterns')}>
              <View style={{ gap: theme.space.sm }}>
                {patterns
                  .filter((p) => p.motif !== 'none')
                  .map((pattern) => (
                    <Card key={pattern.id}>
                      <Row justify="space-between">
                        <View style={{ gap: 4 }}>
                          <T variant="small" weight="700">
                            {pattern.code} · {L(pattern.name)}
                          </T>
                          <T variant="tiny" color={theme.color.textFaint}>
                            {pattern.channelCount} {t('studio.thread')} · {formatMoney(pattern.surcharge, lang)}
                          </T>
                        </View>
                        <Switch
                          value={pattern.active}
                          onValueChange={(v) => setPatternActive(pattern.id, v)}
                          trackColor={{ true: theme.color.accent, false: theme.color.border }}
                        />
                      </Row>
                    </Card>
                  ))}
              </View>
            </Section>

            <Section title={t('admin.addColor')}>
              <Card>
                <View style={{ gap: theme.space.md }}>
                  <Row gap={theme.space.sm}>
                    <TextInput
                      value={newColorName}
                      onChangeText={setNewColorName}
                      placeholder={L({ ar: 'اسم اللون', en: 'Colour name' })}
                      placeholderTextColor={theme.color.textFaint}
                      style={{ flex: 1, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.sm, padding: theme.space.md, minHeight: theme.hit, color: theme.color.text }}
                    />
                    <TextInput
                      value={newColorHex}
                      onChangeText={setNewColorHex}
                      autoCapitalize="characters"
                      placeholder="#RRGGBB"
                      placeholderTextColor={theme.color.textFaint}
                      style={{ width: 120, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.sm, padding: theme.space.md, minHeight: theme.hit, color: theme.color.text }}
                    />
                  </Row>
                  <Row gap={theme.space.md}>
                    <Swatch hex={normalizeHex(newColorHex)} size={40} />
                    <Button
                      label={t('admin.addColor')}
                      variant="secondary"
                      onPress={() => {
                        const hex = normalizeHex(newColorHex);
                        if (hex === '#000000' && newColorHex.replace('#', '').length !== 6) return;
                        addColor({
                          id: `col_custom_${Date.now()}`,
                          name: { ar: newColorName || hex, en: newColorName || hex },
                          hex,
                          family: hexToHsl(hex).s < 12 ? 'grey' : 'accent',
                          active: true,
                        });
                        setNewColorName('');
                        setNewColorHex('#');
                      }}
                    />
                  </Row>
                  <T variant="tiny" color={theme.color.textFaint}>
                    {colors.length} {t('discover.colors')}
                  </T>
                </View>
              </Card>
            </Section>

            <Button label={t('common.reset')} variant="danger" onPress={resetCatalog} full />
          </>
        ) : null}

        {tab === 'pricing' ? (
          <Section title={t('admin.pricing')}>
            <View style={{ gap: theme.space.sm }}>
              {fabrics.map((fabric) => (
                <Card key={fabric.id}>
                  <Row justify="space-between" align="center">
                    <T variant="small" style={{ flex: 1 }} numberOfLines={1}>
                      {L(fabric.name)}
                    </T>
                    <TextInput
                      defaultValue={String(fabric.pricePerGarment)}
                      onEndEditing={(e) => {
                        const value = Number(e.nativeEvent.text.replace(',', '.'));
                        if (Number.isFinite(value)) setFabricPrice(fabric.id, value);
                      }}
                      keyboardType="decimal-pad"
                      style={{ width: 96, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.sm, padding: theme.space.sm, minHeight: theme.hit, color: theme.color.text, textAlign: 'center' }}
                    />
                  </Row>
                </Card>
              ))}
              {patterns
                .filter((p) => p.motif !== 'none')
                .map((pattern) => (
                  <Card key={pattern.id}>
                    <Row justify="space-between" align="center">
                      <T variant="small" style={{ flex: 1 }} numberOfLines={1}>
                        {pattern.code} · {L(pattern.name)}
                      </T>
                      <TextInput
                        defaultValue={String(pattern.surcharge)}
                        onEndEditing={(e) => {
                          const value = Number(e.nativeEvent.text.replace(',', '.'));
                          if (Number.isFinite(value)) setPatternSurcharge(pattern.id, value);
                        }}
                        keyboardType="decimal-pad"
                        style={{ width: 96, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.sm, padding: theme.space.sm, minHeight: theme.hit, color: theme.color.text, textAlign: 'center' }}
                      />
                    </Row>
                  </Card>
                ))}
            </View>
          </Section>
        ) : null}

        {tab === 'metrics' ? (
          <>
            <Section title={t('admin.orders')}>
              <Row gap={theme.space.md} wrap>
                <MetricTile label={t('admin.orders')} value={String(orders.length)} />
                <MetricTile label={t('common.total')} value={formatMoney(ordersRevenue(orders), lang)} />
                <MetricTile
                  label={L({ ar: 'متوسط قيمة الطلب', en: 'Avg order value' })}
                  value={orders.length ? formatMoney(ordersRevenue(orders) / orders.length, lang) : '—'}
                />
                <MetricTile label={t('admin.aiGenerations')} value={String(aiLogs.length)} />
              </Row>
            </Section>

            <Section title={L({ ar: 'مسار التحويل (هذه الجلسة)', en: 'Funnel (this session)' })}>
              <Card>
                <View style={{ gap: 6 }}>
                  <FunnelRow label="design_started" value={funnel.designStarted} />
                  <FunnelRow label="checkout_started" value={funnel.checkoutStarted} />
                  <FunnelRow label="order_created" value={funnel.ordersCreated} />
                  <FunnelRow label="preview_generated" value={funnel.previews} />
                  <FunnelRow label="design → checkout" value={`${Math.round(funnel.designToCheckout * 100)}%`} />
                  <FunnelRow label="checkout → order" value={`${Math.round(funnel.checkoutToOrder * 100)}%`} />
                  <FunnelRow label="stylist adoption" value={`${Math.round(funnel.stylistAdoption * 100)}%`} />
                  <FunnelRow label="palette adoption" value={`${Math.round(funnel.paletteAdoption * 100)}%`} />
                </View>
              </Card>
            </Section>

            <Section title={t('admin.aiGenerations')}>
              <Card>
                <View style={{ gap: 6 }}>
                  {aiLogs.length === 0 ? (
                    <T variant="tiny" color={theme.color.textFaint}>
                      —
                    </T>
                  ) : (
                    aiLogs.slice(0, 12).map((log) => (
                      <Row key={log.id} justify="space-between">
                        <T variant="tiny" color={theme.color.textMuted}>
                          {log.kind} · {log.provider}
                        </T>
                        <T variant="tiny" color={log.status === 'succeeded' ? theme.color.success : theme.color.danger}>
                          {log.status} · {log.latencyMs}ms
                        </T>
                      </Row>
                    ))
                  )}
                </View>
              </Card>
            </Section>
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

const MetricTile: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Card style={{ minWidth: 150, flexGrow: 1 }}>
    <View style={{ gap: 4 }}>
      <T variant="tiny" color={theme.color.textMuted}>
        {label}
      </T>
      <T variant="heading">{value}</T>
    </View>
  </Card>
);

const FunnelRow: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <Row justify="space-between">
    <T variant="tiny" color={theme.color.textMuted}>
      {label}
    </T>
    <T variant="tiny" weight="700">
      {value}
    </T>
  </Row>
);

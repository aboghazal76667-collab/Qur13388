import React from 'react';
import { ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { DishdashaFigure } from '@dd/components/dishdasha/DishdashaFigure';
import { PatternPreview } from '@dd/components/cards';
import { Badge, Button, Card, Divider, EmptyState, Notice, Row, Section, T } from '@dd/components/ui';
import { getColor, getThreadColor } from '@dd/data/colors';
import { getFabric } from '@dd/data/fabrics';
import { getPattern } from '@dd/data/embroidery';
import { getTailor } from '@dd/data/tailors';
import { getMeasurementTemplate } from '@dd/domain/measurementTemplates';
import { formatMoney } from '@dd/engine/money';
import { isTerminal, nextStatus } from '@dd/engine/orders';
import { ltr, useI18n, type StringKey } from '@dd/i18n';
import { useOrdersStore } from '@dd/store/ordersStore';
import { useProfileStore } from '@dd/store/profileStore';
import { theme } from '@dd/theme/tokens';
import { formatDate, formatDateTime } from '@dd/utils/date';

/**
 * THE DIGITAL TAILORING TICKET.
 *
 * This screen replaces a WhatsApp screenshot and a handwritten note. Every
 * value a cutter or stitcher needs is on it, unambiguous and in one place:
 * exact colour names AND hex references, the pattern code, which thread goes
 * in which channel, the frozen measurement snapshot, and the due date.
 */
export default function TailorTicket() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, L, lang } = useI18n();

  const order = useOrdersStore((s) => s.orders.find((o) => o.id === id));
  const advance = useOrdersStore((s) => s.advance);
  const customerName = useProfileStore((s) => s.customer.name);

  if (!order) {
    return (
      <>
        <Stack.Screen options={{ title: t('dash.ticket') }} />
        <View style={{ flex: 1, backgroundColor: theme.color.bg, justifyContent: 'center' }}>
          <EmptyState title={t('error.notFound')} action={{ label: t('common.back'), onPress: () => router.back() }} />
        </View>
      </>
    );
  }

  const tailor = getTailor(order.tailorBusinessId);
  const upcoming = nextStatus(order.status, order.fulfilment);

  return (
    <>
      <Stack.Screen options={{ title: order.number }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.color.bg }}
        contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.lg, paddingBottom: theme.space.xxxl }}
      >
        <Card>
          <View style={{ gap: theme.space.sm }}>
            <Row justify="space-between">
              <T variant="title">{order.number}</T>
              <Badge label={t(`status.${order.status}` as StringKey)} tone="info" />
            </Row>
            <Divider />
            <TicketRow label={t('dash.customer')} value={customerName || '—'} />
            <TicketRow label={t('checkout.tailor')} value={L(tailor?.name)} />
            <TicketRow label={t('dash.due')} value={formatDate(order.expectedReadyAt, lang)} />
            <TicketRow label={t('orders.placedOn')} value={formatDate(order.createdAt, lang)} />
            <TicketRow
              label={t('dash.paid')}
              value={order.payment?.status === 'paid' ? t('dash.paid.yes') : t('dash.paid.no')}
            />
            <TicketRow
              label={t('checkout.delivery')}
              value={order.fulfilment === 'pickup' ? t('checkout.pickup') : t('checkout.homeDelivery')}
            />
          </View>
        </Card>

        {order.items.map((item, index) => {
          const fabric = getFabric(item.config.fabricId);
          const color = getColor(item.config.baseColorId);
          const pattern = getPattern(item.config.embroideryPatternId);
          const furakha = getThreadColor(item.config.furakhaColorId);
          const template = item.measurementSnapshot
            ? getMeasurementTemplate(item.measurementSnapshot.templateId)
            : null;

          return (
            <Card key={item.id}>
              <View style={{ gap: theme.space.md }}>
                <Row justify="space-between">
                  <T variant="heading">
                    #{index + 1} · {item.quantity} {t('dash.qty')}
                  </T>
                  <T variant="small" weight="700" color={theme.color.accent}>
                    {formatMoney(item.price.total, lang)}
                  </T>
                </Row>

                <Row gap={theme.space.md} align="flex-start">
                  <View style={{ backgroundColor: theme.color.bgSunken, borderRadius: theme.radius.sm, padding: 6 }}>
                    <DishdashaFigure config={item.config} width={92} height={144} transparentBackground />
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    <TicketRow label={t('studio.step.fabric')} value={`${fabric?.brand ?? ''} · ${L(fabric?.name)}`} />
                    <TicketRow label={t('studio.step.color')} value={`${L(color?.name)} · ${ltr(color?.hex)}`} />
                    <TicketRow label={t('studio.step.pattern')} value={pattern ? `${pattern.code} · ${L(pattern.name)}` : t('studio.noPattern')} />
                    <TicketRow label={t('studio.furakhaColor')} value={`${L(furakha?.name)} · ${ltr(furakha?.hex)}`} />
                  </View>
                </Row>

                {pattern && pattern.motif !== 'none' ? (
                  <Section title={t('dash.threadRefs')}>
                    <Row gap={theme.space.md} align="flex-start">
                      <View style={{ backgroundColor: theme.color.bgSunken, borderRadius: theme.radius.sm, padding: 6 }}>
                        <PatternPreview pattern={pattern} threadColorIds={item.config.threadColorIds} width={46} height={80} />
                      </View>
                      <View style={{ flex: 1, gap: 6 }}>
                        {pattern.channels.map((channel, ci) => {
                          const thread = getThreadColor(item.config.threadColorIds[ci] ?? '');
                          return (
                            <Row key={channel.index} justify="space-between">
                              <Row gap={theme.space.sm}>
                                <View
                                  style={{
                                    width: 18,
                                    height: 18,
                                    borderRadius: 4,
                                    backgroundColor: thread?.hex ?? '#CCC',
                                    borderWidth: 1,
                                    borderColor: theme.color.border,
                                  }}
                                />
                                <T variant="tiny" color={theme.color.textMuted}>
                                  {t(`studio.thread${channel.index}` as StringKey)}
                                </T>
                              </Row>
                              <T variant="tiny" weight="700">
                                {L(thread?.name)} · {ltr(thread?.hex)}
                              </T>
                            </Row>
                          );
                        })}
                      </View>
                    </Row>
                  </Section>
                ) : null}

                {item.measurementSnapshot && template ? (
                  <Section
                    title={t('checkout.measurement')}
                    subtitle={`${item.measurementSnapshot.name} · ${t(`measure.status.${item.measurementSnapshot.status}` as StringKey)}`}
                  >
                    <View style={{ gap: 4 }}>
                      {template.fields.map((field) => {
                        const value = item.measurementSnapshot?.values[field.key];
                        if (value === undefined) return null;
                        return (
                          <Row key={field.key} justify="space-between">
                            <T variant="tiny" color={theme.color.textMuted}>
                              {L(field.label)}
                            </T>
                            <T variant="tiny" weight="700">
                              {value} {item.measurementSnapshot?.unit === 'cm' ? t('common.cm') : t('common.in')}
                            </T>
                          </Row>
                        );
                      })}
                      {item.measurementSnapshot.customValues.map((custom) => (
                        <Row key={custom.label} justify="space-between">
                          <T variant="tiny" color={theme.color.textMuted}>
                            {custom.label}
                          </T>
                          <T variant="tiny" weight="700">
                            {custom.value}
                          </T>
                        </Row>
                      ))}
                      {item.measurementSnapshot.notes ? (
                        <Notice text={item.measurementSnapshot.notes} tone="info" />
                      ) : null}
                    </View>
                  </Section>
                ) : null}

                {item.notes ? <Notice text={item.notes} tone="warning" title={t('measure.notes')} /> : null}
              </View>
            </Card>
          );
        })}

        <Section title={t('orders.tracking')}>
          <Card>
            <View style={{ gap: 6 }}>
              {order.history.map((event, i) => (
                <Row key={i} justify="space-between">
                  <T variant="tiny" color={theme.color.textMuted}>
                    {t(`status.${event.status}` as StringKey)}
                    {event.by ? ` · ${event.by}` : ''}
                  </T>
                  <T variant="tiny" color={theme.color.textFaint}>
                    {formatDateTime(event.at, lang)}
                  </T>
                </Row>
              ))}
            </View>
          </Card>
        </Section>

        {!isTerminal(order.status) && upcoming ? (
          <Button
            label={`${t('dash.advance')} → ${t(`status.${upcoming}` as StringKey)}`}
            onPress={() => advance(order.id, 'Demo Tailor')}
            full
            size="lg"
          />
        ) : null}
      </ScrollView>
    </>
  );
}

const TicketRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Row justify="space-between" gap={12}>
    <T variant="tiny" color={theme.color.textMuted}>
      {label}
    </T>
    <T variant="tiny" weight="700" style={{ flex: 1 }} numberOfLines={2}>
      {value}
    </T>
  </Row>
);

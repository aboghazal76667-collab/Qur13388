import React from 'react';
import { Alert, Pressable, ScrollView, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Badge, Button, Card, Chip, Notice, Row, Section, T } from '@dd/components/ui';
import { PaletteStrip } from '@dd/components/ui/Swatch';
import { BRAND, fullBrandName } from '@dd/config/brand';
import { ENV, hasSupabaseCredentials } from '@dd/config/env';
import { colorHex, threadHex } from '@dd/data/colors';
import { getFabric } from '@dd/data/fabrics';
import { getPattern } from '@dd/data/embroidery';
import type { AppRole } from '@dd/domain/types';
import { ltr, useI18n, type StringKey } from '@dd/i18n';
import { clearAllPersistedState } from '@dd/store/persist';
import { useCartStore } from '@dd/store/cartStore';
import { useDesignStore } from '@dd/store/designStore';
import { useOrdersStore } from '@dd/store/ordersStore';
import { useProfileStore } from '@dd/store/profileStore';
import { useSessionStore } from '@dd/store/sessionStore';
import { useStyleMemory } from '@dd/hooks/useStyleMemory';
import { theme } from '@dd/theme/tokens';
import { formatDate } from '@dd/utils/date';

const ROLES: { key: AppRole; labelKey: StringKey }[] = [
  { key: 'customer', labelKey: 'profile.role.customer' },
  { key: 'tailor', labelKey: 'profile.role.tailor' },
  { key: 'admin', labelKey: 'profile.role.admin' },
];

export default function Profile() {
  const router = useRouter();
  const { t, L, lang, setLang } = useI18n();

  const customer = useProfileStore((s) => s.customer);
  const notifications = useProfileStore((s) => s.notifications);
  const setNotifications = useProfileStore((s) => s.setNotifications);
  const privacy = useProfileStore((s) => s.privacy);
  const setPrivacy = useProfileStore((s) => s.setPrivacy);
  const measurements = useProfileStore((s) => s.measurements);

  const role = useSessionStore((s) => s.role);
  const setRole = useSessionStore((s) => s.setRole);
  const signOut = useSessionStore((s) => s.signOut);

  const memory = useStyleMemory();

  const exportData = () => {
    const payload = {
      customer,
      measurements,
      orders: useOrdersStore.getState().orders,
      designs: useDesignStore.getState().savedDesigns,
      notifications,
      privacy,
      exportedAt: new Date().toISOString(),
    };
    // In production this is a server-side export delivered by signed URL.
    // Here it demonstrates the workflow with the customer's own local data.
    Alert.alert(
      t('profile.exportData'),
      `${JSON.stringify(payload).length} bytes\n${L({ ar: 'في الإصدار الإنتاجي سيُرسل الملف عبر رابط آمن.', en: 'In production the file is delivered via a signed URL.' })}`,
    );
  };

  const deleteAccount = () => {
    Alert.alert(t('profile.deleteAccount'), t('profile.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await clearAllPersistedState();
          useCartStore.getState().clear();
          useOrdersStore.getState().resetToDemo();
          useProfileStore.getState().resetToDemo();
          signOut();
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.color.bg }}
      contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.xl, paddingBottom: theme.space.xxxl }}
    >
      <Card>
        <Row justify="space-between">
          <View style={{ gap: 4 }}>
            <T variant="heading">{customer.name || fullBrandName(lang)}</T>
            <T variant="tiny" color={theme.color.textMuted}>
              {ltr(customer.phone ?? customer.email) || '—'}
            </T>
          </View>
          {customer.isDemo ? <Badge label={t('auth.demoBadge')} tone="warning" /> : null}
        </Row>
      </Card>

      <Section title={t('profile.language')}>
        <Row gap={theme.space.sm}>
          <Chip label="العربية" selected={lang === 'ar'} onPress={() => setLang('ar')} />
          <Chip label="English" selected={lang === 'en'} onPress={() => setLang('en')} />
        </Row>
      </Section>

      <Section title={t('profile.styleMemory')}>
        <Card>
          <View style={{ gap: theme.space.md }}>
            <Row justify="space-between">
              <T variant="small" color={theme.color.textMuted}>
                {t('orders.title')}
              </T>
              <T variant="small" weight="700">
                {memory.orderCount}
              </T>
            </Row>
            {memory.lastOrderAt ? (
              <Row justify="space-between">
                <T variant="small" color={theme.color.textMuted}>
                  {t('orders.placedOn')}
                </T>
                <T variant="small">{formatDate(memory.lastOrderAt, lang)}</T>
              </Row>
            ) : null}
            {memory.favoriteColorIds.length ? (
              <PaletteStrip
                hexes={memory.favoriteColorIds.map((id) => colorHex(id))}
                label={L({ ar: 'ألوانك المفضلة', en: 'Your usual colours' })}
              />
            ) : null}
            {memory.favoriteThreadColorIds.length ? (
              <PaletteStrip
                hexes={memory.favoriteThreadColorIds.map((id) => threadHex(id))}
                label={L({ ar: 'خيوطك المفضلة', en: 'Your usual threads' })}
              />
            ) : null}
            {memory.favoriteFabricIds[0] ? (
              <Row justify="space-between">
                <T variant="small" color={theme.color.textMuted}>
                  {t('saved.fabrics')}
                </T>
                <T variant="small">{L(getFabric(memory.favoriteFabricIds[0])?.name)}</T>
              </Row>
            ) : null}
            {memory.favoritePatternIds[0] ? (
              <Row justify="space-between">
                <T variant="small" color={theme.color.textMuted}>
                  {t('saved.patterns')}
                </T>
                <T variant="small">{L(getPattern(memory.favoritePatternIds[0])?.name)}</T>
              </Row>
            ) : null}
            <Row justify="space-between">
              <T variant="small" color={theme.color.textMuted}>
                {L({ ar: 'كثافة التطريز المعتادة', en: 'Usual embroidery intensity' })}
              </T>
              <T variant="small">{Math.round(memory.embroideryIntensity * 100)}%</T>
            </Row>
          </View>
        </Card>
      </Section>

      <Section title={t('profile.preferences')}>
        <View style={{ gap: theme.space.sm }}>
          <LinkRow label={t('profile.measurements')} onPress={() => router.push('/measurements')} />
          <LinkRow label={t('tailor.title')} onPress={() => router.push('/tailors')} />
          <LinkRow label={t('discover.fabrics')} onPress={() => router.push('/fabrics')} />
          <LinkRow label={t('discover.patterns')} onPress={() => router.push('/patterns')} />
        </View>
      </Section>

      <Section title={t('profile.notifications')}>
        <Card>
          <View style={{ gap: theme.space.lg }}>
            <ToggleRow
              label={t('profile.notif.operational')}
              hint={t('profile.notif.operationalHint')}
              value={notifications.operational}
              onChange={(v) => setNotifications({ operational: v })}
            />
            <ToggleRow
              label={t('profile.notif.marketing')}
              hint={t('profile.notif.marketingHint')}
              value={notifications.marketing}
              onChange={(v) => setNotifications({ marketing: v, seasonalReminders: v ? notifications.seasonalReminders : false })}
            />
            <ToggleRow
              label={L({ ar: 'تذكير مواسم العيد والمناسبات', en: 'Eid and seasonal reminders' })}
              hint={L({ ar: 'يتطلب الموافقة على الرسائل التسويقية.', en: 'Requires marketing consent.' })}
              value={notifications.seasonalReminders}
              disabled={!notifications.marketing}
              onChange={(v) => setNotifications({ seasonalReminders: v })}
            />
          </View>
        </Card>
      </Section>

      <Section title={t('profile.privacy')}>
        <Card>
          <View style={{ gap: theme.space.lg }}>
            <ToggleRow
              label={L({ ar: 'حفظ صور التجربة', en: 'Store try-on photos' })}
              hint={L({ ar: 'الصور لا تُحفظ افتراضياً.', en: 'Photos are not stored by default.' })}
              value={privacy.storeTryOnPhotos}
              onChange={(v) => setPrivacy({ storeTryOnPhotos: v })}
            />
            <ToggleRow
              label={L({ ar: 'استخدام سجل الطلبات للاقتراحات', en: 'Use order history for suggestions' })}
              hint={L({ ar: 'يشغّل ذاكرة أسلوبك واقتراحات المنسق.', en: 'Powers style memory and stylist suggestions.' })}
              value={privacy.personalisation}
              onChange={(v) => setPrivacy({ personalisation: v })}
            />
          </View>
        </Card>
        <View style={{ gap: theme.space.sm, marginTop: theme.space.sm }}>
          <Button label={t('profile.exportData')} variant="secondary" onPress={exportData} full />
          <Button label={t('profile.deleteAccount')} variant="danger" onPress={deleteAccount} full />
        </View>
      </Section>

      <Section title={t('profile.legal')}>
        <View style={{ gap: theme.space.sm }}>
          <LinkRow label={t('legal.privacy')} onPress={() => router.push('/legal/privacy')} />
          <LinkRow label={t('legal.terms')} onPress={() => router.push('/legal/terms')} />
          <LinkRow label={t('legal.returns')} onPress={() => router.push('/legal/returns')} />
          <LinkRow label={t('legal.alterations')} onPress={() => router.push('/legal/alterations')} />
          <LinkRow label={t('legal.customMade')} onPress={() => router.push('/legal/custom-made')} />
        </View>
      </Section>

      {ENV.SHOW_ROLE_SWITCHER ? (
        <Section title={t('profile.devTools')} subtitle={t('profile.role')}>
          <Row gap={theme.space.sm} wrap>
            {ROLES.map((r) => (
              <Chip key={r.key} label={t(r.labelKey)} selected={role === r.key} onPress={() => setRole(r.key)} />
            ))}
          </Row>
          <View style={{ gap: theme.space.sm, marginTop: theme.space.sm }}>
            <Button label={t('dash.title')} variant="secondary" onPress={() => router.push('/dashboard')} full />
            <Button label={t('admin.title')} variant="secondary" onPress={() => router.push('/admin')} full />
          </View>
          <Notice
            tone="info"
            text={`DEMO_MODE=${ENV.DEMO_MODE} · MOCK_AI_MODE=${ENV.MOCK_AI_MODE} · MOCK_PAYMENT_MODE=${ENV.MOCK_PAYMENT_MODE} · Supabase=${hasSupabaseCredentials() ? 'configured' : 'not configured'}`}
          />
        </Section>
      ) : null}

      <Button
        label={t('profile.logout')}
        variant="ghost"
        onPress={() => {
          signOut();
          router.replace('/');
        }}
        full
      />

      <T variant="tiny" color={theme.color.textFaint} center>
        {BRAND.codename} · {BRAND.supportEmail}
      </T>
    </ScrollView>
  );
}

const LinkRow: React.FC<{ label: string; onPress: () => void }> = ({ label, onPress }) => (
  <Card onPress={onPress}>
    <Row justify="space-between">
      <T variant="small">{label}</T>
      <T variant="small" color={theme.color.textFaint}>
        ›
      </T>
    </Row>
  </Card>
);

const ToggleRow: React.FC<{
  label: string;
  hint?: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}> = ({ label, hint, value, disabled, onChange }) => (
  <Row justify="space-between" align="flex-start">
    <View style={{ flex: 1, gap: 3, opacity: disabled ? 0.5 : 1 }}>
      <T variant="small" weight="600">
        {label}
      </T>
      {hint ? (
        <T variant="tiny" color={theme.color.textMuted}>
          {hint}
        </T>
      ) : null}
    </View>
    <Switch
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      trackColor={{ true: theme.color.accent, false: theme.color.border }}
    />
  </Row>
);

import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { AppText, Badge, Row, Spacer } from '../../src/components/primitives';
import { useTheme } from '../../src/theme/ThemeProvider';
import { surahs } from '../../src/quran/repository';
import { normalizeArabic, toArabicNumerals } from '../../src/quran/arabic';

export default function QuranTab() {
  const { palette, spacing, radii } = useTheme();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = normalizeArabic(query);
    const qLower = query.trim().toLowerCase();
    if (!q && !qLower) return surahs;
    return surahs.filter(
      (s) =>
        normalizeArabic(s.nameArabic).includes(q) ||
        s.nameTransliterated.toLowerCase().includes(qLower) ||
        String(s.number) === query.trim()
    );
  }, [query]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
        <AppText variant="small" tone="muted">
          اختر السورة، ثم اضغط على أي كلمة داخل الآية لتحليلها في القرآن كله.
        </AppText>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="ابحث عن سورة بالاسم أو الرقم"
          placeholderTextColor={palette.textFaint}
          textAlign="right"
          style={{
            marginTop: spacing.md,
            backgroundColor: palette.surface,
            borderRadius: radii.md,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: palette.border,
            paddingHorizontal: spacing.md,
            paddingVertical: 12,
            color: palette.text,
            writingDirection: 'rtl',
          }}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(s) => String(s.number)}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: 40 }}
        ItemSeparatorComponent={() => <Spacer size={spacing.sm} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/surah/[id]', params: { id: String(item.number) } })}
            style={({ pressed }) => ({
              flexDirection: 'row-reverse',
              alignItems: 'center',
              gap: spacing.md,
              backgroundColor: palette.surface,
              borderRadius: radii.md,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: palette.border,
              padding: spacing.md,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: palette.accentSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppText variant="small" weight="bold" tone="accent">
                {toArabicNumerals(item.number)}
              </AppText>
            </View>

            <View style={{ flex: 1 }}>
              <AppText variant="body" weight="medium">
                {item.nameArabic}
              </AppText>
              <AppText variant="tiny" tone="faint">
                {item.nameTransliterated} · {toArabicNumerals(item.ayahCount)} آية
              </AppText>
            </View>

            <Badge
              label={item.revelationType === 'makki' ? 'مكية' : 'مدنية'}
              tone={item.revelationType === 'makki' ? 'neutral' : 'accent'}
            />
          </Pressable>
        )}
        ListEmptyComponent={
          <Row style={{ justifyContent: 'center', paddingVertical: 40 }}>
            <AppText variant="small" tone="muted">
              لا توجد سورة مطابقة.
            </AppText>
          </Row>
        }
      />
    </View>
  );
}

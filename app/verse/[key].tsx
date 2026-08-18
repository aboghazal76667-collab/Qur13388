import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';

import {
  AppText,
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  Row,
  Screen,
  SectionTitle,
  Spacer,
} from '../../src/components/primitives';
import { VerseCard } from '../../src/components/VerseCard';
import { useTheme } from '../../src/theme/ThemeProvider';
import {
  getVerseByIndex,
  getVerseByKey,
  getVersesForRoot,
  referenceFromVerse,
} from '../../src/quran/repository';
import { displayRoot, toArabicNumerals } from '../../src/quran/arabic';
import { featureLabel } from '../../src/analysis/grammar';
import { useFavoritesStore } from '../../src/store/favoritesStore';

export default function VerseScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { palette, spacing, radii } = useTheme();
  const [deep, setDeep] = useState(false);
  const favorites = useFavoritesStore();

  const verse = key ? getVerseByKey(key) : undefined;

  const related = useMemo(() => {
    if (!verse || !deep) return [];
    // Verses sharing this verse's rarest roots are the most informative
    // neighbours; common roots (قول, الله) would drown the list.
    const scored = verse.roots
      .map((root) => ({ root, verses: getVersesForRoot(root) }))
      .filter((r) => r.verses.length > 1 && r.verses.length < 300)
      .sort((a, b) => a.verses.length - b.verses.length)
      .slice(0, 3);

    const seen = new Set<string>([verse.key]);
    const out: { root: string; reference: ReturnType<typeof referenceFromVerse> }[] = [];
    for (const { root, verses } of scored) {
      for (const v of verses.slice(0, 4)) {
        if (seen.has(v.key)) continue;
        seen.add(v.key);
        out.push({
          root,
          reference: referenceFromVerse(v, `تشترك مع هذه الآية في الجذر (${displayRoot(root)})`),
        });
      }
    }
    return out;
  }, [verse, deep]);

  if (!verse) {
    return (
      <Screen>
        <EmptyState title="آية غير موجودة" message="تحقق من رقم السورة والآية." />
      </Screen>
    );
  }

  const previous = getVerseByIndex(verse.index - 1);
  const next = getVerseByIndex(verse.index + 1);
  const favoriteId = `verse:${verse.key}`;
  const isFavorite = favorites.items.some((i) => i.id === favoriteId);

  const contentWords = verse.words.filter((w) => w.root);

  return (
    <Screen>
      <Stack.Screen options={{ title: `${verse.surahNameArabic} ${verse.surahNumber}:${verse.ayahNumber}` }} />

      <Card>
        <Row gap={8} style={{ justifyContent: 'space-between' }}>
          <Row gap={6}>
            <Badge label={verse.surahNameArabic} tone="accent" />
            <Badge
              label={`${toArabicNumerals(verse.surahNumber)} : ${toArabicNumerals(verse.ayahNumber)}`}
              tone="neutral"
            />
          </Row>
          <Pressable
            hitSlop={10}
            onPress={() =>
              favorites.toggle({
                id: favoriteId,
                kind: 'verse',
                createdAt: new Date().toISOString(),
                title: `${verse.surahNameArabic} ${verse.surahNumber}:${verse.ayahNumber}`,
                subtitle: verse.uthmaniText.slice(0, 60),
                verseKey: verse.key,
                reference: referenceFromVerse(verse),
              })
            }
          >
            <AppText variant="body" tone={isFavorite ? 'accent' : 'faint'}>
              {isFavorite ? '★' : '☆'}
            </AppText>
          </Pressable>
        </Row>

        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', marginTop: spacing.lg }}>
          {verse.words.map((word) => (
            <Pressable
              key={word.index}
              onPress={() =>
                router.push({
                  pathname: '/word/[form]',
                  params: { form: word.surface, root: word.root ?? '', verseKey: verse.key },
                })
              }
              style={({ pressed }) => ({
                paddingHorizontal: 3,
                paddingVertical: 2,
                borderRadius: 6,
                backgroundColor: pressed ? palette.quranHighlight : 'transparent',
              })}
            >
              <AppText variant="quran" tone="quran">
                {word.surface}
              </AppText>
            </Pressable>
          ))}
        </View>

        <AppText variant="tiny" tone="faint" style={{ marginTop: spacing.md }}>
          اضغط على أي كلمة لعرض جذرها ومواضعها في القرآن كله.
        </AppText>
      </Card>

      <Spacer size={spacing.md} />
      <Row gap={spacing.sm} wrap={false}>
        <Button
          label="الآية السابقة"
          variant="secondary"
          disabled={!previous}
          onPress={() => previous && router.replace({ pathname: '/verse/[key]', params: { key: previous.key } })}
          style={{ flex: 1 }}
        />
        <Button
          label="الآية التالية"
          variant="secondary"
          disabled={!next}
          onPress={() => next && router.replace({ pathname: '/verse/[key]', params: { key: next.key } })}
          style={{ flex: 1 }}
        />
      </Row>

      <Spacer size={spacing.md} />
      <Button label={deep ? 'إخفاء التحليل العميق' : 'تحليل عميق'} onPress={() => setDeep((v) => !v)} />

      {deep ? (
        <>
          <Spacer size={spacing.xl} />
          <SectionTitle hint="بنية الآية كما تُقرأ من مورفولوجيا المصحف">بنية الآية</SectionTitle>
          <Card>
            <Row gap={16}>
              <Stat label="الكلمات" value={verse.words.length} />
              <Stat label="الجذور" value={verse.roots.length} />
              <Stat label="اللواحق" value={verse.lemmas.length} />
            </Row>
          </Card>

          <Spacer size={spacing.lg} />
          <SectionTitle>الكلمات المركزية</SectionTitle>
          {contentWords.map((word) => (
            <Card key={word.index} style={{ marginBottom: spacing.sm }}>
              <Row gap={8} style={{ justifyContent: 'space-between' }}>
                <AppText variant="body" weight="medium">
                  {word.surface}
                </AppText>
                <Badge label={displayRoot(word.root!)} tone="accent" />
              </Row>
              {word.lemma ? (
                <AppText variant="tiny" tone="faint" style={{ marginTop: 4 }}>
                  الصيغة الأصلية: {word.lemma}
                </AppText>
              ) : null}
              {word.features.length > 0 ? (
                <Row gap={5} style={{ marginTop: spacing.sm }}>
                  {word.features.slice(0, 6).map((f) => (
                    <Badge key={f} label={featureLabel(f)} tone="neutral" />
                  ))}
                </Row>
              ) : null}
              <Pressable
                style={{ marginTop: spacing.sm }}
                onPress={() =>
                  router.push({
                    pathname: '/word/[form]',
                    params: { form: word.surface, root: word.root ?? '', verseKey: verse.key },
                  })
                }
              >
                <AppText variant="tiny" tone="accent">
                  حلّل هذه الكلمة في القرآن ←
                </AppText>
              </Pressable>
            </Card>
          ))}

          {related.length > 0 ? (
            <>
              <Spacer size={spacing.lg} />
              <SectionTitle hint="اشتراك الجذر يدل على الموضع فقط، لا على وحدة المعنى">
                آيات تشترك في الجذور نفسها
              </SectionTitle>
              {related.map(({ reference }) => (
                <VerseCard key={reference.key} reference={reference} />
              ))}
            </>
          ) : null}

          <Spacer size={spacing.lg} />
          <Card tone="alt">
            <AppText variant="small" weight="bold">
              الاحتمالات التفسيرية والافتراضات
            </AppText>
            <AppText variant="small" tone="muted" style={{ marginTop: spacing.sm }}>
              كل قراءة لهذه الآية تحتاج إلى تحديد: (١) معنى كل لفظ مركزي فيها،
              (٢) مرجع الضمائر، (٣) علاقة الآية بما قبلها وما بعدها، (٤) ما إذا كان الحكم
              مقيّدًا بسياقه أم عامًا. أي إجابة تتجاوز إحدى هذه الخطوات دون تصريح
              تكون قد أضافت مقدمة غير منصوصة. استخدم زر «حلّل هذه الكلمة» لفحص الخطوة الأولى
              على أساس إحصائي.
            </AppText>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <AppText variant="heading" weight="bold" tone="accent">
        {value}
      </AppText>
      <AppText variant="tiny" tone="faint">
        {label}
      </AppText>
    </View>
  );
}

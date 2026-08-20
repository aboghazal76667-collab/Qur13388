import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { getBackend, type AdminJobRow, type AdminOverview } from '@/data';
import type { QaDecision } from '@/domain';
import { useI18n } from '@/i18n';
import { friendlyMessage } from '@/lib/errors';
import { useTheme } from '@/theme';
import { Banner, Button, Card, Chip, EmptyState, Row, RowGroup, Screen, ScreenHeader, Text } from '@/ui';

/**
 * The admin area.
 *
 * Minimal on purpose: the point is that a human can see every generation job,
 * find the failures, and approve or reject a model before anything is
 * manufactured. Making that possible matters far more right now than making it
 * pretty — an AI pipeline with no human gate in front of a physical product is
 * not a pipeline we would ship.
 */

type Tab = 'overview' | 'qa' | 'jobs' | 'failed';

export default function Admin() {
  const theme = useTheme();
  const { t, formatNumber, isRtl } = useI18n();

  const [tab, setTab] = useState<Tab>('overview');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [rows, setRows] = useState<AdminJobRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const available = getBackend().admin.isAvailable();

  const load = useCallback(async () => {
    if (!available) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const admin = getBackend().admin;
      if (tab === 'overview') {
        setOverview(await admin.overview());
      } else if (tab === 'qa') {
        setRows(await admin.qaQueue());
      } else {
        setRows(await admin.listJobs(tab === 'failed' ? { onlyFailed: true } : undefined));
      }
    } catch (loadError) {
      setError(friendlyMessage(loadError, t.errors));
    } finally {
      setLoading(false);
    }
  }, [tab, available, t.errors]);

  useEffect(() => {
    load();
  }, [load]);

  const review = async (jobId: string, decision: QaDecision) => {
    try {
      await getBackend().admin.submitReview(jobId, decision, null);
      setNotice(t.admin.reviewSaved);
      await load();
    } catch (reviewError) {
      setError(friendlyMessage(reviewError, t.errors));
    }
  };

  if (!available) {
    return (
      <Screen>
        <ScreenHeader title={t.admin.title} />
        <EmptyState icon="lock-closed-outline" title={t.errors.notFound} />
      </Screen>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: t.admin.overview },
    { key: 'qa', label: t.admin.qaQueue },
    { key: 'jobs', label: t.admin.jobs },
    { key: 'failed', label: t.admin.failures },
  ];

  return (
    <Screen>
      <ScreenHeader title={t.admin.title} subtitle={t.admin.subtitle} />

      <View style={{ gap: theme.spacing.lg, paddingTop: theme.spacing.lg }}>
        <View
          style={{
            flexDirection: isRtl ? 'row-reverse' : 'row',
            gap: theme.spacing.sm,
            flexWrap: 'wrap',
          }}
        >
          {tabs.map((item) => (
            <Chip
              key={item.key}
              label={item.label}
              selected={tab === item.key}
              tone={tab === item.key ? 'primary' : 'neutral'}
              onPress={() => {
                setNotice(null);
                setTab(item.key);
              }}
            />
          ))}
        </View>

        {error ? <Banner tone="danger" body={error} /> : null}
        {notice ? <Banner tone="success" body={notice} /> : null}

        {loading ? (
          <Text variant="caption" color="textFaint">
            {t.common.loading}
          </Text>
        ) : tab === 'overview' ? (
          overview ? (
            <View style={{ gap: theme.spacing.lg }}>
              <RowGroup>
                <Row label={t.admin.families} value={formatNumber(overview.families)} icon="home-outline" />
                <Row label={t.admin.children} value={formatNumber(overview.children)} icon="people-outline" />
                <Row label={t.admin.memories} value={formatNumber(overview.memories)} icon="albums-outline" />
                <Row label={t.admin.failures} value={formatNumber(overview.failedJobs)} icon="warning-outline" />
                <Row
                  label={t.admin.totalSpend}
                  value={`$${overview.estimatedSpendUsd.toFixed(3)}`}
                  icon="cash-outline"
                />
              </RowGroup>

              <Card>
                <View style={{ gap: theme.spacing.md }}>
                  <Text variant="subheading">{t.admin.jobs}</Text>
                  {Object.keys(overview.jobsByStatus).length === 0 ? (
                    <Text variant="caption" color="textFaint">
                      {t.admin.noJobs}
                    </Text>
                  ) : (
                    <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                      {Object.entries(overview.jobsByStatus).map(([status, count]) => (
                        <Chip
                          key={status}
                          label={`${status} · ${formatNumber(count)}`}
                          tone={status === 'failed' ? 'danger' : 'neutral'}
                        />
                      ))}
                    </View>
                  )}
                </View>
              </Card>
            </View>
          ) : null
        ) : rows.length === 0 ? (
          <Card>
            <EmptyState icon="cube-outline" title={t.admin.noJobs} />
          </Card>
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            {rows.map(({ job, childFirstName, memoryTitle, calls, review: existing }) => {
              const spend = calls.reduce((sum, call) => sum + (call.estimatedCostUsd ?? 0), 0);

              return (
                <Card key={job.id}>
                  <View style={{ gap: theme.spacing.md }}>
                    <View
                      style={{
                        flexDirection: isRtl ? 'row-reverse' : 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                        {childFirstName} · {memoryTitle}
                      </Text>
                      <Chip
                        label={job.status}
                        tone={job.status === 'failed' ? 'danger' : job.completedAt ? 'success' : 'neutral'}
                      />
                    </View>

                    <View
                      style={{
                        flexDirection: isRtl ? 'row-reverse' : 'row',
                        gap: theme.spacing.lg,
                        flexWrap: 'wrap',
                      }}
                    >
                      <Text variant="micro" color="textFaint">
                        {job.providerKey ?? '—'} · attempt {formatNumber(job.attempt)}
                      </Text>
                      <Text variant="micro" color="textFaint">
                        {formatNumber(job.sourceAssetIds.length)} photos
                      </Text>
                      <Text variant="micro" color="textFaint">
                        ${spend.toFixed(3)}
                      </Text>
                      {job.errorCode ? (
                        <Text variant="micro" color="danger">
                          {job.errorCode}
                        </Text>
                      ) : null}
                    </View>

                    {existing ? (
                      <View
                        style={{
                          flexDirection: isRtl ? 'row-reverse' : 'row',
                          alignItems: 'center',
                          gap: theme.spacing.sm,
                        }}
                      >
                        <Ionicons name="checkmark-done-outline" size={15} color={theme.colors.success} />
                        <Text variant="micro" color="success">
                          {existing.decision}
                        </Text>
                      </View>
                    ) : job.completedAt && job.status !== 'failed' ? (
                      <View style={{ gap: theme.spacing.sm }}>
                        <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: theme.spacing.sm }}>
                          <Button
                            label={t.admin.approve}
                            size="small"
                            fullWidth={false}
                            onPress={() => review(job.id, 'approved')}
                          />
                          <Button
                            label={t.admin.regenerate}
                            size="small"
                            variant="secondary"
                            fullWidth={false}
                            onPress={() => review(job.id, 'needs_regeneration')}
                          />
                        </View>
                        <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: theme.spacing.sm }}>
                          <Button
                            label={t.admin.adjust}
                            size="small"
                            variant="secondary"
                            fullWidth={false}
                            onPress={() => review(job.id, 'needs_manual_adjustment')}
                          />
                          <Button
                            label={t.admin.reject}
                            size="small"
                            variant="danger"
                            fullWidth={false}
                            onPress={() => review(job.id, 'rejected')}
                          />
                        </View>
                      </View>
                    ) : null}
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </View>
    </Screen>
  );
}

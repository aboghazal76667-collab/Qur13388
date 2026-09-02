import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Stack } from 'expo-router';

import { Badge, Button, Card, Chip, Notice, Row, Section, T } from '@dd/components/ui';
import { GarmentViewer } from '@dd/components/dishdasha/GarmentViewer';
import { ENV } from '@dd/config/env';
import { useI18n } from '@dd/i18n';
import {
  REFERENCE_MANIFEST,
  prototypeLimitations,
  supportsDesignDrivenMaterials,
  validateManifest,
} from '@dd/render/assetManifest';
import { GARMENT_ASSETS, hasProfessionalAsset, renderableAsset } from '@dd/render/assetRegistry';
import { REASON_LABELS, selectRenderer } from '@dd/render/rendererAdapter';
import { detectWebglSupport } from '@dd/render/real3d/webglSupport';
import { ACCEPTANCE_CHECKS, evaluateAcceptance } from '@dd/render/visualAcceptance';
import { fabricTwinPipeline } from '@dd/render/fabricDigitalTwin';
import { embroideryImporter } from '@dd/services/ingestion/embroideryImporter';
import { fabricScanner } from '@dd/services/ingestion/fabricScanner';
import { useDesignStore } from '@dd/store/designStore';
import type { RendererSelection } from '@dd/render/types';
import { theme } from '@dd/theme/tokens';

/**
 * DEV_VISUAL_INSPECTOR.
 *
 * Everything the customer must never see: which renderer was chosen and why,
 * whether WebGL is available, manifest validation, the visual acceptance gate,
 * and which pipelines are architecture-only.
 *
 * Reachable only from Profile → developer tools, and only while the role
 * switcher is enabled.
 */
export default function VisualInspector() {
  const { L } = useI18n();
  const config = useDesignStore((s) => s.config);
  const [forced, setForced] = useState<'real3d' | 'v2fallback' | null>(null);
  const [selection, setSelection] = useState<RendererSelection | null>(null);

  const webgl = detectWebglSupport();
  const predicted = useMemo(
    () => selectRenderer({ styleId: 'om_standard', webglAvailable: webgl, force: forced }),
    [webgl, forced],
  );
  const manifestIssues = validateManifest(REFERENCE_MANIFEST);
  const loaded = renderableAsset('om_standard');
  const limitations = loaded ? prototypeLimitations(loaded.manifest) : [];
  // Nothing has been reviewed, so every blocking check is unanswered — which
  // the gate correctly treats as NOT accepted.
  const acceptance = evaluateAcceptance({});

  return (
    <>
      <Stack.Screen options={{ title: 'DEV · Visual inspector' }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.color.bg }}
        contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.xl, paddingBottom: theme.space.xxxl }}
      >
        <Notice
          tone="warning"
          title="Developer only"
          text="Not part of the customer experience. Shows renderer selection and asset readiness."
        />

        <Section title="Renderer selection">
          <Card>
            <View style={{ gap: theme.space.sm }}>
              <Row justify="space-between">
                <T variant="small">Professional 3D asset registered</T>
                <Badge label={hasProfessionalAsset() ? 'YES' : 'NO'} tone={hasProfessionalAsset() ? 'success' : 'warning'} />
              </Row>
              <Row justify="space-between">
                <T variant="small">Loaded asset quality</T>
                <Badge
                  label={loaded ? loaded.quality : 'NONE'}
                  tone={loaded?.quality === 'PROFESSIONAL' ? 'success' : 'warning'}
                />
              </Row>
              <Row justify="space-between">
                <T variant="small">WebGL available</T>
                <Badge label={webgl ? 'YES' : 'NO'} tone={webgl ? 'success' : 'neutral'} />
              </Row>
              <Row justify="space-between">
                <T variant="small">Predicted renderer</T>
                <Badge label={predicted.kind} tone={predicted.kind === 'real3d' ? 'accent' : 'neutral'} />
              </Row>
              <T variant="tiny" color={theme.color.textMuted}>
                {REASON_LABELS[predicted.reason]}
              </T>
              {selection ? (
                <T variant="tiny" color={theme.color.textFaint}>
                  Live: {selection.kind} — {REASON_LABELS[selection.reason]}
                </T>
              ) : null}
              <Row gap={theme.space.sm} wrap>
                <Chip label="auto" selected={forced === null} onPress={() => setForced(null)} small />
                <Chip label="force real3d" selected={forced === 'real3d'} onPress={() => setForced('real3d')} small />
                <Chip label="force v2fallback" selected={forced === 'v2fallback'} onPress={() => setForced('v2fallback')} small />
              </Row>
            </View>
          </Card>
        </Section>

        <Section title="Live viewer">
          <Card padded={false}>
            <View style={{ alignItems: 'center', paddingVertical: theme.space.md, backgroundColor: theme.color.bgSunken }}>
              <GarmentViewer
                config={config}
                width={260}
                height={340}
                forceRenderer={forced}
                onSelection={setSelection}
              />
            </View>
          </Card>
        </Section>

        <Section title="Asset manifest contract">
          <Card>
            <View style={{ gap: 6 }}>
              <T variant="tiny" color={theme.color.textMuted}>
                Reference manifest (specification only — no GLB bound)
              </T>
              {manifestIssues.length === 0 ? (
                <T variant="tiny" color={theme.color.success}>
                  Reference manifest validates
                </T>
              ) : (
                manifestIssues.map((issue, i) => (
                  <T key={i} variant="tiny" color={issue.severity === 'error' ? theme.color.danger : theme.color.warning}>
                    {issue.severity}: {issue.field} — {issue.message}
                  </T>
                ))
              )}
            </View>
          </Card>
        </Section>

        {loaded ? (
          <Section title="Loaded asset">
            <Card>
              <View style={{ gap: 6 }}>
                <T variant="small" weight="600">
                  {loaded.label}
                </T>
                <T variant="tiny" color={theme.color.textMuted}>
                  {loaded.manifest.assetId} · {loaded.manifest.assetVersion} ·{' '}
                  {loaded.manifest.triangleCount.toLocaleString('en')} triangles
                </T>
                <Row justify="space-between">
                  <T variant="tiny">Materials driven by the design</T>
                  <Badge
                    label={supportsDesignDrivenMaterials(loaded.manifest) ? 'YES' : 'NO'}
                    tone={supportsDesignDrivenMaterials(loaded.manifest) ? 'success' : 'warning'}
                  />
                </Row>
                {limitations.length > 0 ? (
                  <>
                    <T variant="tiny" weight="600" color={theme.color.warning}>
                      Prototype limitations ({limitations.length})
                    </T>
                    {limitations.map((l, i) => (
                      <T key={i} variant="tiny" color={theme.color.textFaint}>
                        · {l}
                      </T>
                    ))}
                  </>
                ) : null}
                <T variant="tiny" color={theme.color.textFaint}>
                  {loaded.manifest.notes}
                </T>
              </View>
            </Card>
          </Section>
        ) : null}

        <Section title={`Visual acceptance gate (${acceptance.passed}/${acceptance.total})`}>
          <Card>
            <View style={{ gap: 4 }}>
              <Badge label={acceptance.accepted ? 'ACCEPTED' : 'NOT ACCEPTED'} tone={acceptance.accepted ? 'success' : 'danger'} />
              <T variant="tiny" color={theme.color.textMuted}>
                {acceptance.unanswered.length} checks unanswered — no asset has been reviewed.
              </T>
              {ACCEPTANCE_CHECKS.slice(0, 6).map((c) => (
                <T key={c.id} variant="tiny" color={theme.color.textFaint}>
                  · {L(c.label)}
                </T>
              ))}
              <T variant="tiny" color={theme.color.textFaint}>
                … and {ACCEPTANCE_CHECKS.length - 6} more
              </T>
            </View>
          </Card>
        </Section>

        <Section title="Pipelines">
          <Card>
            <View style={{ gap: 6 }}>
              {[
                ['Fabric digital twin', fabricTwinPipeline.implemented],
                ['Fabric scanner', fabricScanner.implemented],
                ['Embroidery importer', embroideryImporter.implemented],
              ].map(([label, implemented]) => (
                <Row key={String(label)} justify="space-between">
                  <T variant="small">{String(label)}</T>
                  <Badge label={implemented ? 'IMPLEMENTED' : 'ARCHITECTURE ONLY'} tone={implemented ? 'success' : 'neutral'} />
                </Row>
              ))}
            </View>
          </Card>
        </Section>

        <T variant="tiny" color={theme.color.textFaint}>
          DEMO_MODE={String(ENV.DEMO_MODE)} · MOCK_AI_MODE={String(ENV.MOCK_AI_MODE)}
        </T>
      </ScrollView>
    </>
  );
}

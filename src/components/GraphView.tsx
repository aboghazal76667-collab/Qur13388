import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

import { AppText, Row, Badge } from './primitives';
import { useTheme } from '../theme/ThemeProvider';
import { NODE_LABELS } from '../graph/builder';
import type { GraphNode, KnowledgeGraph } from '../types/knowledge';

/**
 * Radial knowledge-graph prototype.
 *
 * A force simulation is overkill on a phone and janky in Expo Go, so layout is
 * deterministic: the highest-degree node anchors the centre and the rest are
 * placed on rings by node kind. Readable, cheap, and stable between renders.
 * The `KnowledgeGraph` shape is what a real graph database would return, so
 * swapping in a proper renderer later touches this file only.
 */
export function GraphView({ graph, height = 320 }: { graph: KnowledgeGraph; height?: number }) {
  const { palette, spacing, radii } = useTheme();

  const layout = useMemo(() => computeLayout(graph, height), [graph, height]);

  const colorFor = (kind: GraphNode['kind']): string => {
    switch (kind) {
      case 'verse':
        return palette.accent;
      case 'root':
        return palette.good;
      case 'word':
        return palette.neutral;
      case 'concept':
        return palette.strong;
      case 'thinker':
        return palette.caution;
      case 'claim':
        return palette.external;
    }
  };

  if (graph.nodes.length === 0) {
    return (
      <View style={{ padding: spacing.lg }}>
        <AppText variant="small" tone="muted" align="center">
          لا توجد عناصر كافية لبناء الرسم.
        </AppText>
      </View>
    );
  }

  const kinds = Array.from(new Set(graph.nodes.map((n) => n.kind)));

  return (
    <View style={{ gap: spacing.md }}>
      <View
        style={{
          height,
          borderRadius: radii.lg,
          backgroundColor: palette.surface,
          borderWidth: 1,
          borderColor: palette.border,
          overflow: 'hidden',
        }}
      >
        <Svg width="100%" height={height}>
          {graph.edges.map((edge) => {
            const from = layout.positions[edge.from];
            const to = layout.positions[edge.to];
            if (!from || !to) return null;
            return (
              <Line
                key={edge.id}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={palette.border}
                strokeWidth={1}
              />
            );
          })}

          {graph.nodes.map((node) => {
            const pos = layout.positions[node.id];
            if (!pos) return null;
            const r = node.id === layout.centerId ? 14 : 8;
            return (
              <React.Fragment key={node.id}>
                <Circle cx={pos.x} cy={pos.y} r={r} fill={colorFor(node.kind)} opacity={0.9} />
                <SvgText
                  x={pos.x}
                  y={pos.y + r + 12}
                  fill={palette.textMuted}
                  fontSize={9}
                  textAnchor="middle"
                >
                  {truncate(node.label, 16)}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
      </View>

      <Row gap={6}>
        {kinds.map((kind) => (
          <View key={kind} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colorFor(kind) }} />
            <AppText variant="tiny" tone="faint">
              {NODE_LABELS[kind]}
            </AppText>
          </View>
        ))}
      </Row>

      <Row gap={6}>
        <Badge label={`${graph.nodes.length} عقدة`} tone="neutral" />
        <Badge label={`${graph.edges.length} علاقة`} tone="neutral" />
      </Row>
    </View>
  );
}

interface Layout {
  positions: Record<string, { x: number; y: number }>;
  centerId: string | null;
}

function computeLayout(graph: KnowledgeGraph, height: number): Layout {
  const width = 340;
  const cx = width / 2;
  const cy = height / 2;

  const degree = new Map<string, number>();
  for (const edge of graph.edges) {
    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
  }

  const sorted = [...graph.nodes].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0));
  const centerId = sorted[0]?.id ?? null;

  const positions: Record<string, { x: number; y: number }> = {};
  if (centerId) positions[centerId] = { x: cx, y: cy };

  const rest = sorted.slice(1);
  // Two rings: the well-connected nodes inside, the long tail outside.
  const inner = rest.slice(0, 8);
  const outer = rest.slice(8, 34);

  const place = (nodes: GraphNode[], radius: number, offset: number) => {
    nodes.forEach((node, i) => {
      const angle = offset + (i / Math.max(1, nodes.length)) * Math.PI * 2;
      positions[node.id] = {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius * 0.78,
      };
    });
  };

  place(inner, Math.min(width, height) * 0.24, -Math.PI / 2);
  place(outer, Math.min(width, height) * 0.42, -Math.PI / 2 + 0.3);

  return { positions, centerId };
}

function truncate(text: string, length: number): string {
  return text.length <= length ? text : `${text.slice(0, length)}…`;
}

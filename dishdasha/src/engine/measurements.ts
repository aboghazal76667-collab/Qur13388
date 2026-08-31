import { getMeasurementTemplate } from '@dd/domain/measurementTemplates';
import type {
  MeasurementProfile,
  MeasurementStatus,
  MeasurementTemplate,
} from '@dd/domain/types';

export type MeasurementIssue = {
  fieldKey: string;
  severity: 'error' | 'warning';
  code: 'required' | 'out_of_range' | 'implausible_ratio';
  message: { ar: string; en: string };
};

export const CM_PER_INCH = 2.54;

export const toCm = (value: number, unit: 'cm' | 'in'): number =>
  unit === 'cm' ? value : value * CM_PER_INCH;

export const fromCm = (valueCm: number, unit: 'cm' | 'in'): number =>
  unit === 'cm' ? valueCm : valueCm / CM_PER_INCH;

export const convertValue = (value: number, from: 'cm' | 'in', to: 'cm' | 'in'): number =>
  from === to ? value : Math.round(fromCm(toCm(value, from), to) * 10) / 10;

/**
 * Rejects clearly impossible values rather than trying to police fit.
 * Ranges are wide on purpose: a real customer can sit outside a "typical"
 * body, and refusing their real measurement is worse than a soft warning.
 */
export const validateMeasurements = (
  values: Record<string, number>,
  templateId: string,
  unit: 'cm' | 'in',
): MeasurementIssue[] => {
  const template = getMeasurementTemplate(templateId);
  const issues: MeasurementIssue[] = [];

  for (const field of template.fields) {
    const raw = values[field.key];
    if (raw === undefined || raw === null || Number.isNaN(raw)) {
      if (field.required) {
        issues.push({
          fieldKey: field.key,
          severity: 'error',
          code: 'required',
          message: { ar: 'هذا القياس مطلوب', en: 'This measurement is required' },
        });
      }
      continue;
    }
    const cm = toCm(raw, unit);
    if (cm < field.min || cm > field.max) {
      issues.push({
        fieldKey: field.key,
        severity: 'error',
        code: 'out_of_range',
        message: {
          ar: `القيمة يجب أن تكون بين ${field.min} و ${field.max} سم`,
          en: `Value must be between ${field.min} and ${field.max} cm`,
        },
      });
    }
  }

  // Cross-field sanity: a sleeve longer than the garment, or a chest smaller
  // than the neck, is a data-entry slip rather than a body.
  const lengthCm = values.total_length !== undefined ? toCm(values.total_length, unit) : null;
  const sleeveCm = values.sleeve_length !== undefined ? toCm(values.sleeve_length, unit) : null;
  if (lengthCm !== null && sleeveCm !== null && sleeveCm >= lengthCm * 0.65) {
    issues.push({
      fieldKey: 'sleeve_length',
      severity: 'warning',
      code: 'implausible_ratio',
      message: {
        ar: 'طول الكم كبير جداً مقارنة بالطول الكلي — يرجى التأكد.',
        en: 'Sleeve length looks long relative to total length — please double-check.',
      },
    });
  }

  const chestCm = values.chest !== undefined ? toCm(values.chest, unit) : null;
  const neckCm = values.neck !== undefined ? toCm(values.neck, unit) : null;
  if (chestCm !== null && neckCm !== null && neckCm >= chestCm * 0.6) {
    issues.push({
      fieldKey: 'neck',
      severity: 'warning',
      code: 'implausible_ratio',
      message: {
        ar: 'محيط الرقبة كبير مقارنة بالصدر — يرجى التأكد.',
        en: 'Neck looks large relative to chest — please double-check.',
      },
    });
  }

  return issues;
};

export const hasBlockingIssues = (issues: MeasurementIssue[]): boolean =>
  issues.some((i) => i.severity === 'error');

export const emptyValuesFor = (template: MeasurementTemplate): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const f of template.fields) out[f.key] = f.typical;
  return out;
};

/**
 * Applies an approved alteration delta to a saved profile.
 * Never called implicitly — the customer must confirm first.
 */
export const applyAlterationDelta = (
  profile: MeasurementProfile,
  fieldKey: string,
  delta: number,
): MeasurementProfile => {
  const current = profile.values[fieldKey];
  if (current === undefined) return profile;
  return {
    ...profile,
    values: { ...profile.values, [fieldKey]: Math.round((current + delta) * 10) / 10 },
    status: 'needs_review' as MeasurementStatus,
    notes: [profile.notes, `Adjusted ${fieldKey} by ${delta > 0 ? '+' : ''}${delta}`]
      .filter(Boolean)
      .join(' · '),
    updatedAt: new Date().toISOString(),
  };
};

export const statusConfidence = (status: MeasurementStatus): number =>
  status === 'tailor_verified' ? 1 : status === 'imported' ? 0.75 : status === 'customer_entered' ? 0.55 : 0.3;

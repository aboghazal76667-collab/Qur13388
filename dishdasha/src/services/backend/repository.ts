/**
 * DATA ACCESS BOUNDARY.
 *
 * Screens read from zustand stores; the stores read from a repository. Today
 * the repository is backed by local seed data, which is what makes the whole
 * app work with zero credentials. When Supabase is configured the same
 * interface is fulfilled by the Supabase adapter and no screen changes.
 */
import type {
  Design,
  EmbroideryPattern,
  Fabric,
  GarmentColor,
  MeasurementProfile,
  Order,
  TailorBusiness,
  ThreadColor,
} from '@dd/domain/types';
import { EMBROIDERY_PATTERNS } from '@dd/data/embroidery';
import { FABRICS } from '@dd/data/fabrics';
import { GARMENT_COLORS, THREAD_COLORS } from '@dd/data/colors';
import { TAILORS } from '@dd/data/tailors';
import { DEMO_DESIGNS, DEMO_MEASUREMENTS, DEMO_ORDERS } from '@dd/data/demo';

export interface CatalogRepository {
  readonly source: 'local' | 'supabase';
  fabrics(): Promise<Fabric[]>;
  patterns(): Promise<EmbroideryPattern[]>;
  colors(): Promise<GarmentColor[]>;
  threads(): Promise<ThreadColor[]>;
  tailors(): Promise<TailorBusiness[]>;
}

export interface CustomerRepository {
  readonly source: 'local' | 'supabase';
  measurements(customerId: string): Promise<MeasurementProfile[]>;
  designs(customerId: string): Promise<Design[]>;
  orders(customerId: string): Promise<Order[]>;
  saveMeasurement(profile: MeasurementProfile): Promise<MeasurementProfile>;
  saveDesign(design: Design): Promise<Design>;
  createOrder(order: Order): Promise<Order>;
}

export class LocalCatalogRepository implements CatalogRepository {
  readonly source = 'local' as const;
  async fabrics() { return FABRICS; }
  async patterns() { return EMBROIDERY_PATTERNS; }
  async colors() { return GARMENT_COLORS; }
  async threads() { return THREAD_COLORS; }
  async tailors() { return TAILORS; }
}

export class LocalCustomerRepository implements CustomerRepository {
  readonly source = 'local' as const;
  async measurements() { return DEMO_MEASUREMENTS; }
  async designs() { return DEMO_DESIGNS; }
  async orders() { return DEMO_ORDERS; }
  async saveMeasurement(profile: MeasurementProfile) { return profile; }
  async saveDesign(design: Design) { return design; }
  async createOrder(order: Order) { return order; }
}

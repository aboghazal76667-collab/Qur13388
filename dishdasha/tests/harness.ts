/**
 * Minimal test harness.
 *
 * Deliberately dependency-free: it runs under `tsx` with no Jest/Babel
 * configuration, so `npm test` works on a fresh clone and in CI without a
 * second toolchain to keep in sync with Expo's.
 */
type TestFn = () => void | Promise<void>;

const suites: { name: string; tests: { name: string; fn: TestFn }[] }[] = [];
let current: (typeof suites)[number] | null = null;

export const describe = (name: string, fn: () => void) => {
  current = { name, tests: [] };
  suites.push(current);
  fn();
  current = null;
};

export const it = (name: string, fn: TestFn) => {
  if (!current) throw new Error('it() called outside describe()');
  current.tests.push({ name, fn });
};

export class AssertionError extends Error {}

const show = (value: unknown) =>
  typeof value === 'object' ? JSON.stringify(value) : String(value);

export const expect = <T>(actual: T) => ({
  toBe(expected: T) {
    if (!Object.is(actual, expected)) {
      throw new AssertionError(`expected ${show(expected)}, received ${show(actual)}`);
    }
  },
  toEqual(expected: unknown) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new AssertionError(`expected ${show(expected)}, received ${show(actual)}`);
    }
  },
  toBeCloseTo(expected: number, precision = 3) {
    const diff = Math.abs(Number(actual) - expected);
    if (diff > Math.pow(10, -precision) / 2) {
      throw new AssertionError(`expected ${expected} ± 1e-${precision}, received ${show(actual)}`);
    }
  },
  toBeTruthy() {
    if (!actual) throw new AssertionError(`expected truthy, received ${show(actual)}`);
  },
  toBeFalsy() {
    if (actual) throw new AssertionError(`expected falsy, received ${show(actual)}`);
  },
  toBeGreaterThan(expected: number) {
    if (!(Number(actual) > expected)) {
      throw new AssertionError(`expected > ${expected}, received ${show(actual)}`);
    }
  },
  toBeLessThan(expected: number) {
    if (!(Number(actual) < expected)) {
      throw new AssertionError(`expected < ${expected}, received ${show(actual)}`);
    }
  },
  toHaveLength(expected: number) {
    const length = (actual as unknown as { length: number }).length;
    if (length !== expected) {
      throw new AssertionError(`expected length ${expected}, received ${length}`);
    }
  },
  toContain(expected: unknown) {
    const list = actual as unknown as unknown[];
    if (!list.includes(expected)) {
      throw new AssertionError(`expected to contain ${show(expected)}`);
    }
  },
  toThrow() {
    try {
      (actual as unknown as () => void)();
    } catch {
      return;
    }
    throw new AssertionError('expected function to throw');
  },
});

export const run = async (): Promise<number> => {
  let passed = 0;
  const failures: { suite: string; test: string; error: unknown }[] = [];

  for (const suite of suites) {
    console.log(`\n  ${suite.name}`);
    for (const test of suite.tests) {
      try {
        await test.fn();
        passed += 1;
        console.log(`    ✓ ${test.name}`);
      } catch (error) {
        failures.push({ suite: suite.name, test: test.name, error });
        console.log(`    ✗ ${test.name}`);
      }
    }
  }

  console.log(`\n  ${passed} passed, ${failures.length} failed\n`);
  for (const failure of failures) {
    console.log(`  ${failure.suite} > ${failure.test}`);
    console.log(`    ${failure.error instanceof Error ? failure.error.message : String(failure.error)}`);
  }
  return failures.length;
};

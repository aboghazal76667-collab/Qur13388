import { run } from './harness';
import './suites';

void run().then((failures) => {
  process.exit(failures > 0 ? 1 : 0);
});

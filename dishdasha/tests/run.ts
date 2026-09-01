import { run } from './harness';
import './suites';
import './v2Suites';

void run().then((failures) => {
  process.exit(failures > 0 ? 1 : 0);
});

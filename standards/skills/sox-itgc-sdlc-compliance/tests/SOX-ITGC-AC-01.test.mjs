// Test harness for SOX-ITGC-AC-01. Proves the control conforms to the schema, runs to a
// schema-valid run record, lands on the fixture's expected status, and that its assertions evaluate.
import { registerControlTests } from '../../../control-framework/lib/test-helper.mjs';

registerControlTests('sox', 'SOX-ITGC-AC-01');

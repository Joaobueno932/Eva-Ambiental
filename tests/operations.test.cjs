const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Compile only the tested module in memory; no production data or network calls.
function load(relative, dependencies = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const result = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    if (name in dependencies) return dependencies[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }, result, result.exports);
  return result.exports;
}
const { operationSummary, weighingEvents } = load('src/utils/operations.ts');
const { validateProfile } = load('src/utils/authErrors.ts');
const record = (changes = {}) => ({ id: 'test', created_by: 'owner', approval_status: 'pending',
  created_at: '2026-09-20T12:00:00Z', weighing_date: '2026-09-20T12:00:00Z', weight_kg: 10, ...changes });

test('status, export and weight scopes remain distinct', () => {
  const result = operationSummary([record(), record({ approval_status: 'approved', weight_kg: 20 }),
    record({ approval_status: 'rejected', weight_kg: 99 }), record({ canceled_at: '2026-09-21', weight_kg: 200 })]);
  assert.deepEqual(result.status, { pending: 1, approved: 1, rejected: 1, canceled: 1 });
  assert.equal(result.exportCount, 3);
  assert.equal(result.daily.reduce((sum, day) => sum + day.value, 0), 30);
});
test('empty scope has no fabricated activity', () => {
  assert.deepEqual(operationSummary([]), { status: { pending: 0, approved: 0, rejected: 0, canceled: 0 }, exportCount: 0, daily: [] });
});
test('daily evolution sums numeric database values and sorts chronologically', () => {
  const result = operationSummary([record({ weight_kg: '12.5' }), record({ weighing_date: '2026-09-19T12:00:00Z', weight_kg: 3 }), record({ weight_kg: 2.5 })]);
  assert.deepEqual(result.daily.map(d => d.value), [3, 15]);
});
test('timeline never infers an approval from updated_at', () => {
  assert.equal(weighingEvents(record({ updated_at: '2026-09-21T12:00:00Z' })).length, 1);
  assert.equal(weighingEvents(record({ approval_status: 'approved' })).length, 1);
});
test('rejection and cancellation preserve actual dates and reasons', () => {
  const events = weighingEvents(record({ approval_status: 'rejected', approved_at: '2026-09-20T13:00:00Z', rejection_reason: 'Foto ilegível',
    canceled_at: '2026-09-21T12:00:00Z', cancellation_reason: 'Duplicidade' }));
  assert.deepEqual(events.map(e => e.label), ['Registro criado', 'Pesagem rejeitada', 'Pesagem cancelada']);
  assert.equal(events[1].detail, 'Foto ilegível');
  assert.equal(events[2].detail, 'Duplicidade');
});
for (const role of ['admin', 'analyst', 'operator', 'viewer']) {
  test(`${role}: inactive profile rejected; active profile accepted`, () => {
    assert.equal(validateProfile({ role, active: true }), null);
    assert.equal(validateProfile({ role, active: false }).signOut, true);
  });
  test(`${role}: creation, decisions and ownership rules preserved`, () => {
    const { usePermissions } = load('src/hooks/usePermissions.ts', {
      '@/contexts/AuthContext': { useAuth: () => ({ profile: { id: 'owner', role, active: true } }) },
    });
    const p = usePermissions();
    assert.equal(p.canCreateWeighing, role !== 'viewer');
    assert.equal(p.canApprove, role === 'admin' || role === 'analyst');
    assert.equal(p.canCancelWeighing, p.canApprove);
    assert.equal(p.canManageUsers, role === 'admin');
    assert.equal(p.canEditWeighing(record()), role !== 'viewer');
    assert.equal(p.canEditWeighing(record({ created_by: 'someone-else' })), role === 'admin');
    assert.equal(p.canEditWeighing(record({ approval_status: 'approved' })), role === 'admin');
    assert.equal(p.canEditWeighing(record({ canceled_at: '2026-09-21' })), false);
  });
}

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
const { operationSummary, weighingEvents, dailyStatusSeries } = load('src/utils/operations.ts');
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
test('daily status series counts by status and ignores canceled records', () => {
  const series = dailyStatusSeries([record(), record({ approval_status: 'approved' }),
    record({ approval_status: 'approved' }), record({ approval_status: 'rejected' }),
    record({ canceled_at: '2026-09-21' })]);
  assert.equal(series.length, 1);
  assert.deepEqual({ ...series[0] }, { day: '2026-09-20', label: '20/09', approved: 2, pending: 1, rejected: 1 });
});
test('daily status series counts weighings, never their weight', () => {
  const series = dailyStatusSeries([record({ weight_kg: 900 }), record({ weight_kg: 1 })]);
  assert.equal(series[0].pending, 2);
});
test('daily status series spans the whole window, keeping empty days at zero', () => {
  const series = dailyStatusSeries([record()], '2026-09-18', '2026-09-22');
  assert.deepEqual(series.map(d => d.day),
    ['2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22']);
  assert.deepEqual(series.map(d => d.pending), [0, 0, 1, 0, 0]);
});
test('daily status series sorts chronologically without a window', () => {
  const series = dailyStatusSeries([record({ weighing_date: '2026-09-22T12:00:00Z' }),
    record({ weighing_date: '2026-09-19T12:00:00Z' })]);
  assert.deepEqual(series.map(d => d.day), ['2026-09-19', '2026-09-22']);
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

// ---------------------------------------------------------------------------
// Fator de desvio de aterro (migração 0011)
// ---------------------------------------------------------------------------
// O fator é o único campo do cadastro de tratamentos que muda número: ele
// entra na taxa de desvio do painel e dos relatórios. Estes testes fixam que
// um banco sem o campo, ou um cadastro em que ninguém mexeu nele, continua
// dando exatamente a conta antiga.
// O módulo só é carregado para uma função que não usa datas; o dayjs entra
// como dublê porque `format.ts` chama `dayjs.locale` ao ser importado.
const dayjsStub = () => ({ isValid: () => false, format: () => '' });
dayjsStub.locale = () => {};
const { treatmentDiversionFactor } = load('src/utils/format.ts', {
  dayjs: { __esModule: true, default: dayjsStub },
  'dayjs/locale/pt-br': {},
});

test('sem o campo, o fator repete a marca de desvio', () => {
  assert.equal(treatmentDiversionFactor({ name: 'Reciclagem', counts_as_diversion: true }), 1);
  assert.equal(treatmentDiversionFactor({ name: 'Aterro', counts_as_diversion: false }), 0);
  assert.equal(treatmentDiversionFactor(null), 0);
});

test('o fator cadastrado manda, inclusive quando é parcial', () => {
  assert.equal(treatmentDiversionFactor({ counts_as_diversion: true, diversion_factor: 100 }), 1);
  assert.equal(treatmentDiversionFactor({ counts_as_diversion: true, diversion_factor: 60 }), 0.6);
  // Fator zero vence a marca: quem zerou o percentual não quer desvio nenhum.
  assert.equal(treatmentDiversionFactor({ counts_as_diversion: true, diversion_factor: 0 }), 0);
});

test('fator fora da faixa é contido, não propagado', () => {
  assert.equal(treatmentDiversionFactor({ counts_as_diversion: true, diversion_factor: 150 }), 1);
  assert.equal(treatmentDiversionFactor({ counts_as_diversion: true, diversion_factor: -10 }), 0);
});

test('o nome ainda desvia quando não há marca nem fator', () => {
  // Fallback histórico por nome normalizado, preservado.
  assert.equal(treatmentDiversionFactor({ name: 'Reaproveitamento' }), 1);
  assert.equal(treatmentDiversionFactor({ name: 'Incineração' }), 0);
});

// ---------------------------------------------------------------------------
// CPF e data de nascimento (migração 0015)
// ---------------------------------------------------------------------------
const { maskCpf, isValidCpf, maskDate, parseBrDate, formatBrDate } = load('src/utils/format.ts', {
  dayjs: { __esModule: true, default: dayjsStub },
  'dayjs/locale/pt-br': {},
});

test('a máscara do CPF acompanha o que já foi digitado', () => {
  assert.equal(maskCpf('123'), '123');
  assert.equal(maskCpf('1234567'), '123.456.7');
  assert.equal(maskCpf('52998224725'), '529.982.247-25');
  // Dígitos a mais são descartados em vez de deslocarem a máscara.
  assert.equal(maskCpf('529982247259999'), '529.982.247-25');
});

test('o CPF é conferido pelos dígitos verificadores', () => {
  assert.equal(isValidCpf('529.982.247-25'), true);
  assert.equal(isValidCpf('52998224725'), true);
  assert.equal(isValidCpf('529.982.247-24'), false);
  // Sequências repetidas passam na conta, mas não são CPF de ninguém.
  assert.equal(isValidCpf('111.111.111-11'), false);
  assert.equal(isValidCpf('123'), false);
  assert.equal(isValidCpf(null), false);
});

test('a data só é aceita se existir no calendário', () => {
  assert.equal(maskDate('12051990'), '12/05/1990');
  assert.equal(parseBrDate('12/05/1990'), '1990-05-12');
  assert.equal(parseBrDate('29/02/2024'), '2024-02-29');
  // 2023 não é bissexto, 31/02 não existe e o ano precisa de quatro casas.
  assert.equal(parseBrDate('29/02/2023'), null);
  assert.equal(parseBrDate('31/02/1990'), null);
  assert.equal(parseBrDate('12/5/90'), null);
  assert.equal(parseBrDate(''), null);
});

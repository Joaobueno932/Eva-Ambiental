/**
 * Quais colunas a tabela tem de verdade.
 *
 * As telas de cadastro têm campos que só existem depois de uma migração. Até
 * aqui cada tela decidia isso com uma única marca por tabela ("o cadastro
 * completo existe?"), obtida de uma coluna representativa — e o efeito era
 * trancar campos cuja coluna existe, só porque a coluna vizinha não existia.
 * Num banco em que as migrações foram aplicadas pela metade, ou em que alguém
 * criou uma coluna à mão, isso trancava o que dava para editar.
 *
 * A resposta certa vem da própria resposta do banco: `select *` devolve as
 * colunas que existem, e as chaves da primeira linha são a lista. Cada campo
 * passa a perguntar pela sua coluna.
 */
export type ColumnCheck = (column: string) => boolean;

/** As colunas presentes na resposta; vazio quando não veio nenhuma linha. */
export function columnsOf(rows: readonly object[]): string[] {
  return rows.length > 0 ? Object.keys(rows[0]) : [];
}

/**
 * A pergunta que cada campo faz.
 *
 * Sem nenhuma linha para inspecionar não há o que afirmar sobre o banco: aí
 * nada é trancado. É melhor deixar o campo editável e, no limite, receber do
 * banco uma recusa que diz o nome da coluna, do que esconder um campo que
 * talvez exista — numa tabela vazia a única ação possível é criar o primeiro
 * registro.
 */
export function columnCheck(columns: readonly string[]): ColumnCheck {
  if (columns.length === 0) return () => true;
  const set = new Set(columns);
  return (column) => set.has(column);
}

/**
 * Só os campos que têm coluna.
 *
 * Mandar uma coluna que não existe faz o banco recusar a gravação inteira —
 * inclusive os campos que existem. Filtrar antes é o que permite salvar o que
 * dá para salvar.
 */
export function onlyExisting<T extends object>(fields: T, can: ColumnCheck): Partial<T> {
  return Object.fromEntries(Object.entries(fields).filter(([key]) => can(key))) as Partial<T>;
}

/** Quantos dos campos listados estão sem coluna no banco. */
export function missingColumns(candidates: readonly string[], can: ColumnCheck): string[] {
  return candidates.filter((column) => !can(column));
}

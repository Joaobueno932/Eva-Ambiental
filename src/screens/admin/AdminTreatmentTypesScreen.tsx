import React from 'react';
import { MasterCrud, FieldConfig } from './MasterCrud';
import { listTreatmentTypes, upsertTreatmentType } from '@/services/masters';
import { TreatmentType } from '@/types';

const fields: FieldConfig[] = [
  { key: 'name', label: 'Nome do tratamento', type: 'text', placeholder: 'Ex.: Reciclagem', required: true },
  { key: 'counts_as_diversion', label: 'Conta como desvio de aterro?', type: 'switch', default: true },
];

export function AdminTreatmentTypesScreen() {
  return (
    <MasterCrud<TreatmentType>
      title="Tipos de Tratamento"
      subtitle="Define o desvio de aterro"
      fields={fields}
      load={() => listTreatmentTypes(false)}
      upsert={upsertTreatmentType}
      renderTitle={(t) => t.name}
      renderSubtitle={(t) => (t.counts_as_diversion ? 'Desvio de aterro' : 'Aterro (não desvia)')}
    />
  );
}

import React from 'react';
import { MasterCrud, FieldConfig } from './MasterCrud';
import { listWasteTypes, upsertWasteType } from '@/services/masters';
import { WasteType } from '@/types';

const fields: FieldConfig[] = [
  { key: 'name', label: 'Nome do resíduo', type: 'text', placeholder: 'Ex.: Papelão', required: true },
  { key: 'color', label: 'Cor (hex)', type: 'text', placeholder: '#63B32E', default: '#63B32E' },
];

export function AdminWasteTypesScreen() {
  return (
    <MasterCrud<WasteType>
      title="Tipos de Resíduos"
      subtitle="Categorias de resíduos"
      fields={fields}
      load={() => listWasteTypes(false)}
      upsert={upsertWasteType}
      renderTitle={(w) => w.name}
      renderSubtitle={(w) => w.color ?? ''}
    />
  );
}

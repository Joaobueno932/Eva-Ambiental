import React from 'react';
import { MasterCrud, FieldConfig } from './MasterCrud';
import { listClients, upsertClient } from '@/services/masters';
import { Client } from '@/types';

const fields: FieldConfig[] = [
  { key: 'name', label: 'Nome', type: 'text', placeholder: 'Nome do cliente', required: true },
  { key: 'document', label: 'Documento (CNPJ/CPF)', type: 'text', placeholder: '00.000.000/0001-00' },
  { key: 'email', label: 'E-mail', type: 'text', placeholder: 'contato@cliente.com', keyboardType: 'email-address' },
  { key: 'phone', label: 'Telefone', type: 'text', placeholder: '(00) 00000-0000', keyboardType: 'phone-pad' },
];

export function AdminClientsScreen() {
  return (
    <MasterCrud<Client>
      title="Clientes"
      subtitle="Gerencie os clientes"
      fields={fields}
      load={() => listClients(false)}
      upsert={upsertClient}
      renderTitle={(c) => c.name}
      renderSubtitle={(c) => c.document ?? c.email ?? ''}
    />
  );
}

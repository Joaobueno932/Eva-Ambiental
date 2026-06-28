import React from 'react';
import { MasterCrud, FieldConfig } from './MasterCrud';
import { listRecipients, upsertRecipient } from '@/services/masters';
import { Recipient } from '@/types';

const fields: FieldConfig[] = [
  { key: 'name', label: 'Nome', type: 'text', placeholder: 'Nome do destinatário', required: true },
  { key: 'document', label: 'Documento (CNPJ/CPF)', type: 'text', placeholder: '00.000.000/0001-00' },
  { key: 'email', label: 'E-mail', type: 'text', placeholder: 'contato@destinatario.com', keyboardType: 'email-address' },
  { key: 'phone', label: 'Telefone', type: 'text', placeholder: '(00) 00000-0000', keyboardType: 'phone-pad' },
];

export function AdminRecipientsScreen() {
  return (
    <MasterCrud<Recipient>
      title="Destinatários"
      subtitle="Para onde o resíduo vai"
      fields={fields}
      load={() => listRecipients(false)}
      upsert={upsertRecipient}
      renderTitle={(r) => r.name}
      renderSubtitle={(r) => r.document ?? r.email ?? ''}
    />
  );
}

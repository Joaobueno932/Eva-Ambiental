import React, { useEffect, useState } from 'react';
import { Loading } from '@/components';
import { MasterCrud, FieldConfig } from './MasterCrud';
import { listClients, listUnits, upsertUnit } from '@/services/masters';
import { Client, Unit } from '@/types';

export function AdminUnitsScreen() {
  const [clients, setClients] = useState<Client[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    listClients(false)
      .then(setClients)
      .finally(() => setReady(true));
  }, []);

  if (!ready) return <Loading />;

  const fields: FieldConfig[] = [
    {
      key: 'client_id',
      label: 'Cliente',
      type: 'select',
      required: true,
      placeholder: 'Selecione o cliente',
      options: clients.map((c) => ({ label: c.name, value: c.id })),
    },
    { key: 'name', label: 'Nome da unidade', type: 'text', placeholder: 'Ex.: Unidade Central', required: true },
    { key: 'city', label: 'Cidade', type: 'text', placeholder: 'Cidade' },
    { key: 'address', label: 'Endereço', type: 'text', placeholder: 'Endereço completo' },
  ];

  const clientName = (id?: string) => clients.find((c) => c.id === id)?.name ?? '';

  return (
    <MasterCrud<Unit>
      title="Unidades"
      subtitle="Locais por cliente"
      fields={fields}
      load={() => listUnits(false)}
      upsert={upsertUnit}
      renderTitle={(u) => u.name}
      renderSubtitle={(u) => [clientName(u.client_id), u.city].filter(Boolean).join(' • ')}
    />
  );
}

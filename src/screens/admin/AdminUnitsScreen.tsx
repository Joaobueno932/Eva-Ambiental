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
      .catch(() => setClients([]))
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
    { key: 'name', label: 'Nome da unidade / localidade', type: 'text', placeholder: 'Ex.: Unidade Central', required: true },
    { key: 'street', label: 'Rua / Logradouro', type: 'text', placeholder: 'Ex.: Av. Paulista, 1000' },
    { key: 'neighborhood', label: 'Bairro', type: 'text', placeholder: 'Ex.: Centro' },
    { key: 'city', label: 'Cidade', type: 'text', placeholder: 'Ex.: São Paulo' },
    { key: 'state', label: 'Estado (UF)', type: 'text', placeholder: 'Ex.: SP' },
    { key: 'postal_code', label: 'CEP', type: 'text', placeholder: 'Ex.: 01310-100' },
  ];

  const clientName = (id?: string) => clients.find((c) => c.id === id)?.name ?? '';

  const renderSubtitle = (u: Unit) => {
    const parts = [
      clientName(u.client_id),
      [u.city, u.state].filter(Boolean).join(' - '),
    ].filter(Boolean);
    return parts.join(' • ');
  };

  return (
    <MasterCrud<Unit>
      title="Unidades"
      subtitle="Locais por cliente"
      fields={fields}
      load={() => listUnits(false)}
      upsert={upsertUnit}
      renderTitle={(u) => u.name}
      renderSubtitle={renderSubtitle}
    />
  );
}

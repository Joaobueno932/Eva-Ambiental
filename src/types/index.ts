export type Role = 'admin' | 'analyst' | 'operator' | 'viewer';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type ImageSource = 'camera' | 'upload';

/** Detalhes de localização (reverse geocoding ou preenchimento manual). */
export interface LocationDetails {
  latitude?: number | null;
  longitude?: number | null;
  placeName?: string | null;
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  postalCode?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  formattedAddress?: string | null;
  capturedAt?: string | null;
}

/** Colunas de endereço persistidas (weighings e weighing_photos). */
export interface LocationColumns {
  location_place_name?: string | null;
  location_street?: string | null;
  location_number?: string | null;
  location_neighborhood?: string | null;
  location_postal_code?: string | null;
  location_city?: string | null;
  location_state?: string | null;
  location_country?: string | null;
  location_formatted_address?: string | null;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  active: boolean;
  client_id?: string | null;
  created_at: string;
  updated_at: string;
  /**
   * Último login, vindo de `auth.users` pela função `admin_list_users`
   * (migração 0007). Ausente enquanto a migração não for aplicada; `null`
   * para quem nunca entrou.
   */
  last_sign_in_at?: string | null;
  /**
   * Observação livre sobre a conta (migração 0008). Ausente enquanto a
   * migração não for aplicada — a interface então desabilita o campo em vez
   * de aceitar um texto que não teria onde ser gravado.
   */
  notes?: string | null;
  /**
   * CPF, só dígitos (migração 0015). A pontuação é da exibição: gravar as
   * duas formas faria o mesmo CPF existir duas vezes no banco.
   */
  cpf?: string | null;
  /** Data de nascimento, "AAAA-MM-DD" (migração 0015). */
  birth_date?: string | null;
}

export interface Client {
  id: string;
  /** Razão social. */
  name: string;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  active: boolean;
  created_at: string;
  /**
   * Cadastro completo (migração 0009). Ausentes enquanto a migração não for
   * aplicada — a interface então desabilita os campos em vez de aceitar um
   * texto que não teria onde ser gravado.
   */
  trade_name?: string | null;
  state_registration?: string | null;
  segment?: string | null;
  contact_name?: string | null;
  contact_role?: string | null;
  city?: string | null;
  state?: string | null;
  notes?: string | null;
  updated_at?: string | null;
}

export interface Unit {
  id: string;
  client_id: string;
  name: string;
  city?: string | null;
  /** Endereço em texto livre: o que a importação de planilhas preenche. */
  address?: string | null;
  active: boolean;
  created_at: string;
  client?: Client;
  /**
   * Cadastro completo (migração 0010). Ausentes enquanto a migração não for
   * aplicada — a interface então desabilita os campos em vez de aceitar um
   * texto que não teria onde ser gravado.
   *
   * `street`, `neighborhood`, `state` e `postal_code` já eram gravados pelo
   * formulário antigo, mas as colunas nunca existiram no banco.
   */
  code?: string | null;
  type?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  street?: string | null;
  neighborhood?: string | null;
  state?: string | null;
  postal_code?: string | null;
  notes?: string | null;
  updated_at?: string | null;
}

export interface WasteType {
  id: string;
  name: string;
  color?: string | null;
  /**
   * Indica se o resíduo tem potencial de ser desviado do aterro (para cálculo
   * de desvio perdido). A coluna só existe a partir da migração 0012 — ver
   * `0013_missing_columns.sql` para o histórico dessa ausência.
   */
  is_divertible?: boolean;
  active: boolean;
  created_at: string;
  /**
   * Cadastro completo (migração 0012). Ausentes enquanto a migração não for
   * aplicada — a interface então desabilita os campos em vez de aceitar um
   * texto que não teria onde ser gravado.
   */
  code?: string | null;
  category?: string | null;
  /** Classe da NBR 10004: "Classe I", "Classe II A" ou "Classe II B". */
  waste_class?: string | null;
  description?: string | null;
  /** Tratamento que a tela sugere ao registrar uma pesagem deste resíduo. */
  default_treatment_id?: string | null;
  suggested_recipient_id?: string | null;
  is_hazardous?: boolean;
  notes?: string | null;
  updated_at?: string | null;
}

export interface TreatmentType {
  id: string;
  name: string;
  counts_as_diversion: boolean;
  active: boolean;
  created_at: string;
  /**
   * Cadastro completo (migração 0011). Ausentes enquanto a migração não for
   * aplicada — a interface então desabilita os campos em vez de aceitar um
   * texto que não teria onde ser gravado.
   */
  category?: string | null;
  description?: string | null;
  application?: string | null;
  notes?: string | null;
  /**
   * Percentual do peso que conta como desvio de aterro (0 a 100).
   *
   * Nulo é o comportamento de sempre: o peso inteiro quando
   * `counts_as_diversion` é verdadeiro, nada quando é falso. Ver
   * `treatmentDiversionFactor`.
   */
  diversion_factor?: number | null;
  updated_at?: string | null;
}

export interface Recipient {
  id: string;
  name: string;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  /**
   * Indica se este destinatário representa aterro/disposição final. A coluna
   * só existe a partir da migração 0013 — ver o cabeçalho dela. É derivada do
   * `type`: só um aterro sanitário responde verdadeiro.
   */
  is_landfill?: boolean;
  /**
   * Espelho de `status`, mantido pelo banco (migração 0014). É o que o resto
   * do sistema lê para saber se o destinatário pode ser escolhido numa
   * pesagem; "pendente" e "inativo" chegam aqui como falso.
   */
  active: boolean;
  created_at: string;
  /**
   * Cadastro completo (migração 0014). Ausentes enquanto a migração não for
   * aplicada — a interface então desabilita os campos em vez de aceitar um
   * texto que não teria onde ser gravado.
   */
  type?: string | null;
  contact_name?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  street?: string | null;
  neighborhood?: string | null;
  website?: string | null;
  license_number?: string | null;
  /** Endereço do documento da licença, quando há um para abrir. */
  license_url?: string | null;
  /** 'active' | 'pending' | 'inactive'. Ver `recipientStatus`. */
  status?: string | null;
  notes?: string | null;
  updated_at?: string | null;
}

export interface WeighingPhoto extends LocationColumns {
  id: string;
  weighing_id: string;
  storage_path: string;
  public_url?: string | null;
  image_source: ImageSource;
  gps_lat?: number | null;
  gps_lng?: number | null;
  manual_location?: string | null;
  captured_at?: string | null;
  created_at: string;
}

export interface Weighing extends LocationColumns {
  id: string;
  /**
   * Número sequencial exibido como "000028".
   *
   * Opcional porque só existe a partir da migração 0006 — antes dela a
   * interface cai no início do UUID. Ver `formatWeighingCode`.
   */
  seq?: number | null;
  client_id: string;
  unit_id: string;
  waste_type_id: string;
  treatment_type_id: string;
  recipient_id?: string | null;
  weighing_date: string;
  weight_kg: number;
  status: string;
  approval_status: ApprovalStatus;
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  notes?: string | null;
  /** Quantidade de pessoas na unidade no momento da pesagem (base para indicador per capita). */
  people_count?: number | null;
  /**
   * Indica se este resíduo poderia ter sido desviado do aterro.
   * Relevante apenas quando o destinatário é aterro (recipient.is_landfill = true).
   * null = não informado / não se aplica.
   */
  could_divert_from_landfill?: boolean | null;
  gps_lat?: number | null;
  gps_lng?: number | null;
  manual_location?: string | null;
  image_source?: ImageSource | null;
  captured_at?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;

  // Cancelamento lógico (rastreabilidade)
  canceled_at?: string | null;
  canceled_by?: string | null;
  cancellation_reason?: string | null;

  // Relações (joins)
  client?: Client;
  unit?: Unit;
  waste_type?: WasteType;
  treatment_type?: TreatmentType;
  recipient?: Recipient;
  creator?: Profile;
  approver?: Profile;
  canceler?: Profile;
  photos?: WeighingPhoto[];
}

export interface DashboardStats {
  totalWeighings: number;
  totalWeight: number;
  activeClients: number;
  activeUnits: number;
  diversionRate: number;
  byWasteType: { name: string; color: string; weight: number }[];
  byTreatment: { name: string; weight: number }[];
  /** Geração per capita: calculado a partir de pesagens com people_count informado. */
  perCapita: {
    avgKgPerPerson: number;
    totalPeople: number;
    weighingsWithPeople: number;
  };
  /** Resíduos potencialmente desviáveis que foram para aterro. */
  lostDiversion: {
    rate: number;
    lostWeight: number;
    divertibleWeight: number;
  };
  /**
   * Variação contra o período anterior de mesma duração.
   *
   * `null` quando não há período anterior comparável (filtro sem datas) ou
   * quando o período anterior não teve movimento — nesse caso não existe
   * variação percentual, e inventar "+100%" diria mais do que o dado permite.
   */
  trend: DashboardTrend | null;
}

/** Variação de cada indicador contra o período anterior. */
export interface DashboardTrend {
  /** Rótulo do período comparado, ex.: "vs. mês anterior". */
  label: string;
  /** Variação percentual da contagem de pesagens. */
  weighings: number | null;
  /** Variação percentual da massa registrada. */
  weight: number | null;
  /** Variação em pontos percentuais da taxa de desvio. */
  diversionPoints: number | null;
  /** Variação percentual das pesagens aguardando validação. */
  pending: number | null;
}

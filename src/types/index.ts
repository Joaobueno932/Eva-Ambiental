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
}

export interface Client {
  id: string;
  name: string;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  active: boolean;
  created_at: string;
}

export interface Unit {
  id: string;
  client_id: string;
  name: string;
  /** Campos de endereço separados (novos). */
  street?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  /** Legado: campo único de endereço. Mantido para compatibilidade. */
  address?: string | null;
  active: boolean;
  created_at: string;
  client?: Client;
}

export interface WasteType {
  id: string;
  name: string;
  color?: string | null;
  /** Indica se o resíduo tem potencial de ser desviado do aterro (para cálculo de desvio perdido). */
  is_divertible?: boolean;
  active: boolean;
  created_at: string;
}

export interface TreatmentType {
  id: string;
  name: string;
  counts_as_diversion: boolean;
  active: boolean;
  created_at: string;
}

export interface Recipient {
  id: string;
  name: string;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  /** Indica se este destinatário representa aterro/disposição final. */
  is_landfill?: boolean;
  active: boolean;
  created_at: string;
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
}

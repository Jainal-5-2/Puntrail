export type UserRole = 'visitor' | 'admin';

export type BurialStatus = 'verified' | 'pending' | 'rejected';

export type GeometrySource = 'survey' | 'official_plan' | 'imagery' | 'estimated';

export type SyncOperation = 'insert' | 'update' | 'delete';

export type SyncStatus = 'pending' | 'in_progress' | 'synced' | 'failed' | 'conflict';

export type Position = [number, number];

export interface PolygonGeometry {
  type: 'Polygon';
  coordinates: Position[][];
}

export interface MultiPolygonGeometry {
  type: 'MultiPolygon';
  coordinates: Position[][][];
}

export type PlotGeometry = PolygonGeometry | MultiPolygonGeometry;

export interface Cemetery {
  id: string;
  name: string;
  location: string;
  boundary: PolygonGeometry | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface Section {
  id: string;
  cemetery_id: string;
  name: string;
  boundary: PolygonGeometry | null;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface Plot {
  id: string;
  cemetery_id: string;
  section_id: string | null;
  plot_identifier: string;
  geometry: PlotGeometry;
  geometry_source: GeometrySource;
  geometry_verified: boolean;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface Burial {
  id: string;
  plot_id: string;
  full_name: string;
  name_normalized: string | null;
  date_of_death: string | null;
  date_of_burial: string | null;
  age_at_death: string | null;
  notes: string | null;
  status: BurialStatus;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface Profile {
  id: string;
  role: UserRole;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: string;
  actor_id: string;
  entity_type: 'cemetery' | 'section' | 'plot' | 'burial';
  entity_id: string;
  operation: SyncOperation;
  changes: Record<string, unknown>;
  client_timestamp: string;
  created_at: string;
}

export interface SyncQueueEntry {
  id: string;
  entity_type: 'cemetery' | 'section' | 'plot' | 'burial';
  entity_id: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  base_version: number;
  status: SyncStatus;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface CachedCemetery {
  id: string;
  name: string;
  location: string;
  boundary: PolygonGeometry | null;
  notes: string | null;
  version: number;
  synced_at: string;
}

export interface CachedPlot {
  id: string;
  cemetery_id: string;
  section_id: string | null;
  plot_identifier: string;
  geometry: PlotGeometry;
  geometry_source: GeometrySource;
  geometry_verified: boolean;
  version: number;
  synced_at: string;
}

export interface CachedBurial {
  id: string;
  plot_id: string;
  full_name: string;
  name_normalized: string | null;
  date_of_death: string | null;
  date_of_burial: string | null;
  age_at_death: string | null;
  status: BurialStatus;
  version: number;
  synced_at: string;
}

export interface BurialSearchResult {
  burial_id: string;
  plot_id: string;
  full_name: string;
  date_of_death: string | null;
  date_of_burial: string | null;
  plot_identifier: string;
  section_name: string | null;
  cemetery_name: string;
}

export interface SelectedPlot {
  plot_id: string;
  plot_identifier: string;
  geometry: PlotGeometry;
}

export interface OfflineMapPackInfo {
  id: string;
  cemetery_id: string;
  label: string;
  size_bytes: number;
  bbox: [number, number, number, number];
  created_at: string;
}

export interface CachedSection {
  id: string;
  cemetery_id: string;
  name: string;
  boundary: PolygonGeometry | null;
  version: number;
  synced_at: string;
}
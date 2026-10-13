export interface ActivityItem {
  id: string;
  gerencia: string;
  areaSubArea: string;
  tipoProceso: string;
  procesoMacro: string;
  actividadProceso: string;
  frecuencia: string;
  puesto: string;
  responsableFuncional: string;
  digitalizado: 'SÍ' | 'NO';
  esAutomatizable: 'SÍ' | 'NO';
  herramienta: string;
  porcentajeAutomatizado: number;
  horasMensualesActividad: number;
  horasMensualesAutomatizadas: number;
  horasManuales: number;
  satisfaccionOperativa?: number; // e.g. 98%
}

export interface ProcesoMacroSummary {
  procesoMacro: string;
  gerencia: string;
  totalTareas: number;
  horasActividadTotal: number;
  horasAutomatizadasTotal: number;
  horasManualesTotal: number;
  horasViablesActividad: number;
  horasViablesAutomatizadas: number;
  horasDescartadasNoViables: number;
  kpiAutomatizacion: number; // Formula: (horasViablesAutomatizadas / horasViablesActividad) * 100
  kpiEstatus: 'automatizado' | 'en_desarrollo'; // >= 80% = automatizado, < 80% = en desarrollo
  tareasDigitalizadas: number;
  tareasNoDigitalizadas: number;
  actividades: ActivityItem[];
}

export interface GerenciaSummary {
  gerencia: string;
  totalTareas: number;
  totalHorasActividad: number;
  totalHorasAutomatizadas: number;
  totalHorasManuales: number;
  horasViablesActividad: number;
  horasViablesAutomatizadas: number;
  horasDescartadasNoViables: number;
  kpiAutomatizacion: number;
  kpiEstatus: 'automatizado' | 'en_desarrollo';
  kpiSatisfaccion: number; // e.g., 97.5%
  satisfaccionEstatus: 'satisfactorio' | 'critico'; // >= 96% verde, < 96% rojo
  tareasDigitalizadas: number;
  tareasNoDigitalizadas: number;
  procesosMacro: ProcesoMacroSummary[];
  puestosCount: number;
  responsablesCount: number;
  actividades: ActivityItem[];
}

export interface OverallKpiMetrics {
  totalGerencias: number;
  totalTareas: number;
  totalHorasActividad: number;
  totalHorasAutomatizadas: number;
  totalHorasManuales: number;
  horasViablesActividad: number;
  horasViablesAutomatizadas: number;
  horasDescartadasNoViables: number;
  kpiAutomatizacionGlobal: number;
  kpiEstatusGlobal: 'automatizado' | 'en_desarrollo';
  kpiSatisfaccionGlobal: number;
  satisfaccionEstatusGlobal: 'satisfactorio' | 'critico';
  totalDigitalizadas: number;
  totalNoDigitalizadas: number;
  porcentajeDigitalizacionTotal: number;
}

export interface GoogleDriveAuthState {
  isConnected: boolean;
  userEmail: string | null;
  userName: string | null;
  userAvatar: string | null;
  accessToken: string | null;
  lastSyncTime: string | null;
  isSyncing: boolean;
  syncError: string | null;
  spreadsheetId: string;
  sheetCount: number;
}

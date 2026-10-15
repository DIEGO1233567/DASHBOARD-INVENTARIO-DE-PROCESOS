export interface ProcessRecord {
  id: string;
  gerencia: string;
  areaSubArea: string;
  tipoProceso: string;
  procesoMacro: string;
  actividadProceso: string;
  frecuencia: string;
  puesto: string;
  responsableFuncional: string;
  digitalizado: 'Sí' | 'No' | string;
  esAutomatizable: 'Sí' | 'No' | string;
  herramienta: string;
  porcentajeAutomatizado: number;
  horasMensualesTotal: number;
  horasMensualesActividad?: number;
  horasMensualesAutomatizadas: number;
  horasManualesTotal: number;
  horasManuales?: number;
  satisfaccionOperativa?: number;
}

export interface SheetSyncConfig {
  spreadsheetUrl: string;
  spreadsheetId: string;
  sheetNames: string[];
  lastSyncedAt: string | null;
  sourceType: 'demo' | 'google-sheets-url' | 'xlsx-upload' | 'clipboard' | 'drive_oauth';
  fileName?: string;
}

export interface MacroProcessStat {
  nombre: string;
  totalActividades: number; // Conteo de actividades ÚNICAS
  totalFilas?: number;
  horasTotales: number;
  horasManuales: number;
  horasAutomatizadas: number;
  pctAutomatizado: number;
  colaboradoresCount: number;
  actividades: ProcessRecord[];
}

export interface GerenciaSummaryItem {
  gerencia: string;
  totalProcesosMacro: number; // Conteo de procesos macro ÚNICOS
  totalActividades: number; // Conteo de actividades / procesos ÚNICOS
  totalFilas?: number;
  totalColaboradores: number;
  horasTotales: number;
  horasManuales: number;
  horasAutomatizadas: number;
  horasPotencialAutomatizable: number;
  tareasManuales: number;
  tareasAutomatizadas: number;
  pctAutomatizado: number;
  pctPotencialMeta: number;
  fteActual: number;
  fteLiberables: number;
  macroProcessesList: MacroProcessStat[];
}

export interface ColaboradorSummaryItem {
  colaborador: string;
  gerencia: string;
  puesto: string;
  totalActividades: number;
  horasTotales: number;
  horasManuales: number;
  horasAutomatizadas: number;
  tareasManuales: number;
  tareasAutomatizadas: number;
  pctAutomatizado: number;
  porcentajeJornada: number;
  horasPotencialAutomatizable: number;
  actividades: ProcessRecord[];
}

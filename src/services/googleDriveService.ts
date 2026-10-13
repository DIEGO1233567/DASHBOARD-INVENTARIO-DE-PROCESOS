import * as XLSX from 'xlsx';
import { ActivityItem } from '../types/dashboard';
import { normalizeNumber, normalizePercent } from '../utils/kpiCalculator';

export const GOOGLE_CLIENT_ID = '1761125251-hfov1jf6jnd61gnoftm9hkd3ajue1ti2.apps.googleusercontent.com';
export const GOOGLE_PROJECT_ID = '1761125251';
export const DEFAULT_SPREADSHEET_ID = '1_8MYUUiNlDN6YFvVtSOH34qBBKoSAvev60CbNKVryoI';
export const SHEETS_API_ENABLE_URL = `https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=${GOOGLE_PROJECT_ID}`;
export const DRIVE_API_ENABLE_URL = `https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=${GOOGLE_PROJECT_ID}`;

export const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
].join(' ');

export interface SheetMetadata {
  sheetId: number;
  title: string;
  hidden?: boolean;
  rowCount?: number;
}

export interface SyncResult {
  activities: ActivityItem[];
  sheetNames: string[];
  totalRows: number;
  source: 'drive_xlsx' | 'sheets_api' | 'file_import';
}

export class GoogleApiDisabledError extends Error {
  public apiName: string;
  public enableUrl: string;
  public projectId: string;

  constructor(apiName: string, enableUrl: string, projectId: string) {
    super(
      `La ${apiName} no está habilitada en tu proyecto de Google Cloud (${projectId}). Haz clic en el botón para habilitarla en un solo paso.`
    );
    this.name = 'GoogleApiDisabledError';
    this.apiName = apiName;
    this.enableUrl = enableUrl;
    this.projectId = projectId;
  }
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: any; error_description?: string }) => void;
            error_callback?: (error: any) => void;
          }) => {
            requestAccessToken: (options?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

/**
 * Initiates Google OAuth2 Popup using Google Identity Services (GIS).
 */
export function requestGoogleAccessToken(
  onSuccess: (token: string) => void,
  onError: (error: string) => void
): void {
  if (!window.google?.accounts?.oauth2) {
    onError(
      'La biblioteca de Google Identity Services aún no se ha cargado en el navegador. Por favor espera unos segundos o verifica tu conexión.'
    );
    return;
  }

  try {
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: OAUTH_SCOPES,
      callback: (response) => {
        if (response.error) {
          onError(`Error al autorizar con Google: ${response.error_description || response.error}`);
          return;
        }
        if (response.access_token) {
          onSuccess(response.access_token);
        } else {
          onError('No se recibió el token de acceso de Google.');
        }
      },
      error_callback: (err) => {
        onError(`Fallo en el inicio de sesión de Google: ${err?.message || JSON.stringify(err)}`);
      },
    });

    tokenClient.requestAccessToken({ prompt: 'consent' });
  } catch (err: any) {
    onError(err?.message || 'Error inesperado al iniciar autenticación con Google.');
  }
}

/**
 * Extracts spreadsheet ID from full URL or returns raw ID.
 */
export function extractSpreadsheetId(input: string): string {
  if (!input) return DEFAULT_SPREADSHEET_ID;
  const match = input.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return input.trim();
}

/**
 * Check if a sheet should be ignored.
 * Explicit rule:
 * - DO NOT consider hidden sheets
 * - DO NOT consider the sheet named KPIS (or KPI summary)
 * - DO NOT ignore operational areas like "KPI y Reportes"
 */
export function shouldIgnoreSheet(title: string): boolean {
  if (!title) return true;
  const t = title.trim().toUpperCase();
  if (
    t === 'KPIS' ||
    t === 'KPI' ||
    t === 'RESUMEN' ||
    t === 'RESUMEN KPIS' ||
    t.startsWith('KPIS ') ||
    t.startsWith('KPIS-') ||
    t.startsWith('KPIS_')
  ) {
    return true;
  }
  return (
    t.includes('INSTRUCCION') ||
    t.includes('CATALOGO') ||
    t === 'CONFIG' ||
    t === 'PARAMETROS' ||
    t.includes('METADATA')
  );
}

const cleanString = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

function findColIndex(headers: string[], exactKeywords: string[], includeKeywords: string[]): number {
  for (const kw of exactKeywords) {
    const target = cleanString(kw);
    const idx = headers.findIndex((h) => cleanString(h) === target);
    if (idx !== -1) return idx;
  }
  for (const kw of includeKeywords) {
    const target = cleanString(kw);
    const idx = headers.findIndex((h) => cleanString(h).includes(target));
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * Normalizes Area/Gerencia name for consistent grouping (e.g. CxC -> CXC).
 */
export function normalizeGerenciaName(name: string): string {
  if (!name) return 'General';
  const clean = name.trim();
  if (clean.toUpperCase() === 'CXC') return 'CXC';
  return clean;
}

/**
 * Parses raw 2D array of rows into ActivityItem objects with robust, precise header detection.
 */
export function parseRowsToActivities(rows: any[][], defaultGerencia: string): ActivityItem[] {
  if (!rows || rows.length < 2) return [];

  // Scan first 20 rows to dynamically detect the true header row
  let headerRowIndex = 0;
  let maxScore = 0;

  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const row = rows[r];
    if (!row || !Array.isArray(row)) continue;
    const rowJoined = row.map((c) => cleanString(String(c || ''))).join(' | ');

    let score = 0;
    if (rowJoined.includes('AREA') || rowJoined.includes('SUB AREA')) score += 3;
    if (rowJoined.includes('PROCESO MACRO') || rowJoined.includes('MACRO')) score += 3;
    if (rowJoined.includes('ACTIVIDAD')) score += 4;
    if (rowJoined.includes('HORAS')) score += 4;
    if (rowJoined.includes('PUESTO') || rowJoined.includes('ROL')) score += 2;
    if (rowJoined.includes('RESPONSABLE') || rowJoined.includes('REPONSABLE')) score += 2;
    if (rowJoined.includes('DIGITALIZADO')) score += 2;
    if (rowJoined.includes('AUTOMATIZABLE')) score += 2;
    if (rowJoined.includes('HERRAMIENTA')) score += 1;
    if (rowJoined.includes('FRECUENCIA')) score += 1;

    if (score > maxScore) {
      maxScore = score;
      headerRowIndex = r;
    }
  }

  const headerRow = rows[headerRowIndex] || [];
  const headers = headerRow.map((h: any) => String(h || '').trim());

  // Precision-mapped column finding
  const idxArea = findColIndex(
    headers,
    ['AREA / SUB AREA', 'AREA/SUB AREA', 'AREA', 'SUB AREA', 'SUBAREA'],
    ['SUB AREA', 'AREA /']
  );
  const idxTipo = findColIndex(
    headers,
    ['TIPO DE PROCESO', 'TIPO PROCESO', 'TIPO'],
    ['TIPO DE PROCESO', 'TIPO PROCESO']
  );
  const idxMacro = findColIndex(
    headers,
    ['PROCESO MACRO', 'MACROPROCESO', 'MACRO'],
    ['PROCESO MACRO', 'MACRO']
  );
  const idxAct = findColIndex(
    headers,
    ['ACTIVIDAD / PROCESO', 'ACTIVIDAD/PROCESO', 'ACTIVIDAD', 'SUBPROCESO', 'TAREA'],
    ['ACTIVIDAD', 'SUBPROCESO', 'TAREA']
  );
  const idxFrec = findColIndex(
    headers,
    ['FRECUENCIA', 'PERIODICIDAD'],
    ['FRECUENCIA', 'PERIODICIDAD']
  );
  const idxPuesto = findColIndex(
    headers,
    ['PUESTO', 'ROL', 'CARGO', 'POSICIÓN'],
    ['PUESTO', 'ROL', 'CARGO']
  );
  const idxResp = findColIndex(
    headers,
    ['REPONSABLE FUNCIONAL', 'RESPONSABLE FUNCIONAL', 'REPONSABLE', 'RESPONSABLE', 'ENCARGADO'],
    ['REPONSABLE', 'RESPONSABLE']
  );
  const idxDigit = findColIndex(
    headers,
    ['¿DIGITALIZADO?', 'DIGITALIZADO', 'DIGITAL', 'ESTA DIGITALIZADO'],
    ['DIGITALIZAD']
  );
  const idxAuto = findColIndex(
    headers,
    ['¿ES AUTOMATIZABLE?', 'ES AUTOMATIZABLE', 'AUTOMATIZABLE', 'VIABLE AUTOMATIZAR'],
    ['AUTOMATIZABLE']
  );
  const idxTool = findColIndex(
    headers,
    ['HERRAMIENTA', 'SISTEMA', 'SOFTWARE', 'APLICATIVO', 'BOT'],
    ['HERRAMIENTA', 'SISTEMA', 'SOFTWARE']
  );
  const idxPctAuto = findColIndex(
    headers,
    ['% AUTOMATIZADO', '% AUTOMATIZACION', 'PORCENTAJE AUTOMATIZADO', '% AUTO', '% DE AVANCE'],
    ['% AUTO', 'PORCENTAJE AUTO', '% AUTOMATIZAD']
  );
  const idxHrsAct = findColIndex(
    headers,
    ['HORAS MENSUALES ACTIVIDAD (TOTAL)', 'HORAS MENSUALES ACTIVIDAD', 'HORAS ACTIVIDAD', 'HORAS TOTALES', 'HORAS MENSUALES TOTAL'],
    ['HORAS MENSUALES ACTIVIDAD', 'HORAS ACTIVIDAD', 'HORAS TOTALES']
  );
  const idxHrsAuto = findColIndex(
    headers,
    ['HORAS MENSUALES AUTOMATIZADAS (TOTAL)', 'HORAS MENSUALES AUTOMATIZADAS', 'HORAS AUTOMATIZADAS', 'HORAS AUTO'],
    ['HORAS MENSUALES AUTOMATIZADAS', 'HORAS AUTOMATIZADAS', 'HORAS AUTO']
  );
  const idxHrsMan = findColIndex(
    headers,
    ['HORAS MANUALES (TOTAL)', 'HORAS MANUALES', 'HORAS MANUAL', 'HORAS RESIDUALES'],
    ['HORAS MANUAL']
  );
  const idxGerencia = findColIndex(
    headers,
    ['GERENCIA', 'DIRECCION', 'DIRECCIÓN', 'UNIDAD'],
    ['GERENCIA', 'DIRECCION']
  );

  const activities: ActivityItem[] = [];

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || !row.some((c) => c !== undefined && String(c).trim() !== '')) {
      continue;
    }

    const getVal = (idx: number, fallback = '') => {
      if (idx >= 0 && row[idx] !== undefined && row[idx] !== null) {
        const val = String(row[idx]).trim();
        return val.length > 0 ? val : fallback;
      }
      return fallback;
    };

    const rowArea = normalizeGerenciaName(getVal(idxArea));
    const isGenericDefault = !defaultGerencia || defaultGerencia === 'General' || defaultGerencia.includes('.csv') || defaultGerencia.includes('.xlsx');
    const rowGerencia = normalizeGerenciaName(
      getVal(idxGerencia) || (!isGenericDefault ? defaultGerencia : rowArea) || rowArea || 'General'
    );

    const actName = getVal(idxAct) || getVal(idxMacro) || `Actividad ${i}`;
    const macroName = getVal(idxMacro) || getVal(idxArea) || 'General';
    const areaName = rowArea || rowGerencia;

    // Check digitalization: SI, SÍ, YES, 1, TRUE
    const digitRaw = cleanString(getVal(idxDigit, 'NO'));
    const isDigit = digitRaw === 'SI' || digitRaw.startsWith('S') || digitRaw === '1' || digitRaw === 'TRUE';
    const digitVal: 'SÍ' | 'NO' = isDigit ? 'SÍ' : 'NO';

    // Check automation feasibility: SI, SÍ, YES, 1, TRUE
    const autoRaw = cleanString(getVal(idxAuto, 'NO'));
    const isAuto = autoRaw === 'SI' || autoRaw.startsWith('S') || autoRaw === '1' || autoRaw === 'TRUE';
    const autoVal: 'SÍ' | 'NO' = isAuto ? 'SÍ' : 'NO';

    const rawHrsAct = getVal(idxHrsAct, '0');
    const rawHrsAuto = getVal(idxHrsAuto, '0');
    const rawHrsMan = getVal(idxHrsMan, '0');
    const rawPctAuto = getVal(idxPctAuto, '0');

    const hrsAct = normalizeNumber(rawHrsAct);
    const pctAuto = normalizePercent(rawPctAuto);
    let hrsAuto = normalizeNumber(rawHrsAuto);
    let hrsMan = normalizeNumber(rawHrsMan);

    // If hours automated is 0 but percentage > 0 and activity hours > 0
    if (hrsAuto === 0 && pctAuto > 0 && hrsAct > 0) {
      hrsAuto = Math.round((hrsAct * (pctAuto / 100)) * 10) / 10;
    }

    // If hours manual is not provided or 0, calculate as act - auto
    if (hrsMan === 0 && hrsAct > 0) {
      hrsMan = Math.max(0, Math.round((hrsAct - hrsAuto) * 10) / 10);
    }

    // If activity hours is 0 but auto and man are provided, sum them
    let finalHrsAct = hrsAct;
    if (finalHrsAct === 0 && (hrsAuto > 0 || hrsMan > 0)) {
      finalHrsAct = Math.round((hrsAuto + hrsMan) * 10) / 10;
    }

    activities.push({
      id: `${rowGerencia}-${i}`,
      gerencia: rowGerencia,
      areaSubArea: areaName,
      tipoProceso: getVal(idxTipo, 'OPERATIVO'),
      procesoMacro: macroName,
      actividadProceso: actName,
      frecuencia: getVal(idxFrec, 'MENSUAL'),
      puesto: getVal(idxPuesto, 'Especialista'),
      responsableFuncional: getVal(idxResp, 'Equipo Funcional'),
      digitalizado: digitVal,
      esAutomatizable: autoVal,
      herramienta: getVal(idxTool, 'N/A'),
      porcentajeAutomatizado: pctAuto,
      horasMensualesActividad: finalHrsAct,
      horasMensualesAutomatizadas: hrsAuto,
      horasManuales: hrsMan,
      satisfaccionOperativa: 97.5,
    });
  }

  return activities;
}

/**
 * Parses raw CSV/TSV text string into 2D array of rows using SheetJS RFC-4180 parser.
 * Handles multiline quoted cells, tabs, semicolons, and commas cleanly.
 */
export function parseCsvText(csvText: string): string[][] {
  if (!csvText) return [];
  try {
    const workbook = XLSX.read(csvText, { type: 'string' });
    const firstSheetName = workbook.SheetNames[0];
    if (firstSheetName && workbook.Sheets[firstSheetName]) {
      return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { header: 1, defval: '' }) as string[][];
    }
  } catch (e) {
    console.warn('XLSX csv parse fallback:', e);
  }

  // Basic manual fallback
  const lines = csvText.split(/\r?\n/);
  return lines.filter((l) => l.trim()).map((l) => l.split(',').map((c) => c.trim().replace(/^"|"$/g, '')));
}

/**
 * Exports and parses Google Spreadsheet via Google Drive API XLSX endpoint.
 * This exports the ENTIRE workbook including ALL sheets (gerencias) in a single call,
 * ignores hidden sheets, and ignores the KPIS summary sheet.
 */
export async function tryDriveApiExportXlsx(accessToken: string, fileId: string): Promise<SyncResult | null> {
  try {
    const exportRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!exportRes.ok) {
      console.warn('Drive API XLSX export returned status:', exportRes.status);
      return null;
    }

    const arrayBuffer = await exportRes.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetMetaList = workbook.Workbook?.Sheets || [];

    const allActivities: ActivityItem[] = [];
    const sheetNames: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      // Rule 1: Ignore hidden sheets
      const meta = sheetMetaList.find((s: any) => s.name === sheetName);
      if (meta && (meta.Hidden === 1 || meta.Hidden === 2)) {
        console.log(`[Drive XLSX] Ignorando hoja oculta: "${sheetName}"`);
        continue;
      }

      // Rule 2: Ignore sheet named KPIS
      if (shouldIgnoreSheet(sheetName)) {
        console.log(`[Drive XLSX] Ignorando hoja de resumen/KPIS: "${sheetName}"`);
        continue;
      }

      const cleanName = normalizeGerenciaName(sheetName);
      sheetNames.push(cleanName);
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) continue;

      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
      const sheetActs = parseRowsToActivities(rows, cleanName);
      allActivities.push(...sheetActs);
    }

    if (allActivities.length > 0) {
      return {
        activities: allActivities,
        sheetNames,
        totalRows: allActivities.length,
        source: 'drive_xlsx',
      };
    }
  } catch (e) {
    console.warn('Error during Drive API XLSX export parsing:', e);
  }
  return null;
}

/**
 * Parses an ArrayBuffer of an uploaded Excel file (.xlsx / .xls).
 * Ignores hidden sheets and KPIS sheet.
 */
export function parseExcelBuffer(buffer: ArrayBuffer): { activities: ActivityItem[]; sheetNames: string[] } {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetMetaList = workbook.Workbook?.Sheets || [];
  const allActivities: ActivityItem[] = [];
  const sheetNames: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    // Ignore hidden sheets
    const meta = sheetMetaList.find((s: any) => s.name === sheetName);
    if (meta && (meta.Hidden === 1 || meta.Hidden === 2)) {
      continue;
    }

    // Ignore sheet named KPIS
    if (shouldIgnoreSheet(sheetName)) continue;

    const cleanName = normalizeGerenciaName(sheetName);
    sheetNames.push(cleanName);
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
    const sheetActs = parseRowsToActivities(rows, cleanName);
    allActivities.push(...sheetActs);
  }

  return { activities: allActivities, sheetNames };
}

/**
 * Fetches all sheets and rows from Google Drive / Sheets API.
 * 1. Tries Google Drive API XLSX export (Multi-sheet, ignores hidden sheets and KPIS).
 * 2. Falls back to Google Sheets API v4 with hidden sheet filtering.
 */
export async function fetchSpreadsheetData(
  accessToken: string,
  spreadsheetId: string = DEFAULT_SPREADSHEET_ID
): Promise<SyncResult> {
  const cleanId = extractSpreadsheetId(spreadsheetId);

  // Strategy 1: Google Drive API full XLSX export (Multi-sheet, bypasses Sheets API)
  const driveResult = await tryDriveApiExportXlsx(accessToken, cleanId);
  if (driveResult && driveResult.activities.length > 0) {
    return driveResult;
  }

  // Strategy 2: Google Sheets API v4
  let metaRes: Response;
  try {
    metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}?fields=sheets.properties`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
  } catch (networkError: any) {
    throw new Error(`Error de red al consultar Google Sheets API: ${networkError?.message}`);
  }

  if (!metaRes.ok) {
    const errorBody = await metaRes.text();
    if (metaRes.status === 403 && (errorBody.includes('SERVICE_DISABLED') || errorBody.includes('sheets.googleapis.com'))) {
      throw new GoogleApiDisabledError('Google Sheets API', SHEETS_API_ENABLE_URL, GOOGLE_PROJECT_ID);
    }
    throw new Error(`Error al consultar metadata de Google Sheets (${metaRes.status}): ${errorBody}`);
  }

  const metaData = await metaRes.json();
  const rawSheets: SheetMetadata[] = (metaData.sheets || []).map((s: any) => ({
    sheetId: s.properties?.sheetId,
    title: s.properties?.title || 'Sin Nombre',
    hidden: Boolean(s.properties?.hidden),
  }));

  // Exclude hidden sheets AND sheets matching shouldIgnoreSheet (e.g. KPIS)
  const validSheets = rawSheets.filter((s) => !s.hidden && !shouldIgnoreSheet(s.title));
  const sheets = validSheets.length > 0 ? validSheets : rawSheets.filter((s) => !s.hidden);
  const sheetNames = sheets.map((s) => normalizeGerenciaName(s.title));
  const allActivities: ActivityItem[] = [];

  // Fetch each visible non-KPI sheet in parallel using properly quoted range notation
  await Promise.all(
    sheets.map(async (sheet) => {
      try {
        const safeSheetName = `'${sheet.title.replace(/'/g, "''")}'`;
        const encodedRange = encodeURIComponent(safeSheetName);
        const valRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodedRange}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!valRes.ok) {
          console.warn(`No se pudieron cargar datos para la hoja: ${sheet.title}`, valRes.status);
          return;
        }

        const valData = await valRes.json();
        const rows: any[][] = valData.values || [];
        const cleanName = normalizeGerenciaName(sheet.title);
        const sheetActivities = parseRowsToActivities(rows, cleanName);
        allActivities.push(...sheetActivities);
      } catch (err) {
        console.error(`Error parsing sheet ${sheet.title}:`, err);
      }
    })
  );

  if (allActivities.length === 0) {
    throw new Error('No se encontraron actividades válidas en las hojas procesadas del archivo.');
  }

  return {
    activities: allActivities,
    sheetNames,
    totalRows: allActivities.length,
    source: 'sheets_api',
  };
}

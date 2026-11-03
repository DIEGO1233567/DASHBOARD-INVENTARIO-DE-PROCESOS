import ExcelJS from 'exceljs';
import {
  UniqueActivityItem,
  ActivityStatusMetrics,
  CrossGerenciaActivityGroup,
} from './activityStatusParser';
import { formatHours, formatThousands } from './sheetsParser';

/**
 * Generates and downloads the specialized Excel workbook for Hoja 2:
 * "Estatus y Auditoría de Actividades Únicas"
 */
export async function exportUniqueActivitiesStatusXlsx(
  items: UniqueActivityItem[],
  metrics: ActivityStatusMetrics,
  crossGerenciaGroups: CrossGerenciaActivityGroup[],
  selectedGerencia: string = 'ALL',
  fileName: string = 'Auditoria_Estatus_Actividades_Unicas.xlsx'
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Liverpool - Eficiencia de Procesos';
  workbook.lastModifiedBy = 'Liverpool - Eficiencia de Procesos';
  workbook.created = new Date();
  workbook.modified = new Date();

  const scopeLabel =
    selectedGerencia === 'ALL'
      ? 'Consolidado Global (Todas las Gerencias)'
      : `Gerencia: ${selectedGerencia}`;
  const now = new Date();
  const dateFormatted = `${now.toLocaleDateString('es-MX')} ${now.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;

  // --------------------------------------------------------------------------
  // HOJA 1: RESUMEN Y MÉTRICAS GLOBALES
  // --------------------------------------------------------------------------
  const ws1 = workbook.addWorksheet('Resumen de Estatus', {
    views: [{ showGridLines: true }],
  });

  ws1.columns = [
    { width: 4 },  // A
    { width: 38 }, // B
    { width: 22 }, // C
    { width: 24 }, // D
    { width: 35 }, // E
  ];

  // Title Banner
  ws1.mergeCells('B2:E2');
  const title1 = ws1.getCell('B2');
  title1.value = 'AUDITORÍA DE ESTATUS DE ACTIVIDADES ÚNICAS - HOJA 2';
  title1.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  title1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  title1.alignment = { vertical: 'middle', horizontal: 'center' };
  ws1.getRow(2).height = 30;

  // Subtitle
  ws1.mergeCells('B3:E3');
  const sub1 = ws1.getCell('B3');
  sub1.value = `Alcance: ${scopeLabel}  |  Fecha: ${dateFormatted}`;
  sub1.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } };
  sub1.alignment = { vertical: 'middle', horizontal: 'center' };
  ws1.getRow(3).height = 20;

  // Header
  ws1.getRow(5).height = 24;
  ['Métrica / Categoría', 'Cantidad de Actividades', 'Horas Involucradas (h)', 'Observaciones'].forEach(
    (h, idx) => {
      const cell = ws1.getRow(5).getCell(idx + 2);
      cell.value = h;
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
      cell.alignment = { vertical: 'middle', horizontal: idx === 0 ? 'left' : idx <= 2 ? 'right' : 'left' };
    }
  );

  const metricRows = [
    {
      label: 'Total Actividades Únicas Analizadas',
      count: metrics.totalUniqueActivities,
      hours: metrics.horasTotales,
      obs: 'Universo total de actividades únicas en el alcance seleccionado',
    },
    {
      label: 'Actividades con Discordancia de Estatus',
      count: metrics.totalDiscordantes,
      hours: metrics.horasDiscordantes,
      obs: 'Actividades capturadas con diferentes criterios de automatización/digitalización',
    },
    {
      label: 'No Digitalizada · Sí Automatizable (Prioridad 1)',
      count: metrics.totalDigNoAutoSi,
      hours: items
        .filter((i) => i.category === 'DIG_NO_AUTO_SI')
        .reduce((acc, i) => acc + i.horasTotales, 0),
      obs: 'Mayor oportunidad de automatización directa para Eficiencia de Procesos',
    },
    {
      label: 'Digitalizada · No Automatizable',
      count: metrics.totalDigSiAutoNo,
      hours: items
        .filter((i) => i.category === 'DIG_SI_AUTO_NO')
        .reduce((acc, i) => acc + i.horasTotales, 0),
      obs: 'Procesos soportados por sistemas o plataformas vigentes',
    },
    {
      label: 'No Digitalizada · No Automatizable',
      count: metrics.totalDigNoAutoNo,
      hours: items
        .filter((i) => i.category === 'DIG_NO_AUTO_NO')
        .reduce((acc, i) => acc + i.horasTotales, 0),
      obs: 'Actividades manuales complejas o fuera de automatización actual',
    },
    {
      label: 'Digitalizada · Sí Automatizable',
      count: metrics.totalDigSiAutoSi,
      hours: items
        .filter((i) => i.category === 'DIG_SI_AUTO_SI')
        .reduce((acc, i) => acc + i.horasTotales, 0),
      obs: 'Sistemas que aún requieren integración, bots o scripts',
    },
    {
      label: 'Grupos con Presencia en Múltiples Gerencias',
      count: crossGerenciaGroups.length,
      hours: crossGerenciaGroups.reduce(
        (acc, g) =>
          acc +
          g.gerenciasList.reduce(
            (gAcc, gl) => gAcc + gl.variants.reduce((va, v) => va + v.horasTotales, 0),
            0
          ),
        0
      ),
      obs: 'Actividades homologables entre distintas gerencias',
    },
  ];

  let rIdx1 = 6;
  metricRows.forEach((row, idx) => {
    const r = ws1.getRow(rIdx1);
    r.height = 22;

    const cLabel = r.getCell(2);
    cLabel.value = row.label;
    cLabel.font = { name: 'Arial', size: 9, bold: idx <= 1 };

    const cCount = r.getCell(3);
    cCount.value = row.count;
    cCount.numFmt = '#,##0';
    cCount.font = { name: 'Arial', size: 9, bold: true };
    cCount.alignment = { horizontal: 'right' };

    const cHours = r.getCell(4);
    cHours.value = Number(row.hours.toFixed(1));
    cHours.numFmt = '#,##0.0';
    cHours.font = { name: 'Arial', size: 9, bold: idx <= 1 };
    cHours.alignment = { horizontal: 'right' };

    const cObs = r.getCell(5);
    cObs.value = row.obs;
    cObs.font = { name: 'Arial', size: 8, color: { argb: 'FF475569' } };

    // Zebra
    const bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
    for (let c = 2; c <= 5; c++) {
      r.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      r.getCell(c).border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    }

    rIdx1++;
  });

  // --------------------------------------------------------------------------
  // HOJA 2: CATÁLOGO DE ACTIVIDADES ÚNICAS Y ESTATUS
  // --------------------------------------------------------------------------
  const ws2 = workbook.addWorksheet('Catálogo Actividades Únicas', {
    views: [{ showGridLines: true }],
  });

  ws2.columns = [
    { width: 28 }, // A: Gerencia
    { width: 44 }, // B: Actividad / Proceso
    { width: 30 }, // C: Categoría de Estatus
    { width: 16 }, // D: ¿Discordante?
    { width: 14 }, // E: Variantes
    { width: 16 }, // F: Horas Manuales
    { width: 16 }, // G: Horas Auto
    { width: 16 }, // H: Horas Totales
    { width: 14 }, // I: % Automatizado
    { width: 14 }, // J: Registros
    { width: 14 }, // K: Colabs
    { width: 35 }, // L: Procesos Macro
    { width: 35 }, // M: Colaboradores
  ];

  // Title Banner
  ws2.mergeCells('A1:M1');
  const title2 = ws2.getCell('A1');
  title2.value = 'DETALLE COMPLETO DE ACTIVIDADES ÚNICAS Y ESTATUS ASIGNADO';
  title2.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  title2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  title2.alignment = { vertical: 'middle', horizontal: 'center' };
  ws2.getRow(1).height = 28;

  const hCols = [
    'Gerencia',
    'Actividad / Proceso',
    'Estatus Determinado',
    '¿Discordancia?',
    'Variantes',
    'Horas Manuales',
    'Horas Auto.',
    'Horas Totales',
    '% Automatizado',
    'Total Registros',
    'Colaboradores',
    'Procesos Macro',
    'Nombres de Colaboradores',
  ];

  const rHead2 = ws2.getRow(2);
  rHead2.height = 24;
  hCols.forEach((col, idx) => {
    const cell = rHead2.getCell(idx + 1);
    cell.value = col;
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.alignment = { vertical: 'middle', horizontal: idx <= 2 ? 'left' : idx <= 10 ? 'center' : 'left' };
  });

  let rIdx2 = 3;
  items.forEach((item, idx) => {
    const r = ws2.getRow(rIdx2);
    r.height = 20;

    r.getCell(1).value = item.gerencia;
    r.getCell(2).value = item.actividadProceso;
    r.getCell(3).value = item.primaryStatusLabel;

    const discCell = r.getCell(4);
    discCell.value = item.hasDiscrepancy ? 'SÍ (Discordante)' : 'NO';
    discCell.font = {
      name: 'Arial',
      size: 9,
      bold: item.hasDiscrepancy,
      color: { argb: item.hasDiscrepancy ? 'FFDC2626' : 'FF059669' },
    };
    discCell.alignment = { horizontal: 'center' };

    r.getCell(5).value = item.variants.length;
    r.getCell(5).numFmt = '#,##0';
    r.getCell(5).alignment = { horizontal: 'center' };

    r.getCell(6).value = Number(item.horasManuales.toFixed(1));
    r.getCell(6).numFmt = '#,##0.0';
    r.getCell(6).alignment = { horizontal: 'right' };

    r.getCell(7).value = Number(item.horasAutomatizadas.toFixed(1));
    r.getCell(7).numFmt = '#,##0.0';
    r.getCell(7).alignment = { horizontal: 'right' };

    r.getCell(8).value = Number(item.horasTotales.toFixed(1));
    r.getCell(8).numFmt = '#,##0.0';
    r.getCell(8).alignment = { horizontal: 'right' };

    r.getCell(9).value = Number((item.pctAutomatizado / 100).toFixed(3));
    r.getCell(9).numFmt = '0.0%';
    r.getCell(9).alignment = { horizontal: 'right' };

    r.getCell(10).value = item.totalRecords;
    r.getCell(10).numFmt = '#,##0';
    r.getCell(10).alignment = { horizontal: 'center' };

    r.getCell(11).value = item.totalColaboradores;
    r.getCell(11).numFmt = '#,##0';
    r.getCell(11).alignment = { horizontal: 'center' };

    r.getCell(12).value = item.procesosMacro.join(', ');
    r.getCell(13).value = item.colaboradores.join(', ');

    const rowBg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
    for (let c = 1; c <= 13; c++) {
      if (c !== 4) {
        r.getCell(c).font = { name: 'Arial', size: 9 };
      }
      r.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      r.getCell(c).border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    }

    rIdx2++;
  });

  // --------------------------------------------------------------------------
  // HOJA 3: CRUCE MULTI-GERENCIA
  // --------------------------------------------------------------------------
  const ws3 = workbook.addWorksheet('Cruce Multi-Gerencia', {
    views: [{ showGridLines: true }],
  });

  ws3.columns = [
    { width: 44 }, // A: Actividad
    { width: 14 }, // B: Num Gerencias
    { width: 40 }, // C: Gerencias Involucradas
    { width: 16 }, // D: Horas Totales
    { width: 18 }, // E: ¿Difiere Estatus?
    { width: 45 }, // F: Estatus Registrados
  ];

  ws3.mergeCells('A1:F1');
  const title3 = ws3.getCell('A1');
  title3.value = 'ACTIVIDADES HOMÓLOGAS ENCONTRADAS EN MÚLTIPLES GERENCIAS';
  title3.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  title3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  title3.alignment = { vertical: 'middle', horizontal: 'center' };
  ws3.getRow(1).height = 28;

  const hCols3 = [
    'Actividad Normalizada',
    'N° Gerencias',
    'Gerencias',
    'Horas Totales (h)',
    '¿Diferente Estatus?',
    'Estatus Observados por Gerencia',
  ];
  const rHead3 = ws3.getRow(2);
  rHead3.height = 24;
  hCols3.forEach((c, idx) => {
    const cell = rHead3.getCell(idx + 1);
    cell.value = c;
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.alignment = { vertical: 'middle', horizontal: idx === 0 ? 'left' : idx <= 4 ? 'center' : 'left' };
  });

  let rIdx3 = 3;
  crossGerenciaGroups.forEach((g, idx) => {
    const r = ws3.getRow(rIdx3);
    r.height = 22;

    const groupHours = g.gerenciasList.reduce(
      (gAcc, gl) => gAcc + gl.variants.reduce((va, v) => va + v.horasTotales, 0),
      0
    );
    const gerenciaNames = g.gerenciasList.map((gl) => gl.gerencia).join('; ');
    const statusesDesc = g.gerenciasList
      .map((gl) => `${gl.gerencia}: ${gl.primaryStatus}`)
      .join(' | ');

    r.getCell(1).value = g.actividadNombre;
    r.getCell(2).value = g.totalGerencias;
    r.getCell(2).numFmt = '#,##0';
    r.getCell(2).alignment = { horizontal: 'center' };

    r.getCell(3).value = gerenciaNames;
    r.getCell(4).value = Number(groupHours.toFixed(1));
    r.getCell(4).numFmt = '#,##0.0';
    r.getCell(4).alignment = { horizontal: 'right' };

    const diffCell = r.getCell(5);
    diffCell.value = g.hasCrossDiscrepancy ? 'SÍ (Discrepante)' : 'NO (Consistente)';
    diffCell.font = {
      name: 'Arial',
      size: 9,
      bold: g.hasCrossDiscrepancy,
      color: { argb: g.hasCrossDiscrepancy ? 'FFDC2626' : 'FF059669' },
    };
    diffCell.alignment = { horizontal: 'center' };

    r.getCell(6).value = statusesDesc;

    const rowBg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
    for (let c = 1; c <= 6; c++) {
      if (c !== 5) {
        r.getCell(c).font = { name: 'Arial', size: 9 };
      }
      r.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      r.getCell(c).border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    }

    rIdx3++;
  });

  // Write and trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
}

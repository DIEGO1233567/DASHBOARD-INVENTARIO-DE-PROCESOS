import ExcelJS from 'exceljs';
import { GerenciaSummaryItem, ProcessRecord } from '../types/sheets';
import { formatHours, formatThousands } from './sheetsParser';

export interface TopKpiData {
  gerenciasCount: number;
  macroByGerenciaCount: number;
  actividadesCount: number;
  totalFilasCount: number;
  colaboradoresCount: number;
  horasTotales: number;
  horasManuales: number;
  horasAutomatizadas: number;
  pctAutomatizadoGlobal: number;
}

/**
 * Captures an SVG element from the DOM and converts it to a PNG base64 string.
 */
async function captureSvgAsBase64Png(svgElement: SVGSVGElement): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(svgElement);

      // Ensure xmlns and dimensions are present for canvas rendering
      if (!svgString.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
        svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      if (!svgString.match(/^<svg[^>]+width=/)) {
        svgString = svgString.replace(/^<svg/, '<svg width="980" height="430"');
      }

      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const URL = window.URL || window.webkitURL || window;
      const blobUrl = URL.createObjectURL(svgBlob);

      const image = new Image();
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          // High resolution 2x
          const width = (svgElement.clientWidth || 980) * 2;
          const height = (svgElement.clientHeight || 430) * 2;
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(blobUrl);
            resolve(null);
            return;
          }

          // White background
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(image, 0, 0, width, height);

          const pngBase64 = canvas.toDataURL('image/png');
          URL.revokeObjectURL(blobUrl);
          resolve(pngBase64);
        } catch (e) {
          console.warn('Canvas export error:', e);
          URL.revokeObjectURL(blobUrl);
          resolve(null);
        }
      };

      image.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        resolve(null);
      };

      image.src = blobUrl;
    } catch (err) {
      console.warn('SVG serialization error:', err);
      resolve(null);
    }
  });
}

/**
 * Generates and downloads a rich, formatted .xlsx file containing:
 * 1. Top KPI Cards (Procesos Macro, Actividades Únicas, Horas Manuales, Horas Manuales vs Auto)
 * 2. Embedded Chart Image + Chart Data Table
 * 3. Section 01 Table: Resumen Gerencial (Procesos Macro, Actividades, Colaboradores, Horas)
 * 4. Separate Tab for Macro Processes breakdown
 */
export async function exportExecutiveSummaryXlsx(
  kpi: TopKpiData,
  summaries: GerenciaSummaryItem[],
  selectedGerencia: string = 'ALL',
  fileName: string = 'Resumen_Ejecutivo_Procesos.xlsx'
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Tablero Inventario de Procesos';
  workbook.created = new Date();

  // Try to capture chart image from DOM
  const svgEl = (document.getElementById('gerencias-chart-svg') ||
    document.querySelector('#grafica-gerencias svg')) as SVGSVGElement | null;
  let chartBase64: string | null = null;
  if (svgEl) {
    try {
      chartBase64 = await captureSvgAsBase64Png(svgEl);
    } catch (e) {
      console.warn('Could not capture chart image:', e);
    }
  }

  // -------------------------------------------------------------
  // HOJA 1: RESUMEN EJECUTIVO Y TABLA GERENCIAL
  // -------------------------------------------------------------
  const ws1 = workbook.addWorksheet('Resumen Ejecutivo', {
    views: [{ showGridLines: true }],
  });

  // Set columns width
  ws1.columns = [
    { width: 34 }, // A: Concepto / Gerencia
    { width: 20 }, // B: Métrica 1 / Macro
    { width: 22 }, // C: Métrica 2 / Actividades
    { width: 18 }, // D: Colaboradores
    { width: 20 }, // E: Horas Totales
    { width: 20 }, // F: Horas Manuales
    { width: 20 }, // G: Horas Automatizadas
    { width: 18 }, // H: Observaciones / Notas
  ];

  // Header banner
  ws1.mergeCells('A1:G1');
  const titleCell = ws1.getCell('A1');
  titleCell.value = 'TABLERO INVENTARIO DE PROCESOS - REPORTE EJECUTIVO';
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' }, // Slate 900
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws1.getRow(1).height = 36;

  // Subtitle info
  ws1.mergeCells('A2:G2');
  const subCell = ws1.getCell('A2');
  const scopeText = selectedGerencia === 'ALL' ? 'Consolidado Global (Todas las Gerencias)' : `Gerencia: ${selectedGerencia}`;
  const now = new Date();
  subCell.value = `Alcance: ${scopeText}  |  Fecha: ${now.toLocaleDateString('es-MX')} ${now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}  |  Base Jornada Laboral: 152 h/mes`;
  subCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF334155' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws1.getRow(2).height = 20;

  // Empty row 3
  ws1.getRow(3).height = 10;

  // -------------------------------------------------------------
  // SECCIÓN 1: CUADROS DE INICIO (KPIS EJECUTIVOS)
  // -------------------------------------------------------------
  ws1.mergeCells('A4:G4');
  const kpiHeader = ws1.getCell('A4');
  kpiHeader.value = '1. INDICADORES CLAVE DE INICIO (KPIS EJECUTIVOS)';
  kpiHeader.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  kpiHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A8A' }, // Blue 900
  };
  kpiHeader.alignment = { vertical: 'middle', indent: 1 };
  ws1.getRow(4).height = 26;

  // KPI Table Headers
  const kpiTableHeaders = ['Indicador', 'Cifra Principal', 'Equivalente FTE (152h)', 'Promedio / Detalle', 'Volumen Adicional', 'Estado / Distribución', ''];
  const r5 = ws1.getRow(5);
  r5.height = 22;
  kpiTableHeaders.forEach((th, idx) => {
    if (idx < 6) {
      const cell = r5.getCell(idx + 1);
      cell.value = th;
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E293B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.alignment = { vertical: 'middle', horizontal: idx === 0 ? 'left' : 'center' };
      cell.border = { bottom: { style: 'medium', color: { argb: 'FFCBD5E1' } } };
    }
  });

  const avgManual = kpi.colaboradoresCount > 0 ? (kpi.horasManuales / kpi.colaboradoresCount).toFixed(1) : '0';
  const pctAuto = kpi.pctAutomatizadoGlobal.toFixed(1);
  const pctManual = (100 - kpi.pctAutomatizadoGlobal).toFixed(1);

  const kpiRows = [
    [
      'Procesos Macro Evaluados',
      `${formatThousands(kpi.macroByGerenciaCount)} procesos`,
      'N/A',
      `${formatThousands(kpi.gerenciasCount)} gerencias activas`,
      'Estructura multi-proceso',
      'Inventario completo',
    ],
    [
      'Actividades / Procesos (Únicas)',
      `${formatThousands(kpi.actividadesCount)} actividades`,
      'N/A',
      `${formatThousands(kpi.totalFilasCount)} registros evaluados`,
      `${formatThousands(kpi.colaboradoresCount)} responsables funcionales`,
      'Actividades sin duplicados',
    ],
    [
      'Horas Mensuales Manuales',
      `${formatHours(kpi.horasManuales)} h/mes`,
      `${formatThousands(kpi.horasManuales / 152, 1)} FTE manual`,
      `Promedio: ${formatThousands(Number(avgManual), 1)} h/mes manuales`,
      'Carga operativa no automatizada',
      `${pctManual}% del total de horas`,
    ],
    [
      'Horas Manuales vs. Automatizadas (Total)',
      `Total: ${formatHours(kpi.horasTotales)} h/mes`,
      `${formatThousands(kpi.horasTotales / 152, 1)} FTE total`,
      `Manual: ${formatHours(kpi.horasManuales)} h  |  Auto: ${formatHours(kpi.horasAutomatizadas)} h`,
      `Automatización: ${pctAuto}%`,
      `${pctAuto}% auto · ${pctManual}% manual`,
    ],
  ];

  kpiRows.forEach((row, i) => {
    const rowNum = 6 + i;
    const r = ws1.getRow(rowNum);
    r.height = 22;
    row.forEach((val, colIdx) => {
      const cell = r.getCell(colIdx + 1);
      cell.value = val;
      cell.font = { name: 'Arial', size: 9, bold: colIdx === 0 || colIdx === 1 };
      cell.alignment = { vertical: 'middle', horizontal: colIdx === 0 ? 'left' : 'center' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: i % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' },
      };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });

  // -------------------------------------------------------------
  // SECCIÓN 2: GRÁFICA COMPARATIVA POR GERENCIA (IMAGEN + DATOS)
  // -------------------------------------------------------------
  let currentExcelRow = 11;
  ws1.getRow(currentExcelRow).height = 10;
  currentExcelRow++;

  ws1.mergeCells(`A${currentExcelRow}:G${currentExcelRow}`);
  const chartHeader = ws1.getCell(`A${currentExcelRow}`);
  chartHeader.value = '2. GRÁFICA COMPARATIVA: HORAS MANUALES VS. AUTOMATIZADAS Y VOLUMEN DE ACTIVIDADES';
  chartHeader.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  chartHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A8A' },
  };
  chartHeader.alignment = { vertical: 'middle', indent: 1 };
  ws1.getRow(currentExcelRow).height = 26;
  currentExcelRow++;

  // If chart image is captured, insert it!
  if (chartBase64) {
    try {
      const imageId = workbook.addImage({
        base64: chartBase64,
        extension: 'png',
      });

      // Place image spanning across columns A to G
      ws1.addImage(imageId, `A${currentExcelRow}:G${currentExcelRow + 18}`);

      // Advance rows past the image
      currentExcelRow += 19;
    } catch (e) {
      console.warn('Error inserting image in Excel:', e);
    }
  }

  // Table with chart data points
  ws1.mergeCells(`A${currentExcelRow}:G${currentExcelRow}`);
  const chartDataSubHeader = ws1.getCell(`A${currentExcelRow}`);
  chartDataSubHeader.value = 'DATOS DE LA GRÁFICA POR GERENCIA (EJE MANUAL, AUTO Y ACTIVIDADES)';
  chartDataSubHeader.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF334155' } };
  chartDataSubHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  chartDataSubHeader.alignment = { vertical: 'middle', indent: 1 };
  ws1.getRow(currentExcelRow).height = 20;
  currentExcelRow++;

  const chartColHeaders = ['Gerencia', 'Horas Manuales (h)', 'Horas Auto (h)', 'Horas Totales (h)', 'Volumen Actividades', '% Automatizado', 'FTE Total (152h)'];
  const rChartHead = ws1.getRow(currentExcelRow);
  rChartHead.height = 22;
  chartColHeaders.forEach((th, idx) => {
    const cell = rChartHead.getCell(idx + 1);
    cell.value = th;
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E293B' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.alignment = { vertical: 'middle', horizontal: idx === 0 ? 'left' : 'right' };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF94A3B8' } } };
  });
  currentExcelRow++;

  summaries.forEach((s, idx) => {
    const r = ws1.getRow(currentExcelRow);
    r.height = 20;
    r.getCell(1).value = s.gerencia;
    r.getCell(1).font = { name: 'Arial', size: 9, bold: true };
    r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

    r.getCell(2).value = s.horasManuales;
    r.getCell(2).numFmt = '#,##0.0';
    r.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };

    r.getCell(3).value = s.horasAutomatizadas;
    r.getCell(3).numFmt = '#,##0.0';
    r.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };

    r.getCell(4).value = s.horasTotales;
    r.getCell(4).numFmt = '#,##0.0';
    r.getCell(4).font = { bold: true };
    r.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };

    r.getCell(5).value = s.totalActividades;
    r.getCell(5).numFmt = '#,##0';
    r.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };

    r.getCell(6).value = `${s.pctAutomatizado}%`;
    r.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };

    r.getCell(7).value = Number((s.horasTotales / 152).toFixed(1));
    r.getCell(7).numFmt = '#,##0.0';
    r.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };

    for (let c = 1; c <= 7; c++) {
      const cell = r.getCell(c);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' },
      };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    }
    currentExcelRow++;
  });

  // -------------------------------------------------------------
  // SECCIÓN 3: TABLA DE SECCIÓN 1 - RESUMEN GERENCIAL
  // -------------------------------------------------------------
  currentExcelRow++;
  ws1.mergeCells(`A${currentExcelRow}:G${currentExcelRow}`);
  const sec1Header = ws1.getCell(`A${currentExcelRow}`);
  sec1Header.value = '3. SECCIÓN 01: RESUMEN GERENCIAL - PROCESOS MACRO, ACTIVIDADES Y HORAS';
  sec1Header.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  sec1Header.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A8A' },
  };
  sec1Header.alignment = { vertical: 'middle', indent: 1 };
  ws1.getRow(currentExcelRow).height = 26;
  currentExcelRow++;

  const sec1ColHeaders = [
    'Gerencia',
    'Procesos Macro',
    'Actividades Únicas',
    'Colaboradores',
    'Horas Totales (h)',
    'Horas Manuales (h)',
    'Horas Auto. (h)',
  ];

  const rSec1Head = ws1.getRow(currentExcelRow);
  rSec1Head.height = 24;
  sec1ColHeaders.forEach((th, idx) => {
    const cell = rSec1Head.getCell(idx + 1);
    cell.value = th;
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Slate 900
    cell.alignment = { vertical: 'middle', horizontal: idx === 0 ? 'left' : 'right' };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF334155' } } };
  });
  currentExcelRow++;

  let totMacros = 0;
  let totActs = 0;
  let totColabs = 0;
  let totHorasTotales = 0;
  let totHorasManuales = 0;
  let totHorasAuto = 0;

  summaries.forEach((s, idx) => {
    totMacros += s.totalProcesosMacro;
    totActs += s.totalActividades;
    totColabs += s.totalColaboradores;
    totHorasTotales += s.horasTotales;
    totHorasManuales += s.horasManuales;
    totHorasAuto += s.horasAutomatizadas;

    const r = ws1.getRow(currentExcelRow);
    r.height = 21;
    r.getCell(1).value = s.gerencia;
    r.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
    r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

    r.getCell(2).value = s.totalProcesosMacro;
    r.getCell(2).numFmt = '#,##0';
    r.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };

    r.getCell(3).value = s.totalActividades;
    r.getCell(3).numFmt = '#,##0';
    r.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };

    r.getCell(4).value = s.totalColaboradores;
    r.getCell(4).numFmt = '#,##0';
    r.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };

    r.getCell(5).value = s.horasTotales;
    r.getCell(5).numFmt = '#,##0.0';
    r.getCell(5).font = { bold: true };
    r.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };

    r.getCell(6).value = s.horasManuales;
    r.getCell(6).numFmt = '#,##0.0';
    r.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };

    r.getCell(7).value = s.horasAutomatizadas;
    r.getCell(7).numFmt = '#,##0.0';
    r.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };

    for (let c = 1; c <= 7; c++) {
      const cell = r.getCell(c);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' },
      };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    }
    currentExcelRow++;
  });

  // Total Row for Section 1
  const rTotal = ws1.getRow(currentExcelRow);
  rTotal.height = 24;
  rTotal.getCell(1).value = 'TOTAL CONSOLIDADO';
  rTotal.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

  rTotal.getCell(2).value = totMacros;
  rTotal.getCell(2).numFmt = '#,##0';
  rTotal.getCell(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };

  rTotal.getCell(3).value = totActs;
  rTotal.getCell(3).numFmt = '#,##0';
  rTotal.getCell(3).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };

  rTotal.getCell(4).value = totColabs;
  rTotal.getCell(4).numFmt = '#,##0';
  rTotal.getCell(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };

  rTotal.getCell(5).value = Number(totHorasTotales.toFixed(1));
  rTotal.getCell(5).numFmt = '#,##0.0';
  rTotal.getCell(5).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };

  rTotal.getCell(6).value = Number(totHorasManuales.toFixed(1));
  rTotal.getCell(6).numFmt = '#,##0.0';
  rTotal.getCell(6).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };

  rTotal.getCell(7).value = Number(totHorasAuto.toFixed(1));
  rTotal.getCell(7).numFmt = '#,##0.0';
  rTotal.getCell(7).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };

  for (let c = 1; c <= 7; c++) {
    const cell = rTotal.getCell(c);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }, // Slate 800
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF475569' } },
      bottom: { style: 'medium', color: { argb: 'FF475569' } },
    };
  }

  // -------------------------------------------------------------
  // HOJA 2: DESGLOSE DE PROCESOS MACRO POR GERENCIA
  // -------------------------------------------------------------
  const ws2 = workbook.addWorksheet('Desglose Procesos Macro', {
    views: [{ showGridLines: true }],
  });

  ws2.columns = [
    { width: 28 }, // Gerencia
    { width: 34 }, // Proceso Macro
    { width: 20 }, // Actividades Únicas
    { width: 18 }, // Colaboradores
    { width: 20 }, // Horas Totales
    { width: 20 }, // Horas Manuales
    { width: 20 }, // Horas Auto
  ];

  ws2.mergeCells('A1:G1');
  const ws2Title = ws2.getCell('A1');
  ws2Title.value = 'DESGLOSE DETALLADO DE PROCESOS MACRO POR GERENCIA';
  ws2Title.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  ws2Title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  ws2Title.alignment = { vertical: 'middle', horizontal: 'center' };
  ws2.getRow(1).height = 30;

  const macroHeaders = ['Gerencia', 'Proceso Macro', 'Actividades Únicas', 'Colaboradores', 'Horas Totales (h)', 'Horas Manuales (h)', 'Horas Auto (h)'];
  const rMacroHead = ws2.getRow(2);
  rMacroHead.height = 22;
  macroHeaders.forEach((th, idx) => {
    const cell = rMacroHead.getCell(idx + 1);
    cell.value = th;
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.alignment = { vertical: 'middle', horizontal: idx < 2 ? 'left' : 'right' };
  });

  let macroRowIndex = 3;
  summaries.forEach((s) => {
    (s.macroProcessesList || []).forEach((m, mIdx) => {
      const r = ws2.getRow(macroRowIndex);
      r.height = 20;
      r.getCell(1).value = s.gerencia;
      r.getCell(2).value = m.nombre;
      r.getCell(3).value = m.totalActividades;
      r.getCell(4).value = m.colaboradoresCount;
      r.getCell(5).value = m.horasTotales;
      r.getCell(6).value = m.horasManuales;
      r.getCell(7).value = m.horasAutomatizadas;

      r.getCell(3).numFmt = '#,##0';
      r.getCell(4).numFmt = '#,##0';
      r.getCell(5).numFmt = '#,##0.0';
      r.getCell(6).numFmt = '#,##0.0';
      r.getCell(7).numFmt = '#,##0.0';

      for (let c = 1; c <= 7; c++) {
        const cell = r.getCell(c);
        cell.font = { name: 'Arial', size: 9 };
        cell.alignment = { vertical: 'middle', horizontal: c <= 2 ? 'left' : 'right' };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: macroRowIndex % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' },
        };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      }
      macroRowIndex++;
    });
  });

  // -------------------------------------------------------------
  // WRITE AND DOWNLOAD WORKBOOK
  // -------------------------------------------------------------
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

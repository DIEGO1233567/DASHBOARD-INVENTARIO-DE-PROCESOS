import ExcelJS from 'exceljs';
import { ColaboradorSummaryItem, GerenciaSummaryItem } from '../types/sheets';
import { formatHours, formatThousands, inferSubdireccion } from './sheetsParser';

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
 * Captures an SVG element from the DOM and converts it to a high-resolution PNG base64 string.
 * Preserves fonts, colors, and margins so no axis, label, or legend info gets clipped.
 */
async function captureSvgAsBase64Png(svgElement: SVGSVGElement): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const targetWidth = 1060;
      const targetHeight = 480;

      // Clone SVG node to safely inject styling without altering the live DOM
      const clone = svgElement.cloneNode(true) as SVGSVGElement;
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('width', String(targetWidth));
      clone.setAttribute('height', String(targetHeight));
      clone.setAttribute('viewBox', `0 0 ${targetWidth} ${targetHeight}`);

      // Inject explicit embedded CSS so class-based Tailwind colors and fonts render properly in isolated canvas
      const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      styleEl.textContent = `
        text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
        .text-\\[9px\\] { font-size: 9px; }
        .text-\\[10px\\] { font-size: 10px; }
        .text-\\[11px\\] { font-size: 11px; }
        .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
        .font-bold { font-weight: 700; }
        .font-semibold { font-weight: 600; }
        .font-medium { font-weight: 500; }
        .fill-slate-500 { fill: #64748b; }
        .fill-slate-700 { fill: #334155; }
        .fill-slate-800 { fill: #1e293b; }
        .fill-slate-900 { fill: #0f172a; }
        .fill-emerald-700 { fill: #047857; }
        .fill-emerald-800 { fill: #065f46; }
        .fill-blue-900 { fill: #1e3a8a; }
        .fill-blue-700 { fill: #1d4ed8; }
        .fill-white { fill: #ffffff; }
      `;
      clone.insertBefore(styleEl, clone.firstChild);

      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(clone);

      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const URL = window.URL || window.webkitURL || window;
      const blobUrl = URL.createObjectURL(svgBlob);

      const image = new Image();
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const scale = 2;
          canvas.width = targetWidth * scale;
          canvas.height = targetHeight * scale;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(blobUrl);
            resolve(null);
            return;
          }

          // Crisp white background
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

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
 * Generates and downloads the executive Excel workbook:
 *
 * Hoja 1: Sección 01 - Gerencias (tabla por gerencia con SUBDIRECCIÓN y abajo la gráfica comparativa)
 * Hoja 2: Sec 01 - Procesos Macro (Zoom al Desglose de Procesos Macro de todas las gerencias)
 * Hoja 3: Sec 01 - Desglose Actividades (Desglose de actividades por proceso macro y gerencia hasta nivel actividad)
 * Hoja 4: Sec 02 - Base de Datos (Base de datos de la Sección 2 en el mismo orden de gerencias)
 */
export async function exportExecutiveSummaryXlsx(
  kpi: TopKpiData,
  summaries: GerenciaSummaryItem[],
  colaboradores: ColaboradorSummaryItem[],
  selectedGerencia: string = 'ALL',
  fileName: string = 'Reporte_Sec1_y_Sec2.xlsx'
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

  // Filter scoped summaries and collaborators based on selection
  const scopedSummaries =
    selectedGerencia === 'ALL'
      ? summaries
      : summaries.filter((s) => s.gerencia === selectedGerencia);

  const scopedColaboradores =
    selectedGerencia === 'ALL'
      ? colaboradores
      : colaboradores.filter((c) => c.gerencia === selectedGerencia);

  const now = new Date();
  const dateFormatted = `${now.toLocaleDateString('es-MX')} ${now.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
  const scopeText =
    selectedGerencia === 'ALL'
      ? 'Consolidado Global (Todas las Gerencias)'
      : `Gerencia: ${selectedGerencia}`;

  // =========================================================================
  // HOJA 1: SECCIÓN 01 CON LA GRÁFICA COMPARATIVA (SIN CUADROS RESUMEN NI NADA MÁS)
  // =========================================================================
  const ws1 = workbook.addWorksheet('Sección 01 - Gerencias', {
    views: [{ showGridLines: true }],
  });

  ws1.columns = [
    { width: 38 }, // A: Subdirección
    { width: 36 }, // B: Gerencia
    { width: 20 }, // C: Procesos Macro
    { width: 22 }, // D: Actividades Únicas
    { width: 20 }, // E: Colaboradores
    { width: 22 }, // F: Horas Auto. (h)
    { width: 22 }, // G: Horas Manuales (h)
    { width: 22 }, // H: Horas Totales (h)
  ];

  // Title Banner
  ws1.mergeCells('A1:H1');
  const title1 = ws1.getCell('A1');
  title1.value = 'SECCIÓN 01: RESUMEN GERENCIAL - PROCESOS MACRO, ACTIVIDADES Y HORAS';
  title1.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  title1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Slate 900
  title1.alignment = { vertical: 'middle', horizontal: 'center' };
  ws1.getRow(1).height = 32;

  // Subtitle
  ws1.mergeCells('A2:H2');
  const sub1 = ws1.getCell('A2');
  sub1.value = `Alcance: ${scopeText}  |  Fecha: ${dateFormatted}  |  Jornada Base: 152 h/mes`;
  sub1.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } };
  sub1.alignment = { vertical: 'middle', horizontal: 'center' };
  ws1.getRow(2).height = 20;

  // Table Column Headers (Row 3 - No extra KPI boxes!)
  const sec1Headers = [
    'Subdirección',
    'Gerencia',
    'Procesos Macro',
    'Actividades Únicas',
    'Colaboradores',
    'Horas Auto.',
    'Horas Manuales',
    'Horas Totales',
  ];

  const rHead1 = ws1.getRow(3);
  rHead1.height = 26;
  sec1Headers.forEach((th, idx) => {
    const cell = rHead1.getCell(idx + 1);
    cell.value = th;
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }; // Blue 900
    cell.alignment = {
      vertical: 'middle',
      horizontal: idx <= 1 ? 'left' : idx <= 4 ? 'center' : 'right',
    };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF334155' } } };
  });

  let row1Idx = 4;
  let totMacros = 0;
  let totActs = 0;
  let totColabs = 0;
  let totHorasAuto = 0;
  let totHorasManuales = 0;
  let totHorasTotales = 0;

  scopedSummaries.forEach((s, idx) => {
    totMacros += s.totalProcesosMacro;
    totActs += s.totalActividades;
    totColabs += s.totalColaboradores;
    totHorasAuto += s.horasAutomatizadas;
    totHorasManuales += s.horasManuales;
    totHorasTotales += s.horasTotales;

    const r = ws1.getRow(row1Idx);
    r.height = 22;

    const subName = s.subdireccion || inferSubdireccion(s.gerencia);
    r.getCell(1).value = subName;
    r.getCell(1).font = { name: 'Arial', size: 9, color: { argb: 'FF334155' } };
    r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

    r.getCell(2).value = s.gerencia;
    r.getCell(2).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
    r.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };

    r.getCell(3).value = s.totalProcesosMacro;
    r.getCell(3).numFmt = '#,##0';
    r.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };

    r.getCell(4).value = s.totalActividades;
    r.getCell(4).numFmt = '#,##0';
    r.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };

    r.getCell(5).value = s.totalColaboradores;
    r.getCell(5).numFmt = '#,##0';
    r.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };

    r.getCell(6).value = s.horasAutomatizadas;
    r.getCell(6).numFmt = '#,##0.0';
    r.getCell(6).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E3A8A' } };
    r.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };

    r.getCell(7).value = s.horasManuales;
    r.getCell(7).numFmt = '#,##0.0';
    r.getCell(7).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFB45309' } }; // Amber font
    r.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };

    r.getCell(8).value = s.horasTotales;
    r.getCell(8).numFmt = '#,##0.0';
    r.getCell(8).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
    r.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };

    for (let c = 1; c <= 8; c++) {
      const cell = r.getCell(c);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: c === 7 ? 'FFFFFBEB' : (idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC') },
      };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    }
    row1Idx++;
  });

  // Total Consolidado Row for Section 1
  const rTotal1 = ws1.getRow(row1Idx);
  rTotal1.height = 25;
  rTotal1.getCell(1).value = 'TOTAL CONSOLIDADO';
  rTotal1.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal1.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

  rTotal1.getCell(2).value = `${scopedSummaries.length} gerencias`;
  rTotal1.getCell(2).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal1.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };

  rTotal1.getCell(3).value = totMacros;
  rTotal1.getCell(3).numFmt = '#,##0';
  rTotal1.getCell(3).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal1.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };

  rTotal1.getCell(4).value = totActs;
  rTotal1.getCell(4).numFmt = '#,##0';
  rTotal1.getCell(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal1.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };

  rTotal1.getCell(5).value = totColabs;
  rTotal1.getCell(5).numFmt = '#,##0';
  rTotal1.getCell(5).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal1.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };

  rTotal1.getCell(6).value = Number(totHorasAuto.toFixed(1));
  rTotal1.getCell(6).numFmt = '#,##0.0';
  rTotal1.getCell(6).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal1.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };

  rTotal1.getCell(7).value = Number(totHorasManuales.toFixed(1));
  rTotal1.getCell(7).numFmt = '#,##0.0';
  rTotal1.getCell(7).font = { bold: true, color: { argb: 'FFFEF08A' } }; // Light amber text
  rTotal1.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };

  rTotal1.getCell(8).value = Number(totHorasTotales.toFixed(1));
  rTotal1.getCell(8).numFmt = '#,##0.0';
  rTotal1.getCell(8).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal1.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };

  for (let c = 1; c <= 8; c++) {
    const cell = rTotal1.getCell(c);
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
  row1Idx++;

  // -------------------------------------------------------------
  // ABAJO DE LA TABLA: LA GRÁFICA COMPARATIVA (SIN NADA MÁS)
  // -------------------------------------------------------------
  row1Idx++; // Empty separator row
  ws1.getRow(row1Idx).height = 14;
  row1Idx++;

  ws1.mergeCells(`A${row1Idx}:H${row1Idx}`);
  const chartTitleCell = ws1.getCell(`A${row1Idx}`);
  chartTitleCell.value =
    'GRÁFICA COMPARATIVA: HORAS MANUALES VS. AUTOMATIZADAS Y VOLUMEN DE ACTIVIDADES';
  chartTitleCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  chartTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }; // Blue 900
  chartTitleCell.alignment = { vertical: 'middle', indent: 1 };
  ws1.getRow(row1Idx).height = 24;
  row1Idx++;

  // Insert captured chart image if present
  if (chartBase64) {
    try {
      const imageId = workbook.addImage({
        base64: chartBase64,
        extension: 'png',
      });

      const startChartRow = row1Idx;
      const chartRowsCount = 24;
      for (let r = 0; r < chartRowsCount; r++) {
        ws1.getRow(startChartRow + r).height = 20;
      }

      ws1.addImage(imageId, {
        tl: { col: 0.1, row: startChartRow - 0.8 },
        ext: { width: 1020, height: 460 },
        editAs: 'oneCell',
      });

      row1Idx += chartRowsCount + 1;
    } catch (e) {
      console.warn('Error inserting image in Excel:', e);
    }
  } else {
    ws1.mergeCells(`A${row1Idx}:H${row1Idx}`);
    const noImgCell = ws1.getCell(`A${row1Idx}`);
    noImgCell.value =
      'Gráfica interactiva disponible en la vista web del tablero (horas manuales, auto y volumen de actividades).';
    noImgCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } };
    noImgCell.alignment = { vertical: 'middle', indent: 1 };
    ws1.getRow(row1Idx).height = 24;
  }

  // =========================================================================
  // HOJA 2: ZOOM AL DESGLOSE DE PROCESOS MACRO DE TODAS LAS GERENCIAS
  // (Mismo orden de la Sección 1, sin nada más)
  // =========================================================================
  const ws2 = workbook.addWorksheet('Sec 01 - Procesos Macro', {
    views: [{ showGridLines: true }],
  });

  ws2.columns = [
    { width: 38 }, // A: Subdirección
    { width: 36 }, // B: Gerencia
    { width: 44 }, // C: Proceso Macro
    { width: 22 }, // D: Actividades Únicas
    { width: 24 }, // E: Total Registros (Filas)
    { width: 20 }, // F: Colaboradores
    { width: 22 }, // G: Horas Auto. (h)
    { width: 22 }, // H: Horas Manuales (h)
    { width: 22 }, // I: Horas Totales (h)
  ];

  // Header Banner Sheet 2
  ws2.mergeCells('A1:I1');
  const title2 = ws2.getCell('A1');
  title2.value = 'SECCIÓN 01: ZOOM AL DESGLOSE DE PROCESOS MACRO POR GERENCIA';
  title2.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  title2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  title2.alignment = { vertical: 'middle', horizontal: 'center' };
  ws2.getRow(1).height = 32;

  // Subtitle Sheet 2
  ws2.mergeCells('A2:I2');
  const sub2 = ws2.getCell('A2');
  sub2.value = `Desglose de procesos macro de todas las gerencias en el mismo orden de la Sección 01  |  Alcance: ${scopeText}  |  Actividades Únicas: ${formatThousands(kpi.actividadesCount)}  |  Total Registros: ${formatThousands(kpi.totalFilasCount)}  |  Fecha: ${dateFormatted}`;
  sub2.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } };
  sub2.alignment = { vertical: 'middle', horizontal: 'center' };
  ws2.getRow(2).height = 20;

  // Table Column Headers Sheet 2
  const macroHeaders = [
    'Subdirección',
    'Gerencia',
    'Proceso Macro',
    'Actividades Únicas',
    'Total Registros (Filas)',
    'Colaboradores',
    'Horas Auto.',
    'Horas Manuales',
    'Horas Totales',
  ];

  const rHead2 = ws2.getRow(3);
  rHead2.height = 26;
  macroHeaders.forEach((th, idx) => {
    const cell = rHead2.getCell(idx + 1);
    cell.value = th;
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: idx < 3 ? 'left' : idx <= 5 ? 'center' : 'right',
    };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF334155' } } };
  });

  let row2Idx = 4;
  let totMacroActs = 0;
  let totMacroActsTotales = 0;
  let totMacroColabs = 0;
  let totMacroHorasAuto = 0;
  let totMacroHorasManual = 0;
  let totMacroHorasTotal = 0;

  // Iterate across summaries in the EXACT same order of Section 1 (CXP, CEGDP, etc.)
  scopedSummaries.forEach((s) => {
    const subName = s.subdireccion || inferSubdireccion(s.gerencia);

    (s.macroProcessesList || []).forEach((m) => {
      const actsUnicas = m.totalActividades;
      const actsTotales = m.totalFilas != null ? m.totalFilas : (m.actividades?.length || 0);

      totMacroActs += actsUnicas;
      totMacroActsTotales += actsTotales;
      totMacroColabs += m.colaboradoresCount;
      totMacroHorasAuto += m.horasAutomatizadas;
      totMacroHorasManual += m.horasManuales;
      totMacroHorasTotal += m.horasTotales;

      const r = ws2.getRow(row2Idx);
      r.height = 21;

      r.getCell(1).value = subName;
      r.getCell(1).font = { name: 'Arial', size: 9, color: { argb: 'FF334155' } };
      r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

      r.getCell(2).value = s.gerencia;
      r.getCell(2).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
      r.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };

      r.getCell(3).value = m.nombre;
      r.getCell(3).font = { name: 'Arial', size: 9, color: { argb: 'FF1E293B' } };
      r.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };

      r.getCell(4).value = actsUnicas;
      r.getCell(4).numFmt = '#,##0';
      r.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };

      r.getCell(5).value = actsTotales;
      r.getCell(5).numFmt = '#,##0';
      r.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };

      r.getCell(6).value = m.colaboradoresCount;
      r.getCell(6).numFmt = '#,##0';
      r.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };

      r.getCell(7).value = m.horasAutomatizadas;
      r.getCell(7).numFmt = '#,##0.0';
      r.getCell(7).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E3A8A' } };
      r.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };

      r.getCell(8).value = m.horasManuales;
      r.getCell(8).numFmt = '#,##0.0';
      r.getCell(8).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFB45309' } };
      r.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };

      r.getCell(9).value = m.horasTotales;
      r.getCell(9).numFmt = '#,##0.0';
      r.getCell(9).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
      r.getCell(9).alignment = { vertical: 'middle', horizontal: 'right' };

      for (let c = 1; c <= 9; c++) {
        const cell = r.getCell(c);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: c === 8 ? 'FFFFFBEB' : (row2Idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC') },
        };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      }

      row2Idx++;
    });
  });

  // Total Consolidado Row Sheet 2
  const rTotal2 = ws2.getRow(row2Idx);
  rTotal2.height = 25;
  rTotal2.getCell(1).value = 'TOTAL CONSOLIDADO';
  rTotal2.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal2.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

  rTotal2.getCell(2).value = `${scopedSummaries.length} gerencias`;
  rTotal2.getCell(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  rTotal2.getCell(3).value = `${scopedSummaries.reduce((acc, s) => acc + (s.macroProcessesList?.length || 0), 0)} procesos macro`;
  rTotal2.getCell(3).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  rTotal2.getCell(4).value = totMacroActs;
  rTotal2.getCell(4).numFmt = '#,##0';
  rTotal2.getCell(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal2.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };

  rTotal2.getCell(5).value = totMacroActsTotales;
  rTotal2.getCell(5).numFmt = '#,##0';
  rTotal2.getCell(5).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal2.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };

  rTotal2.getCell(6).value = scopedSummaries.reduce((acc, s) => acc + s.totalColaboradores, 0);
  rTotal2.getCell(6).numFmt = '#,##0';
  rTotal2.getCell(6).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal2.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };

  rTotal2.getCell(7).value = Number(totMacroHorasAuto.toFixed(1));
  rTotal2.getCell(7).numFmt = '#,##0.0';
  rTotal2.getCell(7).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal2.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };

  rTotal2.getCell(8).value = Number(totMacroHorasManual.toFixed(1));
  rTotal2.getCell(8).numFmt = '#,##0.0';
  rTotal2.getCell(8).font = { bold: true, color: { argb: 'FFFEF08A' } };
  rTotal2.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };

  rTotal2.getCell(9).value = Number(totMacroHorasTotal.toFixed(1));
  rTotal2.getCell(9).numFmt = '#,##0.0';
  rTotal2.getCell(9).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal2.getCell(9).alignment = { vertical: 'middle', horizontal: 'right' };

  for (let c = 1; c <= 9; c++) {
    const cell = rTotal2.getCell(c);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF334155' } },
      bottom: { style: 'medium', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF475569' } },
    };
  }

  // =========================================================================
  // HOJA 3: DESGLOSE DE ACTIVIDADES POR PROCESO MACRO Y GERENCIA
  // (Como si abriéramos los procesos macro para verlo hasta la actividad)
  // =========================================================================
  const ws3 = workbook.addWorksheet('Sec 01 - Desglose Actividades', {
    views: [{ showGridLines: true }],
  });

  ws3.columns = [
    { width: 36 }, // A: Subdirección
    { width: 32 }, // B: Gerencia
    { width: 38 }, // C: Proceso Macro
    { width: 48 }, // D: Actividad / Proceso
    { width: 30 }, // E: Área / Sub Área
    { width: 34 }, // F: Responsable Funcional
    { width: 26 }, // G: Puesto
    { width: 18 }, // H: Frecuencia
    { width: 15 }, // I: ¿Auto.?
    { width: 20 }, // J: Herramienta
    { width: 18 }, // K: Horas Auto. (h)
    { width: 18 }, // L: Horas Manuales (h)
    { width: 18 }, // M: Horas Totales (h)
    { width: 18 }, // N: % Carga Colab.
  ];

  // Title Banner Sheet 3
  ws3.mergeCells('A1:N1');
  const title3 = ws3.getCell('A1');
  title3.value = 'DESGLOSE DE ACTIVIDADES POR PROCESO MACRO Y GERENCIA';
  title3.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  title3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  title3.alignment = { vertical: 'middle', horizontal: 'center' };
  ws3.getRow(1).height = 32;

  // Subtitle Sheet 3
  ws3.mergeCells('A2:N2');
  const sub3 = ws3.getCell('A2');
  sub3.value = `Desglose detallado de actividades por cada proceso macro de cada gerencia | Alcance: ${scopeText} | Fecha: ${dateFormatted}`;
  sub3.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } };
  sub3.alignment = { vertical: 'middle', horizontal: 'center' };
  ws3.getRow(2).height = 20;

  // Column Headers Sheet 3
  const desgloseMacroActHeaders = [
    'Subdirección',
    'Gerencia',
    'Proceso Macro',
    'Actividad / Proceso',
    'Área / Sub Área',
    'Responsable Funcional',
    'Puesto',
    'Frecuencia',
    '¿Auto.?',
    'Herramienta',
    'Horas Auto.',
    'Horas Manuales',
    'Horas Totales',
    '% Carga Colab.',
  ];

  const rHead3 = ws3.getRow(3);
  rHead3.height = 26;
  desgloseMacroActHeaders.forEach((th, idx) => {
    const cell = rHead3.getCell(idx + 1);
    cell.value = th;
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: idx < 7 ? 'left' : idx <= 9 ? 'center' : 'right',
    };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF334155' } } };
  });

  // Map of collaborator manual hours for % Carga Colaborador calculation
  const colabManualHoursMap = new Map<string, number>();
  scopedColaboradores.forEach((c) => {
    const key = `${c.gerencia.trim().toUpperCase()}:::${c.colaborador.trim().toUpperCase()}`;
    colabManualHoursMap.set(key, c.horasManuales);
  });

  let row3Idx = 4;
  let totDesgloseActs = 0;
  let totDesgloseAuto = 0;
  let totDesgloseManual = 0;
  let totDesgloseTotal = 0;

  // Iterate across summaries in the EXACT same order of Section 1 (CXP, CE/GDP, etc.)
  scopedSummaries.forEach((s) => {
    const subName = s.subdireccion || inferSubdireccion(s.gerencia);

    (s.macroProcessesList || []).forEach((m) => {
      const acts = m.actividades || [];
      acts.forEach((act) => {
        totDesgloseActs++;
        const actTot = Number(act.horasMensualesTotal != null ? act.horasMensualesTotal : (act.horasMensualesActividad || 0));
        const actMan = Number(act.horasManualesTotal != null ? act.horasManualesTotal : (act.horasManuales || 0));
        const actAuto = Number(act.horasMensualesAutomatizadas || 0);

        totDesgloseAuto += actAuto;
        totDesgloseManual += actMan;
        totDesgloseTotal += actTot;

        const colabKey = `${s.gerencia.trim().toUpperCase()}:::${(act.responsableFuncional || '').trim().toUpperCase()}`;
        const colabTotalMan = colabManualHoursMap.get(colabKey) || 0;
        const pctColab =
          colabTotalMan > 0 && actMan > 0
            ? `${((actMan / colabTotalMan) * 100).toFixed(1)}%`
            : '0%';

        const r = ws3.getRow(row3Idx);
        r.height = 20;

        r.getCell(1).value = act.subdireccion || subName;
        r.getCell(1).font = { name: 'Arial', size: 9, color: { argb: 'FF334155' } };
        r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

        r.getCell(2).value = s.gerencia;
        r.getCell(2).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
        r.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };

        r.getCell(3).value = m.nombre;
        r.getCell(3).font = { name: 'Arial', size: 9, color: { argb: 'FF1E293B' } };
        r.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };

        r.getCell(4).value = act.actividadProceso || 'Sin Especificar';
        r.getCell(4).font = { name: 'Arial', size: 9, color: { argb: 'FF0F172A' } };
        r.getCell(4).alignment = { vertical: 'middle', horizontal: 'left' };

        r.getCell(5).value = act.areaSubArea || s.gerencia;
        r.getCell(5).font = { name: 'Arial', size: 9, color: { argb: 'FF475569' } };
        r.getCell(5).alignment = { vertical: 'middle', horizontal: 'left' };

        r.getCell(6).value = act.responsableFuncional || 'Sin Asignar';
        r.getCell(6).font = { name: 'Arial', size: 9, color: { argb: 'FF1E293B' } };
        r.getCell(6).alignment = { vertical: 'middle', horizontal: 'left' };

        r.getCell(7).value = act.puesto || 'Especialista';
        r.getCell(7).font = { name: 'Arial', size: 9, color: { argb: 'FF475569' } };
        r.getCell(7).alignment = { vertical: 'middle', horizontal: 'left' };

        r.getCell(8).value = act.frecuencia || 'Mensual';
        r.getCell(8).font = { name: 'Arial', size: 9, color: { argb: 'FF334155' } };
        r.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };

        r.getCell(9).value = act.esAutomatizable || 'No';
        r.getCell(9).font = { name: 'Arial', size: 9, color: { argb: 'FF334155' } };
        r.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' };

        r.getCell(10).value = act.herramienta || 'N/A';
        r.getCell(10).font = { name: 'Arial', size: 9, color: { argb: 'FF334155' } };
        r.getCell(10).alignment = { vertical: 'middle', horizontal: 'left' };

        r.getCell(11).value = actAuto;
        r.getCell(11).numFmt = '#,##0.0';
        r.getCell(11).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E3A8A' } };
        r.getCell(11).alignment = { vertical: 'middle', horizontal: 'right' };

        r.getCell(12).value = actMan;
        r.getCell(12).numFmt = '#,##0.0';
        r.getCell(12).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFB45309' } };
        r.getCell(12).alignment = { vertical: 'middle', horizontal: 'right' };

        r.getCell(13).value = actTot;
        r.getCell(13).numFmt = '#,##0.0';
        r.getCell(13).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
        r.getCell(13).alignment = { vertical: 'middle', horizontal: 'right' };

        r.getCell(14).value = pctColab;
        r.getCell(14).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFB45309' } };
        r.getCell(14).alignment = { vertical: 'middle', horizontal: 'right' };

        for (let col = 1; col <= 14; col++) {
          const cell = r.getCell(col);
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: col === 12 ? 'FFFFFBEB' : (row3Idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC') },
          };
          cell.border = {
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
        }

        row3Idx++;
      });
    });
  });

  // Total Consolidado Row Sheet 3
  const rTotal3 = ws3.getRow(row3Idx);
  rTotal3.height = 25;
  rTotal3.getCell(1).value = 'TOTAL CONSOLIDADO';
  rTotal3.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal3.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

  rTotal3.getCell(2).value = `${scopedSummaries.length} gerencias`;
  rTotal3.getCell(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  rTotal3.getCell(4).value = `${totDesgloseActs} actividades`;
  rTotal3.getCell(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  rTotal3.getCell(11).value = Number(totDesgloseAuto.toFixed(1));
  rTotal3.getCell(11).numFmt = '#,##0.0';
  rTotal3.getCell(11).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal3.getCell(11).alignment = { vertical: 'middle', horizontal: 'right' };

  rTotal3.getCell(12).value = Number(totDesgloseManual.toFixed(1));
  rTotal3.getCell(12).numFmt = '#,##0.0';
  rTotal3.getCell(12).font = { bold: true, color: { argb: 'FFFEF08A' } };
  rTotal3.getCell(12).alignment = { vertical: 'middle', horizontal: 'right' };

  rTotal3.getCell(13).value = Number(totDesgloseTotal.toFixed(1));
  rTotal3.getCell(13).numFmt = '#,##0.0';
  rTotal3.getCell(13).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal3.getCell(13).alignment = { vertical: 'middle', horizontal: 'right' };

  for (let c = 1; c <= 14; c++) {
    const cell = rTotal3.getCell(c);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF475569' } },
      bottom: { style: 'medium', color: { argb: 'FF475569' } },
      right: { style: 'thin', color: { argb: 'FF475569' } },
    };
  }

  // =========================================================================
  // HOJA 4: BASE DE DATOS DE LA SECCIÓN 2 EN EL MISMO ORDEN DE LAS GERENCIAS DE LA SECCIÓN 1
  // (Primero CXP, luego CEGDP, etc., sin nada más)
  // =========================================================================
  const ws4 = workbook.addWorksheet('Sec 02 - Base de Datos', {
    views: [{ showGridLines: true }],
  });

  ws4.columns = [
    { width: 36 }, // A: Subdirección
    { width: 34 }, // B: Gerencia
    { width: 36 }, // C: Responsable Funcional
    { width: 28 }, // D: Puesto
    { width: 48 }, // E: Actividad / Proceso
    { width: 38 }, // F: Proceso Macro
    { width: 30 }, // G: Área / Sub Área
    { width: 18 }, // H: Frecuencia
    { width: 15 }, // I: ¿Auto.?
    { width: 22 }, // J: Herramienta
    { width: 20 }, // K: Horas Auto. (h)
    { width: 20 }, // L: Horas Manuales (h)
    { width: 20 }, // M: Horas Totales (h)
    { width: 22 }, // N: % Carga Colab.
    { width: 24 }, // O: Carga Total Colab. (h)
    { width: 22 }, // P: % Jornada (152h)
  ];

  // Title Banner Sheet 4
  ws4.mergeCells('A1:P1');
  const title4 = ws4.getCell('A1');
  title4.value = 'SECCIÓN 02: BASE DE DATOS DE CARGA LABORAL Y ACTIVIDADES POR COLABORADOR';
  title4.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  title4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  title4.alignment = { vertical: 'middle', horizontal: 'center' };
  ws4.getRow(1).height = 32;

  // Subtitle Sheet 4
  ws4.mergeCells('A2:P2');
  const sub4 = ws4.getCell('A2');
  sub4.value = `Detalle por colaborador ordenado alfabéticamente por gerencia (Sección 01)  |  Jornada base: 152 h/mes  |  Fecha: ${dateFormatted}`;
  sub4.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } };
  sub4.alignment = { vertical: 'middle', horizontal: 'center' };
  ws4.getRow(2).height = 20;

  // Column Headers Sheet 4
  const sec2DetailHeaders = [
    'Subdirección',
    'Gerencia',
    'Responsable Funcional',
    'Puesto',
    'Actividad / Proceso',
    'Proceso Macro',
    'Área / Sub Área',
    'Frecuencia',
    '¿Auto.?',
    'Herramienta',
    'Horas Auto.',
    'Horas Manuales',
    'Horas Totales',
    '% Carga Colab.',
    'Carga Total Colab.',
    '% Jornada (152h)',
  ];

  const rHead4 = ws4.getRow(3);
  rHead4.height = 26;
  sec2DetailHeaders.forEach((th, idx) => {
    const cell = rHead4.getCell(idx + 1);
    cell.value = th;
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: idx < 7 ? 'left' : idx <= 8 ? 'center' : idx === 9 ? 'left' : 'right',
    };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF334155' } } };
  });

  // Organize collaborators strictly by the order of Gerencias in Section 1 (scopedSummaries: CXP, CE/GDP, etc.)
  const orderedColaboradores: ColaboradorSummaryItem[] = [];
  const processedKeys = new Set<string>();

  scopedSummaries.forEach((s) => {
    // Filter collaborators in this specific gerencia
    const gerenciaColabs = scopedColaboradores.filter(
      (c) => c.gerencia.trim().toUpperCase() === s.gerencia.trim().toUpperCase()
    );
    // Sort collaborators within this gerencia by manual hours descending
    gerenciaColabs.sort((a, b) => b.horasManuales - a.horasManuales);

    gerenciaColabs.forEach((c) => {
      const key = `${c.gerencia}:::${c.colaborador}`;
      if (!processedKeys.has(key)) {
        processedKeys.add(key);
        orderedColaboradores.push(c);
      }
    });
  });

  // Append any remaining collaborators not matched to a known gerencia
  scopedColaboradores.forEach((c) => {
    const key = `${c.gerencia}:::${c.colaborador}`;
    if (!processedKeys.has(key)) {
      processedKeys.add(key);
      orderedColaboradores.push(c);
    }
  });

  let row4Idx = 4;
  let totSec2Acts = 0;
  let totSec2ManHours = 0;
  let totSec2AutoHours = 0;
  let totSec2TotalHours = 0;

  orderedColaboradores.forEach((c) => {
    const subName = c.subdireccion || inferSubdireccion(c.gerencia);
    const activities = c.actividades && c.actividades.length > 0
      ? c.actividades
      : [
          {
            actividadProceso: 'Actividad General',
            procesoMacro: 'Operaciones',
            areaSubArea: c.gerencia,
            frecuencia: 'Mensual',
            esAutomatizable: 'No',
            herramienta: 'N/A',
            horasManualesTotal: c.horasManuales,
            horasMensualesAutomatizadas: c.horasAutomatizadas,
            horasMensualesTotal: c.horasTotales,
          } as any,
        ];

    activities.forEach((act) => {
      totSec2Acts++;
      const actTot = act.horasMensualesTotal != null ? act.horasMensualesTotal : (act.horasMensualesActividad || 0);
      const actMan = act.horasManualesTotal != null ? act.horasManualesTotal : (act.horasManuales || 0);
      const actAuto = act.horasMensualesAutomatizadas || 0;

      totSec2ManHours += actMan;
      totSec2AutoHours += actAuto;
      totSec2TotalHours += actTot;

      const pctColabMan =
        c.horasManuales > 0 ? ((actMan / c.horasManuales) * 100).toFixed(1) : '0';

      const r = ws4.getRow(row4Idx);
      r.height = 20;

      // Subdirección
      r.getCell(1).value = subName;
      r.getCell(1).font = { name: 'Arial', size: 9, color: { argb: 'FF334155' } };
      r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

      // Gerencia
      r.getCell(2).value = c.gerencia;
      r.getCell(2).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
      r.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };

      // Responsable Funcional
      r.getCell(3).value = c.colaborador;
      r.getCell(3).font = { name: 'Arial', size: 9, color: { argb: 'FF1E293B' } };
      r.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };

      // Puesto
      r.getCell(4).value = act.puesto || c.puesto;
      r.getCell(4).font = { name: 'Arial', size: 9, color: { argb: 'FF475569' } };
      r.getCell(4).alignment = { vertical: 'middle', horizontal: 'left' };

      // Actividad / Proceso
      r.getCell(5).value = act.actividadProceso || 'Sin Especificar';
      r.getCell(5).font = { name: 'Arial', size: 9, color: { argb: 'FF0F172A' } };
      r.getCell(5).alignment = { vertical: 'middle', horizontal: 'left' };

      // Proceso Macro
      r.getCell(6).value = act.procesoMacro || 'General';
      r.getCell(6).font = { name: 'Arial', size: 9, color: { argb: 'FF334155' } };
      r.getCell(6).alignment = { vertical: 'middle', horizontal: 'left' };

      // Área / Sub Área
      r.getCell(7).value = act.areaSubArea || c.gerencia;
      r.getCell(7).font = { name: 'Arial', size: 9, color: { argb: 'FF475569' } };
      r.getCell(7).alignment = { vertical: 'middle', horizontal: 'left' };

      // Frecuencia
      r.getCell(8).value = act.frecuencia || 'Mensual';
      r.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };

      // ¿Auto.?
      r.getCell(9).value = act.esAutomatizable || 'No';
      r.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' };

      // Herramienta
      r.getCell(10).value = act.herramienta || 'N/A';
      r.getCell(10).alignment = { vertical: 'middle', horizontal: 'left' };

      // Horas Auto.
      r.getCell(11).value = actAuto;
      r.getCell(11).numFmt = '#,##0.0';
      r.getCell(11).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E3A8A' } };
      r.getCell(11).alignment = { vertical: 'middle', horizontal: 'right' };

      // Horas Manuales
      r.getCell(12).value = actMan;
      r.getCell(12).numFmt = '#,##0.0';
      r.getCell(12).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFB45309' } };
      r.getCell(12).alignment = { vertical: 'middle', horizontal: 'right' };

      // Horas Totales
      r.getCell(13).value = actTot;
      r.getCell(13).numFmt = '#,##0.0';
      r.getCell(13).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
      r.getCell(13).alignment = { vertical: 'middle', horizontal: 'right' };

      // % Carga Colaborador
      r.getCell(14).value = `${pctColabMan}%`;
      r.getCell(14).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFB45309' } };
      r.getCell(14).alignment = { vertical: 'middle', horizontal: 'right' };

      // Carga Total Colaborador
      r.getCell(15).value = c.horasManuales;
      r.getCell(15).numFmt = '#,##0.0';
      r.getCell(15).alignment = { vertical: 'middle', horizontal: 'right' };

      // % Jornada Colaborador
      r.getCell(16).value = `${formatThousands(c.porcentajeJornada, 1)}%`;
      r.getCell(16).alignment = { vertical: 'middle', horizontal: 'right' };

      for (let col = 1; col <= 16; col++) {
        const cell = r.getCell(col);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: col === 12 ? 'FFFFFBEB' : (row4Idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC') },
        };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      }

      row4Idx++;
    });
  });

  // Total Consolidado Row Sheet 4
  const rTotal4 = ws4.getRow(row4Idx);
  rTotal4.height = 25;
  rTotal4.getCell(1).value = 'TOTAL CONSOLIDADO';
  rTotal4.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal4.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

  rTotal4.getCell(2).value = `${scopedSummaries.length} gerencias`;
  rTotal4.getCell(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  rTotal4.getCell(3).value = `${orderedColaboradores.length} colaboradores`;
  rTotal4.getCell(3).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  rTotal4.getCell(5).value = `${totSec2Acts} actividades`;
  rTotal4.getCell(5).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  rTotal4.getCell(11).value = Number(totSec2AutoHours.toFixed(1));
  rTotal4.getCell(11).numFmt = '#,##0.0';
  rTotal4.getCell(11).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal4.getCell(11).alignment = { vertical: 'middle', horizontal: 'right' };

  rTotal4.getCell(12).value = Number(totSec2ManHours.toFixed(1));
  rTotal4.getCell(12).numFmt = '#,##0.0';
  rTotal4.getCell(12).font = { bold: true, color: { argb: 'FFFEF08A' } };
  rTotal4.getCell(12).alignment = { vertical: 'middle', horizontal: 'right' };

  rTotal4.getCell(13).value = Number(totSec2TotalHours.toFixed(1));
  rTotal4.getCell(13).numFmt = '#,##0.0';
  rTotal4.getCell(13).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal4.getCell(13).alignment = { vertical: 'middle', horizontal: 'right' };

  const totalColabManualSum = orderedColaboradores.reduce((acc, c) => acc + c.horasManuales, 0);
  rTotal4.getCell(15).value = Number(totalColabManualSum.toFixed(1));
  rTotal4.getCell(15).numFmt = '#,##0.0';
  rTotal4.getCell(15).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal4.getCell(15).alignment = { vertical: 'middle', horizontal: 'right' };

  rTotal4.getCell(16).value = `${formatThousands(
    (totalColabManualSum / Math.max(1, orderedColaboradores.length * 152)) * 100,
    1
  )}% prom`;
  rTotal4.getCell(16).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal4.getCell(16).alignment = { vertical: 'middle', horizontal: 'right' };

  for (let c = 1; c <= 16; c++) {
    const cell = rTotal4.getCell(c);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF475569' } },
      bottom: { style: 'medium', color: { argb: 'FF475569' } },
    };
  }

  // -------------------------------------------------------------
  // WRITE AND DOWNLOAD WORKBOOK (EXACTLY 3 SHEETS)
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

export { exportUniqueActivitiesStatusXlsx } from './statusExport';


import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Filter,
  Search,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Layers,
  Clock,
  Users,
  ShieldAlert,
  ArrowUpDown,
  Sparkles,
  ExternalLink,
  Info,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  Table,
  Check,
  X,
  FileText,
  Zap,
  BarChart2,
  TrendingUp,
} from 'lucide-react';
import { ProcessRecord } from '../types/sheets';
import {
  computeUniqueActivitiesStatusList,
  computeCrossGerenciaAnalysis,
  computeActivitiesByGerenciaAndStatus,
  UniqueActivityItem,
  StatusCategory,
  StatusComboKey,
  CrossGerenciaActivityGroup,
  ActivityByGerenciaAndStatusItem,
} from '../utils/activityStatusParser';
import { formatHours, formatThousands } from '../utils/sheetsParser';
import { exportUniqueActivitiesStatusXlsx } from '../utils/executiveExport';

interface UniqueActivitiesStatusSheetProps {
  records: ProcessRecord[];
  selectedGerencia: string;
  onSelectGerencia: (gerencia: string) => void;
  allGerencias: string[];
}

export function UniqueActivitiesStatusSheet({
  records,
  selectedGerencia,
  onSelectGerencia,
  allGerencias,
}: UniqueActivitiesStatusSheetProps) {
  // -------------------------------------------------------------
  // ESTADOS Y CÁLCULOS: SECCIÓN 1 AL INICIO (ACTIVIDADES ÚNICAS POR GERENCIA Y ESTATUS)
  // -------------------------------------------------------------
  const [topStatusFilter, setTopStatusFilter] = useState<'ALL' | StatusComboKey>('ALL');
  const [topMultiStatusFilter, setTopMultiStatusFilter] = useState<'ALL' | 'MULTI' | 'SINGLE'>('ALL');
  const [topSearchTerm, setTopSearchTerm] = useState<string>('');
  const [topSortBy, setTopSortBy] = useState<'hours' | 'name' | 'records'>('hours');
  const [expandedTopItemIds, setExpandedTopItemIds] = useState<Set<string>>(new Set());

  // Cálculo de actividades únicas por gerencia y estatus (solicitado)
  const statusAnalysisByGerenciaAndStatus = useMemo(() => {
    return computeActivitiesByGerenciaAndStatus(records, selectedGerencia);
  }, [records, selectedGerencia]);

  // Filtrado de la sección superior por estatus, coexistencia y texto
  const filteredTopItems = useMemo(() => {
    return statusAnalysisByGerenciaAndStatus.items.filter((item) => {
      // Filtro de combinación de estatus
      if (topStatusFilter !== 'ALL' && item.statusComboKey !== topStatusFilter) {
        return false;
      }
      // Filtro de coexistencia (múltiples estatus en la gerencia vs estatus único)
      if (topMultiStatusFilter === 'MULTI' && !item.hasOtherStatuses) {
        return false;
      }
      if (topMultiStatusFilter === 'SINGLE' && item.hasOtherStatuses) {
        return false;
      }
      // Búsqueda por texto
      if (topSearchTerm.trim()) {
        const q = topSearchTerm.toLowerCase();
        const matchAct = item.actividadProceso.toLowerCase().includes(q);
        const matchGer = item.gerencia.toLowerCase().includes(q);
        const matchColab = item.colaboradores.some((c) => c.toLowerCase().includes(q));
        const matchMacro = item.procesosMacro.some((m) => m.toLowerCase().includes(q));
        if (!matchAct && !matchGer && !matchColab && !matchMacro) return false;
      }
      return true;
    });
  }, [statusAnalysisByGerenciaAndStatus, topStatusFilter, topMultiStatusFilter, topSearchTerm]);

  // Ordenamiento de la sección superior
  const sortedTopItems = useMemo(() => {
    const list = [...filteredTopItems];
    if (topSortBy === 'hours') {
      list.sort((a, b) => b.horasTotales - a.horasTotales);
    } else if (topSortBy === 'name') {
      list.sort((a, b) => a.actividadProceso.localeCompare(b.actividadProceso));
    } else if (topSortBy === 'records') {
      list.sort((a, b) => b.recordsCount - a.recordsCount);
    }
    return list;
  }, [filteredTopItems, topSortBy]);

  const toggleExpandTopItem = (id: string) => {
    setExpandedTopItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAllTopItems = () => {
    setExpandedTopItemIds(new Set(sortedTopItems.map((i) => i.id)));
  };

  const collapseAllTopItems = () => {
    setExpandedTopItemIds(new Set());
  };

  // -------------------------------------------------------------
  // ESTADOS Y CÁLCULOS: SECCIÓN DE AUDITORÍA DE DISCREPANCIAS
  // -------------------------------------------------------------
  const [activeCategory, setActiveCategory] = useState<StatusCategory | 'CROSS_GERENCIA'>('DISCORDANTE');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedActivityIds, setExpandedActivityIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'discrepancy' | 'hours' | 'name' | 'records'>('discrepancy');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Compute status analysis with strict per-gerencia uniqueness rule
  const { items, metrics, discordantItems } = useMemo(() => {
    return computeUniqueActivitiesStatusList(records, selectedGerencia);
  }, [records, selectedGerencia]);

  // Compute cross-gerencia groups
  const crossGerenciaGroups = useMemo(() => {
    return computeCrossGerenciaAnalysis(records);
  }, [records]);

  // Filter items according to active tab & search
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Category filter
      if (activeCategory === 'DISCORDANTE' && !item.hasDiscrepancy) return false;
      if (activeCategory === 'DIG_NO_AUTO_SI' && item.category !== 'DIG_NO_AUTO_SI') return false;
      if (activeCategory === 'DIG_SI_AUTO_NO' && item.category !== 'DIG_SI_AUTO_NO') return false;
      if (activeCategory === 'DIG_NO_AUTO_NO' && item.category !== 'DIG_NO_AUTO_NO') return false;
      if (activeCategory === 'DIG_SI_AUTO_SI' && item.category !== 'DIG_SI_AUTO_SI') return false;

      // Text search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchName = item.actividadProceso.toLowerCase().includes(query);
        const matchGerencia = item.gerencia.toLowerCase().includes(query);
        const matchColab = item.colaboradores.some((c) => c.toLowerCase().includes(query));
        const matchMacro = item.procesosMacro.some((m) => m.toLowerCase().includes(query));
        const matchTool = item.herramientas.some((t) => t.toLowerCase().includes(query));
        if (!matchName && !matchGerencia && !matchColab && !matchMacro && !matchTool) {
          return false;
        }
      }

      return true;
    });
  }, [items, activeCategory, searchTerm]);

  // Sort items
  const sortedItems = useMemo(() => {
    const list = [...filteredItems];
    if (sortBy === 'discrepancy') {
      list.sort((a, b) => {
        if (a.hasDiscrepancy && !b.hasDiscrepancy) return -1;
        if (!a.hasDiscrepancy && b.hasDiscrepancy) return 1;
        if (b.variants.length !== a.variants.length) return b.variants.length - a.variants.length;
        return b.horasTotales - a.horasTotales;
      });
    } else if (sortBy === 'hours') {
      list.sort((a, b) => b.horasTotales - a.horasTotales);
    } else if (sortBy === 'name') {
      list.sort((a, b) => a.actividadProceso.localeCompare(b.actividadProceso));
    } else if (sortBy === 'records') {
      list.sort((a, b) => b.totalRecords - a.totalRecords);
    }
    return list;
  }, [filteredItems, sortBy]);

  const toggleExpand = (id: string) => {
    setExpandedActivityIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedActivityIds(new Set(sortedItems.map((i) => i.id)));
  };

  const collapseAll = () => {
    setExpandedActivityIds(new Set());
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await exportUniqueActivitiesStatusXlsx(
        items,
        metrics,
        crossGerenciaGroups,
        selectedGerencia,
        `Auditoria_Estatus_Actividades_Unicas_${selectedGerencia === 'ALL' ? 'Consolidado' : selectedGerencia.replace(/\s+/g, '_')}.xlsx`
      );
    } catch (err) {
      console.error('Error exportando reporte de estatus:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ============================================================ */}
      {/* SECCIÓN 1 (AL INICIO): DETERMINACIÓN Y MATRIZ DE ACTIVIDADES ÚNICAS POR GERENCIA Y ESTATUS */}
      {/* ============================================================ */}
      <section className="bg-white border-2 border-blue-600/30 rounded-2xl p-6 shadow-sm space-y-6 relative overflow-hidden">
        {/* Decorador visual superior */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-amber-500 to-emerald-500" />

        {/* Encabezado Principal de la Sección Solicitada */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-4xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide bg-blue-100 text-blue-900 border border-blue-300">
                <BarChart2 className="w-3.5 h-3.5 text-blue-700" />
                Métrica Oficial Solicitada
              </span>
              <span className="text-xs text-slate-500 font-semibold">
                Actividades Únicas por Gerencia y Estatus
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              Conteo y Distribución de Actividades Únicas por Estatus
            </h2>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Determina exactamente cuántas actividades tenemos en total y cuántas corresponden a cada estatus:{' '}
              <strong className="text-blue-900 font-bold">Sí Digitalizado - Sí Automatizable</strong>,{' '}
              <strong className="text-amber-900 font-bold">No Digitalizado - Sí Automatizable</strong>,{' '}
              <strong className="text-rose-900 font-bold">No Digitalizado - No Automatizable</strong> y{' '}
              <strong className="text-emerald-900 font-bold">Sí Digitalizado - No Automatizable</strong>.
              <br />
              <span className="text-slate-500 text-xs">
                * Las actividades se contabilizan de forma única por gerencia y por estatus. En actividades como la captura adjunta (ej.{' '}
                <em>"Validación y ligado de XML"</em> con registros Sí/Sí, No/No y No/Sí), cada combinación existente cuenta como 1 actividad única en su respectivo estatus.
              </span>
            </p>
          </div>

          {/* Badge con el Total General de Actividades Base vs. Instancias de Estatus */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-right shrink-0 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Universo en {selectedGerencia === 'ALL' ? 'Todas las Gerencias' : selectedGerencia}
            </div>
            <div className="text-2xl font-black font-mono text-slate-900 tabular-nums">
              {formatThousands(statusAnalysisByGerenciaAndStatus.totalActividadesPorEstatus)}
              <span className="text-xs font-semibold text-slate-500 ml-1">por estatus</span>
            </div>
            <div className="text-[11px] text-slate-600 font-medium">
              derivadas de <strong className="text-slate-800">{formatThousands(statusAnalysisByGerenciaAndStatus.totalActividadesBase)}</strong> actividades base
            </div>
          </div>
        </div>

        {/* Las 4 Tarjetas de Métricas de Estatus Solicitadas con Clic Interactivo para Filtrar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Sí Digitalizado · Sí Automatizable */}
          <div
            onClick={() => setTopStatusFilter(topStatusFilter === 'SI_SI' ? 'ALL' : 'SI_SI')}
            className={`border rounded-xl p-4 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
              topStatusFilter === 'SI_SI'
                ? 'bg-blue-50/80 border-blue-600 ring-2 ring-blue-500/30 shadow-sm'
                : 'bg-white border-slate-200/90 hover:border-blue-400 hover:bg-blue-50/20 shadow-2xs'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-blue-600" />
                  Sí Digitalizado · Sí Auto
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono">
                  {(
                    (statusAnalysisByGerenciaAndStatus.countByCombo.SI_SI /
                      Math.max(1, statusAnalysisByGerenciaAndStatus.totalActividadesPorEstatus)) *
                    100
                  ).toFixed(1)}
                  %
                </span>
              </div>

              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-3xl font-black font-mono text-blue-950 tabular-nums tracking-tight">
                  {formatThousands(statusAnalysisByGerenciaAndStatus.countByCombo.SI_SI)}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  actividades únicas
                </span>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-600 flex justify-between">
              <span>Carga total:</span>
              <strong className="font-mono text-slate-900">
                {formatHours(statusAnalysisByGerenciaAndStatus.hoursByCombo.SI_SI)} h/mes
              </strong>
            </div>
          </div>

          {/* Card 2: No Digitalizado · Sí Automatizable (Oportunidad Clave) */}
          <div
            onClick={() => setTopStatusFilter(topStatusFilter === 'NO_SI' ? 'ALL' : 'NO_SI')}
            className={`border rounded-xl p-4 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
              topStatusFilter === 'NO_SI'
                ? 'bg-amber-50/90 border-amber-600 ring-2 ring-amber-500/30 shadow-sm'
                : 'bg-white border-amber-200/90 hover:border-amber-400 hover:bg-amber-50/30 shadow-2xs'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  No Digitalizado · Sí Auto
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-mono">
                  {(
                    (statusAnalysisByGerenciaAndStatus.countByCombo.NO_SI /
                      Math.max(1, statusAnalysisByGerenciaAndStatus.totalActividadesPorEstatus)) *
                    100
                  ).toFixed(1)}
                  %
                </span>
              </div>

              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-3xl font-black font-mono text-amber-950 tabular-nums tracking-tight">
                  {formatThousands(statusAnalysisByGerenciaAndStatus.countByCombo.NO_SI)}
                </span>
                <span className="text-xs font-semibold text-amber-900">
                  ¡Oportunidad Directa!
                </span>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-amber-100/70 text-[11px] text-amber-900 flex justify-between">
              <span>Horas manuales a automatizar:</span>
              <strong className="font-mono text-amber-950 font-bold">
                {formatHours(statusAnalysisByGerenciaAndStatus.manualHoursByCombo.NO_SI)} h
              </strong>
            </div>
          </div>

          {/* Card 3: No Digitalizado · No Automatizable */}
          <div
            onClick={() => setTopStatusFilter(topStatusFilter === 'NO_NO' ? 'ALL' : 'NO_NO')}
            className={`border rounded-xl p-4 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
              topStatusFilter === 'NO_NO'
                ? 'bg-rose-50/80 border-rose-600 ring-2 ring-rose-500/30 shadow-sm'
                : 'bg-white border-slate-200/90 hover:border-slate-400 hover:bg-slate-50/40 shadow-2xs'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-slate-500" />
                  No Digitalizado · No Auto
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 font-mono">
                  {(
                    (statusAnalysisByGerenciaAndStatus.countByCombo.NO_NO /
                      Math.max(1, statusAnalysisByGerenciaAndStatus.totalActividadesPorEstatus)) *
                    100
                  ).toFixed(1)}
                  %
                </span>
              </div>

              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-3xl font-black font-mono text-slate-900 tabular-nums tracking-tight">
                  {formatThousands(statusAnalysisByGerenciaAndStatus.countByCombo.NO_NO)}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  manuales estrictos
                </span>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-600 flex justify-between">
              <span>Carga manual:</span>
              <strong className="font-mono text-slate-900">
                {formatHours(statusAnalysisByGerenciaAndStatus.manualHoursByCombo.NO_NO)} h/mes
              </strong>
            </div>
          </div>

          {/* Card 4: Sí Digitalizado · No Automatizable */}
          <div
            onClick={() => setTopStatusFilter(topStatusFilter === 'SI_NO' ? 'ALL' : 'SI_NO')}
            className={`border rounded-xl p-4 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
              topStatusFilter === 'SI_NO'
                ? 'bg-emerald-50/80 border-emerald-600 ring-2 ring-emerald-500/30 shadow-sm'
                : 'bg-white border-slate-200/90 hover:border-emerald-400 hover:bg-emerald-50/30 shadow-2xs'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Sí Digitalizado · No Auto
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-mono">
                  {(
                    (statusAnalysisByGerenciaAndStatus.countByCombo.SI_NO /
                      Math.max(1, statusAnalysisByGerenciaAndStatus.totalActividadesPorEstatus)) *
                    100
                  ).toFixed(1)}
                  %
                </span>
              </div>

              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-3xl font-black font-mono text-emerald-950 tabular-nums tracking-tight">
                  {formatThousands(statusAnalysisByGerenciaAndStatus.countByCombo.SI_NO)}
                </span>
                <span className="text-xs font-semibold text-emerald-800">
                  procesos maduros
                </span>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-emerald-100 text-[11px] text-slate-600 flex justify-between">
              <span>Carga total:</span>
              <strong className="font-mono text-emerald-950">
                {formatHours(statusAnalysisByGerenciaAndStatus.hoursByCombo.SI_NO)} h/mes
              </strong>
            </div>
          </div>
        </div>

        {/* Barra de Distribución Proporcional */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between text-xs font-semibold text-slate-700">
            <span>Distribución proporcional de estatus:</span>
            <span className="font-mono text-slate-500 text-[11px]">
              {formatHours(statusAnalysisByGerenciaAndStatus.hoursByCombo.TOTAL)} h/mes consolidadas
            </span>
          </div>

          <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden flex border border-slate-300">
            <div
              style={{
                width: `${(statusAnalysisByGerenciaAndStatus.countByCombo.SI_SI / Math.max(1, statusAnalysisByGerenciaAndStatus.totalActividadesPorEstatus)) * 100}%`,
              }}
              className="bg-blue-600 h-full transition-all"
              title={`Sí Dig · Sí Auto: ${statusAnalysisByGerenciaAndStatus.countByCombo.SI_SI} actividades`}
            />
            <div
              style={{
                width: `${(statusAnalysisByGerenciaAndStatus.countByCombo.NO_SI / Math.max(1, statusAnalysisByGerenciaAndStatus.totalActividadesPorEstatus)) * 100}%`,
              }}
              className="bg-amber-400 h-full transition-all"
              title={`No Dig · Sí Auto: ${statusAnalysisByGerenciaAndStatus.countByCombo.NO_SI} actividades`}
            />
            <div
              style={{
                width: `${(statusAnalysisByGerenciaAndStatus.countByCombo.NO_NO / Math.max(1, statusAnalysisByGerenciaAndStatus.totalActividadesPorEstatus)) * 100}%`,
              }}
              className="bg-rose-400 h-full transition-all"
              title={`No Dig · No Auto: ${statusAnalysisByGerenciaAndStatus.countByCombo.NO_NO} actividades`}
            />
            <div
              style={{
                width: `${(statusAnalysisByGerenciaAndStatus.countByCombo.SI_NO / Math.max(1, statusAnalysisByGerenciaAndStatus.totalActividadesPorEstatus)) * 100}%`,
              }}
              className="bg-emerald-500 h-full transition-all"
              title={`Sí Dig · No Auto: ${statusAnalysisByGerenciaAndStatus.countByCombo.SI_NO} actividades`}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold font-mono text-slate-600 pt-1">
            <span className="text-blue-800 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              Sí/Sí: {statusAnalysisByGerenciaAndStatus.countByCombo.SI_SI} act. (
              {(
                (statusAnalysisByGerenciaAndStatus.countByCombo.SI_SI /
                  Math.max(1, statusAnalysisByGerenciaAndStatus.totalActividadesPorEstatus)) *
                100
              ).toFixed(1)}
              %)
            </span>
            <span className="text-amber-800 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              No/Sí: {statusAnalysisByGerenciaAndStatus.countByCombo.NO_SI} act. (
              {(
                (statusAnalysisByGerenciaAndStatus.countByCombo.NO_SI /
                  Math.max(1, statusAnalysisByGerenciaAndStatus.totalActividadesPorEstatus)) *
                100
              ).toFixed(1)}
              %)
            </span>
            <span className="text-rose-800 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              No/No: {statusAnalysisByGerenciaAndStatus.countByCombo.NO_NO} act. (
              {(
                (statusAnalysisByGerenciaAndStatus.countByCombo.NO_NO /
                  Math.max(1, statusAnalysisByGerenciaAndStatus.totalActividadesPorEstatus)) *
                100
              ).toFixed(1)}
              %)
            </span>
            <span className="text-emerald-800 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Sí/No: {statusAnalysisByGerenciaAndStatus.countByCombo.SI_NO} act. (
              {(
                (statusAnalysisByGerenciaAndStatus.countByCombo.SI_NO /
                  Math.max(1, statusAnalysisByGerenciaAndStatus.totalActividadesPorEstatus)) *
                100
              ).toFixed(1)}
              %)
            </span>
          </div>
        </div>

        {/* Panel de Filtros y Búsqueda Específico para esta Información */}
        <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Filtros por Botones de Estatus */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-700 mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                Filtrar Estatus:
              </span>
              <button
                type="button"
                onClick={() => setTopStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  topStatusFilter === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Todos ({statusAnalysisByGerenciaAndStatus.totalActividadesPorEstatus})
              </button>
              <button
                type="button"
                onClick={() => setTopStatusFilter('SI_SI')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  topStatusFilter === 'SI_SI'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white border border-blue-200 text-blue-900 hover:bg-blue-50'
                }`}
              >
                🔵 Sí/Sí ({statusAnalysisByGerenciaAndStatus.countByCombo.SI_SI})
              </button>
              <button
                type="button"
                onClick={() => setTopStatusFilter('NO_SI')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  topStatusFilter === 'NO_SI'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white border border-amber-200 text-amber-900 hover:bg-amber-50'
                }`}
              >
                🟡 No/Sí ({statusAnalysisByGerenciaAndStatus.countByCombo.NO_SI})
              </button>
              <button
                type="button"
                onClick={() => setTopStatusFilter('NO_NO')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  topStatusFilter === 'NO_NO'
                    ? 'bg-rose-700 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                🔴 No/No ({statusAnalysisByGerenciaAndStatus.countByCombo.NO_NO})
              </button>
              <button
                type="button"
                onClick={() => setTopStatusFilter('SI_NO')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  topStatusFilter === 'SI_NO'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-white border border-emerald-200 text-emerald-900 hover:bg-emerald-50'
                }`}
              >
                🟢 Sí/No ({statusAnalysisByGerenciaAndStatus.countByCombo.SI_NO})
              </button>
            </div>

            {/* Filtro por Coexistencia de Estatus (el caso de la imagen del usuario) */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-slate-600">Coexistencia:</span>
              <select
                value={topMultiStatusFilter}
                onChange={(e) => setTopMultiStatusFilter(e.target.value as any)}
                className="bg-white border border-slate-200 rounded-md px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="ALL">Todas las actividades</option>
                <option value="MULTI">⚠️ Con múltiples estatus en la gerencia (ej. captura)</option>
                <option value="SINGLE">✅ Con estatus único en la gerencia</option>
              </select>
            </div>
          </div>

          {/* Buscador y Controles de Orden */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 border-t border-slate-200/80">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por actividad, colaborador, proceso macro..."
                value={topSearchTerm}
                onChange={(e) => setTopSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              {topSearchTerm && (
                <button
                  type="button"
                  onClick={() => setTopSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-medium">Ordenar:</span>
                <select
                  value={topSortBy}
                  onChange={(e) => setTopSortBy(e.target.value as any)}
                  className="bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="hours">Horas Totales (Desc)</option>
                  <option value="name">Alfabético (A-Z)</option>
                  <option value="records">N° Registros (Desc)</option>
                </select>
              </div>

              <div className="h-4 w-px bg-slate-200 hidden sm:block" />
              <button
                type="button"
                onClick={expandAllTopItems}
                className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded transition-colors cursor-pointer"
              >
                Expandir
              </button>
              <button
                type="button"
                onClick={collapseAllTopItems}
                className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded transition-colors cursor-pointer"
              >
                Colapsar
              </button>
            </div>
          </div>
        </div>

        {/* Visualización de Actividades Filtradas con Subtabla Desplegable (como en la captura del usuario) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Mostrando <strong className="text-slate-900 font-mono">{sortedTopItems.length}</strong> de{' '}
              <strong className="text-slate-900 font-mono">
                {statusAnalysisByGerenciaAndStatus.totalActividadesPorEstatus}
              </strong>{' '}
              actividades únicas por gerencia y estatus
            </span>
            {topStatusFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setTopStatusFilter('ALL')}
                className="text-blue-700 hover:underline font-semibold text-xs cursor-pointer"
              >
                Quitar filtro de estatus
              </button>
            )}
          </div>

          {sortedTopItems.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500 space-y-2">
              <Info className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="font-semibold text-slate-700">No se encontraron actividades con los filtros actuales.</p>
              <button
                type="button"
                onClick={() => {
                  setTopStatusFilter('ALL');
                  setTopMultiStatusFilter('ALL');
                  setTopSearchTerm('');
                }}
                className="px-3 py-1.5 bg-blue-600 text-white font-bold rounded-lg cursor-pointer"
              >
                Restablecer filtros
              </button>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
              {sortedTopItems.map((item) => {
                const isExpanded = expandedTopItemIds.has(item.id);
                const isDig = item.digitalizado === 'SÍ';
                const isAuto = item.esAutomatizable === 'SÍ';

                return (
                  <div
                    key={item.id}
                    className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-xl overflow-hidden shadow-2xs transition-all"
                  >
                    {/* Header de la Actividad */}
                    <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200 font-mono">
                            {item.gerencia}
                          </span>

                          {/* Badge de Estatus de esta actividad */}
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              item.statusComboKey === 'SI_SI'
                                ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                : item.statusComboKey === 'NO_SI'
                                ? 'bg-amber-100 text-amber-950 border border-amber-300'
                                : item.statusComboKey === 'NO_NO'
                                ? 'bg-rose-100 text-rose-950 border border-rose-300'
                                : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            }`}
                          >
                            <span>Digitalizado: <strong>{item.digitalizado}</strong></span>
                            <span>·</span>
                            <span>Automatizable: <strong>{item.esAutomatizable}</strong></span>
                          </span>

                          {/* Alerta si coexiste con otros estatus como en la captura del usuario */}
                          {item.hasOtherStatuses && (
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200"
                              title={`Esta actividad en ${item.gerencia} también cuenta con: ${item.otherStatusesLabels.join(', ')}`}
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              Tiene {item.otherStatusesCount} estatus adicional(es) en {item.gerencia}
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                          {item.actividadProceso}
                        </h3>

                        <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
                          <span>
                            Colaborador(es):{' '}
                            <strong className="text-slate-700">
                              {item.colaboradores.join(', ') || 'Sin responsable'}
                            </strong>
                          </span>
                          {item.procesosMacro.length > 0 && (
                            <>
                              <span>·</span>
                              <span>
                                Macro:{' '}
                                <strong className="text-slate-700">
                                  {item.procesosMacro.join(', ')}
                                </strong>
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Métricas y Botón Desplegable */}
                      <div className="flex lg:flex-col items-center lg:items-end justify-between gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                        <div className="text-left lg:text-right">
                          <div className="text-xs font-bold text-slate-900">
                            <span className="font-mono text-base font-black">
                              {formatHours(item.horasTotales)}
                            </span>
                            <span className="text-slate-500 font-semibold ml-0.5">h</span>
                            <span className="text-[11px] text-slate-500 ml-1">
                              ({formatHours(item.horasManuales)}h man)
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {item.recordsCount} registro(s) en este estatus
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleExpandTopItem(item.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors cursor-pointer"
                        >
                          <span>{isExpanded ? 'Ocultar registros' : `Ver registros (${item.recordsCount})`}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Subtabla de Registros Individuales (idéntica a la captura del usuario) */}
                    {isExpanded && (
                      <div className="border-t border-slate-200 bg-slate-50/70 p-4 animate-in slide-in-from-top-1 duration-150">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-slate-500" />
                            <span>
                              Desglose de los {item.records.length} registro(s) de este estatus:
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500">
                            Colaboradores involucrados:{' '}
                            <strong className="text-slate-800">{item.colaboradores.join(', ')}</strong>
                          </span>
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                                <th className="py-2.5 px-3">Responsable Funcional</th>
                                <th className="py-2.5 px-3">Puesto</th>
                                <th className="py-2.5 px-3">Área / Sub-área</th>
                                <th className="py-2.5 px-3">Proceso Macro</th>
                                <th className="py-2.5 px-3 text-center">¿Digitalizado?</th>
                                <th className="py-2.5 px-3 text-center">¿Automatizable?</th>
                                <th className="py-2.5 px-3">Herramienta</th>
                                <th className="py-2.5 px-3 text-right">Horas Man.</th>
                                <th className="py-2.5 px-3 text-right">Horas Auto</th>
                                <th className="py-2.5 px-3 text-right">Horas Tot.</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-[11px]">
                              {item.records.map((r, rIdx) => {
                                const rowIsDig =
                                  (r.digitalizado || '').toUpperCase() === 'SÍ' ||
                                  (r.digitalizado || '').toUpperCase() === 'SI';
                                const rowIsAuto =
                                  (r.esAutomatizable || '').toUpperCase() === 'SÍ' ||
                                  (r.esAutomatizable || '').toUpperCase() === 'SI';

                                return (
                                  <tr key={rIdx} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-2 px-3 font-semibold text-slate-900 whitespace-nowrap">
                                      {r.responsableFuncional || 'No especificado'}
                                    </td>
                                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                                      {r.puesto || '-'}
                                    </td>
                                    <td className="py-2 px-3 text-slate-600">
                                      {r.areaSubArea || '-'}
                                    </td>
                                    <td className="py-2 px-3 text-slate-600">
                                      {r.procesoMacro || '-'}
                                    </td>
                                    <td className="py-2 px-3 text-center whitespace-nowrap">
                                      <span
                                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                          rowIsDig
                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                                        }`}
                                      >
                                        {r.digitalizado || 'No'}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-center whitespace-nowrap">
                                      <span
                                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                          rowIsAuto
                                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                            : 'bg-slate-200 text-slate-700 border border-slate-300'
                                        }`}
                                      >
                                        {r.esAutomatizable || 'No'}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                                      {r.herramienta || 'N/A'}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono text-slate-800 whitespace-nowrap">
                                      {formatHours(
                                        r.horasManualesTotal != null ? r.horasManualesTotal : r.horasManuales
                                      )}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono text-slate-800 whitespace-nowrap">
                                      {formatHours(r.horasMensualesAutomatizadas)}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                                      {formatHours(
                                        r.horasMensualesTotal != null
                                          ? r.horasMensualesTotal
                                          : r.horasMensualesActividad
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECCIÓN 2: AUDITORÍA DE ACTIVIDADES CON ESTATUS DISCORDANTE Y MATRIZ HISTÓRICA */}
      {/* ============================================================ */}
      {/* Header Banner de la Hoja de Trabajo */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1.5 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
              Auditoría y Homologación de Criterios
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Hoja Adicional del Tablero
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Estatus de Actividades Únicas por Gerencia
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Regla de unicidad aplicada:{' '}
            <strong className="text-slate-800">
              Las actividades se calculan de manera única por cada Gerencia
            </strong>
            . Si otra gerencia tiene una actividad con el mismo nombre, se cuenta como 2 actividades independientes (idéntico al KPI general).
            Esta vista agrupa y resalta las actividades que presentan{' '}
            <span className="bg-amber-100/70 text-amber-950 font-semibold px-1 rounded">
              estatus diferentes (Digitalizado / Automatizable)
            </span>{' '}
            entre sus registros para facilitar su homologación.
          </p>
        </div>

        {/* Botón de Exportación Excel de la Hoja */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-emerald-950 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
            title="Descargar libro Excel con el análisis de discrepancias y agrupación de estatus"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>{isExporting ? 'Generando Excel...' : 'Descargar Hoja de Estatus .xlsx'}</span>
          </button>
        </div>
      </div>

      {/* Tarjeta de Ejemplo Práctico (orientada a lo que solicitó el usuario) */}
      <div className="bg-gradient-to-r from-amber-50 via-orange-50/50 to-slate-50 border border-amber-200/90 rounded-xl p-4 shadow-2xs">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-100 text-amber-800 shrink-0 mt-0.5">
            <Info className="w-4 h-4" />
          </div>
          <div className="space-y-1.5 text-xs text-slate-700 flex-1">
            <div className="font-bold text-amber-950 flex items-center gap-2">
              <span>¿Qué discrepancias ubica esta hoja?</span>
              <span className="text-[10px] bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded-full font-mono uppercase font-semibold">
                Ejemplo Solicitado
              </span>
            </div>
            <p className="leading-relaxed">
              Detecta automáticamente cuando dentro de una misma gerencia una actividad tiene registros discordantes reportados por diferentes personas o áreas, por ejemplo:{' '}
              <span className="inline-block bg-white px-2 py-0.5 rounded border border-amber-300 text-slate-900 font-medium my-0.5">
                • Registro 1: Digitalizado NO, Automatizable SÍ
              </span>{' '}
              vs.{' '}
              <span className="inline-block bg-white px-2 py-0.5 rounded border border-amber-300 text-slate-900 font-medium my-0.5">
                • Registro 2: Digitalizado SÍ, Automatizable NO
              </span>{' '}
              vs.{' '}
              <span className="inline-block bg-white px-2 py-0.5 rounded border border-amber-300 text-slate-900 font-medium my-0.5">
                • Registro 3: Digitalizado NO, Automatizable NO
              </span>.
            </p>
          </div>
        </div>
      </div>

      {/* 6 Tarjetas de Métricas de Estatus (Dashboard Grid) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* KPI 1: Total Actividades Únicas */}
        <div
          onClick={() => setActiveCategory('ALL')}
          className={`bg-white border rounded-xl p-3.5 transition-all cursor-pointer ${
            activeCategory === 'ALL'
              ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-sm bg-blue-50/30'
              : 'border-slate-200/90 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Total Act. Únicas
          </div>
          <div className="mt-1 text-2xl font-black font-mono text-slate-900 tabular-nums">
            {formatThousands(metrics.totalUniqueActivities)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 truncate">
            {formatHours(metrics.horasTotales)} h totales
          </div>
        </div>

        {/* KPI 2: Discordantes / Diferente Estatus */}
        <div
          onClick={() => setActiveCategory('DISCORDANTE')}
          className={`bg-white border rounded-xl p-3.5 transition-all cursor-pointer relative overflow-hidden ${
            activeCategory === 'DISCORDANTE'
              ? 'border-amber-600 ring-2 ring-amber-500/30 shadow-sm bg-amber-50/40'
              : 'border-amber-300/80 hover:border-amber-400 bg-amber-50/20 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              Estatus Diferente
            </span>
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          </div>
          <div className="mt-1 text-2xl font-black font-mono text-amber-950 tabular-nums">
            {formatThousands(metrics.totalDiscordantes)}
          </div>
          <div className="mt-1 text-[11px] font-semibold text-amber-800 truncate">
            {formatHours(metrics.horasDiscordantes)} h por homologar
          </div>
        </div>

        {/* KPI 3: Digitalizado NO / Auto SÍ (Oportunidad) */}
        <div
          onClick={() => setActiveCategory('DIG_NO_AUTO_SI')}
          className={`bg-white border rounded-xl p-3.5 transition-all cursor-pointer ${
            activeCategory === 'DIG_NO_AUTO_SI'
              ? 'border-sky-600 ring-2 ring-sky-500/20 shadow-sm bg-sky-50/30'
              : 'border-slate-200/90 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="text-[10px] font-bold text-sky-800 uppercase tracking-wider">
            Dig: NO · Auto: SÍ
          </div>
          <div className="mt-1 text-2xl font-black font-mono text-sky-950 tabular-nums">
            {formatThousands(metrics.totalDigNoAutoSi)}
          </div>
          <div className="mt-1 text-[11px] text-sky-700 truncate font-medium">
            Potencial de automatización
          </div>
        </div>

        {/* KPI 4: Digitalizado SÍ · Auto NO */}
        <div
          onClick={() => setActiveCategory('DIG_SI_AUTO_NO')}
          className={`bg-white border rounded-xl p-3.5 transition-all cursor-pointer ${
            activeCategory === 'DIG_SI_AUTO_NO'
              ? 'border-emerald-600 ring-2 ring-emerald-500/20 shadow-sm bg-emerald-50/30'
              : 'border-slate-200/90 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
            Dig: SÍ · Auto: NO
          </div>
          <div className="mt-1 text-2xl font-black font-mono text-emerald-950 tabular-nums">
            {formatThousands(metrics.totalDigSiAutoNo)}
          </div>
          <div className="mt-1 text-[11px] text-emerald-700 truncate font-medium">
            Procesos maduros
          </div>
        </div>

        {/* KPI 5: Digitalizado SÍ · Auto SÍ */}
        <div
          onClick={() => setActiveCategory('DIG_SI_AUTO_SI')}
          className={`bg-white border rounded-xl p-3.5 transition-all cursor-pointer ${
            activeCategory === 'DIG_SI_AUTO_SI'
              ? 'border-indigo-600 ring-2 ring-indigo-500/20 shadow-sm bg-indigo-50/30'
              : 'border-slate-200/90 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider">
            Dig: SÍ · Auto: SÍ
          </div>
          <div className="mt-1 text-2xl font-black font-mono text-indigo-950 tabular-nums">
            {formatThousands(metrics.totalDigSiAutoSi)}
          </div>
          <div className="mt-1 text-[11px] text-indigo-700 truncate font-medium">
            Auto avanzada
          </div>
        </div>

        {/* KPI 6: Digitalizado NO · Auto NO */}
        <div
          onClick={() => setActiveCategory('DIG_NO_AUTO_NO')}
          className={`bg-white border rounded-xl p-3.5 transition-all cursor-pointer ${
            activeCategory === 'DIG_NO_AUTO_NO'
              ? 'border-slate-600 ring-2 ring-slate-500/20 shadow-sm bg-slate-100/50'
              : 'border-slate-200/90 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
            Dig: NO · Auto: NO
          </div>
          <div className="mt-1 text-2xl font-black font-mono text-slate-800 tabular-nums">
            {formatThousands(metrics.totalDigNoAutoNo)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 truncate font-medium">
            Manuales puros
          </div>
        </div>
      </div>

      {/* Barra de Filtros, Búsqueda y Navegación de Categorías */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
        {/* Tabs de Filtro de Categoría */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
          <button
            type="button"
            onClick={() => setActiveCategory('DISCORDANTE')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeCategory === 'DISCORDANTE'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>⚠️ Estatus Discordante / Diferente</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeCategory === 'DISCORDANTE' ? 'bg-white text-amber-900' : 'bg-amber-200 text-amber-900'
            }`}>
              {metrics.totalDiscordantes}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('ALL')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeCategory === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>Todas las Actividades</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-200 text-slate-800">
              {metrics.totalUniqueActivities}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('DIG_NO_AUTO_SI')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeCategory === 'DIG_NO_AUTO_SI'
                ? 'bg-sky-700 text-white shadow-xs'
                : 'bg-sky-50 text-sky-900 border border-sky-200 hover:bg-sky-100'
            }`}
          >
            <span>🟡 No Dig / Auto Sí</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-sky-200 text-sky-900">
              {metrics.totalDigNoAutoSi}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('DIG_SI_AUTO_NO')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeCategory === 'DIG_SI_AUTO_NO'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <span>🟢 Dig Sí / Auto No</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-200 text-emerald-900">
              {metrics.totalDigSiAutoNo}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('DIG_SI_AUTO_SI')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeCategory === 'DIG_SI_AUTO_SI'
                ? 'bg-indigo-700 text-white shadow-xs'
                : 'bg-indigo-50 text-indigo-900 border border-indigo-200 hover:bg-indigo-100'
            }`}
          >
            <span>🔵 Dig Sí / Auto Sí</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-indigo-200 text-indigo-900">
              {metrics.totalDigSiAutoSi}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('DIG_NO_AUTO_NO')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeCategory === 'DIG_NO_AUTO_NO'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>🔴 No Dig / Auto No</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-200 text-slate-800">
              {metrics.totalDigNoAutoNo}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('CROSS_GERENCIA')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ml-auto ${
              activeCategory === 'CROSS_GERENCIA'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100'
            }`}
            title="Comparar actividades que comparten nombre entre diferentes gerencias"
          >
            <span>🌐 Comparativa Cross-Gerencia</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-purple-200 text-purple-900">
              {crossGerenciaGroups.length}
            </span>
          </button>
        </div>

        {/* Barra de Filtro de Texto, Ordenamiento y Switch de Vista */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex-1 flex items-center gap-3">
            {/* Buscador */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por actividad, responsable, macro..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Selector de Gerencia */}
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
              <label htmlFor="filter-gerencia" className="font-semibold text-slate-600 whitespace-nowrap">
                Gerencia:
              </label>
              <select
                id="filter-gerencia"
                value={selectedGerencia}
                onChange={(e) => onSelectGerencia(e.target.value)}
                className="bg-transparent font-bold text-blue-950 focus:outline-none cursor-pointer"
              >
                <option value="ALL">Todas las Gerencias</option>
                {allGerencias.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Opciones de Ordenamiento y Expansión */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-medium">Ordenar:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="discrepancy">Variantes / Discrepancias</option>
                <option value="hours">Horas Totales (Desc)</option>
                <option value="records">N° Registros (Desc)</option>
                <option value="name">Alfabético (A-Z)</option>
              </select>
            </div>

            {activeCategory !== 'CROSS_GERENCIA' && (
              <>
                <div className="h-4 w-px bg-slate-200 hidden sm:block" />
                <button
                  type="button"
                  onClick={expandAll}
                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                >
                  Expandir todo
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                >
                  Colapsar todo
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* SECCIÓN PRINCIPAL: Si estamos en modo CROSS_GERENCIA, mostrar la matriz comparativa entre gerencias */}
      {activeCategory === 'CROSS_GERENCIA' ? (
        <div className="space-y-4">
          <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-4 text-xs text-purple-900 space-y-1">
            <strong className="font-bold block text-purple-950">
              Comparativa de Actividades Compartidas entre Gerencias
            </strong>
            <p>
              Muestra aquellas actividades que poseen el mismo nombre en 2 o más gerencias. Siguiendo la regla de unicidad del tablero, cada una cuenta como una actividad única por gerencia.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {crossGerenciaGroups.map((group, idx) => (
              <div
                key={idx}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                      Compartida en {group.totalGerencias} Gerencias
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-1">
                      {group.actividadNombre}
                    </h3>
                  </div>
                  {group.hasCrossDiscrepancy ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                      Criterios diferentes entre gerencias
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                      Criterios homogéneos
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.gerenciasList.map((g, gIdx) => (
                    <div
                      key={gIdx}
                      className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <strong className="text-slate-900 font-bold">{g.gerencia}</strong>
                        <span className="font-mono text-slate-500 text-[11px]">
                          {g.totalRecords} reg.
                        </span>
                      </div>
                      <div className="space-y-1">
                        {g.variants.map((v, vIdx) => (
                          <div
                            key={vIdx}
                            className={`p-1.5 rounded border text-[11px] flex items-center justify-between ${
                              v.digitalizado === 'SÍ'
                                ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                                : 'bg-amber-50/60 border-amber-200 text-amber-950'
                            }`}
                          >
                            <span>{v.statusLabel}</span>
                            <span className="font-mono font-bold">{v.count} reg</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* SECCIÓN PRINCIPAL: Tarjetas de Actividades Únicas por Gerencia */
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Mostrando <strong className="text-slate-900 font-mono">{sortedItems.length}</strong> de{' '}
              <strong className="text-slate-900 font-mono">{items.length}</strong> actividades únicas
              {selectedGerencia !== 'ALL' && ` en ${selectedGerencia}`}
            </span>
            {activeCategory === 'DISCORDANTE' && (
              <span className="text-amber-800 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {metrics.totalDiscordantes} actividades requieren homologación de estatus
              </span>
            )}
          </div>

          {sortedItems.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">
                No se encontraron actividades con los filtros actuales
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {activeCategory === 'DISCORDANTE'
                  ? 'No hay actividades con estatus discordante para la gerencia seleccionada.'
                  : 'Prueba cambiando los términos de búsqueda o seleccionando otra gerencia.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveCategory('ALL');
                  setSearchTerm('');
                }}
                className="px-4 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 cursor-pointer"
              >
                Ver todas las actividades
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedItems.map((item) => {
                const isExpanded = expandedActivityIds.has(item.id);

                return (
                  <div
                    key={item.id}
                    className={`bg-white border rounded-xl overflow-hidden transition-all shadow-2xs hover:shadow-xs ${
                      item.hasDiscrepancy
                        ? 'border-amber-300 ring-1 ring-amber-400/30'
                        : 'border-slate-200/90'
                    }`}
                  >
                    {/* Header de la Tarjeta */}
                    <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="space-y-2 flex-1 min-w-0">
                        {/* Badges de Gerencia y Discrepancia */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200 font-mono">
                            {item.gerencia}
                          </span>

                          {item.procesosMacro.length > 0 && (
                            <span className="text-[11px] font-medium text-slate-500">
                              Macro:{' '}
                              <strong className="text-slate-700">
                                {item.procesosMacro.slice(0, 2).join(', ')}
                                {item.procesosMacro.length > 2 ? ` (+${item.procesosMacro.length - 2})` : ''}
                              </strong>
                            </span>
                          )}

                          {item.hasDiscrepancy ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-in fade-in">
                              <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                              ⚠️ Estatus Discordante ({item.variants.length} variantes distintas)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              <Check className="w-3 h-3 text-slate-500 shrink-0" />
                              Estatus Homogéneo
                            </span>
                          )}
                        </div>

                        {/* Nombre de la Actividad */}
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug break-words">
                          {item.actividadProceso}
                        </h3>

                        {/* Desglose visual de variantes de estatus encontradas */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span className="text-xs font-semibold text-slate-500">
                            {item.hasDiscrepancy ? 'Variaciones detectadas:' : 'Estatus:'}
                          </span>
                          {item.variants.map((v, vIdx) => {
                            const isAuto = v.esAutomatizable === 'SÍ';
                            const isDig = v.digitalizado === 'SÍ';

                            return (
                              <div
                                key={vIdx}
                                className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-semibold border ${
                                  item.hasDiscrepancy
                                    ? isAuto && !isDig
                                      ? 'bg-amber-50 border-amber-300 text-amber-950 font-bold'
                                      : isDig && !isAuto
                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                                      : 'bg-slate-50 border-slate-300 text-slate-900 font-bold'
                                    : isDig
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                                    : isAuto
                                    ? 'bg-blue-50 border-blue-300 text-blue-950'
                                    : 'bg-slate-50 border-slate-200 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-1.5">
                                  <span>Digitalizado: <strong className={isDig ? 'text-emerald-700' : 'text-rose-700'}>{v.digitalizado}</strong></span>
                                  <span>·</span>
                                  <span>Automatizable: <strong className={isAuto ? 'text-blue-700' : 'text-slate-700'}>{v.esAutomatizable}</strong></span>
                                </div>
                                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-black/5">
                                  {v.count} reg · {formatHours(v.horasTotales)} h
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Métricas Resumen y Botón de Desglose */}
                      <div className="flex lg:flex-col items-center lg:items-end justify-between gap-3 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                        <div className="text-left lg:text-right space-y-0.5">
                          <div className="text-xs font-bold text-slate-900">
                            <span className="font-mono text-base font-black">{formatHours(item.horasTotales)}</span>
                            <span className="text-slate-500 font-semibold ml-0.5">h/mes</span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {item.totalRecords} fila(s) · {item.totalColaboradores} colaborador(es)
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleExpand(item.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors cursor-pointer"
                        >
                          <span>{isExpanded ? 'Ocultar registros' : 'Ver detalle de registros'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Sub-tabla Desplegable con Todos los Registros Individuales */}
                    {isExpanded && (
                      <div className="border-t border-slate-200 bg-slate-50/70 p-4 animate-in slide-in-from-top-1 duration-150">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-slate-500" />
                            <span>Desglose de los {item.allRecords.length} registros individuales reportados:</span>
                          </div>
                          <span className="text-[11px] text-slate-500">
                            Colaboradores involucrados: <strong className="text-slate-800">{item.colaboradores.join(', ')}</strong>
                          </span>
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                                <th className="py-2.5 px-3">Responsable Funcional</th>
                                <th className="py-2.5 px-3">Puesto</th>
                                <th className="py-2.5 px-3">Área / Sub-área</th>
                                <th className="py-2.5 px-3">Proceso Macro</th>
                                <th className="py-2.5 px-3 text-center">¿Digitalizado?</th>
                                <th className="py-2.5 px-3 text-center">¿Automatizable?</th>
                                <th className="py-2.5 px-3">Herramienta</th>
                                <th className="py-2.5 px-3 text-right">Horas Man.</th>
                                <th className="py-2.5 px-3 text-right">Horas Auto</th>
                                <th className="py-2.5 px-3 text-right">Horas Tot.</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-[11px]">
                              {item.allRecords.map((r, rIdx) => {
                                const isDig = (r.digitalizado || '').toUpperCase() === 'SÍ' || (r.digitalizado || '').toUpperCase() === 'SI';
                                const isAuto = (r.esAutomatizable || '').toUpperCase() === 'SÍ' || (r.esAutomatizable || '').toUpperCase() === 'SI';

                                return (
                                  <tr key={rIdx} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-2 px-3 font-semibold text-slate-900 whitespace-nowrap">
                                      {r.responsableFuncional || 'No especificado'}
                                    </td>
                                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                                      {r.puesto || '-'}
                                    </td>
                                    <td className="py-2 px-3 text-slate-600">
                                      {r.areaSubArea || '-'}
                                    </td>
                                    <td className="py-2 px-3 text-slate-600">
                                      {r.procesoMacro || '-'}
                                    </td>
                                    <td className="py-2 px-3 text-center whitespace-nowrap">
                                      <span
                                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                          isDig
                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                                        }`}
                                      >
                                        {r.digitalizado || 'No'}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-center whitespace-nowrap">
                                      <span
                                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                          isAuto
                                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                            : 'bg-slate-200 text-slate-700 border border-slate-300'
                                        }`}
                                      >
                                        {r.esAutomatizable || 'No'}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                                      {r.herramienta || 'N/A'}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono text-slate-800 whitespace-nowrap">
                                      {formatHours(r.horasManualesTotal != null ? r.horasManualesTotal : r.horasManuales)}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono text-slate-800 whitespace-nowrap">
                                      {formatHours(r.horasMensualesAutomatizadas)}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                                      {formatHours(r.horasMensualesTotal != null ? r.horasMensualesTotal : r.horasMensualesActividad)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

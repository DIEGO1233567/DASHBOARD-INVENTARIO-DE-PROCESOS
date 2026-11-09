import React, { useState, useMemo, useCallback } from 'react';
import {
  Briefcase,
  Users,
  Clock,
  Sparkles,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Filter,
  Search,
  FileSpreadsheet,
  RotateCcw,
  PlusCircle,
  Trash2,
  ShieldAlert,
  Zap,
  TrendingUp,
  BarChart3,
  Layers,
  ChevronDown,
  ChevronUp,
  Info,
  Check,
  UserCheck,
  Building2,
  ArrowRight,
  ExternalLink,
  X,
  ArrowUpDown,
  CheckSquare,
  Square,
  SlidersHorizontal,
  Target,
  Award,
  Plus,
  Minus,
  FileText,
  Wrench,
} from 'lucide-react';
import { ProcessRecord } from '../types/sheets';
import {
  computeActivitiesByGerenciaAndStatus,
  computeUniqueActivitiesStatusList,
  UniqueActivityItem,
  ActivityByGerenciaAndStatusItem,
} from '../utils/activityStatusParser';
import { computeGerenciaSummaries, formatHours, formatThousands } from '../utils/sheetsParser';
import {
  PlanCollaborator,
  PlanActivity,
  PlanScenarioConfig,
  exportWorkPlanSimulationXlsx,
} from '../utils/workPlanExport';

export const BASE_PLAN_START_YEAR = 2027;

/**
 * Maps sequential plan year index (1, 2, 3...) to calendar years (2027, 2028, 2029...)
 */
export function toCalendarYear(assignedYearNum: number): number {
  return 2026 + assignedYearNum;
}

export function toCalendarYearLabel(assignedYearNum: number): string {
  return `${toCalendarYear(assignedYearNum)}`;
}

export function formatActivityCount(val: number): string {
  if (val == null || isNaN(val)) return '0';
  if (Number.isInteger(val)) return val.toString();
  return Number(val.toFixed(1)).toString();
}

interface WorkPlanSimulationSheetProps {
  records: ProcessRecord[];
  allGerencias: string[];
}

interface TeamMemberDraft {
  id: string;
  name: string;
  role: 'Jefe Sr' | 'Jefe' | 'Becario' | 'Especialista';
  isVacancy: boolean;
  isNominaExclusive: boolean;
  monthlyCapacity: number;
  customMaxCapacity?: number;
}

// Initial 15 team members according to Liverpool Eficiencia de Procesos specification
const INITIAL_TEAM: TeamMemberDraft[] = [
  // 3 Jefes (2 Jefe Sr + 1 Jefe, capacidad máx 1/mes)
  {
    id: 'jefe-sr-zyanya-velasco',
    name: 'Zyanya Daniela Velasco Ramirez',
    role: 'Jefe Sr',
    isVacancy: false,
    isNominaExclusive: false,
    monthlyCapacity: 1,
  },
  {
    id: 'jefe-sr-diego-martinez',
    name: 'Diego Armando Martínez Patiño',
    role: 'Jefe Sr',
    isVacancy: false,
    isNominaExclusive: false,
    monthlyCapacity: 1,
  },
  {
    id: 'jefe-alexis-ramirez',
    name: 'Alexis Ramírez Sanchez',
    role: 'Jefe',
    isVacancy: false,
    isNominaExclusive: false,
    monthlyCapacity: 1,
  },
  // 3 Becarios (capacidad máx 1/mes)
  {
    id: 'becario-diego-velez',
    name: 'Diego Velez Villaluz',
    role: 'Becario',
    isVacancy: false,
    isNominaExclusive: false,
    monthlyCapacity: 1,
  },
  {
    id: 'becario-ximena-muniz',
    name: 'Ximena Yael Muñiz Huerta',
    role: 'Becario',
    isVacancy: false,
    isNominaExclusive: false,
    monthlyCapacity: 1,
  },
  {
    id: 'becario-rey-j',
    name: 'Rey J',
    role: 'Becario',
    isVacancy: false,
    isNominaExclusive: false,
    monthlyCapacity: 1,
  },
  // 9 Especialistas (Daniel Garcia Velazquez exclusivo para Nómina)
  {
    id: 'esp-daniel-garcia',
    name: 'Daniel Garcia Velazquez',
    role: 'Especialista',
    isVacancy: false,
    isNominaExclusive: true, // EXCLUSIVO PARA NÓMINA
    monthlyCapacity: 1.5,
  },
  {
    id: 'esp-maia-ramirez',
    name: 'Maia Scarlett Ramírez Curiel',
    role: 'Especialista',
    isVacancy: false,
    isNominaExclusive: false,
    monthlyCapacity: 1.5,
  },
  {
    id: 'esp-uriel-sanchez',
    name: 'Uriel Sanchez Lopez',
    role: 'Especialista',
    isVacancy: false,
    isNominaExclusive: false,
    monthlyCapacity: 1.5,
  },
  {
    id: 'esp-david-chavez',
    name: 'David Chávez Muñiz',
    role: 'Especialista',
    isVacancy: false,
    isNominaExclusive: false,
    monthlyCapacity: 1.5,
  },
  {
    id: 'esp-oscar-bucio',
    name: 'Oscar Andres Bucio Cruz',
    role: 'Especialista',
    isVacancy: false,
    isNominaExclusive: false,
    monthlyCapacity: 1.5,
  },
  {
    id: 'esp-angel-castaneda',
    name: 'Angel Humberto Castañeda Huerta',
    role: 'Especialista',
    isVacancy: false,
    isNominaExclusive: false,
    monthlyCapacity: 1.5,
  },
  {
    id: 'esp-ericka-velazquez',
    name: 'Ericka Itzel Velazquez Fonseca',
    role: 'Especialista',
    isVacancy: false,
    isNominaExclusive: false,
    monthlyCapacity: 1.5,
  },
  {
    id: 'esp-ana-vazquez',
    name: 'Ana Catherine Vazquez Diaz',
    role: 'Especialista',
    isVacancy: false,
    isNominaExclusive: false,
    monthlyCapacity: 1.5,
  },
  {
    id: 'esp-karen-rivera',
    name: 'Karen Lizzeth Rivera Cid',
    role: 'Especialista',
    isVacancy: false,
    isNominaExclusive: false,
    monthlyCapacity: 1.5,
  },
];

export function WorkPlanSimulationSheet({ records, allGerencias }: WorkPlanSimulationSheetProps) {
  // --------------------------------------------------------------------------
  // ESCENARIOS Y PARÁMETROS INTERACTIVOS
  // --------------------------------------------------------------------------
  const [horizonYears, setHorizonYears] = useState<number>(3); // 1 a 5 años (default 3)
  const [jefeCapacityRate, setJefeCapacityRate] = useState<number>(1.0); // max 1/mes
  const [becarioCapacityRate, setBecarioCapacityRate] = useState<number>(1.0); // max 1/mes
  const [especialistaCapacityRate, setEspecialistaCapacityRate] = useState<number>(1.5); // act/mes
  const [includeNoAutoActivities, setIncludeNoAutoActivities] = useState<boolean>(true); // Opción dinámica para activar / desactivar
  const [pctNoAutoThreshold, setPctNoAutoThreshold] = useState<number>(20); // 20% default sobre total Hoja 2
  const [anualRequerimientos, setAnualRequerimientos] = useState<number>(10); // 10/año
  const [anualMantenimientos, setAnualMantenimientos] = useState<number>(25); // 25/año
  const [levelingTargetPct, setLevelingTargetPct] = useState<number>(80); // Meta reglamentaria de nivelación por gerencia (80%)
  const [showLevelingBreakdown, setShowLevelingBreakdown] = useState<boolean>(false); // Oculta por default para desplegar bajo demanda
  const [teamMembers, setTeamMembers] = useState<TeamMemberDraft[]>(INITIAL_TEAM);
  const [manualReassignments, setManualReassignments] = useState<Record<string, string>>({});
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [showScenarioDrawer, setShowScenarioDrawer] = useState<boolean>(false);

  // Filtros de tabla tipo Excel en encabezados
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [openHeaderFilter, setOpenHeaderFilter] = useState<string | null>(null);
  const [filterYears, setFilterYears] = useState<number[]>([]); // Vacío = Todos los años (2027, 2028, etc.)
  const [filterGerencias, setFilterGerencias] = useState<string[]>([]); // Vacío = Todas
  const [filterTipos, setFilterTipos] = useState<string[]>([]); // Vacío = Todos
  const [filterColaboradores, setFilterColaboradores] = useState<string[]>([]); // Vacío = Todos
  const [filterColabRoles, setFilterColabRoles] = useState<string[]>([]); // Vacío = Todos
  const [filterHoursRange, setFilterHoursRange] = useState<'ALL' | 'POR_DEFINIR' | 'CON_HORAS' | 'GT_30' | 'GT_60'>('ALL');
  const [filterSortPrio, setFilterSortPrio] = useState<'ASC' | 'DESC'>('ASC');
  const [columnSearchGerencia, setColumnSearchGerencia] = useState<string>('');
  const [columnSearchColab, setColumnSearchColab] = useState<string>('');
  const [pageSize, setPageSize] = useState<number | 'ALL'>(100);

  const [activeTab, setActiveTab] = useState<'colaboradores' | 'actividades' | 'cronograma'>('colaboradores');

  // Estado para desplegar actividades asignadas por colaborador en la matriz
  const [expandedCollabIds, setExpandedCollabIds] = useState<Set<string>>(new Set());

  const toggleCollabExpand = useCallback((id: string) => {
    setExpandedCollabIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expandAllCollabs = useCallback(() => {
    setExpandedCollabIds(new Set(teamMembers.map((m) => m.id)));
  }, [teamMembers]);

  const collapseAllCollabs = useCallback(() => {
    setExpandedCollabIds(new Set());
  }, []);

  const totalMonths = horizonYears * 12;

  // Resumen oficial de Gerencias de la Hoja 1 (para obtener el % de automatización inicial de cada gerencia)
  const gerenciaSummaries = useMemo(() => {
    return computeGerenciaSummaries(records);
  }, [records]);

  // --------------------------------------------------------------------------
  // 1. OBTENCIÓN Y DETERMINACIÓN EXACTA DE ACTIVIDADES SEGÚN HOJA 2
  // --------------------------------------------------------------------------
  const hoja2StatusAnalysis = useMemo(() => {
    return computeActivitiesByGerenciaAndStatus(records, 'ALL');
  }, [records]);

  // Base seleccionable para el cálculo del 20% de actividades totales de la Hoja 2:
  // - 'STATUS_TOTAL': Total actividades determinadas por estatus en Hoja 2 (métrica oficial Hoja 2)
  // - 'RECORDS_TOTAL': Total registros de actividades del inventario evaluado (ej. 1,990 actividades)
  // - 'BASE_UNIQUE': Total actividades base únicas por gerencia
  const [hoja2CalculationBase, setHoja2CalculationBase] = useState<'STATUS_TOTAL' | 'RECORDS_TOTAL' | 'BASE_UNIQUE'>('STATUS_TOTAL');

  // Total de actividades de referencia de la Hoja 2
  const totalHoja2Activities = useMemo(() => {
    if (hoja2CalculationBase === 'RECORDS_TOTAL') {
      return records.length;
    }
    if (hoja2CalculationBase === 'BASE_UNIQUE') {
      return hoja2StatusAnalysis.totalActividadesBase;
    }
    return hoja2StatusAnalysis.totalActividadesPorEstatus;
  }, [hoja2CalculationBase, hoja2StatusAnalysis, records.length]);

  // Selección de actividades candidatas
  const candidateActivities = useMemo(() => {
    // 1. No digitalizadas SÍ automatizables (100% de las identificadas en la Hoja 2 - Cuadrante NO_SI)
    // Se ordenan por horas manuales mensuales descendente (mayor impacto primero)
    const noDigSiAuto = hoja2StatusAnalysis.items
      .filter((item) => item.statusComboKey === 'NO_SI')
      .map((item) => ({
        id: item.id,
        actividadProceso: item.actividadProceso,
        gerencia: item.gerencia,
        horasManuales: item.horasManuales,
        horasTotales: item.horasTotales,
        colaboradores: item.colaboradores,
        isNomina: item.gerencia.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes('nomina'),
      }))
      .sort((a, b) => b.horasManuales - a.horasManuales || b.horasTotales - a.horasTotales);

    // 2. Pool de No digitalizadas NO automatizables (identificadas en la Hoja 2 - Cuadrante NO_NO)
    const noDigNoAutoPool = hoja2StatusAnalysis.items
      .filter((item) => item.statusComboKey === 'NO_NO')
      .map((item) => ({
        id: item.id,
        actividadProceso: item.actividadProceso,
        gerencia: item.gerencia,
        horasManuales: item.horasManuales,
        horasTotales: item.horasTotales,
        colaboradores: item.colaboradores,
        isNomina: item.gerencia.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes('nomina'),
      }))
      .sort((a, b) => b.horasManuales - a.horasManuales || b.horasTotales - a.horasTotales);

    // Cantidad exacta a tomar de No/No: debe representar el pctNoAutoThreshold% (ej. 20%)
    // de las ACTIVIDADES TOTALES DETERMINADAS DE LA HOJA 2
    const targetNoNoCount = includeNoAutoActivities
      ? Math.max(0, Math.round((totalHoja2Activities * pctNoAutoThreshold) / 100))
      : 0;

    // Generar exactamente targetNoNoCount actividades [Por Definir]
    const noDigNoAutoSelected: Array<{
      id: string;
      actividadProceso: string;
      gerencia: string;
      horasManuales: number;
      horasTotales: number;
      isNomina: boolean;
    }> = [];

    for (let i = 0; i < targetNoNoCount; i++) {
      if (i < noDigNoAutoPool.length) {
        const item = noDigNoAutoPool[i];
        noDigNoAutoSelected.push({
          id: item.id,
          actividadProceso: item.actividadProceso,
          gerencia: item.gerencia,
          horasManuales: item.horasManuales,
          horasTotales: item.horasTotales,
          isNomina: item.isNomina,
        });
      } else {
        const gerencia = allGerencias.length > 0 ? allGerencias[i % allGerencias.length] : 'General';
        const isNomina = gerencia.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes('nomina');
        noDigNoAutoSelected.push({
          id: `POR_DEFINIR_EXTRA_${i + 1}`,
          actividadProceso: `Actividad No Dig. / No Auto. #${i + 1}`,
          gerencia,
          horasManuales: 0,
          horasTotales: 0,
          isNomina,
        });
      }
    }

    return {
      noDigSiAuto,
      noDigNoAutoSelected,
      noDigNoAutoPool,
      totalInventoryCandidates: noDigSiAuto.length + noDigNoAutoSelected.length,
      totalHoja2Activities,
      targetNoNoCount,
    };
  }, [hoja2StatusAnalysis, totalHoja2Activities, pctNoAutoThreshold, includeNoAutoActivities, allGerencias]);

  // Métricas de Requerimientos y Mantenimientos proyectados para el horizonte
  const operationalActivities = useMemo(() => {
    const totalReqs = anualRequerimientos * horizonYears;
    const totalMants = anualMantenimientos * horizonYears;
    return { totalReqs, totalMants, totalOpsCount: totalReqs + totalMants };
  }, [anualRequerimientos, anualMantenimientos, horizonYears]);

  // --------------------------------------------------------------------------
  // 2. MOTOR DE ASIGNACIÓN Y DISTRIBUCIÓN PROPORCIONAL
  // --------------------------------------------------------------------------
  const { planActivities, collaboratorsSummary, planMetrics } = useMemo(() => {
    // Lista de colaboradores activos con sus capacidades actualizadas por los sliders
    const collabs: PlanCollaborator[] = teamMembers.map((m) => {
      let capRate = m.monthlyCapacity;
      if (m.role === 'Jefe Sr' || m.role === 'Jefe') {
        capRate = jefeCapacityRate;
      } else if (m.role === 'Becario') {
        capRate = becarioCapacityRate;
      } else if (m.role === 'Especialista') {
        capRate = especialistaCapacityRate;
      }

      const totalCap = Math.round(capRate * totalMonths);
      return {
        id: m.id,
        name: m.name,
        role: m.role,
        isVacancy: m.isVacancy,
        isNominaExclusive: m.isNominaExclusive,
        monthlyCapacity: capRate,
        totalCapacity: totalCap,
        assignedCount: 0,
        assignedHours: 0,
        gerenciasCovered: [],
      };
    });

    const collabMap = new Map<string, PlanCollaborator>(collabs.map((c) => [c.id, c]));

    // Recursos con capacidad activa (> 0)
    const activeCollabs = collabs.filter((c) => c.monthlyCapacity > 0);
    const totalRecursosActivos = activeCollabs.length;
    const reqSharePerYear = totalRecursosActivos > 0 ? anualRequerimientos / totalRecursosActivos : 0;
    const mantSharePerYear = totalRecursosActivos > 0 ? anualMantenimientos / totalRecursosActivos : 0;

    // Identificar a Daniel García Velázquez (ÚNICO autorizado para Nómina)
    const danielCollab = collabs.find((c) => c.isNominaExclusive) || collabs[0];

    // --------------------------------------------------------------------------
    // REGLA SOLICITADA DE PRIORIZACIÓN POR NIVELACIÓN DE GERENCIAS (META 80%):
    // 1. Obtener el % de automatización inicial de cada gerencia (de la Hoja 1).
    // 2. Dar prioridad a las gerencias con menor porcentaje de automatización.
    // 3. Dentro de cada gerencia, ordenar sus actividades de mayor a menor horas.
    // 4. Una vez que el % de automatización simulado de la gerencia alcance el 80%
    //    (o agote sus actividades automatizables), avanzar a las gerencias siguientes.
    // 5. Las actividades restantes de gerencias que superaron o iniciaron con >= 80%
    //    se atienden en la fase de consolidación.
    // --------------------------------------------------------------------------

    // Mapa de horas No Digitalizadas Sí Automatizables por gerencia
    const noDigSiHoursMap = new Map<string, number>();
    for (const act of candidateActivities.noDigSiAuto) {
      const gKey = act.gerencia.trim().toLowerCase();
      noDigSiHoursMap.set(gKey, (noDigSiHoursMap.get(gKey) || 0) + act.horasManuales);
    }

    // Mapa de estadísticas de cada gerencia tomadas de la Hoja 1 y del inventario:
    // - REGLA 1 (Meta 80% Nivelación): Base 100% de automatización = horasAutomatizadas + horasNoDigitalizadasSiAutomatizables
    // - REGLA 2 (Porcentaje Proyectado Global): Base 100% = suma total de las horas de actividades de la gerencia (horasTotales)
    const gerenciaStatsMap = new Map<string, {
      gerencia: string;
      totalHours: number;
      autoHours: number;
      noDigSiAutoHours: number;
      horasAutomatizables100: number;
      initialAvancePct: number;
      initialGlobalPct: number;
      simAutoHours: number;
    }>();

    for (const s of gerenciaSummaries) {
      const gNorm = s.gerencia.trim();
      const gKey = gNorm.toLowerCase();
      const noDigSiHours = noDigSiHoursMap.get(gKey) ?? Math.min(s.horasManuales, Math.max(0, s.horasPotencialAutomatizable || 0));
      const horasAutomatizables100 = s.horasAutomatizadas + noDigSiHours;
      const initialAvancePct = horasAutomatizables100 > 0
        ? Number(((s.horasAutomatizadas / horasAutomatizables100) * 100).toFixed(1))
        : 100;
      const initialGlobalPct = s.horasTotales > 0
        ? Number(((s.horasAutomatizadas / s.horasTotales) * 100).toFixed(1))
        : 0;

      gerenciaStatsMap.set(gNorm, {
        gerencia: gNorm,
        totalHours: s.horasTotales,
        autoHours: s.horasAutomatizadas,
        noDigSiAutoHours: noDigSiHours,
        horasAutomatizables100: horasAutomatizables100 > 0 ? horasAutomatizables100 : (s.horasTotales || 1),
        initialAvancePct,
        initialGlobalPct,
        simAutoHours: s.horasAutomatizadas,
      });
    }

    const getGerenciaInitialAvancePct = (gName: string) => {
      const stat = gerenciaStatsMap.get(gName.trim());
      return stat ? stat.initialAvancePct : 50;
    };

    // Agrupar No Digitalizadas Sí Automatizables por Gerencia
    // y ordenar dentro de cada gerencia de mayor a menor horas
    const siAutoByGerencia = new Map<string, typeof candidateActivities.noDigSiAuto>();
    for (const act of candidateActivities.noDigSiAuto) {
      const g = act.gerencia.trim();
      if (!siAutoByGerencia.has(g)) {
        siAutoByGerencia.set(g, []);
      }
      siAutoByGerencia.get(g)!.push(act);
    }
    for (const acts of siAutoByGerencia.values()) {
      acts.sort((a, b) => b.horasManuales - a.horasManuales || b.horasTotales - a.horasTotales);
    }

    // Gerencias presentes en las actividades, ordenadas por menor avance inicial en lo automatizable
    // (prioridad a las gerencias con menor % de avance sobre horas automatizadas + no dig sí auto)
    const sortedGerenciaNames = Array.from(siAutoByGerencia.keys()).sort((a, b) => {
      return getGerenciaInitialAvancePct(a) - getGerenciaInitialAvancePct(b);
    });

    // Clasificar las actividades de cada gerencia identificando cuáles pertenecen al Tier 1 (Nivelación < 80%)
    // y cuáles al Tier 2 (Consolidación >= 80%), considerando como 100% las horas automatizables.
    type ClassifiedItem = {
      act: (typeof candidateActivities.noDigSiAuto)[0];
      gerenciaInitialPct: number;
      gerenciaInitialGlobalPct: number;
      gerenciaSimPct: number;
      gerenciaSimGlobalPct: number;
      levelingTier: 'NIVELACION_SUB_80' | 'CONSOLIDACION_SUPER_80';
    };

    const classifiedByGerencia = new Map<string, ClassifiedItem[]>();

    for (const gName of sortedGerenciaNames) {
      const acts = siAutoByGerencia.get(gName) || [];
      const gStat = gerenciaStatsMap.get(gName) || {
        gerencia: gName,
        totalHours: acts.reduce((acc, a) => acc + a.horasTotales, 0) || 100,
        autoHours: 0,
        noDigSiAutoHours: acts.reduce((acc, a) => acc + a.horasManuales, 0) || 100,
        horasAutomatizables100: acts.reduce((acc, a) => acc + a.horasManuales, 0) || 100,
        initialAvancePct: 0,
        initialGlobalPct: 0,
        simAutoHours: 0,
      };

      const classifiedList: ClassifiedItem[] = [];

      for (const act of acts) {
        // Avance sobre el 100% automatizable (Horas auto + No dig sí auto)
        const currentSimAvancePct = gStat.horasAutomatizables100 > 0
          ? (gStat.simAutoHours / gStat.horasAutomatizables100) * 100
          : 100;

        // Porcentaje proyectado global sobre la suma total de horas de actividades de la gerencia
        const currentSimGlobalPct = gStat.totalHours > 0
          ? (gStat.simAutoHours / gStat.totalHours) * 100
          : 0;

        const isSub80 = currentSimAvancePct < levelingTargetPct;
        classifiedList.push({
          act,
          gerenciaInitialPct: gStat.initialAvancePct,
          gerenciaInitialGlobalPct: gStat.initialGlobalPct,
          gerenciaSimPct: Number(currentSimAvancePct.toFixed(1)),
          gerenciaSimGlobalPct: Number(currentSimGlobalPct.toFixed(1)),
          levelingTier: isSub80 ? 'NIVELACION_SUB_80' : 'CONSOLIDACION_SUPER_80',
        });
        gStat.simAutoHours += act.horasManuales;
      }

      classifiedByGerencia.set(gName, classifiedList);
    }

    // INTERLEAVING CONCURRENTE MULTIGERENCIA (Prioridad Nivelación + Avance Simultáneo)
    // En lugar de concentrar todas las actividades de una sola gerencia en un bloque rígido,
    // se intercalan rondas entre todas las gerencias:
    // - Las gerencias en Nivelación (< 80%) aportan 2 actividades de mayor impacto por ronda.
    // - Las gerencias en Consolidación (≥ 80%) aportan 1 actividad de mayor impacto por ronda.
    // Esto garantiza que:
    // 1. Todas las gerencias se atiendan simultáneamente desde el Año 1 (2027) sin dejar rezagada a ninguna.
    // 2. Las gerencias con menor porcentaje (< 80%) reciban mayor aceleración de impacto hasta nivelarse.
    const interleavedSiAuto: ClassifiedItem[] = [];
    const queues = new Map<string, ClassifiedItem[]>();
    for (const gName of sortedGerenciaNames) {
      queues.set(gName, [...(classifiedByGerencia.get(gName) || [])]);
    }

    let hasRemainingSiAuto = true;
    while (hasRemainingSiAuto) {
      hasRemainingSiAuto = false;
      for (const gName of sortedGerenciaNames) {
        const q = queues.get(gName)!;
        if (q.length > 0) {
          hasRemainingSiAuto = true;
          const takeCount = q[0].levelingTier === 'NIVELACION_SUB_80' ? 2 : 1;
          for (let k = 0; k < takeCount && q.length > 0; k++) {
            interleavedSiAuto.push(q.shift()!);
          }
        }
      }
    }

    // Preparar lista unificada de actividades ordenadas por prioridad de impacto y nivelación
    const unifiedActivities: Array<{
      id: string;
      actividadProceso: string;
      gerencia: string;
      tipo: 'NO_DIG_SI_AUTO' | 'NO_DIG_NO_AUTO' | 'REQUERIMIENTO' | 'MANTENIMIENTO';
      tipoLabel: string;
      horasManualesMensuales: number;
      horasTotalesMensuales: number;
      isNomina: boolean;
      assignedYear: number;
      prioridad: number;
      isPendingDefinition?: boolean;
      gerenciaInitialPct?: number;
      gerenciaInitialGlobalPct?: number;
      gerenciaSimPct?: number;
      gerenciaSimGlobalPct?: number;
      levelingTier?: string;
    }> = [];

    let currentPriority = 1;

    // 1. Agregar No Digitalizadas Sí Automatizables (Interleaving Concurrente Multigerencia)
    for (const item of interleavedSiAuto) {
      const act = item.act;
      const isNomina = act.gerencia.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes('nomina');
      unifiedActivities.push({
        id: act.id,
        actividadProceso: act.actividadProceso,
        gerencia: act.gerencia,
        tipo: 'NO_DIG_SI_AUTO',
        tipoLabel: item.levelingTier === 'NIVELACION_SUB_80'
          ? `No Dig. Sí Auto · Nivelación (< ${levelingTargetPct}%)`
          : `No Dig. Sí Auto · Consolidación (≥ ${levelingTargetPct}%)`,
        horasManualesMensuales: act.horasManuales,
        horasTotalesMensuales: act.horasTotales,
        isNomina,
        assignedYear: 1, // Se calculará con base en el cronograma
        prioridad: currentPriority++,
        gerenciaInitialPct: item.gerenciaInitialPct,
        gerenciaInitialGlobalPct: item.gerenciaInitialGlobalPct,
        gerenciaSimPct: item.gerenciaSimPct,
        gerenciaSimGlobalPct: item.gerenciaSimGlobalPct,
        levelingTier: item.levelingTier,
      });
    }

    // 2. Interleaving de No Digitalizadas No Automatizables seleccionadas como [Por Definir]
    const noAutoQueues = new Map<string, typeof candidateActivities.noDigNoAutoSelected>();
    for (const gName of sortedGerenciaNames) {
      noAutoQueues.set(gName, []);
    }
    for (const act of candidateActivities.noDigNoAutoSelected) {
      if (!noAutoQueues.has(act.gerencia)) {
        noAutoQueues.set(act.gerencia, []);
      }
      noAutoQueues.get(act.gerencia)!.push(act);
    }
    for (const acts of noAutoQueues.values()) {
      acts.sort((a, b) => b.horasManuales - a.horasManuales);
    }

    const interleavedNoAuto: typeof candidateActivities.noDigNoAutoSelected = [];
    let hasRemainingNoAuto = true;
    while (hasRemainingNoAuto) {
      hasRemainingNoAuto = false;
      for (const gName of sortedGerenciaNames) {
        const q = noAutoQueues.get(gName);
        if (q && q.length > 0) {
          hasRemainingNoAuto = true;
          interleavedNoAuto.push(q.shift()!);
        }
      }
    }

    for (let i = 0; i < interleavedNoAuto.length; i++) {
      const item = interleavedNoAuto[i];
      const isNomina = item.gerencia.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes('nomina');
      unifiedActivities.push({
        id: `POR_DEFINIR_${item.id}`,
        actividadProceso: `[Por Definir] Actividad No Dig. / No Auto. #${i + 1} (${item.gerencia})`,
        gerencia: item.gerencia,
        tipo: 'NO_DIG_NO_AUTO',
        tipoLabel: `No Dig. / No Auto. (Por definir · Evaluación ${pctNoAutoThreshold}%)`,
        horasManualesMensuales: 0,
        horasTotalesMensuales: 0,
        isNomina,
        assignedYear: 2,
        prioridad: currentPriority++,
        isPendingDefinition: true,
        gerenciaInitialPct: getGerenciaInitialAvancePct(item.gerencia),
        levelingTier: 'EVALUACION_NO_AUTO',
      });
    }

    // Asignación automática inicial
    const assignmentsMap = new Map<string, string>(); // actId -> collabId

    // 3. Agregar Requerimientos y Mantenimientos: repartidos a cada recurso con capacidad activa
    // Cada recurso activo tiene una fila de Requerimiento y una fila de Mantenimiento con horas [Por definir]
    if (anualRequerimientos > 0 && totalRecursosActivos > 0) {
      for (const c of activeCollabs) {
        const reqId = `OP-REQ-${c.id}`;
        unifiedActivities.push({
          id: reqId,
          actividadProceso: `Atención a Requerimientos Operativos (${reqSharePerYear.toFixed(1)} req/año · Por definir)`,
          gerencia: 'Eficiencia de Procesos',
          tipo: 'REQUERIMIENTO',
          tipoLabel: 'Requerimiento Operativo (Por definir)',
          horasManualesMensuales: 0,
          horasTotalesMensuales: 0,
          isNomina: false,
          assignedYear: 1,
          prioridad: currentPriority++,
          isPendingDefinition: true,
          levelingTier: 'OPERATIVO',
        });
        assignmentsMap.set(reqId, c.id);
      }
    }

    if (anualMantenimientos > 0 && totalRecursosActivos > 0) {
      for (const c of activeCollabs) {
        const mantId = `OP-MANT-${c.id}`;
        unifiedActivities.push({
          id: mantId,
          actividadProceso: `Mantenimiento Preventivo y Correctivo (${mantSharePerYear.toFixed(1)} mant/año · Por definir)`,
          gerencia: 'Eficiencia de Procesos',
          tipo: 'MANTENIMIENTO',
          tipoLabel: 'Mantenimiento Preventivo / Correctivo (Por definir)',
          horasManualesMensuales: 0,
          horasTotalesMensuales: 0,
          isNomina: false,
          assignedYear: 1,
          prioridad: currentPriority++,
          isPendingDefinition: true,
          levelingTier: 'OPERATIVO',
        });
        assignmentsMap.set(mantId, c.id);
      }
    }

    // FASE 1: Separar actividades de Nómina (REGLA CRÍTICA: SOLO DANIEL GARCÍA VELÁZQUEZ)
    const nominaActivities = unifiedActivities.filter((a) => a.isNomina);
    // Filtrar actividades de proceso de otras gerencias (excluyendo Nómina y las operativas que ya están asignadas por recurso)
    const processNonNominaActivities = unifiedActivities.filter(
      (a) => !a.isNomina && a.tipo !== 'REQUERIMIENTO' && a.tipo !== 'MANTENIMIENTO'
    );

    // Asignar todas las de Nómina a Daniel
    for (const act of nominaActivities) {
      assignmentsMap.set(act.id, danielCollab.id);
    }

    // FASE 2: Distribuir actividades no-nómina de procesos asegurando que CADA COLABORADOR TENGA ACTIVIDADES DE TODAS LAS GERENCIAS
    const nonNominaCollabs = collabs.filter((c) => !c.isNominaExclusive);

    // Matriz de seguimiento: collabId -> (gerenciaName -> count)
    const collabGerenciaCounts = new Map<string, Map<string, number>>();
    for (const c of nonNominaCollabs) {
      collabGerenciaCounts.set(c.id, new Map<string, number>());
    }

    // Iterar cada actividad no-nómina de procesos en el orden unificado
    for (const act of processNonNominaActivities) {
      // 1. Candidatos con capacidad disponible
      let availableCollabs = nonNominaCollabs.filter((c) => {
        const currentCount = Array.from(assignmentsMap.values()).filter((id) => id === c.id).length;
        return currentCount < c.totalCapacity;
      });

      // Si todos han alcanzado su capacidad nominal, considerar a todos los colaboradores no-nómina
      if (availableCollabs.length === 0) {
        availableCollabs = nonNominaCollabs;
      }

      // Ordenar candidatos con máxima prioridad a la DIVERSIDAD MULTIGERENCIA:
      // Quien tenga MENOS actividades de esta gerencia específica se elige primero
      availableCollabs.sort((a, b) => {
        const gMapA = collabGerenciaCounts.get(a.id);
        const gMapB = collabGerenciaCounts.get(b.id);
        const gCountA = gMapA?.get(act.gerencia) || 0;
        const gCountB = gMapB?.get(act.gerencia) || 0;

        // Criterio 1: Quien tenga menor conteo de actividades en esta gerencia
        if (gCountA !== gCountB) {
          return gCountA - gCountB;
        }

        // Criterio 2: Ratio de ocupación general (assignedCount / totalCapacity)
        const countA = Array.from(assignmentsMap.values()).filter((id) => id === a.id).length;
        const countB = Array.from(assignmentsMap.values()).filter((id) => id === b.id).length;
        const ratioA = a.totalCapacity > 0 ? countA / a.totalCapacity : 1;
        const ratioB = b.totalCapacity > 0 ? countB / b.totalCapacity : 1;

        if (Math.abs(ratioA - ratioB) > 0.05) {
          return ratioA - ratioB;
        }

        // Criterio 3: Especialistas tienen mayor capacidad para absorber volumen
        if (a.role === 'Especialista' && b.role !== 'Especialista') {
          return -1;
        }
        if (b.role === 'Especialista' && a.role !== 'Especialista') {
          return 1;
        }

        return countA - countB;
      });

      const chosenCollab = availableCollabs[0];
      assignmentsMap.set(act.id, chosenCollab.id);

      // Registrar que este colaborador tiene una actividad más de esta gerencia
      const gMap = collabGerenciaCounts.get(chosenCollab.id)!;
      gMap.set(act.gerencia, (gMap.get(act.gerencia) || 0) + 1);
    }

    // FASE 3: Aplicar reasignaciones manuales del usuario si las hay
    for (const [actId, targetCollabId] of Object.entries(manualReassignments)) {
      const act = unifiedActivities.find((a) => a.id === actId);
      if (act) {
        // REGLA ESTRICTA: Si es de Nómina, no permitir cambiar a nadie que no sea Daniel
        if (act.isNomina && targetCollabId !== danielCollab.id) {
          // Ignorar reasignación inválida de nómina
          assignmentsMap.set(actId, danielCollab.id);
        } else {
          assignmentsMap.set(actId, targetCollabId);
        }
      }
    }

    // FASE 4: Asignar Año / Fase del Plan (Año 1, Año 2, Año 3...)
    // Las actividades con mayor impacto de horas manuales van en el Año 1 (Quick Wins), luego Año 2, luego Año 3
    const finalActivities: PlanActivity[] = unifiedActivities.map((act, index) => {
      const assignedId = assignmentsMap.get(act.id) || collabs[0].id;
      const assignedCollab = collabMap.get(assignedId) || collabs[0];

      // Determinar año por fase progresiva:
      // Si es un requerimiento o mantenimiento operativo, respeta su asignación anual periódica
      let assignedYear = act.assignedYear;
      if (act.tipo === 'NO_DIG_SI_AUTO' || act.tipo === 'NO_DIG_NO_AUTO') {
        const totalInventory = candidateActivities.totalInventoryCandidates;
        const bucketSize = Math.ceil(totalInventory / horizonYears);
        assignedYear = Math.min(horizonYears, Math.floor(index / Math.max(1, bucketSize)) + 1);
      }

      return {
        id: act.id,
        actividadProceso: act.actividadProceso,
        gerencia: act.gerencia,
        tipo: act.tipo,
        tipoLabel: act.tipoLabel,
        horasManualesMensuales: act.horasManualesMensuales,
        horasTotalesMensuales: act.horasTotalesMensuales,
        colaboradorAsignadoId: assignedCollab.id,
        colaboradorAsignadoNombre: assignedCollab.name,
        colaboradorAsignadoRol: assignedCollab.role,
        assignedYear,
        prioridad: act.prioridad,
        isNomina: act.isNomina,
        isPendingDefinition: act.isPendingDefinition || act.tipo === 'NO_DIG_NO_AUTO',
        gerenciaInitialPct: act.gerenciaInitialPct,
        gerenciaInitialGlobalPct: act.gerenciaInitialGlobalPct,
        gerenciaSimPct: act.gerenciaSimPct,
        gerenciaSimGlobalPct: act.gerenciaSimGlobalPct,
        levelingTier: act.levelingTier,
      };
    });

    // Calcular estadísticas acumuladas por colaborador
    const gerenciasByCollab = new Map<string, Set<string>>();
    for (const c of collabs) {
      gerenciasByCollab.set(c.id, new Set<string>());
    }

    for (const act of finalActivities) {
      const c = collabMap.get(act.colaboradorAsignadoId);
      if (c) {
        if (act.tipo === 'REQUERIMIENTO') {
          c.assignedCount += reqSharePerYear;
        } else if (act.tipo === 'MANTENIMIENTO') {
          c.assignedCount += mantSharePerYear;
        } else {
          c.assignedCount += 1;
        }
        c.assignedHours += act.horasManualesMensuales;
        gerenciasByCollab.get(c.id)?.add(act.gerencia);
      }
    }

    for (const c of collabs) {
      c.assignedCount = Number(c.assignedCount.toFixed(1));
      c.gerenciasCovered = Array.from(gerenciasByCollab.get(c.id) || []);
    }

    // Métricas globales del escenario
    const totalActividades = finalActivities.length;
    const totalHorasManuales = finalActivities.reduce((acc, a) => acc + a.horasManualesMensuales, 0);
    const capacidadTotalEquipo = collabs.reduce((acc, c) => acc + c.totalCapacity, 0);
    const balanceActividades = capacidadTotalEquipo - totalActividades;
    const esViable = balanceActividades >= 0;

    const planMetrics: PlanScenarioConfig = {
      years: horizonYears,
      monthsTotal: totalMonths,
      jefeMonthlyCapacity: jefeCapacityRate,
      becarioMonthlyCapacity: becarioCapacityRate,
      especialistaMonthlyCapacity: especialistaCapacityRate,
      pctNoAutoToInclude: includeNoAutoActivities ? pctNoAutoThreshold : 0,
      includeNoAutoActivities,
      levelingTargetPct,
      anualRequerimientos,
      anualMantenimientos,
      totalActividades,
      totalHorasManuales,
      capacidadTotalEquipo,
      balanceActividades,
      esViable,
    };

    return {
      planActivities: finalActivities,
      collaboratorsSummary: collabs,
      planMetrics,
    };
  }, [
    teamMembers,
    candidateActivities,
    operationalActivities,
    horizonYears,
    totalMonths,
    jefeCapacityRate,
    becarioCapacityRate,
    especialistaCapacityRate,
    pctNoAutoThreshold,
    includeNoAutoActivities,
    levelingTargetPct,
    gerenciaSummaries,
    anualRequerimientos,
    anualMantenimientos,
    manualReassignments,
  ]);

  // Proyecciones de Nivelación de Automatización por Gerencia (Prioridad hasta el 80%)
  const gerenciaLevelingProjections = useMemo(() => {
    const planActsByGerencia = new Map<string, PlanActivity[]>();
    for (const act of planActivities) {
      if (!planActsByGerencia.has(act.gerencia)) {
        planActsByGerencia.set(act.gerencia, []);
      }
      planActsByGerencia.get(act.gerencia)!.push(act);
    }

    // Mapa de horas No Digitalizadas Sí Automatizables por gerencia
    const noDigSiHoursMap = new Map<string, number>();
    for (const act of candidateActivities.noDigSiAuto) {
      const gKey = act.gerencia.trim().toLowerCase();
      noDigSiHoursMap.set(gKey, (noDigSiHoursMap.get(gKey) || 0) + act.horasManuales);
    }

    return gerenciaSummaries.map((summary) => {
      const gKey = summary.gerencia.trim().toLowerCase();
      const acts = planActsByGerencia.get(summary.gerencia) || [];
      const totalPlanActs = acts.length;
      const hoursFromPlan = acts.reduce((acc, a) => acc + (a.horasManualesMensuales || 0), 0);
      const projectedAutoHours = summary.horasAutomatizadas + hoursFromPlan;

      // --------------------------------------------------------------------------
      // REGLA 1 (Usuario): Para calcular lo del 80% de avance de automatización,
      // el 100% de automatización será la suma de:
      // horas automatizadas + horas no digitalizadas sí automatizables
      // --------------------------------------------------------------------------
      const noDigSiHours = noDigSiHoursMap.get(gKey) ?? Math.min(summary.horasManuales, Math.max(0, summary.horasPotencialAutomatizable || 0));
      const autoBase100 = summary.horasAutomatizadas + noDigSiHours;

      const initialAvancePct = autoBase100 > 0
        ? Number(((summary.horasAutomatizadas / autoBase100) * 100).toFixed(1))
        : 100;

      const projectedAvancePct = autoBase100 > 0
        ? Math.min(100, Number(((projectedAutoHours / autoBase100) * 100).toFixed(1)))
        : 100;

      const deltaAvancePct = Number((projectedAvancePct - initialAvancePct).toFixed(1));

      // --------------------------------------------------------------------------
      // REGLA 2 (Usuario): Para el porcentaje proyectado,
      // debe considerar el 100% como la suma total de las horas de actividades de la gerencia (horasTotales)
      // --------------------------------------------------------------------------
      const totalGerenciaHours = summary.horasTotales;
      const initialGlobalPct = summary.pctAutomatizado; // (horasAutomatizadas / totalGerenciaHours) * 100
      const projectedPct = totalGerenciaHours > 0
        ? Math.min(100, Number(((projectedAutoHours / totalGerenciaHours) * 100).toFixed(1)))
        : summary.pctAutomatizado;
      const deltaPct = Number((projectedPct - initialGlobalPct).toFixed(1));

      // Meta de nivelación al 80%: evaluada respecto al avance sobre lo automatizable (Regla 1)
      const meetsTarget = projectedAvancePct >= levelingTargetPct;
      const initiallyBelowTarget = initialAvancePct < levelingTargetPct;

      const tier1Count = acts.filter((a) => a.levelingTier === 'NIVELACION_SUB_80').length;
      const tier2Count = acts.filter((a) => a.levelingTier === 'CONSOLIDACION_SUPER_80').length;
      const noAutoCount = acts.filter((a) => a.tipo === 'NO_DIG_NO_AUTO').length;

      const year1Count = acts.filter((a) => a.assignedYear === 1).length;
      const year2Count = acts.filter((a) => a.assignedYear === 2).length;
      const year3Count = acts.filter((a) => a.assignedYear === 3).length;

      return {
        gerencia: summary.gerencia,
        // Métricas para Meta 80% (Base = Horas Automatizadas + No Dig Sí Auto)
        autoBase100: autoBase100 > 0 ? autoBase100 : totalGerenciaHours,
        noDigSiHours,
        initialAvancePct,
        projectedAvancePct,
        deltaAvancePct,
        meetsTarget,
        initiallyBelowTarget,
        // Métricas Globales (Base = Total Horas Gerencia)
        totalHours: totalGerenciaHours,
        initialPct: initialGlobalPct,
        projectedPct,
        deltaPct,
        initialAutoHours: summary.horasAutomatizadas,
        initialManualHours: summary.horasManuales,
        projectedAutoHours,
        planActsCount: totalPlanActs,
        hoursFromPlan,
        tier1Count,
        tier2Count,
        noAutoCount,
        year1Count,
        year2Count,
        year3Count,
      };
    }).sort((a, b) => a.initialAvancePct - b.initialAvancePct);
  }, [gerenciaSummaries, planActivities, levelingTargetPct, candidateActivities.noDigSiAuto]);

  // Función para reasignar una actividad
  const handleReassignActivity = useCallback((actId: string, newCollabId: string) => {
    setManualReassignments((prev) => ({
      ...prev,
      [actId]: newCollabId,
    }));
  }, []);

  // Agregar nueva vacante interactiva de especialista
  const handleAddSpecialistVacancy = () => {
    const existingVacancies = teamMembers.filter((m) => m.name.includes('Vacante Especialista'));
    const nextNum = existingVacancies.length + 1;
    const newId = `vacante-esp-${Date.now()}`;
    const newMember: TeamMemberDraft = {
      id: newId,
      name: `Vacante Especialista ${nextNum} (Por Contratar)`,
      role: 'Especialista',
      isVacancy: true,
      isNominaExclusive: false,
      monthlyCapacity: especialistaCapacityRate,
    };
    setTeamMembers([...teamMembers, newMember]);
  };

  // Agregar nueva vacante interactiva de becario
  const handleAddBecarioVacancy = () => {
    const existingVacancies = teamMembers.filter((m) => m.name.includes('Vacante Becario'));
    const nextNum = existingVacancies.length + 1;
    const newId = `vacante-bec-${Date.now()}`;
    const newMember: TeamMemberDraft = {
      id: newId,
      name: `Vacante Becario ${nextNum} (Por Contratar)`,
      role: 'Becario',
      isVacancy: true,
      isNominaExclusive: false,
      monthlyCapacity: becarioCapacityRate,
    };
    setTeamMembers([...teamMembers, newMember]);
  };

  // Eliminar miembro vacante agregado
  const handleRemoveMember = (id: string) => {
    if (id === 'esp-daniel-garcia') {
      alert('Daniel García Velázquez es el responsable exclusivo de Nómina y no puede ser removido.');
      return;
    }
    setTeamMembers((prev) => prev.filter((m) => m.id !== id));
  };

  // Restablecer escenario base
  const handleResetBaseline = () => {
    setHorizonYears(3);
    setJefeCapacityRate(1.0);
    setBecarioCapacityRate(1.0);
    setEspecialistaCapacityRate(1.5);
    setIncludeNoAutoActivities(true);
    setPctNoAutoThreshold(20);
    setLevelingTargetPct(80);
    setAnualRequerimientos(10);
    setAnualMantenimientos(25);
    setShowLevelingBreakdown(false);
    setTeamMembers(INITIAL_TEAM);
    setManualReassignments({});
  };

  // Ajuste automático del ritmo de especialistas para alcanzar la meta en los años fijados
  const handleAutoAdjustPace = () => {
    const totalTarget = planMetrics.totalActividades;
    const jefeTotalCap = teamMembers
      .filter((m) => m.role === 'Jefe Sr' || m.role === 'Jefe')
      .reduce((acc, m) => acc + jefeCapacityRate * totalMonths, 0);
    const becarioTotalCap = teamMembers
      .filter((m) => m.role === 'Becario')
      .reduce((acc, m) => acc + becarioCapacityRate * totalMonths, 0);

    const remainingForSpecialists = Math.max(0, totalTarget - jefeTotalCap - becarioTotalCap);
    const numSpecialists = teamMembers.filter((m) => m.role === 'Especialista').length;

    if (numSpecialists > 0 && totalMonths > 0) {
      const requiredRatePerMonth = Number(
        (remainingForSpecialists / (numSpecialists * totalMonths)).toFixed(2)
      );
      setEspecialistaCapacityRate(Math.max(0.5, requiredRatePerMonth));
    }
  };

  // Exportar a Excel
  const handleExportPlanXlsx = async () => {
    try {
      setIsExporting(true);
      await exportWorkPlanSimulationXlsx(
        planMetrics,
        collaboratorsSummary,
        planActivities,
        `Plan_de_Trabajo_Automatizacion_2027_${toCalendarYear(horizonYears)}.xlsx`
      );
    } catch (err) {
      console.error('Error al exportar plan a Excel:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Filtrado de actividades para la vista de catálogo con filtros estilo Excel
  const filteredActivities = useMemo(() => {
    let list = planActivities;

    // Búsqueda global de texto
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((act) => {
        const matchName = act.actividadProceso.toLowerCase().includes(q);
        const matchGer = act.gerencia.toLowerCase().includes(q);
        const matchColab = act.colaboradorAsignadoNombre.toLowerCase().includes(q);
        const matchTipo = act.tipoLabel.toLowerCase().includes(q);
        return matchName || matchGer || matchColab || matchTipo;
      });
    }

    // Filtro Excel: Año Calendario (2027, 2028, etc.)
    if (filterYears.length > 0) {
      list = list.filter((act) => 
        filterYears.includes(toCalendarYear(act.assignedYear)) ||
        act.tipo === 'REQUERIMIENTO' ||
        act.tipo === 'MANTENIMIENTO'
      );
    }

    // Filtro Excel: Gerencia
    if (filterGerencias.length > 0) {
      list = list.filter((act) => filterGerencias.includes(act.gerencia));
    }

    // Filtro Excel: Tipo
    if (filterTipos.length > 0) {
      list = list.filter((act) => filterTipos.includes(act.tipo));
    }

    // Filtro Excel: Colaborador
    if (filterColaboradores.length > 0) {
      list = list.filter((act) => filterColaboradores.includes(act.colaboradorAsignadoId));
    }

    // Filtro Excel: Roles de colaborador
    if (filterColabRoles.length > 0) {
      list = list.filter((act) => filterColabRoles.includes(act.colaboradorAsignadoRol));
    }

    // Filtro Excel: Horas Manuales
    if (filterHoursRange === 'POR_DEFINIR') {
      list = list.filter((act) => act.tipo === 'NO_DIG_NO_AUTO' || (act as any).isPendingDefinition);
    } else if (filterHoursRange === 'CON_HORAS') {
      list = list.filter((act) => act.tipo !== 'NO_DIG_NO_AUTO' && act.horasManualesMensuales > 0);
    } else if (filterHoursRange === 'GT_30') {
      list = list.filter((act) => act.horasManualesMensuales >= 30);
    } else if (filterHoursRange === 'GT_60') {
      list = list.filter((act) => act.horasManualesMensuales >= 60);
    }

    // Ordenamiento por prioridad
    if (filterSortPrio === 'DESC') {
      list = [...list].sort((a, b) => b.prioridad - a.prioridad);
    } else {
      list = [...list].sort((a, b) => a.prioridad - b.prioridad);
    }

    return list;
  }, [
    planActivities,
    searchQuery,
    filterYears,
    filterGerencias,
    filterTipos,
    filterColaboradores,
    filterColabRoles,
    filterHoursRange,
    filterSortPrio,
  ]);

  const isAnyFilterActive =
    searchQuery.trim().length > 0 ||
    filterYears.length > 0 ||
    filterGerencias.length > 0 ||
    filterTipos.length > 0 ||
    filterColaboradores.length > 0 ||
    filterColabRoles.length > 0 ||
    filterHoursRange !== 'ALL' ||
    filterSortPrio !== 'ASC';

  const handleClearAllFilters = () => {
    setSearchQuery('');
    setFilterYears([]);
    setFilterGerencias([]);
    setFilterTipos([]);
    setFilterColaboradores([]);
    setFilterColabRoles([]);
    setFilterHoursRange('ALL');
    setFilterSortPrio('ASC');
  };

  // Lista única de gerencias involucradas en el plan
  const planGerencias = useMemo(() => {
    return Array.from(new Set(planActivities.map((a) => a.gerencia))).sort();
  }, [planActivities]);

  // Métricas agregadas de Nivelación y Avance hacia la meta de automatización
  const gerenciasBelowTargetInitially = gerenciaLevelingProjections.filter((g) => g.initiallyBelowTarget).length;
  const gerenciasMeetingTargetProjected = gerenciaLevelingProjections.filter((g) => g.meetsTarget).length;
  const totalTier1Acts = planActivities.filter((a) => a.levelingTier === 'NIVELACION_SUB_80').length;
  const totalTier2Acts = planActivities.filter((a) => a.levelingTier === 'CONSOLIDACION_SUPER_80').length;

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* BANNER PRINCIPAL & CONTROL DE ESCENARIO INTERACTIVO */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border-2 border-slate-200/90 rounded-2xl p-6 text-slate-900 shadow-sm relative overflow-hidden">
        {/* Glow de fondo decorativo muy sutil */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-indigo-100/40 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Simulador Interactivo de Capacidad y Plan de Trabajo</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
              Hoja 3: Distribución del Plan de Automatización
            </h2>
            <p className="text-slate-600 text-xs md:text-sm leading-relaxed">
              Distribución estratégica y concurrente para el{' '}
              <strong className="text-slate-900 font-bold">Equipo de Eficiencia de Procesos</strong>. Atención simultánea de todas las gerencias desde el primer año, priorizando con mayor intensidad aquellas con menor nivel de automatización hasta nivelar al{' '}
              <strong className="text-rose-600 font-bold">{levelingTargetPct}%</strong>, con portafolios multigerencia balanceados por colaborador y exclusividad de{' '}
              <strong className="text-blue-600 font-bold">Daniel García Velázquez</strong> en Nómina.
            </p>
          </div>

          {/* Botones de acción principales */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleAutoAdjustPace}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all cursor-pointer"
              title="Calcula automáticamente el ritmo mensual necesario por especialista para cumplir el plan en los años fijados"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>Ritmo Meta Automático</span>
            </button>

            <button
              type="button"
              onClick={handleResetBaseline}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs transition-all cursor-pointer"
              title="Restablecer los valores iniciales (3 años, 1 act/mes jefes y becarios, equipo de 15)"
            >
              <RotateCcw className="w-4 h-4 text-slate-500" />
              <span>Restablecer</span>
            </button>

            <button
              type="button"
              onClick={handleExportPlanXlsx}
              disabled={isExporting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all cursor-pointer disabled:opacity-60"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{isExporting ? 'Generando Excel...' : 'Descargar Plan .xlsx'}</span>
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* BARRA DE PARÁMETROS DINÁMICOS DEL ESCENARIO (8 CONTROLES INDEPENDIENTES) */}
        {/* ------------------------------------------------------------- */}
        <div className="relative z-10 mt-6 pt-6 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Parámetro 1: Plazo en Años Calendario */}
          <div className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-3.5 space-y-2 flex flex-col justify-between hover:border-slate-300 transition-all shadow-2xs">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  Plazo del Plan:
                </span>
                <span className="font-mono font-black text-blue-600 text-sm">
                  {horizonYears} {horizonYears === 1 ? 'Año' : 'Años'}
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                Calendario: <strong className="text-slate-800 font-bold">{BASE_PLAN_START_YEAR} a {toCalendarYear(horizonYears)}</strong> ({totalMonths} meses)
              </div>
            </div>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={horizonYears}
              onChange={(e) => setHorizonYears(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>2027 (1a)</span>
              <span className="text-blue-700 font-bold">2029 (Meta 3a)</span>
              <span>2031 (5a)</span>
            </div>
          </div>

          {/* Parámetro 2: Ritmo Jefes (Jefe Sr y Jefe) - INDEPENDIENTE */}
          <div className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-3.5 space-y-2 flex flex-col justify-between hover:border-slate-300 transition-all shadow-2xs">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5" title="Capacidad mensual para Jefes Sr y Jefes (máximo reglamentario: 1/mes)">
                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                  Capacidad Jefes:
                </span>
                <span className="font-mono font-black text-indigo-600 text-sm">
                  {jefeCapacityRate} act/mes
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                3 Jefes = <strong className="text-indigo-700 font-mono font-bold">{(3 * jefeCapacityRate * totalMonths).toFixed(0)} act</strong> ({horizonYears}a)
              </div>
            </div>
            <input
              type="range"
              min={0.2}
              max={2.0}
              step={0.1}
              value={jefeCapacityRate}
              onChange={(e) => setJefeCapacityRate(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0.2/m</span>
              <span className="text-indigo-700 font-bold">1.0/m (Regla)</span>
              <span>2.0/m</span>
            </div>
          </div>

          {/* Parámetro 3: Ritmo Becarios - INDEPENDIENTE */}
          <div className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-3.5 space-y-2 flex flex-col justify-between hover:border-slate-300 transition-all shadow-2xs">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5" title="Capacidad mensual para Becarios (máximo reglamentario: 1/mes)">
                  <Users className="w-3.5 h-3.5 text-cyan-600" />
                  Capacidad Becarios:
                </span>
                <span className="font-mono font-black text-cyan-600 text-sm">
                  {becarioCapacityRate} act/mes
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                3 Becarios = <strong className="text-cyan-700 font-mono font-bold">{(3 * becarioCapacityRate * totalMonths).toFixed(0)} act</strong> ({horizonYears}a)
              </div>
            </div>
            <input
              type="range"
              min={0.2}
              max={2.0}
              step={0.1}
              value={becarioCapacityRate}
              onChange={(e) => setBecarioCapacityRate(Number(e.target.value))}
              className="w-full accent-cyan-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0.2/m</span>
              <span className="text-cyan-700 font-bold">1.0/m (Regla)</span>
              <span>2.0/m</span>
            </div>
          </div>

          {/* Parámetro 4: Ritmo Especialistas */}
          <div className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-3.5 space-y-2 flex flex-col justify-between hover:border-slate-300 transition-all shadow-2xs">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
                  Especialistas:
                </span>
                <span className="font-mono font-black text-emerald-600 text-sm">
                  {especialistaCapacityRate} act/mes
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                {teamMembers.filter((m) => m.role === 'Especialista').length} Especialistas = <strong className="text-emerald-700 font-mono font-bold">{(teamMembers.filter((m) => m.role === 'Especialista').length * especialistaCapacityRate * totalMonths).toFixed(0)} act</strong>
              </div>
            </div>
            <input
              type="range"
              min={0.5}
              max={3.0}
              step={0.1}
              value={especialistaCapacityRate}
              onChange={(e) => setEspecialistaCapacityRate(Number(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0.5/m</span>
              <span className="text-emerald-700 font-bold">1.5/m (Base)</span>
              <span>3.0/m</span>
            </div>
          </div>

          {/* Parámetro 5: No Digitalizadas No Automatizables (Toggle Dinámico + % de Cupo) */}
          <div className={`border rounded-xl p-3.5 space-y-2.5 transition-all flex flex-col justify-between ${
            includeNoAutoActivities
              ? 'bg-amber-50/60 border-amber-300 shadow-2xs'
              : 'bg-slate-50 border-slate-200 opacity-80'
          }`}>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-600" />
                  No Dig / No Auto:
                </span>
                {/* Switch dinámico para activar o desactivar */}
                <button
                  type="button"
                  onClick={() => setIncludeNoAutoActivities(!includeNoAutoActivities)}
                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition-all cursor-pointer ${
                    includeNoAutoActivities
                      ? 'bg-amber-500 text-white font-bold shadow-xs'
                      : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}
                  title={includeNoAutoActivities ? 'Haz clic para desactivar inclusión de No Auto en el plan' : 'Haz clic para activar inclusión de No Auto en el plan'}
                >
                  {includeNoAutoActivities ? 'Activo' : 'Inactivo'}
                </button>
              </div>

              {includeNoAutoActivities ? (
                <div className="space-y-1">
                  <div className="text-[11px] text-amber-800 font-mono flex items-center justify-between">
                    <span>
                      Cupo: <strong className="font-bold">{pctNoAutoThreshold}% s/total Hoja 2</strong>
                    </span>
                    <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px] font-bold border border-amber-300">
                      {candidateActivities.noDigNoAutoSelected.length} act [Por Definir]
                    </span>
                  </div>

                  <div className="text-[10px] text-slate-600 flex items-center justify-between bg-white p-1.5 rounded-lg border border-slate-200">
                    <span>Base total Hoja 2:</span>
                    <strong className="text-slate-900 font-mono font-bold">
                      {formatThousands(totalHoja2Activities)} actividades
                    </strong>
                  </div>

                  {/* Selector interactivo de base de Hoja 2 si se desea auditar la métrica */}
                  <div className="flex items-center gap-1 pt-0.5 text-[9px]">
                    <span className="text-slate-500">Base:</span>
                    <button
                      type="button"
                      onClick={() => setHoja2CalculationBase('STATUS_TOTAL')}
                      className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                        hoja2CalculationBase === 'STATUS_TOTAL'
                          ? 'bg-amber-500 text-white font-bold'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                      }`}
                      title="Métrica oficial de Hoja 2 (Suma de los 4 cuadrantes de estatus)"
                    >
                      Por Estatus ({hoja2StatusAnalysis.totalActividadesPorEstatus})
                    </button>
                    <button
                      type="button"
                      onClick={() => setHoja2CalculationBase('RECORDS_TOTAL')}
                      className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                        hoja2CalculationBase === 'RECORDS_TOTAL'
                          ? 'bg-amber-500 text-white font-bold'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                      }`}
                      title="Total de registros de actividades en el inventario"
                    >
                      Inventario ({records.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setHoja2CalculationBase('BASE_UNIQUE')}
                      className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                        hoja2CalculationBase === 'BASE_UNIQUE'
                          ? 'bg-amber-500 text-white font-bold'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                      }`}
                      title="Actividades base únicas por gerencia"
                    >
                      Base ({hoja2StatusAnalysis.totalActividadesBase})
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-slate-500 italic">
                  Desactivadas (0 act en el plan)
                </div>
              )}
            </div>

            {includeNoAutoActivities ? (
              <div className="space-y-1">
                <input
                  type="range"
                  min={0}
                  max={40}
                  step={1}
                  value={pctNoAutoThreshold}
                  onChange={(e) => setPctNoAutoThreshold(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>0%</span>
                  <span className="text-amber-700 font-bold">
                    20% ({Math.round(totalHoja2Activities * 0.20)} act)
                  </span>
                  <span>40%</span>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIncludeNoAutoActivities(true)}
                className="w-full py-1 text-[11px] font-bold text-amber-700 bg-amber-100/80 border border-amber-300 rounded-lg hover:bg-amber-200/80 transition-colors text-center cursor-pointer"
              >
                + Activar Cupo No Auto
              </button>
            )}
          </div>

          {/* Parámetro 6: Meta de Nivelación de Gerencias (80%) */}
          <div className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-3.5 space-y-2 flex flex-col justify-between hover:border-slate-300 transition-all shadow-2xs">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5" title="Prioriza gerencias con menor % de automatización de mayor a menor horas hasta alcanzar esta meta">
                  <Target className="w-3.5 h-3.5 text-rose-600" />
                  Meta Nivelación:
                </span>
                <span className="font-mono font-black text-rose-600 text-sm">
                  {levelingTargetPct}% auto
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                Prioriza &lt; <strong className="text-rose-700 font-mono font-bold">{levelingTargetPct}%</strong> de mayor a menor horas
              </div>
            </div>
            <input
              type="range"
              min={60}
              max={90}
              step={5}
              value={levelingTargetPct}
              onChange={(e) => setLevelingTargetPct(Number(e.target.value))}
              className="w-full accent-rose-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>60%</span>
              <span className="text-rose-700 font-bold">80% (Meta)</span>
              <span>90%</span>
            </div>
          </div>

          {/* Parámetro 7: Requerimientos Operativos Anuales - INDEPENDIENTE */}
          <div className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-3.5 space-y-2 flex flex-col justify-between hover:border-slate-300 transition-all shadow-2xs">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5" title="Requerimientos operativos anuales para Eficiencia de Procesos (Horas por definir)">
                  <FileText className="w-3.5 h-3.5 text-violet-600" />
                  Requerimientos:
                </span>
                <span className="font-mono font-black text-violet-600 text-sm">
                  {anualRequerimientos} / año
                </span>
              </div>
              <div className="text-[11px] text-slate-500 flex items-center justify-between">
                <span>Total {horizonYears} {horizonYears === 1 ? 'año' : 'años'}:</span>
                <strong className="text-violet-700 font-mono font-bold">
                  {anualRequerimientos * horizonYears} reqs [Por Definir]
                </strong>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAnualRequerimientos((prev) => Math.max(0, prev - 1))}
                  className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 transition-colors cursor-pointer shrink-0"
                  title="Disminuir 1 requerimiento/año"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  type="range"
                  min={0}
                  max={40}
                  step={1}
                  value={anualRequerimientos}
                  onChange={(e) => setAnualRequerimientos(Number(e.target.value))}
                  className="w-full accent-violet-600 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setAnualRequerimientos((prev) => Math.min(50, prev + 1))}
                  className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 transition-colors cursor-pointer shrink-0"
                  title="Aumentar 1 requerimiento/año"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0 req</span>
                <span className="text-violet-700 font-bold">10/año (Base)</span>
                <span>40 req</span>
              </div>
            </div>
          </div>

          {/* Parámetro 8: Mantenimientos Operativos Anuales - INDEPENDIENTE */}
          <div className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-3.5 space-y-2 flex flex-col justify-between hover:border-slate-300 transition-all shadow-2xs">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5" title="Mantenimientos preventivos y correctivos anuales para Eficiencia de Procesos (Horas por definir)">
                  <Wrench className="w-3.5 h-3.5 text-amber-600" />
                  Mantenimientos:
                </span>
                <span className="font-mono font-black text-amber-600 text-sm">
                  {anualMantenimientos} / año
                </span>
              </div>
              <div className="text-[11px] text-slate-500 flex items-center justify-between">
                <span>Total {horizonYears} {horizonYears === 1 ? 'año' : 'años'}:</span>
                <strong className="text-amber-700 font-mono font-bold">
                  {anualMantenimientos * horizonYears} mants [Por Definir]
                </strong>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAnualMantenimientos((prev) => Math.max(0, prev - 1))}
                  className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 transition-colors cursor-pointer shrink-0"
                  title="Disminuir 1 mantenimiento/año"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  type="range"
                  min={0}
                  max={60}
                  step={1}
                  value={anualMantenimientos}
                  onChange={(e) => setAnualMantenimientos(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setAnualMantenimientos((prev) => Math.min(100, prev + 1))}
                  className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 transition-colors cursor-pointer shrink-0"
                  title="Aumentar 1 mantenimiento/año"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0 mant</span>
                <span className="text-amber-700 font-bold">25/año (Base)</span>
                <span>60 mant</span>
              </div>
            </div>
          </div>
        </div>

        {/* Botones de gestión rápida de vacantes */}
        <div className="relative z-10 mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Equipo configurado:</span>
            <span className="font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
              {teamMembers.length} Colaboradores
            </span>
            <span className="text-slate-500 text-[11px]">
              (3 Jefes, 3 Becarios, 9 Especialistas
              {teamMembers.length > 15 ? ` + ${teamMembers.length - 15} vacantes agregadas` : ''})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddSpecialistVacancy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-colors cursor-pointer shadow-2xs"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ Vacante Especialista</span>
            </button>
            <button
              type="button"
              onClick={handleAddBecarioVacancy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-300 transition-colors cursor-pointer shadow-2xs"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ Vacante Becario</span>
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SEMÁFORO DE VIABILIDAD Y 4 TARJETAS KPI EJECUTIVAS */}
      {/* ------------------------------------------------------------- */}
      <div
        className={`rounded-2xl p-5 border shadow-sm transition-all flex flex-col md:flex-row items-center justify-between gap-4 ${
          planMetrics.esViable
            ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
            : 'bg-rose-50 border-rose-300 text-rose-950'
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
              planMetrics.esViable
                ? 'bg-emerald-600 text-white'
                : 'bg-rose-600 text-white'
            }`}
          >
            {planMetrics.esViable ? (
              <CheckCircle2 className="w-7 h-7" />
            ) : (
              <AlertTriangle className="w-7 h-7" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base md:text-lg">
                {planMetrics.esViable
                  ? 'Plan de Automatización 100% Viable'
                  : 'Atención: Déficit de Capacidad en el Plazo Establecido'}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                  planMetrics.esViable
                    ? 'bg-emerald-200 text-emerald-900'
                    : 'bg-rose-200 text-rose-900 animate-pulse'
                }`}
              >
                {planMetrics.esViable ? 'Superávit' : 'Déficit'}
              </span>
            </div>
            <p className="text-xs md:text-sm mt-0.5 opacity-90 leading-snug">
              {planMetrics.esViable ? (
                <>
                  La capacidad total del equipo (
                  <strong>{formatThousands(planMetrics.capacidadTotalEquipo)} actividades</strong>)
                  cubre holgadamente las{' '}
                  <strong>{formatThousands(planMetrics.totalActividades)} actividades</strong> del plan en los{' '}
                  <strong>{horizonYears} años</strong> (margen de{' '}
                  <strong className="text-emerald-700 font-mono">
                    +{formatThousands(planMetrics.balanceActividades)} actividades
                  </strong>
                  ).
                </>
              ) : (
                <>
                  Faltan{' '}
                  <strong className="text-rose-700 font-mono">
                    {formatThousands(Math.abs(planMetrics.balanceActividades))} actividades
                  </strong>{' '}
                  de capacidad para completar la meta en {horizonYears} años. Se sugiere contratar{' '}
                  <strong>
                    {Math.ceil(
                      Math.abs(planMetrics.balanceActividades) / (especialistaCapacityRate * totalMonths)
                    )}{' '}
                    vacante(s) de especialista adicional(es)
                  </strong>{' '}
                  o hacer clic en <em>&quot;Ritmo Meta Automático&quot;</em>.
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-white/80 backdrop-blur-xs px-4 py-2.5 rounded-xl border border-current/20 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">
              Cobertura de Capacidad
            </div>
            <div className="text-2xl font-black font-mono">
              {(
                (planMetrics.capacidadTotalEquipo / Math.max(1, planMetrics.totalActividades)) *
                100
              ).toFixed(1)}
              %
            </div>
          </div>
        </div>
      </div>

      {/* Grid de 4 KPIs Numéricos de Alto Impacto */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Actividades a Distribuir */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:shadow-sm transition-shadow border-t-4 border-t-blue-600 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
              <span>Actividades del Plan</span>
              <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                <Layers className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-black font-mono tabular-nums text-slate-900">
                {formatThousands(planMetrics.totalActividades)}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60 font-mono">
                {BASE_PLAN_START_YEAR} - {toCalendarYear(horizonYears)}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-0.5">
            <div>
              • No Dig Sí Auto: <strong className="text-slate-800">{candidateActivities.noDigSiAuto.length}</strong> (100% Hoja 2)
            </div>
            <div>
              • No Dig No Auto: <strong className="text-slate-800">{candidateActivities.noDigNoAutoSelected.length}</strong> ({includeNoAutoActivities ? `${pctNoAutoThreshold}% s/total Hoja 2 (${totalHoja2Activities} act)` : 'Desactivadas 0'})
            </div>
            <div>
              • Reqs & Mants: <strong className="text-slate-800">{operationalActivities.totalOpsCount}</strong> ({operationalActivities.totalReqs} reqs / {operationalActivities.totalMants} mants en {horizonYears} {horizonYears === 1 ? 'año' : 'años'} · Por definir)
            </div>
          </div>
        </div>

        {/* KPI 2: Total Horas Manuales a Liberar */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:shadow-sm transition-shadow border-t-4 border-t-indigo-600 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
              <span>Horas Manuales a Liberar</span>
              <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                <Clock className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-black font-mono tabular-nums text-slate-900">
                {formatHours(planMetrics.totalHorasManuales)}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60 font-mono">
                h / mes
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Equivalente en plantilla:</span>
            <span className="font-mono font-bold text-indigo-900 text-xs bg-indigo-50 px-2 py-0.5 rounded">
              {formatThousands(planMetrics.totalHorasManuales / 152, 1)} FTEs
            </span>
          </div>
        </div>

        {/* KPI 3: Capacidad Total del Equipo */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:shadow-sm transition-shadow border-t-4 border-t-emerald-600 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
              <span>Capacidad Total Equipo</span>
              <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                <Users className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-black font-mono tabular-nums text-slate-900">
                {formatThousands(planMetrics.capacidadTotalEquipo)}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-mono">
                {teamMembers.length} personas
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-0.5">
            <div>
              • 3 Jefes: <strong className="text-slate-800">{3 * Math.round(jefeCapacityRate * totalMonths)}</strong> act
            </div>
            <div>
              • 3 Becarios: <strong className="text-slate-800">{3 * Math.round(becarioCapacityRate * totalMonths)}</strong> act
            </div>
            <div>
              • Especialistas: <strong className="text-slate-800">
                {teamMembers.filter((m) => m.role === 'Especialista').length * Math.round(especialistaCapacityRate * totalMonths)}
              </strong> act
            </div>
          </div>
        </div>

        {/* KPI 4: Balance y Ritmo Requerido */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:shadow-sm transition-shadow border-t-4 border-t-amber-600 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
              <span>Ritmo Mensual Equipo</span>
              <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                <TrendingUp className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-black font-mono tabular-nums text-slate-900">
                {(planMetrics.totalActividades / totalMonths).toFixed(1)}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/60 font-mono">
                act / mes
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Ritmo por Especialista:</span>
            <span className="font-mono font-bold text-amber-900 text-xs bg-amber-50 px-2 py-0.5 rounded">
              {especialistaCapacityRate} act / mes
            </span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECCIÓN INTERACTIVA: NIVELACIÓN DE AUTOMATIZACIÓN POR GERENCIA (META 80%) */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200/60">
                <Target className="w-5 h-5" />
              </span>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                Estrategia de Nivelación de Automatización por Gerencia (Prioridad hasta {levelingTargetPct}%)
              </h3>
            </div>
            <p className="text-xs text-slate-600 max-w-4xl leading-relaxed">
              Equilibrio operativo: Para calcular el avance de automatización hacia la meta del <strong className="text-slate-900 font-bold">{levelingTargetPct}%</strong>, el 100% de automatización se determina como la suma de las <strong className="text-slate-900 font-semibold">horas automatizadas + horas no digitalizadas sí automatizables</strong> (de acuerdo con la Hoja 1). Para el porcentaje proyectado global, el 100% corresponde a la <strong className="text-slate-900 font-semibold">suma total de horas de actividades de la gerencia</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowLevelingBreakdown(!showLevelingBreakdown)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-colors cursor-pointer shadow-2xs"
            >
              {showLevelingBreakdown ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5 text-slate-600" />
                  <span>Ocultar Matriz ({gerenciaLevelingProjections.length})</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5 text-rose-600" />
                  <span>Ver Matriz de Nivelación ({gerenciaLevelingProjections.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Resumen ejecutivo de nivelación en badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Gerencias Iniciales &lt; {levelingTargetPct}%
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-black font-mono text-amber-700">
                {gerenciasBelowTargetInitially}
              </span>
              <span className="text-[11px] text-slate-500">
                de {gerenciaLevelingProjections.length} gerencias
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Menor base: <strong className="text-slate-800">CXP ({gerenciaLevelingProjections[0]?.initialAvancePct ?? 0}%)</strong>
            </div>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
              Gerencias con Meta Proyectada
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-black font-mono text-emerald-800">
                {gerenciasMeetingTargetProjected}
              </span>
              <span className="text-[11px] text-emerald-700">
                de {gerenciaLevelingProjections.length} ({(gerenciasMeetingTargetProjected / Math.max(1, gerenciaLevelingProjections.length) * 100).toFixed(0)}%)
              </span>
            </div>
            <div className="text-[10px] text-emerald-700 mt-0.5">
              Alcanzan ≥ {levelingTargetPct}% de lo automatizable
            </div>
          </div>

          <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-rose-800">
              Tier 1: Nivelación (&lt; {levelingTargetPct}%)
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-black font-mono text-rose-800">
                {totalTier1Acts}
              </span>
              <span className="text-[11px] text-rose-700">
                actividades prioritarias
              </span>
            </div>
            <div className="text-[10px] text-rose-700 mt-0.5">
              Hasta el {levelingTargetPct}% de lo automatizable
            </div>
          </div>

          <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-800">
              Tier 2: Consolidación (≥ {levelingTargetPct}%)
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-black font-mono text-indigo-800">
                {totalTier2Acts}
              </span>
              <span className="text-[11px] text-indigo-700">
                actividades
              </span>
            </div>
            <div className="text-[10px] text-indigo-700 mt-0.5">
              Consolidación sobre el {levelingTargetPct}%
            </div>
          </div>
        </div>

        {/* Matriz detallada de las 14 gerencias desplegable */}
        {showLevelingBreakdown && (
          <div className="pt-2 border-t border-slate-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {gerenciaLevelingProjections.map((g, idx) => {
                const isBaseOver80 = g.initialAvancePct >= levelingTargetPct;
                const isProjectedOver80 = g.meetsTarget;

                return (
                  <div
                    key={g.gerencia}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isBaseOver80
                        ? 'bg-slate-50/80 border-slate-200'
                        : isProjectedOver80
                        ? 'bg-emerald-50/40 border-emerald-200/80 shadow-2xs'
                        : 'bg-amber-50/40 border-amber-200/80 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-700">
                            #{idx + 1} Prio
                          </span>
                          <span className="font-bold text-slate-900 text-xs">
                            {g.gerencia}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          Total horas gerencia: <strong>{formatThousands(g.totalHours)} h/m</strong>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          100% Automatizable: <strong className="text-slate-800">{formatThousands(g.autoBase100)} h/m</strong> ({formatHours(g.initialAutoHours)} h auto + {formatHours(g.noDigSiHours)} h no dig sí auto)
                        </div>
                      </div>

                      {/* Badge de estado frente a la meta */}
                      <div>
                        {isBaseOver80 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-800 border border-slate-300" title={`Base inicial: ${g.initialAvancePct}% de su universo automatizable`}>
                            ⭐ Base ≥ {levelingTargetPct}% ({g.initialAvancePct}%)
                          </span>
                        ) : isProjectedOver80 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300" title={`Avance proyectado: ${g.projectedAvancePct}% sobre horas automatizables`}>
                            ✅ Meta {levelingTargetPct}% (+{g.deltaAvancePct}%)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300" title={`Avance proyectado: ${g.projectedAvancePct}% sobre horas automatizables`}>
                            🎯 Nivelando ({g.projectedAvancePct}% de meta)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Barra de progreso de avance hacia la meta del 80% de lo automatizable */}
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-slate-600">
                          Avance Auto Inicial: <strong className="text-slate-900">{g.initialAvancePct}%</strong>
                        </span>
                        <span className="font-bold text-slate-900">
                          Avance Proyectado: <strong className={isProjectedOver80 ? 'text-emerald-700 text-xs' : 'text-amber-800'}>{g.projectedAvancePct}%</strong>
                        </span>
                      </div>

                      {/* Track de progreso con marca visual en 80% */}
                      <div className="relative w-full h-3 bg-slate-200 rounded-full overflow-hidden flex">
                        {/* Porcentaje inicial sobre base automatizable */}
                        <div
                          className="h-full bg-slate-600 transition-all duration-300"
                          style={{ width: `${Math.min(100, g.initialAvancePct)}%` }}
                          title={`Inicial: ${g.initialAvancePct}% de lo automatizable`}
                        />
                        {/* Aporte del plan */}
                        <div
                          className="h-full bg-emerald-500 transition-all duration-300"
                          style={{ width: `${Math.max(0, Math.min(100 - g.initialAvancePct, g.deltaAvancePct))}%` }}
                          title={`Aporte del plan: +${g.deltaAvancePct}%`}
                        />
                        {/* Línea de meta de 80% */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-red-600 z-10"
                          style={{ left: `${levelingTargetPct}%` }}
                          title={`Meta: ${levelingTargetPct}% de lo automatizable`}
                        />
                      </div>

                      {/* Porcentaje Proyectado Global (respecto al 100% de horas totales de la gerencia) */}
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-0.5">
                        <span>Global s/Total Horas Gerencia:</span>
                        <span>
                          Inicial <strong>{g.initialPct}%</strong> → Proyectado <strong className="text-slate-900 font-bold">{g.projectedPct}%</strong> (+{g.deltaPct}%)
                        </span>
                      </div>
                    </div>

                    {/* Desglose de actividades y cronograma */}
                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-600 font-mono">
                      <span>
                        Plan: <strong className="text-slate-900 font-bold">{g.planActsCount} act</strong> ({formatHours(g.hoursFromPlan)} h/m)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 rounded bg-white border border-slate-200">
                          2027: {g.year1Count}
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-white border border-slate-200">
                          2028: {g.year2Count}
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-white border border-slate-200">
                          2029+: {g.year3Count}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* NAVEGACIÓN DE PESTAÑAS INTERNAS DE LA HOJA 3 */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border border-slate-200 rounded-xl p-2 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('colaboradores')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'colaboradores'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Matriz de Colaboradores & Gerencias ({collaboratorsSummary.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('actividades')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'actividades'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Catálogo Asignado & Reasignación ({planActivities.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cronograma')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'cronograma'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Cronograma por Años ({BASE_PLAN_START_YEAR} a {toCalendarYear(horizonYears)})</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium px-3 py-1">
          Regla Nómina:{' '}
          <span className="font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            Exclusivo Daniel García Velázquez
          </span>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* VISTA 1: MATRIZ DE COLABORADORES Y DISTRIBUCIÓN POR GERENCIA */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'colaboradores' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Distribución por Colaborador del Equipo de Eficiencia</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Haz clic en cualquier colaborador para desplegar u ocultar el desglose de sus actividades asignadas.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Controles de expansión masiva */}
              <div className="flex items-center gap-1.5 mr-2">
                <button
                  type="button"
                  onClick={expandAllCollabs}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-slate-700 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 transition-colors shadow-2xs cursor-pointer"
                  title="Desplegar actividades de todos los colaboradores"
                >
                  <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                  <span>Expandir Todos</span>
                </button>
                <button
                  type="button"
                  onClick={collapseAllCollabs}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors shadow-2xs cursor-pointer"
                  title="Colapsar todas las filas"
                >
                  <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                  <span>Colapsar Todos</span>
                </button>
              </div>

              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-50 text-blue-800 border border-blue-200 font-semibold">
                ⭐ Exclusivo Nómina
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-purple-50 text-purple-800 border border-purple-200 font-semibold">
                Vacante de Posición
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="w-9 py-3 pl-3 pr-1 text-center"></th>
                  <th className="py-3 px-3">Colaborador</th>
                  <th className="py-3 px-3">Rol</th>
                  <th className="py-3 px-3 text-center">Capacidad Máx ({horizonYears}a)</th>
                  <th className="py-3 px-3 text-center">Actividades Asignadas</th>
                  <th className="py-3 px-3 text-right">Horas Asignadas / mes</th>
                  <th className="py-3 px-3 text-center">% Ocupación</th>
                  <th className="py-3 px-4">Gerencias con Actividades</th>
                  <th className="py-3 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80">
                {collaboratorsSummary.map((collab) => {
                  const ocupPct = collab.totalCapacity > 0 ? (collab.assignedCount / collab.totalCapacity) * 100 : 0;
                  const isDaniel = collab.isNominaExclusive;
                  const isVac = collab.isVacancy;
                  const isExpanded = expandedCollabIds.has(collab.id);

                  // Actividades asignadas a este colaborador
                  const collabActivities = planActivities.filter(
                    (a) => a.colaboradorAsignadoId === collab.id
                  );
                  const countSiAuto = collabActivities.filter((a) => a.tipo === 'NO_DIG_SI_AUTO').length;
                  const countNoAuto = collabActivities.filter((a) => a.tipo === 'NO_DIG_NO_AUTO').length;
                  const countOps = collabActivities.filter(
                    (a) => a.tipo === 'REQUERIMIENTO' || a.tipo === 'MANTENIMIENTO'
                  ).length;

                  return (
                    <React.Fragment key={collab.id}>
                      <tr
                        onClick={() => toggleCollabExpand(collab.id)}
                        className={`hover:bg-blue-50/50 transition-colors cursor-pointer select-none ${
                          isExpanded
                            ? 'bg-blue-50/40 font-medium'
                            : isDaniel
                            ? 'bg-blue-50/20'
                            : isVac
                            ? 'bg-purple-50/15'
                            : ''
                        }`}
                        title="Haz clic para ver/ocultar actividades asignadas"
                      >
                        {/* Columna 1: Chevron expander */}
                        <td className="py-3 pl-3 pr-1 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCollabExpand(collab.id);
                            }}
                            className={`w-6 h-6 rounded-md inline-flex items-center justify-center transition-all cursor-pointer ${
                              isExpanded
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/60'
                            }`}
                            title={isExpanded ? 'Ocultar actividades' : 'Desplegar actividades'}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                isDaniel
                                  ? 'bg-blue-600 text-white'
                                  : isVac
                                  ? 'bg-purple-600 text-white'
                                  : collab.role.includes('Jefe')
                                  ? 'bg-slate-800 text-white'
                                  : collab.role === 'Becario'
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-slate-200 text-slate-800'
                              }`}
                            >
                              {collab.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <span>{collab.name}</span>
                                {isDaniel && (
                                  <span
                                    className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-100 text-blue-900 border border-blue-300"
                                    title="Único colaborador autorizado a automatizar actividades de Nómina"
                                  >
                                    ⭐ Exclusivo Nómina
                                  </span>
                                )}
                                {isVac && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                    Vacante
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                                <span>{collab.monthlyCapacity} act/mes nominal</span>
                                <span className="text-slate-300">·</span>
                                <span className="text-blue-600 font-semibold hover:underline">
                                  {isExpanded ? 'Ocultar actividades' : `Ver ${formatActivityCount(collab.assignedCount)} actividades`}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span
                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                              collab.role.includes('Jefe')
                                ? 'bg-slate-100 text-slate-800 border border-slate-300'
                                : collab.role === 'Becario'
                                ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {collab.role}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-700">
                          {collab.totalCapacity}
                        </td>

                        <td className="py-3 px-3 text-center">
                          <span className="font-mono font-black text-slate-900 text-sm bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 inline-flex items-center gap-1">
                            <span>{formatActivityCount(collab.assignedCount)}</span>
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          {formatHours(collab.assignedHours)} h
                        </td>

                        <td className="py-3 px-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span
                              className={`font-mono font-bold text-xs ${
                                ocupPct > 100
                                  ? 'text-rose-600'
                                  : ocupPct >= 80
                                  ? 'text-emerald-700'
                                  : 'text-amber-700'
                              }`}
                            >
                              {ocupPct.toFixed(1)}%
                            </span>
                            <div className="w-20 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${Math.min(100, ocupPct)}%` }}
                                className={`h-full ${
                                  ocupPct > 100
                                    ? 'bg-rose-500'
                                    : ocupPct >= 80
                                    ? 'bg-emerald-500'
                                    : 'bg-amber-500'
                                }`}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="space-y-1.5 max-w-md">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-500 font-mono">
                                {collab.isNominaExclusive
                                  ? 'Exclusivo 1 Gerencia'
                                  : `${collab.gerenciasCovered.length} Gerencias cubiertas`}
                              </span>
                              {!collab.isNominaExclusive && collab.gerenciasCovered.length >= 10 && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Portafolio Integral
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {collab.gerenciasCovered.map((g) => {
                                const isNom = g.toLowerCase().includes('nomin');
                                return (
                                  <span
                                    key={g}
                                    className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                                      isNom
                                        ? 'bg-blue-100 text-blue-900 border-blue-300 font-bold'
                                        : 'bg-slate-100 text-slate-700 border-slate-200'
                                    }`}
                                  >
                                    {g}
                                  </span>
                                );
                              })}
                              {collab.gerenciasCovered.length === 0 && (
                                <span className="text-slate-400 italic text-[11px]">Sin asignaciones</span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          {collab.isVacancy && !collab.id.includes('becario-3') ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(collab.id)}
                              className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Remover vacante agregada"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[10px]">—</span>
                          )}
                        </td>
                      </tr>

                      {/* ------------------------------------------------------------- */}
                      {/* FILA EXPANDIBLE: CATÁLOGO DE ACTIVIDADES DE ESTE COLABORADOR */}
                      {/* ------------------------------------------------------------- */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-b-2 border-blue-300">
                          <td colSpan={9} className="p-0">
                            <div className="border-l-4 border-l-blue-600 bg-slate-50/80 p-4 space-y-3">
                              {/* Barra superior de métricas del colaborador expandido */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                                    <Briefcase className="w-4 h-4 text-blue-600" />
                                    <span>Actividades asignadas a <strong className="text-blue-900">{collab.name}</strong></span>
                                  </span>
                                  <span className="px-2.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-900 text-xs font-mono border border-blue-200">
                                    {collabActivities.length} actividades
                                  </span>
                                  <span className="px-2.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-800 text-xs font-mono border border-slate-200">
                                    {formatHours(collab.assignedHours)} h manuales / mes
                                  </span>
                                  <div className="hidden lg:flex items-center gap-1.5 text-xs ml-1">
                                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-medium border border-emerald-200">
                                      {countSiAuto} Sí Auto
                                    </span>
                                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-medium border border-amber-200">
                                      {countNoAuto} No Auto Top
                                    </span>
                                    {countOps > 0 && (
                                      <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 font-medium border border-indigo-200">
                                        {countOps} Req/Mant
                                      </span>
                                    )}
                                  </div>
                                </div>

                                 <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFilterColaboradores([collab.id]);
                                      setActiveTab('actividades');
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 hover:text-blue-900 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer shadow-2xs"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    <span>Ver en Catálogo Asignado</span>
                                  </button>
                                </div>
                              </div>

                              {/* Tabla detallada de actividades asignadas */}
                              {collabActivities.length === 0 ? (
                                <div className="bg-white border border-dashed border-slate-300 rounded-xl p-6 text-center text-xs text-slate-500">
                                  <Info className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                                  <p className="font-semibold text-slate-700">Este colaborador no tiene actividades asignadas en este escenario.</p>
                                  <p className="text-[11px] text-slate-400 mt-0.5">Puedes reasignarle actividades desde el catálogo o incrementar el ritmo de automatización.</p>
                                </div>
                              ) : (
                                <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-2xs">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-100/90 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                                      <tr>
                                        <th className="py-2.5 px-3 text-center w-14">Prio</th>
                                        <th className="py-2.5 px-3 text-center w-16">Año</th>
                                        <th className="py-2.5 px-3 w-36">Gerencia</th>
                                        <th className="py-2.5 px-4">Actividad / Tarea</th>
                                        <th className="py-2.5 px-3 w-52">Tipo en Plan</th>
                                        <th className="py-2.5 px-3 text-right w-28">Horas Manuales</th>
                                        <th className="py-2.5 px-4 w-60">Reasignar</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200/80">
                                      {collabActivities.map((act) => (
                                        <tr
                                          key={act.id}
                                          className={`hover:bg-slate-50/80 transition-colors ${
                                            act.isNomina ? 'bg-blue-50/20' : ''
                                          }`}
                                        >
                                          <td className="py-2 px-3 text-center font-mono font-bold text-slate-500 text-xs">
                                            #{act.prioridad}
                                          </td>
                                          <td className="py-2 px-3 text-center">
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-900 border border-blue-200 font-mono">
                                              {act.tipo === 'REQUERIMIENTO' || act.tipo === 'MANTENIMIENTO' ? 'Anual' : toCalendarYear(act.assignedYear)}
                                            </span>
                                          </td>
                                          <td className="py-2 px-3">
                                            <div className="flex flex-col">
                                              <span
                                                className={`font-semibold ${
                                                  act.isNomina ? 'text-blue-900 font-bold' : 'text-slate-800'
                                                }`}
                                              >
                                                {act.gerencia}
                                              </span>
                                              {act.gerenciaInitialPct !== undefined && (
                                                <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                                                  Avance Base: <strong className={act.gerenciaInitialPct < levelingTargetPct ? 'text-amber-700 font-bold' : 'text-emerald-700 font-bold'}>{act.gerenciaInitialPct}%</strong> auto
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="py-2 px-4 max-w-md">
                                            <div className="font-semibold text-slate-900 leading-snug">
                                              {act.actividadProceso}
                                            </div>
                                          </td>
                                          <td className="py-2 px-3">
                                            <div className="flex flex-col gap-1 items-start">
                                              <span
                                                className={`px-2 py-0.5 rounded text-[10px] font-medium border inline-block ${
                                                  act.tipo === 'NO_DIG_SI_AUTO'
                                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                    : act.tipo === 'NO_DIG_NO_AUTO'
                                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                    : act.tipo === 'REQUERIMIENTO'
                                                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                                                    : 'bg-purple-50 text-purple-800 border-purple-200'
                                                }`}
                                              >
                                                {act.tipoLabel}
                                              </span>
                                              {act.levelingTier === 'NIVELACION_SUB_80' && (
                                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                                                  🎯 Nivelación (&lt; {levelingTargetPct}%)
                                                </span>
                                              )}
                                              {act.levelingTier === 'CONSOLIDACION_SUPER_80' && (
                                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                                                  ✨ Consolidación (≥ {levelingTargetPct}%)
                                                </span>
                                              )}
                                              {act.levelingTier === 'EVALUACION_NO_AUTO' && (
                                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                                                  🔍 Cupo No Auto
                                                </span>
                                              )}
                                              {act.levelingTier === 'OPERATIVO' && (
                                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1">
                                                  ⚙️ Operativo
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                            {act.tipo === 'NO_DIG_NO_AUTO' || (act as any).isPendingDefinition ? (
                                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                                Por definir
                                              </span>
                                            ) : (
                                              `${formatHours(act.horasManualesMensuales)} h`
                                            )}
                                          </td>
                                          <td className="py-2 px-4" onClick={(e) => e.stopPropagation()}>
                                            {act.isNomina ? (
                                              <div className="flex items-center gap-1.5 text-blue-900 font-bold bg-blue-50 px-2 py-1 rounded-md border border-blue-200 text-[11px]">
                                                <span>⭐ {act.colaboradorAsignadoNombre}</span>
                                                <span className="text-[10px] text-blue-700 font-normal">
                                                  (Exclusivo Nómina)
                                                </span>
                                              </div>
                                            ) : (
                                              <select
                                                value={act.colaboradorAsignadoId}
                                                onChange={(e) => handleReassignActivity(act.id, e.target.value)}
                                                className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
                                              >
                                                {collaboratorsSummary.map((c) => (
                                                  <option key={c.id} value={c.id}>
                                                    {c.name} ({c.role}) · {formatActivityCount(c.assignedCount)}/{c.totalCapacity}
                                                  </option>
                                                ))}
                                              </select>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VISTA 2: CATÁLOGO DE ACTIVIDADES ASIGNADAS Y REASIGNACIÓN */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'actividades' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden space-y-4 p-5 relative">
          {/* Backdrop para cerrar popovers de filtros Excel */}
          {openHeaderFilter && (
            <div
              className="fixed inset-0 z-30 bg-transparent cursor-default"
              onClick={() => setOpenHeaderFilter(null)}
            />
          )}

          {/* Barra superior del Catálogo: Búsqueda rápida y Resumen de Filtros */}
          <div className="flex flex-col gap-3 pb-4 border-b border-slate-200 relative z-20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Buscador de texto global */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar texto en actividad, gerencia, colaborador..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Controles de Vista y Paginación */}
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                  <span className="text-slate-500 font-semibold">Mostrar:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                    className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
                  >
                    <option value={50}>50 actividades</option>
                    <option value={100}>100 actividades</option>
                    <option value={200}>200 actividades</option>
                    <option value="ALL">Todas ({filteredActivities.length})</option>
                  </select>
                </div>

                <div className="text-xs text-slate-600 font-mono font-bold">
                  {filteredActivities.length} de {planActivities.length} act
                </div>

                {isAnyFilterActive && (
                  <button
                    type="button"
                    onClick={handleClearAllFilters}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200 transition-colors cursor-pointer"
                    title="Limpiar todos los filtros"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Limpiar filtros</span>
                  </button>
                )}
              </div>
            </div>

            {/* Chips de Filtros Activos (Estilo Excel) */}
            {isAnyFilterActive && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1">
                  <SlidersHorizontal className="w-3 h-3 text-blue-600" />
                  Filtros activos:
                </span>

                {searchQuery && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-800 border border-blue-200">
                    <span>Texto: &quot;{searchQuery}&quot;</span>
                    <button type="button" onClick={() => setSearchQuery('')} className="hover:text-blue-900 cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {filterYears.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-800 border border-indigo-200">
                    <span>Años: {filterYears.join(', ')}</span>
                    <button type="button" onClick={() => setFilterYears([])} className="hover:text-indigo-900 cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {filterGerencias.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 text-purple-800 border border-purple-200">
                    <span>Gerencias: {filterGerencias.length} seleccionada(s)</span>
                    <button type="button" onClick={() => setFilterGerencias([])} className="hover:text-purple-900 cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {filterTipos.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <span>Tipos: {filterTipos.length} seleccionado(s)</span>
                    <button type="button" onClick={() => setFilterTipos([])} className="hover:text-emerald-900 cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {filterColaboradores.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-cyan-50 text-cyan-800 border border-cyan-200">
                    <span>Colaboradores: {filterColaboradores.length} seleccionado(s)</span>
                    <button type="button" onClick={() => setFilterColaboradores([])} className="hover:text-cyan-900 cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {filterColabRoles.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-300">
                    <span>Rol: {filterColabRoles.join(', ')}</span>
                    <button type="button" onClick={() => setFilterColabRoles([])} className="hover:text-slate-900 cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {filterHoursRange !== 'ALL' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                    <span>
                      Horas: {filterHoursRange === 'POR_DEFINIR' ? 'Por definir' : filterHoursRange === 'CON_HORAS' ? 'Con horas' : filterHoursRange === 'GT_30' ? '≥ 30h' : '≥ 60h'}
                    </span>
                    <button type="button" onClick={() => setFilterHoursRange('ALL')} className="hover:text-amber-900 cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {filterSortPrio === 'DESC' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-300">
                    <span>Orden: Prio descendente</span>
                    <button type="button" onClick={() => setFilterSortPrio('ASC')} className="hover:text-slate-900 cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Tabla de Actividades Asignadas con Encabezados Filtrables Tipo Excel */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 relative z-10">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  {/* COL 1: PRIORIDAD (CON ORDENAMIENTO EXCEL) */}
                  <th className="py-3 px-3 text-center relative w-20">
                    <button
                      type="button"
                      onClick={() => setFilterSortPrio(filterSortPrio === 'ASC' ? 'DESC' : 'ASC')}
                      className={`inline-flex items-center justify-center gap-1 px-1.5 py-1 rounded transition-colors cursor-pointer ${
                        filterSortPrio === 'DESC'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'hover:bg-slate-200 text-slate-700'
                      }`}
                      title={filterSortPrio === 'ASC' ? 'Orden: Menor a Mayor (Clic para invertir)' : 'Orden: Mayor a Menor (Clic para invertir)'}
                    >
                      <span>Prio</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>

                  {/* COL 2: AÑO CALENDARIO (FILTRO EXCEL) */}
                  <th className="py-3 px-3 text-center relative w-24">
                    <button
                      type="button"
                      onClick={() => setOpenHeaderFilter(openHeaderFilter === 'year' ? null : 'year')}
                      className={`inline-flex items-center justify-center gap-1 px-2 py-1 rounded transition-colors cursor-pointer ${
                        filterYears.length > 0
                          ? 'bg-blue-600 text-white font-bold shadow-2xs'
                          : 'hover:bg-slate-200 text-slate-700'
                      }`}
                      title="Filtrar por Año Calendario"
                    >
                      <span>Año</span>
                      <Filter className="w-3 h-3" />
                      {filterYears.length > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      )}
                    </button>

                    {/* Popover Excel para Año */}
                    {openHeaderFilter === 'year' && (
                      <div className="absolute left-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50 text-left normal-case tracking-normal">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                          <span className="font-bold text-xs text-slate-900">Años Calendario</span>
                          <button
                            type="button"
                            onClick={() => setOpenHeaderFilter(null)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {Array.from({ length: horizonYears }, (_, i) => toCalendarYear(i + 1)).map((yr) => {
                            const isChecked = filterYears.includes(yr);
                            const count = planActivities.filter((a) => toCalendarYear(a.assignedYear) === yr).length;
                            return (
                              <label
                                key={yr}
                                className="flex items-center justify-between gap-2 p-1.5 rounded hover:bg-slate-50 cursor-pointer text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      if (isChecked) {
                                        setFilterYears(filterYears.filter((y) => y !== yr));
                                      } else {
                                        setFilterYears([...filterYears, yr]);
                                      }
                                    }}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="font-bold text-slate-800 font-mono">{yr}</span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono">({count})</span>
                              </label>
                            );
                          })}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() => setFilterYears(Array.from({ length: horizonYears }, (_, i) => toCalendarYear(i + 1)))}
                            className="text-blue-600 hover:underline font-semibold cursor-pointer"
                          >
                            Todos
                          </button>
                          <button
                            type="button"
                            onClick={() => setFilterYears([])}
                            className="text-slate-500 hover:underline cursor-pointer"
                          >
                            Limpiar
                          </button>
                        </div>
                      </div>
                    )}
                  </th>

                  {/* COL 3: GERENCIA (FILTRO EXCEL) */}
                  <th className="py-3 px-3 relative w-48">
                    <button
                      type="button"
                      onClick={() => setOpenHeaderFilter(openHeaderFilter === 'gerencia' ? null : 'gerencia')}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded transition-colors cursor-pointer ${
                        filterGerencias.length > 0
                          ? 'bg-blue-600 text-white font-bold shadow-2xs'
                          : 'hover:bg-slate-200 text-slate-700'
                      }`}
                      title="Filtrar por Gerencia"
                    >
                      <span>Gerencia</span>
                      <Filter className="w-3 h-3" />
                      {filterGerencias.length > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      )}
                    </button>

                    {/* Popover Excel para Gerencia */}
                    {openHeaderFilter === 'gerencia' && (
                      <div className="absolute left-0 top-full mt-1 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50 text-left normal-case tracking-normal">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                          <span className="font-bold text-xs text-slate-900">Gerencias ({planGerencias.length})</span>
                          <button
                            type="button"
                            onClick={() => setOpenHeaderFilter(null)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Buscador interno en lista de gerencias */}
                        <div className="relative mb-2">
                          <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Buscar gerencia..."
                            value={columnSearchGerencia}
                            onChange={(e) => setColumnSearchGerencia(e.target.value)}
                            className="w-full pl-7 pr-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                        <div className="space-y-1 max-h-56 overflow-y-auto">
                          {planGerencias
                            .filter((g) => g.toLowerCase().includes(columnSearchGerencia.toLowerCase()))
                            .map((g) => {
                              const isChecked = filterGerencias.includes(g);
                              const count = planActivities.filter((a) => a.gerencia === g).length;
                              return (
                                <label
                                  key={g}
                                  className="flex items-center justify-between gap-2 p-1 rounded hover:bg-slate-50 cursor-pointer text-xs"
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        if (isChecked) {
                                          setFilterGerencias(filterGerencias.filter((item) => item !== g));
                                        } else {
                                          setFilterGerencias([...filterGerencias, g]);
                                        }
                                      }}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="truncate text-slate-800 font-medium" title={g}>
                                      {g}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                    ({count})
                                  </span>
                                </label>
                              );
                            })}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() => setFilterGerencias(planGerencias)}
                            className="text-blue-600 hover:underline font-semibold cursor-pointer"
                          >
                            Todas
                          </button>
                          <button
                            type="button"
                            onClick={() => setFilterGerencias([])}
                            className="text-slate-500 hover:underline cursor-pointer"
                          >
                            Limpiar
                          </button>
                        </div>
                      </div>
                    )}
                  </th>

                  {/* COL 4: ACTIVIDAD / TAREA */}
                  <th className="py-3 px-4">Actividad / Tarea</th>

                  {/* COL 5: TIPO EN PLAN (FILTRO EXCEL) */}
                  <th className="py-3 px-3 relative w-48">
                    <button
                      type="button"
                      onClick={() => setOpenHeaderFilter(openHeaderFilter === 'tipo' ? null : 'tipo')}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded transition-colors cursor-pointer ${
                        filterTipos.length > 0
                          ? 'bg-blue-600 text-white font-bold shadow-2xs'
                          : 'hover:bg-slate-200 text-slate-700'
                      }`}
                      title="Filtrar por Tipo de Actividad"
                    >
                      <span>Tipo en Plan</span>
                      <Filter className="w-3 h-3" />
                      {filterTipos.length > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      )}
                    </button>

                    {/* Popover Excel para Tipo */}
                    {openHeaderFilter === 'tipo' && (
                      <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50 text-left normal-case tracking-normal">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                          <span className="font-bold text-xs text-slate-900">Tipo en Plan</span>
                          <button
                            type="button"
                            onClick={() => setOpenHeaderFilter(null)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="space-y-1.5">
                          {[
                            { id: 'NO_DIG_SI_AUTO', label: 'No Dig Sí Auto (100%)', color: 'text-emerald-700' },
                            { id: 'NO_DIG_NO_AUTO', label: `No Dig No Auto (Por definir · ${pctNoAutoThreshold}%)`, color: 'text-amber-700' },
                            { id: 'REQUERIMIENTO', label: 'Requerimientos Anuales', color: 'text-blue-700' },
                            { id: 'MANTENIMIENTO', label: 'Mantenimientos Preventivos', color: 'text-purple-700' },
                          ].map((t) => {
                            const isChecked = filterTipos.includes(t.id);
                            const count = planActivities.filter((a) => a.tipo === t.id).length;
                            return (
                              <label
                                key={t.id}
                                className="flex items-center justify-between gap-2 p-1.5 rounded hover:bg-slate-50 cursor-pointer text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      if (isChecked) {
                                        setFilterTipos(filterTipos.filter((item) => item !== t.id));
                                      } else {
                                        setFilterTipos([...filterTipos, t.id]);
                                      }
                                    }}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className={`font-semibold ${t.color}`}>{t.label}</span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono">({count})</span>
                              </label>
                            );
                          })}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() => setFilterTipos(['NO_DIG_SI_AUTO', 'NO_DIG_NO_AUTO', 'REQUERIMIENTO', 'MANTENIMIENTO'])}
                            className="text-blue-600 hover:underline font-semibold cursor-pointer"
                          >
                            Todos
                          </button>
                          <button
                            type="button"
                            onClick={() => setFilterTipos([])}
                            className="text-slate-500 hover:underline cursor-pointer"
                          >
                            Limpiar
                          </button>
                        </div>
                      </div>
                    )}
                  </th>

                  {/* COL 6: HORAS MANUALES (FILTRO EXCEL) */}
                  <th className="py-3 px-3 text-right relative w-32">
                    <button
                      type="button"
                      onClick={() => setOpenHeaderFilter(openHeaderFilter === 'hours' ? null : 'hours')}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded transition-colors cursor-pointer ${
                        filterHoursRange !== 'ALL'
                          ? 'bg-blue-600 text-white font-bold shadow-2xs'
                          : 'hover:bg-slate-200 text-slate-700'
                      }`}
                      title="Filtrar por Rango de Horas"
                    >
                      <span>Horas</span>
                      <Filter className="w-3 h-3" />
                      {filterHoursRange !== 'ALL' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      )}
                    </button>

                    {/* Popover Excel para Horas */}
                    {openHeaderFilter === 'hours' && (
                      <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50 text-left normal-case tracking-normal">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                          <span className="font-bold text-xs text-slate-900">Horas Manuales</span>
                          <button
                            type="button"
                            onClick={() => setOpenHeaderFilter(null)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="space-y-1">
                          {[
                            { id: 'ALL', label: 'Todas las actividades' },
                            { id: 'POR_DEFINIR', label: 'Por definir (No Dig No Auto)' },
                            { id: 'CON_HORAS', label: 'Con horas cuantificadas' },
                            { id: 'GT_30', label: 'Impacto Alto (≥ 30 h/mes)' },
                            { id: 'GT_60', label: 'Impacto Crítico (≥ 60 h/mes)' },
                          ].map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                setFilterHoursRange(opt.id as any);
                                setOpenHeaderFilter(null);
                              }}
                              className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer flex items-center justify-between ${
                                filterHoursRange === opt.id
                                  ? 'bg-blue-50 text-blue-900 font-bold'
                                  : 'hover:bg-slate-50 text-slate-700 font-medium'
                              }`}
                            >
                              <span>{opt.label}</span>
                              {filterHoursRange === opt.id && (
                                <span className="text-blue-600">✓</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </th>

                  {/* COL 7: COLABORADOR ASIGNADO (FILTRO EXCEL) */}
                  <th className="py-3 px-4 relative w-64">
                    <button
                      type="button"
                      onClick={() => setOpenHeaderFilter(openHeaderFilter === 'colab' ? null : 'colab')}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded transition-colors cursor-pointer ${
                        filterColaboradores.length > 0 || filterColabRoles.length > 0
                          ? 'bg-blue-600 text-white font-bold shadow-2xs'
                          : 'hover:bg-slate-200 text-slate-700'
                      }`}
                      title="Filtrar por Colaborador y Rol"
                    >
                      <span>Colaborador Asignado</span>
                      <Filter className="w-3 h-3" />
                      {(filterColaboradores.length > 0 || filterColabRoles.length > 0) && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      )}
                    </button>

                    {/* Popover Excel para Colaborador */}
                    {openHeaderFilter === 'colab' && (
                      <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50 text-left normal-case tracking-normal">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                          <span className="font-bold text-xs text-slate-900">Colaboradores ({collaboratorsSummary.length})</span>
                          <button
                            type="button"
                            onClick={() => setOpenHeaderFilter(null)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Filtros rápidos por Rol */}
                        <div className="flex flex-wrap gap-1 mb-2">
                          {['Jefe Sr', 'Jefe', 'Especialista', 'Becario'].map((r) => {
                            const isSelected = filterColabRoles.includes(r);
                            return (
                              <button
                                key={r}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setFilterColabRoles(filterColabRoles.filter((item) => item !== r));
                                  } else {
                                    setFilterColabRoles([...filterColabRoles, r]);
                                  }
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                              >
                                {r}
                              </button>
                            );
                          })}
                        </div>

                        {/* Buscador interno de colaborador */}
                        <div className="relative mb-2">
                          <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Buscar por nombre..."
                            value={columnSearchColab}
                            onChange={(e) => setColumnSearchColab(e.target.value)}
                            className="w-full pl-7 pr-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                        {/* Lista de colaboradores con checkbox */}
                        <div className="space-y-1 max-h-52 overflow-y-auto">
                          {collaboratorsSummary
                            .filter((c) => c.name.toLowerCase().includes(columnSearchColab.toLowerCase()))
                            .map((c) => {
                              const isChecked = filterColaboradores.includes(c.id);
                              return (
                                <label
                                  key={c.id}
                                  className="flex items-center justify-between gap-2 p-1 rounded hover:bg-slate-50 cursor-pointer text-xs"
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        if (isChecked) {
                                          setFilterColaboradores(filterColaboradores.filter((id) => id !== c.id));
                                        } else {
                                          setFilterColaboradores([...filterColaboradores, c.id]);
                                        }
                                      }}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="truncate text-slate-800 font-semibold">{c.name}</span>
                                    <span className="text-[10px] text-slate-400 shrink-0 font-normal">({c.role})</span>
                                  </div>
                                  <span className="text-[10px] text-slate-500 font-mono font-bold shrink-0">
                                    {formatActivityCount(c.assignedCount)} act
                                  </span>
                                </label>
                              );
                            })}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() => setFilterColaboradores(collaboratorsSummary.map((c) => c.id))}
                            className="text-blue-600 hover:underline font-semibold cursor-pointer"
                          >
                            Todos
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFilterColaboradores([]);
                              setFilterColabRoles([]);
                            }}
                            className="text-slate-500 hover:underline cursor-pointer"
                          >
                            Limpiar
                          </button>
                        </div>
                      </div>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80">
                {(pageSize === 'ALL'
                  ? filteredActivities
                  : filteredActivities.slice(0, pageSize)
                ).map((act) => {
                  const isPending = act.tipo === 'NO_DIG_NO_AUTO' || (act as any).isPendingDefinition;

                  return (
                    <tr
                      key={act.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        act.isNomina ? 'bg-blue-50/20' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-500">
                        #{act.prioridad}
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-900 font-mono border border-blue-200">
                          {act.tipo === 'REQUERIMIENTO' || act.tipo === 'MANTENIMIENTO' ? 'Anual' : toCalendarYear(act.assignedYear)}
                        </span>
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="flex flex-col">
                          <span
                            className={`font-semibold ${
                              act.isNomina ? 'text-blue-900 font-bold' : 'text-slate-800'
                            }`}
                          >
                            {act.gerencia}
                          </span>
                          {act.gerenciaInitialPct !== undefined && (
                            <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                              Avance Base: <strong className={act.gerenciaInitialPct < levelingTargetPct ? 'text-amber-700 font-bold' : 'text-emerald-700 font-bold'}>{act.gerenciaInitialPct}%</strong> auto
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-4 max-w-md">
                        <div className="font-semibold text-slate-900 leading-snug flex items-center gap-1.5 flex-wrap">
                          <span>{act.actividadProceso}</span>
                          {isPending && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                              Por evaluar
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-medium border inline-block ${
                              act.tipo === 'NO_DIG_SI_AUTO'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : act.tipo === 'NO_DIG_NO_AUTO'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : act.tipo === 'REQUERIMIENTO'
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : 'bg-purple-50 text-purple-800 border-purple-200'
                            }`}
                          >
                            {act.tipoLabel}
                          </span>
                          {act.levelingTier === 'NIVELACION_SUB_80' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                              🎯 Nivelación (&lt; {levelingTargetPct}%)
                            </span>
                          )}
                          {act.levelingTier === 'CONSOLIDACION_SUPER_80' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                              ✨ Consolidación (≥ {levelingTargetPct}%)
                            </span>
                          )}
                          {act.levelingTier === 'EVALUACION_NO_AUTO' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                              🔍 Cupo No Auto
                            </span>
                          )}
                          {act.levelingTier === 'OPERATIVO' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1">
                              ⚙️ Operativo
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {isPending ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            Por definir
                          </span>
                        ) : (
                          `${formatHours(act.horasManualesMensuales)} h`
                        )}
                      </td>

                      <td className="py-2.5 px-4">
                        {act.isNomina ? (
                          <div className="flex items-center gap-1.5 text-blue-900 font-bold bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                            <span>⭐ {act.colaboradorAsignadoNombre}</span>
                            <span className="text-[10px] text-blue-700 font-normal">
                              (Exclusivo Nómina)
                            </span>
                          </div>
                        ) : (
                          <select
                            value={act.colaboradorAsignadoId}
                            onChange={(e) => handleReassignActivity(act.id, e.target.value)}
                            className="w-full max-w-xs text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
                          >
                            {collaboratorsSummary.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} ({c.role}) · {formatActivityCount(c.assignedCount)}/{c.totalCapacity}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pageSize !== 'ALL' && filteredActivities.length > pageSize && (
            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 px-1">
              <span>
                Mostrando las primeras <strong>{pageSize}</strong> de <strong>{filteredActivities.length}</strong> actividades filtradas.
              </span>
              <button
                type="button"
                onClick={() => setPageSize('ALL')}
                className="text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer"
              >
                Ver todas ({filteredActivities.length})
              </button>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VISTA 3: CRONOGRAMA POR AÑOS / FASES (2027, 2028, 2029...) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'cronograma' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: horizonYears }, (_, idx) => {
              const yearNum = idx + 1;
              const calYear = toCalendarYear(yearNum);
              const yearActs = planActivities.filter((a) => a.assignedYear === yearNum);
              const yearHours = yearActs.reduce((acc, a) => acc + a.horasManualesMensuales, 0);

              return (
                <div
                  key={yearNum}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase bg-blue-100 text-blue-900 font-mono">
                        {calYear}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 mt-1">
                        {yearNum === 1
                          ? `Fase ${calYear}: Quick Wins y Mayor Impacto`
                          : yearNum === 2
                          ? `Fase ${calYear}: Consolidación y Optimización`
                          : `Fase ${calYear}: Cierre de Complejidad y No Autom.`}
                      </h4>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black font-mono text-slate-900">
                        {yearActs.length}
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">
                        Actividades
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Horas a Liberar (definidas):</span>
                      <strong className="font-mono text-slate-900">{formatHours(yearHours)} h/mes</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">FTEs Liberables:</span>
                      <strong className="font-mono text-blue-800 font-bold">
                        {formatThousands(yearHours / 152, 1)} FTE
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Ritmo Requerido:</span>
                      <strong className="font-mono text-slate-900">
                        {(yearActs.length / 12).toFixed(1)} act/mes
                      </strong>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      Desglose de Actividades de {calYear}:
                    </span>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/60 border border-emerald-200/60">
                        <span className="text-emerald-900 font-medium">No Dig Sí Auto</span>
                        <strong className="font-mono font-bold text-emerald-800">
                          {yearActs.filter((a) => a.tipo === 'NO_DIG_SI_AUTO').length}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50/60 border border-amber-200/60">
                        <span className="text-amber-900 font-medium">No Dig No Auto (Por definir)</span>
                        <strong className="font-mono font-bold text-amber-800">
                          {yearActs.filter((a) => a.tipo === 'NO_DIG_NO_AUTO').length}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50/60 border border-blue-200/60">
                        <span className="text-blue-900 font-medium">Requerimientos Anuales</span>
                        <strong className="font-mono font-bold text-blue-800">
                          {yearActs.filter((a) => a.tipo === 'REQUERIMIENTO').length}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-purple-50/60 border border-purple-200/60">
                        <span className="text-purple-900 font-medium">Mantenimientos Preventivos</span>
                        <strong className="font-mono font-bold text-purple-800">
                          {yearActs.filter((a) => a.tipo === 'MANTENIMIENTO').length}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

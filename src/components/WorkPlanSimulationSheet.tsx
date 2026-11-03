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
} from 'lucide-react';
import { ProcessRecord } from '../types/sheets';
import { computeUniqueActivitiesStatusList, UniqueActivityItem } from '../utils/activityStatusParser';
import { formatHours, formatThousands } from '../utils/sheetsParser';
import {
  PlanCollaborator,
  PlanActivity,
  PlanScenarioConfig,
  exportWorkPlanSimulationXlsx,
} from '../utils/workPlanExport';

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
  const [pctNoAutoThreshold, setPctNoAutoThreshold] = useState<number>(20); // 20% default
  const [anualRequerimientos, setAnualRequerimientos] = useState<number>(10); // 10/año
  const [anualMantenimientos, setAnualMantenimientos] = useState<number>(25); // 25/año
  const [teamMembers, setTeamMembers] = useState<TeamMemberDraft[]>(INITIAL_TEAM);
  const [manualReassignments, setManualReassignments] = useState<Record<string, string>>({});
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [showScenarioDrawer, setShowScenarioDrawer] = useState<boolean>(false);

  // Filtros de tabla detallada
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterGerencia, setFilterGerencia] = useState<string>('ALL');
  const [filterColaborador, setFilterColaborador] = useState<string>('ALL');
  const [filterTipo, setFilterTipo] = useState<string>('ALL');
  const [filterYear, setFilterYear] = useState<number | 'ALL'>('ALL');
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

  // --------------------------------------------------------------------------
  // 1. OBTENCIÓN Y FILTRADO DE ACTIVIDADES ÚNICAS (LÓGICA HOJA 2)
  // --------------------------------------------------------------------------
  const { items: allUniqueActivities } = useMemo(() => {
    return computeUniqueActivitiesStatusList(records, 'ALL');
  }, [records]);

  // Selección de actividades candidatas
  const candidateActivities = useMemo(() => {
    // Excluir aquellas que ya están digitalizadas
    const nonDigitalized = allUniqueActivities.filter((act) => {
      const hasDigSi = act.variants.some((v) => v.digitalizado === 'SÍ');
      return !hasDigSi;
    });

    // 1. No digitalizadas SÍ automatizables (100% seleccionadas, ordenadas por horas manuales desc)
    const noDigSiAuto = nonDigitalized
      .filter((act) => act.variants.some((v) => v.esAutomatizable === 'SÍ'))
      .sort((a, b) => b.horasManuales - a.horasManuales || b.horasTotales - a.horasTotales);

    // 2. No digitalizadas NO automatizables (ordenadas por horas manuales desc)
    const noDigNoAutoPool = nonDigitalized
      .filter((act) => act.variants.every((v) => v.esAutomatizable === 'NO'))
      .sort((a, b) => b.horasManuales - a.horasManuales || b.horasTotales - a.horasTotales);

    // Cantidad a tomar de No/No: debe alcanzarse el pctNoAutoThreshold% (ej. 20%) respecto a las ACTIVIDADES TOTALES
    // de la Hoja 2 (ej. si hay 1,990 actividades totales en la Hoja 2, se toman las 398 de mayor impacto en horas)
    const targetNoNoCount = Math.min(
      noDigNoAutoPool.length,
      Math.max(
        0,
        Math.round((allUniqueActivities.length * pctNoAutoThreshold) / 100)
      )
    );

    const noDigNoAutoSelected = noDigNoAutoPool.slice(0, targetNoNoCount);

    return {
      noDigSiAuto,
      noDigNoAutoSelected,
      noDigNoAutoPool,
      totalInventoryCandidates: noDigSiAuto.length + noDigNoAutoSelected.length,
    };
  }, [allUniqueActivities, pctNoAutoThreshold]);

  // Actividades operativas fijas (Requerimientos y Mantenimientos proyectados para el horizonte)
  const operationalActivities = useMemo(() => {
    const totalReqs = anualRequerimientos * horizonYears;
    const totalMants = anualMantenimientos * horizonYears;

    const reqs: Array<{
      id: string;
      actividadProceso: string;
      gerencia: string;
      tipo: 'REQUERIMIENTO';
      tipoLabel: string;
      horasManualesMensuales: number;
      horasTotalesMensuales: number;
      isNomina: boolean;
      assignedYear: number;
    }> = [];

    for (let i = 1; i <= totalReqs; i++) {
      const year = Math.min(horizonYears, Math.floor((i - 1) / anualRequerimientos) + 1);
      reqs.push({
        id: `OP-REQ-${i}`,
        actividadProceso: `Atención a Requerimiento Funcional Operativo #${i} (Eficiencia)`,
        gerencia: 'Eficiencia de Procesos',
        tipo: 'REQUERIMIENTO',
        tipoLabel: 'Requerimiento Operativo Anual',
        horasManualesMensuales: 30, // Estimación estándar de horas
        horasTotalesMensuales: 30,
        isNomina: false,
        assignedYear: year,
      });
    }

    const mants: Array<{
      id: string;
      actividadProceso: string;
      gerencia: string;
      tipo: 'MANTENIMIENTO';
      tipoLabel: string;
      horasManualesMensuales: number;
      horasTotalesMensuales: number;
      isNomina: boolean;
      assignedYear: number;
    }> = [];

    for (let i = 1; i <= totalMants; i++) {
      const year = Math.min(horizonYears, Math.floor((i - 1) / anualMantenimientos) + 1);
      mants.push({
        id: `OP-MANT-${i}`,
        actividadProceso: `Mantenimiento Preventivo y Correctivo de Solución #${i} (Eficiencia)`,
        gerencia: 'Eficiencia de Procesos',
        tipo: 'MANTENIMIENTO',
        tipoLabel: 'Mantenimiento Preventivo / Correctivo',
        horasManualesMensuales: 16, // Estimación estándar de horas
        horasTotalesMensuales: 16,
        isNomina: false,
        assignedYear: year,
      });
    }

    return { reqs, mants, totalOpsCount: totalReqs + totalMants };
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

    // Identificar a Daniel García Velázquez (ÚNICO autorizado para Nómina)
    const danielCollab = collabs.find((c) => c.isNominaExclusive) || collabs[0];

    // Preparar lista unificada de actividades ordenadas por prioridad de impacto
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
    }> = [];

    let currentPriority = 1;

    // 1. Agregar No Digitalizadas Sí Automatizables (100%)
    for (const item of candidateActivities.noDigSiAuto) {
      const isNomina = item.gerencia.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes('nomina');
      unifiedActivities.push({
        id: item.id,
        actividadProceso: item.actividadProceso,
        gerencia: item.gerencia,
        tipo: 'NO_DIG_SI_AUTO',
        tipoLabel: 'No Digitalizada · Sí Automatizable (100%)',
        horasManualesMensuales: item.horasManuales,
        horasTotalesMensuales: item.horasTotales,
        isNomina,
        assignedYear: 1, // Se calculará con base en el cronograma
        prioridad: currentPriority++,
      });
    }

    // 2. Agregar Top No Digitalizadas No Automatizables seleccionadas
    for (const item of candidateActivities.noDigNoAutoSelected) {
      const isNomina = item.gerencia.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes('nomina');
      unifiedActivities.push({
        id: item.id,
        actividadProceso: item.actividadProceso,
        gerencia: item.gerencia,
        tipo: 'NO_DIG_NO_AUTO',
        tipoLabel: `No Digitalizada · No Automatizable (${pctNoAutoThreshold}% s/total Hoja 2)`,
        horasManualesMensuales: item.horasManuales,
        horasTotalesMensuales: item.horasTotales,
        isNomina,
        assignedYear: 2,
        prioridad: currentPriority++,
      });
    }

    // 3. Agregar Requerimientos y Mantenimientos
    for (const req of operationalActivities.reqs) {
      unifiedActivities.push({
        ...req,
        prioridad: currentPriority++,
      });
    }
    for (const mant of operationalActivities.mants) {
      unifiedActivities.push({
        ...mant,
        prioridad: currentPriority++,
      });
    }

    // FASE 1: Separar actividades de Nómina (REGLA CRÍTICA: SOLO DANIEL GARCÍA VELÁZQUEZ)
    const nominaActivities = unifiedActivities.filter((a) => a.isNomina);
    const nonNominaActivities = unifiedActivities.filter((a) => !a.isNomina);

    // Asignación automática inicial
    const assignmentsMap = new Map<string, string>(); // actId -> collabId

    // Asignar todas las de Nómina a Daniel
    for (const act of nominaActivities) {
      assignmentsMap.set(act.id, danielCollab.id);
    }

    // FASE 2: Distribuir actividades no-nómina asegurando contribución multi-gerencia y proporcionalidad
    // Agrupar actividades por Gerencia
    const activitiesByGerencia = new Map<string, typeof nonNominaActivities>();
    for (const act of nonNominaActivities) {
      if (!activitiesByGerencia.has(act.gerencia)) {
        activitiesByGerencia.set(act.gerencia, []);
      }
      activitiesByGerencia.get(act.gerencia)!.push(act);
    }

    // Pool de colaboradores ordenados según su rol para distribución balanceada:
    // Los Especialistas llevan la mayor carga proporcional; Jefes y Becarios se limitan a sus topes.
    const allCollabIds = collabs.map((c) => c.id);
    const specialistIds = collabs.filter((c) => c.role === 'Especialista').map((c) => c.id);
    const nonSpecialistIds = collabs.filter((c) => c.role !== 'Especialista').map((c) => c.id);

    // Asignador proporcional de carga
    let roundRobinSpecialistIdx = 0;
    let roundRobinNonSpecialistIdx = 0;

    // Para cada gerencia, distribuir sus actividades entre los miembros para que todos tengan actividades de múltiples gerencias
    for (const [gerenciaName, actsInGerencia] of activitiesByGerencia.entries()) {
      for (const act of actsInGerencia) {
        // Encontrar al colaborador con menor porcentaje de carga asignada relativa a su capacidad
        // Dando prioridad a alternar entre especialistas y no especialistas respetando cupos
        let chosenCollab: PlanCollaborator | null = null;

        // Candidatos con capacidad disponible
        const availableCollabs = collabs.filter((c) => {
          const currentCount = Array.from(assignmentsMap.values()).filter((id) => id === c.id).length;
          return currentCount < c.totalCapacity;
        });

        if (availableCollabs.length > 0) {
          // Ordenar candidatos por menor ratio de ocupación (assignedCount / totalCapacity)
          availableCollabs.sort((a, b) => {
            const countA = Array.from(assignmentsMap.values()).filter((id) => id === a.id).length;
            const countB = Array.from(assignmentsMap.values()).filter((id) => id === b.id).length;
            const ratioA = a.totalCapacity > 0 ? countA / a.totalCapacity : 1;
            const ratioB = b.totalCapacity > 0 ? countB / b.totalCapacity : 1;
            if (Math.abs(ratioA - ratioB) > 0.05) {
              return ratioA - ratioB;
            }
            // Si la gerencia ya está cubierta por este colaborador, preferir otro para diversificar
            return countA - countB;
          });
          chosenCollab = availableCollabs[0];
        } else {
          // Si todos exceden su capacidad nominal, asignar al especialista con menor conteo absoluto
          const allSpecialists = collabs.filter((c) => c.role === 'Especialista');
          allSpecialists.sort((a, b) => {
            const countA = Array.from(assignmentsMap.values()).filter((id) => id === a.id).length;
            const countB = Array.from(assignmentsMap.values()).filter((id) => id === b.id).length;
            return countA - countB;
          });
          chosenCollab = allSpecialists[0] || collabs[0];
        }

        assignmentsMap.set(act.id, chosenCollab.id);
      }
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
        c.assignedCount += 1;
        c.assignedHours += act.horasManualesMensuales;
        gerenciasByCollab.get(c.id)?.add(act.gerencia);
      }
    }

    for (const c of collabs) {
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
      pctNoAutoToInclude: pctNoAutoThreshold,
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
    anualRequerimientos,
    anualMantenimientos,
    manualReassignments,
  ]);

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
    setPctNoAutoThreshold(20);
    setAnualRequerimientos(10);
    setAnualMantenimientos(25);
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
        `Plan_de_Trabajo_Automatizacion_${horizonYears}_Anos.xlsx`
      );
    } catch (err) {
      console.error('Error al exportar plan a Excel:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Filtrado de actividades para la vista de catálogo
  const filteredActivities = useMemo(() => {
    return planActivities.filter((act) => {
      if (filterGerencia !== 'ALL' && act.gerencia !== filterGerencia) return false;
      if (filterColaborador !== 'ALL' && act.colaboradorAsignadoId !== filterColaborador) return false;
      if (filterTipo !== 'ALL' && act.tipo !== filterTipo) return false;
      if (filterYear !== 'ALL' && act.assignedYear !== filterYear) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = act.actividadProceso.toLowerCase().includes(q);
        const matchGer = act.gerencia.toLowerCase().includes(q);
        const matchColab = act.colaboradorAsignadoNombre.toLowerCase().includes(q);
        if (!matchName && !matchGer && !matchColab) return false;
      }
      return true;
    });
  }, [planActivities, filterGerencia, filterColaborador, filterTipo, filterYear, searchQuery]);

  // Lista única de gerencias involucradas en el plan
  const planGerencias = useMemo(() => {
    return Array.from(new Set(planActivities.map((a) => a.gerencia))).sort();
  }, [planActivities]);

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* BANNER PRINCIPAL & CONTROL DE ESCENARIO INTERACTIVO */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        {/* Glow de fondo decorativo */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Simulador Interactivo de Capacidad y Plan de Trabajo</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              Hoja 3: Distribución del Plan de Automatización
            </h2>
            <p className="text-slate-300 text-xs md:text-sm leading-relaxed">
              Distribución estratégica de actividades únicas para el{' '}
              <strong className="text-white">Equipo de Eficiencia de Procesos</strong>. Priorización por
              horas manuales, inclusión del 100% de actividades automatizables, cupo del{' '}
              <strong className="text-white">{pctNoAutoThreshold}% no automatizables</strong>, requerimientos (
              {anualRequerimientos}/año), mantenimientos ({anualMantenimientos}/año) y exclusividad de{' '}
              <strong className="text-blue-400">Daniel García Velázquez</strong> en Nómina.
            </p>
          </div>

          {/* Botones de acción principales */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleAutoAdjustPace}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-all cursor-pointer"
              title="Calcula automáticamente el ritmo mensual necesario por especialista para cumplir el plan en los años fijados"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>Ritmo Meta Automático</span>
            </button>

            <button
              type="button"
              onClick={handleResetBaseline}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
              title="Restablecer los valores iniciales (3 años, 1 act/mes jefes y becarios, equipo de 15)"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restablecer</span>
            </button>

            <button
              type="button"
              onClick={handleExportPlanXlsx}
              disabled={isExporting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition-all cursor-pointer disabled:opacity-60"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{isExporting ? 'Generando Excel...' : 'Descargar Plan .xlsx'}</span>
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* BARRA DE PARÁMETROS DINÁMICOS DEL ESCENARIO */}
        {/* ------------------------------------------------------------- */}
        <div className="relative z-10 mt-6 pt-6 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Parámetro 1: Plazo en Años */}
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                Plazo del Plan:
              </span>
              <span className="font-mono font-black text-blue-400 text-sm">
                {horizonYears} {horizonYears === 1 ? 'Año' : 'Años'} ({totalMonths} meses)
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={horizonYears}
              onChange={(e) => setHorizonYears(Number(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>1 Año</span>
              <span>3 Años (Meta)</span>
              <span>5 Años</span>
            </div>
          </div>

          {/* Parámetro 2: Ritmo Jefes y Becarios (Max 1/mes) */}
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                Jefes & Becarios:
              </span>
              <span className="font-mono font-black text-indigo-300 text-sm">
                {jefeCapacityRate} act/mes
              </span>
            </div>
            <input
              type="range"
              min={0.5}
              max={2.0}
              step={0.5}
              value={jefeCapacityRate}
              onChange={(e) => {
                const val = Number(e.target.value);
                setJefeCapacityRate(val);
                setBecarioCapacityRate(val);
              }}
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>0.5/m</span>
              <span>1.0/m (Límite regla)</span>
              <span>2.0/m</span>
            </div>
          </div>

          {/* Parámetro 3: Ritmo Especialistas */}
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
                Especialistas:
              </span>
              <span className="font-mono font-black text-emerald-400 text-sm">
                {especialistaCapacityRate} act/mes
              </span>
            </div>
            <input
              type="range"
              min={0.5}
              max={3.0}
              step={0.1}
              value={especialistaCapacityRate}
              onChange={(e) => setEspecialistaCapacityRate(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>0.5/m</span>
              <span>1.5/m</span>
              <span>3.0/m</span>
            </div>
          </div>

          {/* Parámetro 4: % No Automatizables a Incluir */}
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5" title="Calculado sobre el total de actividades únicas de la Hoja 2">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                % No Auto (s/total Hoja 2):
              </span>
              <span className="font-mono font-black text-amber-400 text-sm">
                {pctNoAutoThreshold}% ({candidateActivities.noDigNoAutoSelected.length} de {allUniqueActivities.length} act)
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={40}
              step={1}
              value={pctNoAutoThreshold}
              onChange={(e) => setPctNoAutoThreshold(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>5%</span>
              <span>20% ({Math.round(allUniqueActivities.length * 0.2)} act de mayor impacto)</span>
              <span>40%</span>
            </div>
          </div>
        </div>

        {/* Botones de gestión rápida de vacantes */}
        <div className="relative z-10 mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Equipo configurado:</span>
            <span className="font-bold text-white bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700">
              {teamMembers.length} Colaboradores
            </span>
            <span className="text-slate-400 text-[11px]">
              (3 Jefes, 3 Becarios, 9 Especialistas
              {teamMembers.length > 15 ? ` + ${teamMembers.length - 15} vacantes agregadas` : ''})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddSpecialistVacancy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 transition-colors cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ Vacante Especialista</span>
            </button>
            <button
              type="button"
              onClick={handleAddBecarioVacancy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 transition-colors cursor-pointer"
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
                {horizonYears} Años
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-0.5">
            <div>
              • No Dig Sí Auto: <strong className="text-slate-800">{candidateActivities.noDigSiAuto.length}</strong> (100%)
            </div>
            <div>
              • No Dig No Auto: <strong className="text-slate-800">{candidateActivities.noDigNoAutoSelected.length}</strong> ({pctNoAutoThreshold}% de {allUniqueActivities.length} totales)
            </div>
            <div>
              • Reqs & Mants: <strong className="text-slate-800">{operationalActivities.totalOpsCount}</strong> en {horizonYears} años
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
            <span>Cronograma por Años / Fases (Año 1 a {horizonYears})</span>
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
                                  {isExpanded ? 'Ocultar actividades' : `Ver ${collab.assignedCount} actividades`}
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
                            <span>{collab.assignedCount}</span>
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
                          <div className="flex flex-wrap gap-1 max-w-md">
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
                                      setFilterColaborador(collab.id);
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
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-800 font-mono">
                                              Año {act.assignedYear}
                                            </span>
                                          </td>
                                          <td className="py-2 px-3">
                                            <span
                                              className={`font-semibold ${
                                                act.isNomina ? 'text-blue-900 font-bold' : 'text-slate-800'
                                              }`}
                                            >
                                              {act.gerencia}
                                            </span>
                                          </td>
                                          <td className="py-2 px-4 max-w-md">
                                            <div className="font-semibold text-slate-900 leading-snug">
                                              {act.actividadProceso}
                                            </div>
                                          </td>
                                          <td className="py-2 px-3">
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
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                            {formatHours(act.horasManualesMensuales)} h
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
                                                    {c.name} ({c.role}) · {c.assignedCount}/{c.totalCapacity}
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
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden space-y-4 p-5">
          {/* Barra de Filtros del Catálogo */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-200">
            {/* Buscador de texto */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por actividad, gerencia o asignado..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            {/* Selectores de Filtro */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Filtro Gerencia */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                <span className="text-slate-500 font-semibold">Gerencia:</span>
                <select
                  value={filterGerencia}
                  onChange={(e) => setFilterGerencia(e.target.value)}
                  className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Todas ({planGerencias.length})</option>
                  {planGerencias.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro Colaborador */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                <span className="text-slate-500 font-semibold">Asignado:</span>
                <select
                  value={filterColaborador}
                  onChange={(e) => setFilterColaborador(e.target.value)}
                  className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Todos ({collaboratorsSummary.length})</option>
                  {collaboratorsSummary.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro Tipo */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                <span className="text-slate-500 font-semibold">Tipo:</span>
                <select
                  value={filterTipo}
                  onChange={(e) => setFilterTipo(e.target.value)}
                  className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Todos los tipos</option>
                  <option value="NO_DIG_SI_AUTO">No Dig Sí Auto (100%)</option>
                  <option value="NO_DIG_NO_AUTO">No Dig No Auto ({pctNoAutoThreshold}% s/total: {candidateActivities.noDigNoAutoSelected.length} act)</option>
                  <option value="REQUERIMIENTO">Requerimientos Anuales</option>
                  <option value="MANTENIMIENTO">Mantenimientos Preventivos</option>
                </select>
              </div>

              {/* Filtro Año / Fase */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                <span className="text-slate-500 font-semibold">Año:</span>
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                  className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Todos los años</option>
                  {Array.from({ length: horizonYears }, (_, i) => i + 1).map((yr) => (
                    <option key={yr} value={yr}>
                      Año {yr}
                    </option>
                  ))}
                </select>
              </div>

              {(searchQuery || filterGerencia !== 'ALL' || filterColaborador !== 'ALL' || filterTipo !== 'ALL' || filterYear !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterGerencia('ALL');
                    setFilterColaborador('ALL');
                    setFilterTipo('ALL');
                    setFilterYear('ALL');
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {/* Tabla de Actividades Asignadas */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 text-center">Prio</th>
                  <th className="py-3 px-3 text-center">Año</th>
                  <th className="py-3 px-3">Gerencia</th>
                  <th className="py-3 px-4">Actividad / Tarea</th>
                  <th className="py-3 px-3">Tipo en Plan</th>
                  <th className="py-3 px-3 text-right">Horas Manuales</th>
                  <th className="py-3 px-4">Colaborador Asignado (Reasignable)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80">
                {filteredActivities.slice(0, 100).map((act) => {
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
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 text-slate-800 font-mono">
                          Año {act.assignedYear}
                        </span>
                      </td>

                      <td className="py-2.5 px-3">
                        <span
                          className={`font-semibold ${
                            act.isNomina ? 'text-blue-900 font-bold' : 'text-slate-800'
                          }`}
                        >
                          {act.gerencia}
                        </span>
                      </td>

                      <td className="py-2.5 px-4 max-w-md">
                        <div className="font-semibold text-slate-900 leading-snug">
                          {act.actividadProceso}
                        </div>
                      </td>

                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
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
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {formatHours(act.horasManualesMensuales)} h
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
                            className="w-full max-w-xs text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                          >
                            {collaboratorsSummary.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} ({c.role}) · {c.assignedCount}/{c.totalCapacity}
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

          {filteredActivities.length > 100 && (
            <div className="text-center text-xs text-slate-500 py-2">
              Mostrando las primeras 100 de {filteredActivities.length} actividades filtradas. Descarga el archivo Excel para ver el inventario completo.
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VISTA 3: CRONOGRAMA POR AÑOS / FASES */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'cronograma' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: horizonYears }, (_, idx) => {
              const yearNum = idx + 1;
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
                        Año {yearNum}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 mt-1">
                        {yearNum === 1
                          ? 'Fase 1: Quick Wins y Mayor Impacto'
                          : yearNum === 2
                          ? 'Fase 2: Consolidación y Optimización'
                          : 'Fase 3: Cierre de Complejidad y No Autom.'}
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
                      <span className="text-slate-600">Horas a Liberar:</span>
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
                      Desglose de Actividades del Año:
                    </span>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/60 border border-emerald-200/60">
                        <span className="text-emerald-900 font-medium">No Dig Sí Auto</span>
                        <strong className="font-mono font-bold text-emerald-800">
                          {yearActs.filter((a) => a.tipo === 'NO_DIG_SI_AUTO').length}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50/60 border border-amber-200/60">
                        <span className="text-amber-900 font-medium">No Dig No Auto</span>
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

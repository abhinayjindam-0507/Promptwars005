import { useCallback, useEffect, useState } from 'react'
import {
  getPatient,
  listPatientLabResults,
  listPatientReports,
  listPatients,
} from '../lib/api.ts'
import type {
  LabResultResponse,
  PatientDetailResponse,
  PatientResponse,
  ReportResponse,
} from '../types/api.ts'

export type ConnectionStatus = 'checking' | 'connected' | 'unavailable'

export interface DashboardDataState {
  connectionStatus: ConnectionStatus
  isLive: boolean
  patients: PatientResponse[]
  selectedPatientId: number | null
  selectedPatient: PatientDetailResponse | null
  reports: ReportResponse[]
  patientLabResults: LabResultResponse[]
  loadingPatients: boolean
  loadingDetails: boolean
  error: string | null
  refetch: () => Promise<void>
  refreshReports: () => Promise<void>
  selectPatient: (id: number) => Promise<void>
}

export function useDashboardData(): DashboardDataState {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('checking')
  const [patients, setPatients] = useState<PatientResponse[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null)
  const [selectedPatient, setSelectedPatient] = useState<PatientDetailResponse | null>(null)
  const [reports, setReports] = useState<ReportResponse[]>([])
  const [patientLabResults, setPatientLabResults] = useState<LabResultResponse[]>([])
  const [loadingPatients, setLoadingPatients] = useState(true)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadPatientDetails = useCallback(async (patientId: number) => {
    setLoadingDetails(true)
    try {
      const [detail, patientReports, allLabResults] = await Promise.all([
        getPatient(patientId),
        listPatientReports(patientId),
        listPatientLabResults(patientId).catch(() => []),
      ])
      setSelectedPatient(detail)
      setReports(patientReports)
      setPatientLabResults(allLabResults)
      setError(null)
    } catch {
      setError('Failed to retrieve patient details from backend.')
    } finally {
      setLoadingDetails(false)
    }
  }, [])

  const selectPatient = useCallback(async (id: number) => {
    setSelectedPatientId(id)
    await loadPatientDetails(id)
  }, [loadPatientDetails])

  const refetch = useCallback(async () => {
    setLoadingPatients(true)
    setError(null)

    try {
      const patientList = await listPatients()
      setConnectionStatus('connected')
      setPatients(patientList)

      if (patientList.length > 0) {
        const firstId = patientList[0].id
        setSelectedPatientId(firstId)
        await loadPatientDetails(firstId)
      } else {
        setSelectedPatientId(null)
        setSelectedPatient(null)
        setReports([])
        setPatientLabResults([])
      }
    } catch {
      setConnectionStatus('unavailable')
      setPatients([])
      setSelectedPatientId(null)
      setSelectedPatient(null)
      setReports([])
      setPatientLabResults([])
      setError('Backend service is currently unavailable. Displaying synthetic preview data.')
    } finally {
      setLoadingPatients(false)
    }
  }, [loadPatientDetails])

  useEffect(() => {
    let active = true

    async function initialize() {
      try {
        const patientList = await listPatients()
        if (!active) return
        setConnectionStatus('connected')
        setPatients(patientList)

        if (patientList.length > 0) {
          const firstId = patientList[0].id
          setSelectedPatientId(firstId)
          const [detail, patientReports, allLabResults] = await Promise.all([
            getPatient(firstId),
            listPatientReports(firstId),
            listPatientLabResults(firstId).catch(() => []),
          ])
          if (!active) return
          setSelectedPatient(detail)
          setReports(patientReports)
          setPatientLabResults(allLabResults)
        }
      } catch {
        if (!active) return
        setConnectionStatus('unavailable')
        setError('Backend service is currently unavailable. Displaying synthetic preview data.')
      } finally {
        if (active) {
          setLoadingPatients(false)
        }
      }
    }

    void initialize()

    return () => {
      active = false
    }
  }, [])

  const refreshReports = useCallback(async () => {
    if (selectedPatientId !== null) {
      await loadPatientDetails(selectedPatientId)
    } else {
      await refetch()
    }
  }, [selectedPatientId, loadPatientDetails, refetch])

  const isLive = connectionStatus === 'connected' && patients.length > 0 && selectedPatient !== null

  return {
    connectionStatus,
    isLive,
    patients,
    selectedPatientId,
    selectedPatient,
    reports,
    patientLabResults,
    loadingPatients,
    loadingDetails,
    error,
    refetch,
    refreshReports,
    selectPatient,
  }
}

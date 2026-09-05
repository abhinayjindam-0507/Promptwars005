import { useMemo, useState } from 'react'
import { ActivityTimeline } from '../components/ActivityTimeline'
import { DashboardHeader } from '../components/DashboardHeader'
import { EvidenceFirstCard } from '../components/EvidenceFirstCard'
import { LabTrendChart } from '../components/LabTrendChart'
import { PatientOverview } from '../components/PatientOverview'
import { RecentReports } from '../components/RecentReports'
import { ReportDetailsPanel } from '../components/ReportDetailsPanel'
import { StatCards } from '../components/StatCards'
import { UploadNotice } from '../components/UploadNotice'
import { VerificationQueue } from '../components/VerificationQueue'
import { useDashboardData } from '../hooks/useDashboardData'

export function Dashboard() {
  const [uploadOpen, setUploadOpen] = useState(false)
  const [reportPanelOpen, setReportPanelOpen] = useState(false)
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null)
  const {
    connectionStatus,
    isLive,
    patients,
    selectedPatient,
    reports,
    patientLabResults,
    loadingPatients,
    loadingDetails,
    error,
    refetch,
    refreshReports,
    selectPatient,
  } = useDashboardData()

  const selectedReport =
    selectedReportId != null ? reports.find((report) => report.id === selectedReportId) ?? null : null

  const closeReportPanel = () => {
    setReportPanelOpen(false)
    setSelectedReportId(null)
  }

  // Calculate pending verification and conflict counts across patient lab results
  const { pendingCount, conflictCount } = useMemo(() => {
    if (!isLive || !patientLabResults.length) {
      return { pendingCount: undefined, conflictCount: 0 }
    }

    const pending = patientLabResults.filter(
      (r) => r.verification_status === 'UNVERIFIED'
    ).length

    // Detect distinct analyte discrepancies across records
    const resultsByTest = new Map<string, string[]>()
    patientLabResults.forEach((r) => {
      const key = r.test_name.trim().toLowerCase()
      const vals = resultsByTest.get(key) || []
      vals.push(r.value.trim().toLowerCase())
      resultsByTest.set(key, vals)
    })

    let conflicts = 0
    resultsByTest.forEach((vals) => {
      const uniqueVals = new Set(vals)
      if (uniqueVals.size > 1) {
        conflicts++
      }
    })

    return { pendingCount: pending, conflictCount: conflicts }
  }, [isLive, patientLabResults])

  const loadingAny = loadingPatients || loadingDetails

  return (
    <div className="space-y-5">
      <DashboardHeader
        onUpload={() => setUploadOpen(true)}
        connectionStatus={connectionStatus}
        isLive={isLive}
        onRetry={refetch}
        loading={loadingPatients}
        errorMessage={error}
      />
      <StatCards
        isLive={isLive}
        patientCount={patients.length}
        reportCount={reports.length}
        pendingCount={pendingCount}
        conflictCount={conflictCount}
      />
      <EvidenceFirstCard />
      <div className="grid gap-5 lg:grid-cols-2">
        <PatientOverview
          isLive={isLive}
          loading={loadingAny}
          patients={patients}
          selectedPatient={selectedPatient}
          reports={reports}
          onSelectPatient={(id) => {
            closeReportPanel()
            void selectPatient(id)
          }}
        />
        <LabTrendChart
          isLive={isLive}
          patientLabResults={patientLabResults}
          reports={reports}
        />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <RecentReports
          isLive={isLive}
          loading={loadingAny}
          patientCode={selectedPatient?.patient_code}
          reports={reports}
          selectedReportId={selectedReportId}
          onSelectReport={(report) => {
            setSelectedReportId(report.id)
            setReportPanelOpen(true)
          }}
          onSelectDemoReport={() => {
            setSelectedReportId(null)
            setReportPanelOpen(true)
          }}
        />
        <VerificationQueue
          isLive={isLive}
          patientLabResults={patientLabResults}
          reports={reports}
          patientCode={selectedPatient?.patient_code}
          onSelectReportId={(reportId) => {
            setSelectedReportId(reportId)
            setReportPanelOpen(true)
          }}
        />
      </div>
      <ActivityTimeline />
      <UploadNotice
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        selectedPatient={selectedPatient}
        isLive={isLive}
        onUploadSuccess={refreshReports}
      />
      <ReportDetailsPanel
        key={reportPanelOpen ? `report-${selectedReportId ?? 'demo'}` : 'closed'}
        open={reportPanelOpen}
        report={isLive ? selectedReport : null}
        isLive={isLive}
        patientCode={selectedPatient?.patient_code}
        onClose={closeReportPanel}
        onProcessed={refreshReports}
      />
    </div>
  )
}

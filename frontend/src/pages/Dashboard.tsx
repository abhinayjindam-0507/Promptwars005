import { useState } from 'react'
import { ActivityTimeline } from '../components/ActivityTimeline'
import { DashboardHeader } from '../components/DashboardHeader'
import { EvidenceFirstCard } from '../components/EvidenceFirstCard'
import { LabTrendChart } from '../components/LabTrendChart'
import { PatientOverview } from '../components/PatientOverview'
import { RecentReports } from '../components/RecentReports'
import { StatCards } from '../components/StatCards'
import { UploadNotice } from '../components/UploadNotice'
import { VerificationQueue } from '../components/VerificationQueue'
import { useDashboardData } from '../hooks/useDashboardData'

export function Dashboard() {
  const [uploadOpen, setUploadOpen] = useState(false)
  const {
    connectionStatus,
    isLive,
    patients,
    selectedPatient,
    reports,
    loadingPatients,
    loadingDetails,
    error,
    refetch,
    selectPatient,
  } = useDashboardData()

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
      />
      <EvidenceFirstCard />
      <div className="grid gap-5 lg:grid-cols-2">
        <PatientOverview
          isLive={isLive}
          loading={loadingAny}
          patients={patients}
          selectedPatient={selectedPatient}
          reports={reports}
          onSelectPatient={selectPatient}
        />
        <LabTrendChart />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <RecentReports
          isLive={isLive}
          loading={loadingAny}
          patientCode={selectedPatient?.patient_code}
          reports={reports}
        />
        <VerificationQueue />
      </div>
      <ActivityTimeline />
      <UploadNotice open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  )
}

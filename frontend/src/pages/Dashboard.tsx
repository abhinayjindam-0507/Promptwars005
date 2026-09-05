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

export function Dashboard() {
  const [uploadOpen, setUploadOpen] = useState(false)

  return (
    <div className="space-y-5">
      <DashboardHeader onUpload={() => setUploadOpen(true)} />
      <StatCards />
      <EvidenceFirstCard />
      <div className="grid gap-5 lg:grid-cols-2">
        <PatientOverview />
        <LabTrendChart />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <RecentReports />
        <VerificationQueue />
      </div>
      <ActivityTimeline />
      <UploadNotice open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  )
}

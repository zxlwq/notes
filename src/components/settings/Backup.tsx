import React from 'react'

interface BackupProps {
  optionValue: string
  labelId?: string
  cloudSyncing: boolean
  gistSyncing: boolean
  r2Syncing: boolean
  onUploadNotes: () => void
  onDownloadNotes: () => void
  onUploadToCloud: () => void
  onDownloadFromCloud: () => void
  onUploadToGist: () => void
  onDownloadFromGist: () => void
  onUploadToR2: () => void
  onDownloadFromR2: () => void
  onViewLogs: () => void
}

const btn =
  'rounded-md border border-transparent px-3 py-1.5 text-xs font-medium text-white focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50'

const Backup: React.FC<BackupProps> = ({
  optionValue,
  labelId,
  cloudSyncing,
  gistSyncing,
  r2Syncing,
  onUploadNotes,
  onDownloadNotes,
  onUploadToCloud,
  onDownloadFromCloud,
  onUploadToGist,
  onDownloadFromGist,
  onUploadToR2,
  onDownloadFromR2,
  onViewLogs,
}) => {
  const groupProps = labelId ? { role: 'group' as const, 'aria-labelledby': labelId } : {}

  if (optionValue === 'backupNotes') {
    return (
      <div className="flex gap-2" {...groupProps}>
        <button
          onClick={onUploadNotes}
          className={`${btn} bg-blue-600 hover:bg-blue-700 focus:ring-blue-500`}
        >
          上传笔记
        </button>
        <button
          onClick={onDownloadNotes}
          className={`${btn} bg-green-600 hover:bg-green-700 focus:ring-green-500`}
        >
          下载笔记
        </button>
      </div>
    )
  }

  if (optionValue === 'cloudNotes') {
    return (
      <div className="flex gap-2" {...groupProps}>
        <button
          onClick={onUploadToCloud}
          disabled={cloudSyncing}
          className={`${btn} bg-blue-600 hover:bg-blue-700 focus:ring-blue-500`}
        >
          {cloudSyncing ? '上传中...' : '上传到云端'}
        </button>
        <button
          onClick={onDownloadFromCloud}
          disabled={cloudSyncing}
          className={`${btn} bg-green-600 hover:bg-green-700 focus:ring-green-500`}
        >
          {cloudSyncing ? '下载中...' : '从云端下载'}
        </button>
      </div>
    )
  }

  if (optionValue === 'gistNotes') {
    return (
      <div className="flex gap-2" {...groupProps}>
        <button
          onClick={onUploadToGist}
          disabled={gistSyncing}
          className={`${btn} bg-blue-600 hover:bg-blue-700 focus:ring-blue-500`}
        >
          {gistSyncing ? '上传中...' : '上传到Gist'}
        </button>
        <button
          onClick={onDownloadFromGist}
          disabled={gistSyncing}
          className={`${btn} bg-green-600 hover:bg-green-700 focus:ring-green-500`}
        >
          {gistSyncing ? '下载中...' : '从Gist下载'}
        </button>
      </div>
    )
  }

  if (optionValue === 'r2Notes') {
    return (
      <div className="flex gap-2" {...groupProps}>
        <button
          onClick={onUploadToR2}
          disabled={r2Syncing}
          className={`${btn} bg-blue-600 hover:bg-blue-700 focus:ring-blue-500`}
        >
          {r2Syncing ? '上传中...' : '上传到R2'}
        </button>
        <button
          onClick={onDownloadFromR2}
          disabled={r2Syncing}
          className={`${btn} bg-green-600 hover:bg-green-700 focus:ring-green-500`}
        >
          {r2Syncing ? '下载中...' : '从R2下载'}
        </button>
      </div>
    )
  }

  if (optionValue === 'viewLogs') {
    return (
      <div className="flex gap-2" {...groupProps}>
        <button
          onClick={onViewLogs}
          className="rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          查看日志
        </button>
      </div>
    )
  }

  return null
}

export default Backup

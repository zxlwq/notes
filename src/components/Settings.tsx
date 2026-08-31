import React, { useState, useEffect, useRef } from 'react'
import { X, Palette, User, Database, Cloud, Upload } from 'lucide-react'
import { useEscapeClose, useFocusTrap } from '@/hooks/Trap'
import { authApi, notesApi, cloudApi, gistApi, r2Api, logsApi } from '@/lib/api'
import { getEncryptionPassword, setEncryptionPassword } from '@/lib/crypto'
import { reencryptAllNotes } from '@/lib/reencrypt'
import {
  buildImportPreview,
  fetchNotesForExport,
  notesToMarkdown,
  notesToPlainText,
} from '@/lib/backup'
import { useAuth } from '@/contexts/Context'
import { AlertModal, ConfirmModal, PromptModal, SelectModal } from './Modal'
import { useModal } from '../hooks/Modal'
import { LOCK_TIMEOUT_OPTIONS } from '@/lib/lock'
import { loadAndApplyBackground } from '@/lib/webp'
import Import from '@/components/settings/Import'
import Logs from '@/components/settings/Logs'
import Pwd from '@/components/settings/Pwd'
import Recovery from '@/components/settings/Recovery'
import Backup from '@/components/settings/Backup'
import type { AppSettings, Note, ImportFormat } from '@/types'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

const defaultSettings: AppSettings = {
  fontSize: '中',
  backgroundImageUrl: '',
  logoUrl: '',
  fontFamily: '默认',
  username: '',
  autoLock: true,
  lockTimeout: '15分钟',
  listRefreshInterval: '5分钟',
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { logout } = useAuth()
  const [settings, setSettings] = useState(defaultSettings)
  const [_currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [_confirmPassword, setConfirmPassword] = useState('')
  const [changing, setChanging] = useState(false)
  const [passwordSource, setPasswordSource] = useState<'d1' | 'env' | 'postgresql' | 'unknown'>(
    'unknown'
  )
  const [showPassword, setShowPassword] = useState(false)
  const [recoveryConfigured, setRecoveryConfigured] = useState(false)
  const [settingUpRecovery, setSettingUpRecovery] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null)

  const modal = useModal()
  const settingsDialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(isOpen, settingsDialogRef)
  useEscapeClose(isOpen, onClose)

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [cloudSyncing, setCloudSyncing] = useState(false)
  const [gistSyncing, setGistSyncing] = useState(false)
  const [r2Syncing, setR2Syncing] = useState(false)
  const [logsOpen, setLogsOpen] = useState(false)
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsText, setLogsText] = useState('')
  const [logsData, setLogsData] = useState<{
    success?: boolean
    source?: string
    count?: number
    items?: Array<{
      id?: number
      level?: string
      message?: string
      meta?: string
      created_at?: string
      [key: string]: unknown
    }>
  } | null>(null)
  const [logsView, setLogsView] = useState<'table' | 'json'>('table')
  const [uploadingImage, setUploadingImage] = useState(false)

  useEffect(() => {
    const savedSettings = localStorage.getItem('app-settings')
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings)
        setSettings({ ...defaultSettings, ...parsedSettings })
      } catch (error) {
        console.error('加载设置失败:', error)
      }
    }

    checkPasswordSource()
  }, [])

  useEffect(() => {
    if (isOpen) {
      setNewPassword('')
      setCurrentPassword('')
      setConfirmPassword('')
      void checkRecoveryStatus()
    }
  }, [isOpen])

  const checkRecoveryStatus = async () => {
    try {
      const res = await authApi.getRecoveryStatus()
      setRecoveryConfigured(Boolean(res.data?.configured))
    } catch {
      setRecoveryConfigured(false)
    }
  }

  const handleSetupRecovery = async () => {
    const confirmed = await modal.showConfirm(
      '将生成新的恢复码，请立即复制或下载并妥善保存。若已有恢复码，生成新码会使旧码失效。\n\n恢复码仅能重置登录密码，不能解密丢失加密密钥后的已加密笔记。',
      { title: '生成恢复码', confirmText: '生成', cancelText: '取消' }
    )
    if (!confirmed) return

    try {
      setSettingUpRecovery(true)
      const res = await authApi.setupRecovery()
      if (res.data?.recoveryCode) {
        setRecoveryCode(res.data.recoveryCode)
        setRecoveryConfigured(true)
      }
    } catch {
      modal.showAlert('生成恢复码失败，请稍后重试', {
        type: 'error',
        title: '操作失败',
        confirmText: '确定',
      })
    } finally {
      setSettingUpRecovery(false)
    }
  }

  const checkPasswordSource = async () => {
    try {
      const response = await authApi.getPasswordStatus()

      if (response.data?.usingD1) {
        setPasswordSource('d1')
      } else if (response.data?.usingPostgreSQL) {
        setPasswordSource('postgresql')
      } else if (response.data?.passwordSource) {
        setPasswordSource(response.data.passwordSource)
      } else {
        setPasswordSource('env')
      }
    } catch {
      setPasswordSource('env')
    }
  }

  const settingsCategories = [
    {
      title: '外观设置',
      icon: <Palette className="size-5" />,
      options: [
        {
          label: '字体大小',
          value: 'fontSize',
          type: 'select',
          options: ['小', '中', '大', '特大', '超大'],
          default: '中',
        },
        {
          label: '字体',
          value: 'fontFamily',
          type: 'select',
          options: [
            '默认',
            '宋体',
            '楷体',
            '黑体',
            '微软雅黑',
            '思源黑体',
            '思源宋体',
            '苹方',
            '仿宋',
            '隶书',
          ],
          default: '默认',
        },
        { label: '背景图URL', value: 'backgroundImageUrl', type: 'input', default: '' },
      ],
    },
    {
      title: '体验设置',
      icon: <User className="size-5" />,
      options: [
        { label: '用户名', value: 'username', type: 'input', default: '' },
        { label: 'logo图URL', value: 'logoUrl', type: 'input', default: '' },
        {
          label: '列表静默刷新',
          value: 'listRefreshInterval',
          type: 'select',
          options: ['关闭', '1分钟', '5分钟', '15分钟'],
          default: '5分钟',
        },
        { label: '空闲自动锁定', value: 'autoLock', type: 'toggle', default: true },
        {
          label: '锁定超时',
          value: 'lockTimeout',
          type: 'select',
          options: [...LOCK_TIMEOUT_OPTIONS],
          default: '15分钟',
        },
      ],
    },
    {
      title: '笔记备份',
      icon: <Database className="size-5" />,
      options: [
        { label: '上传下载笔记', value: 'backupNotes', type: 'custom', default: null },
        { label: '云端笔记', value: 'cloudNotes', type: 'custom', default: null },
        { label: 'GitHub Gist', value: 'gistNotes', type: 'custom', default: null },
        { label: 'Cloudflare R2', value: 'r2Notes', type: 'custom', default: null },
      ],
    },
    {
      title: '日志功能',
      icon: <Cloud className="size-5" />,
      options: [{ label: '查看后端调用日志', value: 'viewLogs', type: 'custom', default: null }],
    },
  ]

  const handleSettingChange = (key: keyof AppSettings, value: AppSettings[keyof AppSettings]) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const toggleSetting = (key: string) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key as keyof typeof prev],
    }))
  }

  const handleSave = () => {
    localStorage.setItem('app-settings', JSON.stringify(settings))
    try {
      const fontSizeMap: Record<string, string> = {
        小: '14px',
        中: '16px',
        大: '18px',
        特大: '20px',
        超大: '22px',
      }
      const resolvedFontSize = fontSizeMap[settings.fontSize as keyof typeof fontSizeMap] || '14px'
      const resolvedLineHeight = '1.6'

      document.documentElement.style.setProperty('--global-font-size', resolvedFontSize)
      document.documentElement.style.setProperty('--global-line-height', resolvedLineHeight)

      document.documentElement.style.setProperty('--editor-font-size', resolvedFontSize)
      document.documentElement.style.setProperty('--editor-line-height', resolvedLineHeight)

      loadAndApplyBackground(
        settings.backgroundImageUrl,
        () => {},
        () => {}
      )
      if (typeof settings.logoUrl === 'string') {
        const href = settings.logoUrl.trim()
        let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null
        if (!link) {
          link = document.createElement('link')
          link.rel = 'icon'
          document.head.appendChild(link)
        }
        if (href) {
          link.href = href
        }
      }
      const family = settings.fontFamily
      const familyMap: Record<string, string> = {
        默认: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
        宋体: "'SimSun', 'Songti SC', 'Noto Serif SC', serif",
        楷体: "'KaiTi', 'Kaiti SC', 'STKaiti', 'Noto Serif SC', serif",
        黑体: "'Heiti SC', 'SimHei', 'Microsoft YaHei', 'Noto Sans SC', sans-serif",
        微软雅黑: "'Microsoft YaHei', 'Noto Sans SC', sans-serif",
        思源黑体: "'Noto Sans SC', 'Source Han Sans SC', sans-serif",
        思源宋体: "'Noto Serif SC', 'Source Han Serif SC', serif",
        苹方: "'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC', sans-serif",
        仿宋: "'FangSong', 'FZSongYi-Z13', 'Songti SC', 'Noto Serif SC', serif",
        隶书: "'LiSu', 'STLiti', 'KaiTi', 'Noto Serif SC', serif",
      }
      const resolvedFamily = familyMap[family] || familyMap['默认']
      document.documentElement.style.setProperty('--editor-font-family', resolvedFamily)
      if (settings.username && typeof settings.username === 'string') {
        document.title = settings.username
      }
      window.dispatchEvent(new CustomEvent('settings-changed', { detail: settings }))

      modal.showAlert('外观设置已保存并生效！', {
        type: 'success',
        title: '设置成功',
        confirmText: '确定',
      })
    } catch (e) {
      console.warn('应用外观设置到 CSS 变量时出错:', e)
      modal.showAlert('设置保存失败，请重试', {
        type: 'error',
        title: '保存失败',
        confirmText: '确定',
      })
    }
    onClose()
  }

  const handleLogout = async () => {
    try {
      sessionStorage.clear()
    } catch {}
    await logout()
    window.location.href = '/login'
  }

  const handleUploadNotes = () => {
    setIsUploadModalOpen(true)
  }

  const handleViewLogs = async () => {
    setLogsOpen(true)
    setLogsLoading(true)
    setLogsText('')
    setLogsData(null)
    try {
      const resp = await logsApi.getLogs()
      const data = resp.data
      const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
      setLogsText(text)
      setLogsData(typeof data === 'object' ? data : null)
    } catch (error: unknown) {
      let errorMessage = '未知错误'
      if (error && typeof error === 'object') {
        if ('response' in error) {
          const errorWithResponse = error as { response?: { data?: { error?: string } } }
          errorMessage = errorWithResponse.response?.data?.error || '未知错误'
        } else if ('message' in error) {
          errorMessage = String(error.message)
        }
      }
      setLogsText(`获取日志失败：${errorMessage}`)
    } finally {
      setLogsLoading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadFile(file)

      const reader = new FileReader()
      reader.onload = async (ev) => {
        const content = ev.target?.result as string
        const fileExtension = file.name.split('.').pop()?.toLowerCase()
        const preview = await buildImportPreview(content, fileExtension === 'json')
        setUploadPreview(preview)
      }
      reader.readAsText(file)
    }
  }

  const handleConfirmUpload = async () => {
    if (!uploadFile) return

    if (!getEncryptionPassword()) {
      modal.showAlert('请先登录并输入密码后再导入笔记', {
        type: 'warning',
        title: '需要密码',
        confirmText: '确定',
      })
      return
    }

    setUploading(true)
    try {
      const text = await uploadFile.text()
      const fileExtension = uploadFile.name.split('.').pop()?.toLowerCase()

      const response = await notesApi.importNotes({
        content: text,
        format: (fileExtension === 'json' ? 'json' : 'markdown') as ImportFormat,
      })
      if (response.data.success) {
        const successMessage = document.createElement('div')
        successMessage.textContent = `成功导入 ${response.data.imported} 条笔记到数据库！`
        successMessage.className =
          'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 max-w-md text-center'
        document.body.appendChild(successMessage)
        setTimeout(() => {
          document.body.removeChild(successMessage)
        }, 3000)

        window.dispatchEvent(
          new CustomEvent('notes-imported', {
            detail: { count: response.data.imported },
          })
        )

        setIsUploadModalOpen(false)
        setUploadFile(null)
        setUploadPreview('')
      } else {
        modal.showAlert(`导入失败：${response.data.error}`, {
          type: 'error',
          title: '导入失败',
          confirmText: '确定',
        })
      }
    } catch (error) {
      modal.showAlert('文件读取失败，请检查文件格式', {
        type: 'error',
        title: '文件错误',
        confirmText: '确定',
      })
      console.error('Upload error:', error)
    } finally {
      setUploading(false)
    }
  }

  const handleCloseUploadModal = () => {
    setIsUploadModalOpen(false)
    setUploadFile(null)
    setUploadPreview('')
  }

  const handleUploadToCloud = async () => {
    setCloudSyncing(true)
    try {
      const response = await cloudApi.uploadToCloud()

      if (response.data.success) {
        modal.showAlert(
          `笔记已成功上传到云端\n文件: ${response.data.fileName || 'notes.md'}\n笔记数量: ${response.data.totalNotes || '未知'}`,
          {
            type: 'success',
            title: '上传成功',
            confirmText: '确定',
          }
        )
      } else {
        throw new Error(response.data.error || '上传失败')
      }
    } catch (error: unknown) {
      console.error('上传到云端失败:', error)
      const axiosError = error as { response?: { data?: { error?: string } }; message?: string }
      modal.showAlert(
        `上传到云端失败: ${axiosError.response?.data?.error || axiosError.message || '未知错误'}`,
        {
          type: 'error',
          title: '上传失败',
          confirmText: '确定',
        }
      )
    } finally {
      setCloudSyncing(false)
    }
  }

  const handleDownloadFromCloud = async () => {
    setCloudSyncing(true)
    try {
      const response = await cloudApi.downloadFromCloud()

      if (response.data && response.data.success) {
        modal.showAlert(
          `笔记已成功从云端下载并导入\n文件: ${response.data.fileName || 'notes.md'}\n导入: ${response.data.importedCount || 0} 条\n更新: ${response.data.updatedCount || 0} 条`,
          {
            type: 'success',
            title: '下载成功',
            confirmText: '确定',
          }
        )

        window.dispatchEvent(new CustomEvent('notes-imported'))
      } else {
        throw new Error(response.data?.error || '下载失败')
      }
    } catch (error: unknown) {
      console.error('从云端下载失败:', error)
      const axiosError = error as { response?: { data?: { error?: string } }; message?: string }
      modal.showAlert(
        `从云端下载失败: ${axiosError.response?.data?.error || axiosError.message || '未知错误'}`,
        {
          type: 'error',
          title: '下载失败',
          confirmText: '确定',
        }
      )
    } finally {
      setCloudSyncing(false)
    }
  }

  const handleUploadToGist = async () => {
    setGistSyncing(true)
    try {
      const response = await gistApi.uploadToGist()

      if (response.data.success) {
        modal.showAlert(
          `成功上传到Gist\n文件: ${response.data.fileName || 'notes.md'}\n笔记数量: ${response.data.totalNotes || '未知'}`,
          {
            type: 'success',
            title: '上传成功',
            confirmText: '确定',
          }
        )
      } else {
        throw new Error(response.data.error || '上传失败')
      }
    } catch (error: unknown) {
      console.error('上传到GitHub Gist失败:', error)
      const axiosError = error as { response?: { data?: { error?: string } }; message?: string }
      modal.showAlert(
        `上传到GitHub Gist失败: ${axiosError.response?.data?.error || axiosError.message || '未知错误'}`,
        {
          type: 'error',
          title: '上传失败',
          confirmText: '确定',
        }
      )
    } finally {
      setGistSyncing(false)
    }
  }

  const handleDownloadFromGist = async () => {
    setGistSyncing(true)
    try {
      const response = await gistApi.downloadFromGist()

      if (response.data && response.data.success) {
        modal.showAlert(
          `成功从Gist导入\n文件: ${response.data.fileName || 'notes.md'}\n导入: ${response.data.importedCount || 0} 条\n更新: ${response.data.updatedCount || 0} 条`,
          {
            type: 'success',
            title: '下载成功',
            confirmText: '确定',
          }
        )

        window.dispatchEvent(new CustomEvent('notes-imported'))
      } else {
        throw new Error(response.data?.error || '下载失败')
      }
    } catch (error: unknown) {
      console.error('从GitHub Gist下载失败:', error)
      const axiosError = error as { response?: { data?: { error?: string } }; message?: string }
      modal.showAlert(
        `从GitHub Gist下载失败: ${axiosError.response?.data?.error || axiosError.message || '未知错误'}`,
        {
          type: 'error',
          title: '下载失败',
          confirmText: '确定',
        }
      )
    } finally {
      setGistSyncing(false)
    }
  }

  const handleUploadToR2 = async () => {
    setR2Syncing(true)
    try {
      const response = await r2Api.uploadToR2()

      if (response.data.success) {
        modal.showAlert(
          `成功上传到R2\n文件: ${response.data.fileName || 'notes.md'}\n笔记数量: ${response.data.totalNotes || '未知'}`,
          {
            type: 'success',
            title: '上传成功',
            confirmText: '确定',
          }
        )
      } else {
        throw new Error(response.data.error || '上传失败')
      }
    } catch (error: unknown) {
      console.error('上传到Cloudflare R2失败:', error)
      const axiosError = error as { response?: { data?: { error?: string } }; message?: string }
      modal.showAlert(
        `上传到Cloudflare R2失败: ${axiosError.response?.data?.error || axiosError.message || '未知错误'}`,
        {
          type: 'error',
          title: '上传失败',
          confirmText: '确定',
        }
      )
    } finally {
      setR2Syncing(false)
    }
  }

  const handleDownloadFromR2 = async () => {
    setR2Syncing(true)
    try {
      const response = await r2Api.downloadFromR2()

      if (response.data && response.data.success) {
        modal.showAlert(
          `成功从R2导入\n文件: ${response.data.fileName || 'notes.md'}\n导入: ${response.data.importedCount || 0} 条\n更新: ${response.data.updatedCount || 0} 条`,
          {
            type: 'success',
            title: '下载成功',
            confirmText: '确定',
          }
        )

        window.dispatchEvent(new CustomEvent('notes-imported'))
      } else {
        throw new Error(response.data?.error || '下载失败')
      }
    } catch (error: unknown) {
      console.error('从Cloudflare R2下载失败:', error)
      const axiosError = error as { response?: { data?: { error?: string } }; message?: string }
      modal.showAlert(
        `从Cloudflare R2下载失败: ${axiosError.response?.data?.error || axiosError.message || '未知错误'}`,
        {
          type: 'error',
          title: '下载失败',
          confirmText: '确定',
        }
      )
    } finally {
      setR2Syncing(false)
    }
  }

  const handleDownloadNotes = async () => {
    try {
      if (!getEncryptionPassword()) {
        modal.showAlert('请先登录并输入密码后再导出笔记', {
          type: 'warning',
          title: '需要密码',
          confirmText: '确定',
        })
        return
      }

      const response = await notesApi.getNotes()
      const notes = response.data

      if (!notes || notes.length === 0) {
        modal.showAlert('没有可下载的笔记', {
          type: 'warning',
          title: '无笔记',
          confirmText: '确定',
        })
        return
      }

      const noteSelection = await modal.showSelect('请选择要下载的笔记：', {
        title: '选择笔记',
        options: [
          {
            value: 'all',
            label: '全部笔记',
            description: `下载所有 ${notes.length} 条笔记（明文）`,
          },
          ...notes.map((note: Note, index: number) => ({
            value: note.id,
            label: note.title || `无标题笔记 ${index + 1}`,
            description: `字数: ${note.contentLength ?? 0}`,
          })),
        ],
        defaultValue: 'all',
      })

      if (!noteSelection) return

      let selectedSummaries = notes
      if (noteSelection !== 'all') {
        selectedSummaries = notes.filter((note: Note) => note.id === noteSelection)
      }

      const format = await modal.showSelect('请选择导出格式：', {
        title: '选择导出格式',
        options: [
          {
            value: '1',
            label: 'JSON 格式',
            description: '解密后的明文，包含所有字段和元数据',
          },
          {
            value: '2',
            label: 'Markdown 格式',
            description: '解密后的纯文本，适合阅读和编辑',
          },
          {
            value: '3',
            label: 'TXT 格式',
            description: '解密后的纯文本，简单易用',
          },
        ],
        defaultValue: '1',
      })

      if (!format) return

      const selectedNotes = await fetchNotesForExport(selectedSummaries)

      let dataStr = ''
      let fileName = ''
      let mimeType = ''

      if (format === '1') {
        dataStr = JSON.stringify(selectedNotes, null, 2)
        const noteType = noteSelection === 'all' ? 'all' : 'single'
        fileName = `notes_${noteType}_${new Date().toISOString().slice(0, 10)}.json`
        mimeType = 'application/json'
      } else if (format === '2') {
        dataStr = notesToMarkdown(selectedNotes)
        const noteType = noteSelection === 'all' ? 'all' : 'single'
        fileName = `notes_${noteType}_${new Date().toISOString().slice(0, 10)}.md`
        mimeType = 'text/markdown'
      } else if (format === '3') {
        dataStr = notesToPlainText(selectedNotes)
        const noteType = noteSelection === 'all' ? 'all' : 'single'
        fileName = `notes_${noteType}_${new Date().toISOString().slice(0, 10)}.txt`
        mimeType = 'text/plain'
      } else {
        modal.showAlert('格式选择无效，请重新选择', {
          type: 'error',
          title: '选择错误',
          confirmText: '确定',
        })
        return
      }

      const dataBlob = new Blob([dataStr], { type: mimeType })
      const url = URL.createObjectURL(dataBlob)

      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      const formatName = format === '1' ? 'JSON' : format === '2' ? 'Markdown' : 'TXT'
      const noteCount = selectedNotes.length
      const noteType = noteSelection === 'all' ? '全部' : '单个'

      modal.showAlert(`成功下载 ${noteCount} 条笔记（${noteType}），格式：${formatName}`, {
        type: 'success',
        title: '下载成功',
        confirmText: '确定',
      })
    } catch (error) {
      modal.showAlert('下载失败，请检查网络连接', {
        type: 'error',
        title: '下载失败',
        confirmText: '确定',
      })
      console.error('Download error:', error)
    }
  }

  const handleChangePassword = async () => {
    if (!newPassword) {
      modal.showAlert('请输入新密码', {
        type: 'warning',
        title: '输入错误',
        confirmText: '确定',
      })
      return
    }
    if (newPassword.length < 6) {
      modal.showAlert('新密码长度不能小于6位', {
        type: 'warning',
        title: '密码太短',
        confirmText: '确定',
      })
      return
    }
    try {
      setChanging(true)

      const currentPassword = getEncryptionPassword() || ''
      if (!currentPassword) {
        modal.showAlert('未找到当前密码，请重新登录', {
          type: 'error',
          title: '登录错误',
          confirmText: '确定',
        })
        return
      }

      await reencryptAllNotes(currentPassword, newPassword)
      await authApi.changePassword({ currentPassword, newPassword })
      setEncryptionPassword(newPassword)

      setNewPassword('')
      setPasswordSource('d1')

      modal.showAlert('密码修改成功！笔记已重新加密。系统将在3秒后退出重新登录。', {
        type: 'success',
        title: '修改成功',
        confirmText: '确定',
      })

      setTimeout(async () => {
        await logout()
        window.location.href = '/login'
      }, 3000)
    } catch (err: unknown) {
      console.error('Change password error:', err)
      const axiosError = err as {
        response?: { status?: number; data?: { error?: string } }
        message?: string
      }

      if (axiosError.response?.status === 401) {
        modal.showAlert('当前密码错误，请检查后重试', {
          type: 'error',
          title: '密码错误',
          confirmText: '确定',
        })
      } else if (axiosError.response?.status === 400) {
        modal.showAlert('请求参数错误，请检查输入', {
          type: 'error',
          title: '参数错误',
          confirmText: '确定',
        })
      } else {
        modal.showAlert('密码修改失败，请检查网络连接', {
          type: 'error',
          title: '修改失败',
          confirmText: '确定',
        })
      }
    } finally {
      setChanging(false)
    }
  }

  const handleImageFileSelect = (
    type: 'background' | 'logo',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        modal.showAlert('请选择图片文件', {
          type: 'error',
          title: '文件类型错误',
          confirmText: '确定',
        })
        return
      }

      if (file.size > 5 * 1024 * 1024) {
        modal.showAlert('图片文件大小不能超过5MB', {
          type: 'error',
          title: '文件过大',
          confirmText: '确定',
        })
        return
      }

      setUploadingImage(true)
      const reader = new FileReader()
      reader.onload = (e) => {
        const base64 = e.target?.result as string
        const imageUrl = base64

        const savedSettings = localStorage.getItem('app-settings')

        let currentSettings = {}
        if (savedSettings) {
          try {
            currentSettings = JSON.parse(savedSettings)
          } catch (error) {
            console.error('解析localStorage设置失败:', error)
            currentSettings = {}
          }
        }

        const updatedSettings = { ...defaultSettings, ...currentSettings }

        if (type === 'background') {
          updatedSettings.backgroundImageUrl = imageUrl
          loadAndApplyBackground(
            imageUrl,
            () => {
              window.dispatchEvent(new CustomEvent('settings-changed', { detail: updatedSettings }))
            },
            () => {
              window.dispatchEvent(new CustomEvent('settings-changed', { detail: updatedSettings }))
            }
          )
        } else if (type === 'logo') {
          updatedSettings.logoUrl = imageUrl
          let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null
          if (!link) {
            link = document.createElement('link')
            link.rel = 'icon'
            link.type = 'image/x-icon'
            document.head.appendChild(link)
          }

          const timestamp = new Date().getTime()
          const faviconWithTimestamp = `${imageUrl}?t=${timestamp}`
          link.href = faviconWithTimestamp
          link.type = 'image/x-icon'

          window.dispatchEvent(new CustomEvent('settings-changed', { detail: updatedSettings }))
        }

        localStorage.setItem('app-settings', JSON.stringify(updatedSettings))

        setSettings(updatedSettings)

        modal.showAlert('图片上传成功并已应用！', {
          type: 'success',
          title: '上传成功',
          confirmText: '确定',
        })
        setUploadingImage(false)
      }
      reader.readAsDataURL(file)
    }
  }

  if (!isOpen) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      <div
        ref={settingsDialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        className="pointer-events-auto relative max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg border border-white/20 bg-white/20 shadow-xl backdrop-blur-xl"
      >
        <div className="flex items-center justify-between border-b border-white/20 bg-white/20 px-6 py-4 backdrop-blur-lg">
          <h2 id="settings-dialog-title" className="font-semibold text-gray-900">
            设置
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭设置"
            className="text-gray-400 transition-colors hover:text-gray-600"
          >
            <X className="size-6" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto bg-white/20 px-6 py-4 backdrop-blur-sm">
          {settingsCategories.map((category, categoryIndex) => (
            <div key={categoryIndex} className="mb-6 last:mb-0">
              <div className="mb-4 flex items-center gap-3 border-b border-white/20 pb-2">
                <div className="text-blue-600">{category.icon}</div>
                <h3 className="font-medium text-gray-900">{category.title}</h3>
              </div>

              <div className="space-y-4">
                {category.options.map((option, optionIndex) => {
                  const controlId =
                    option.type === 'input'
                      ? `settings-input-${option.value}`
                      : option.type === 'select'
                        ? `settings-select-${option.value}`
                        : option.type === 'toggle'
                          ? `settings-toggle-${option.value}`
                          : undefined
                  const labelId =
                    option.type === 'custom' ? `settings-label-${option.value}` : undefined

                  return (
                    <div key={optionIndex} className="flex items-center justify-between">
                      {controlId ? (
                        <label htmlFor={controlId} className="font-medium text-gray-700">
                          {option.label}
                        </label>
                      ) : (
                        <span id={labelId} className="font-medium text-gray-700">
                          {option.label}
                        </span>
                      )}

                      {option.type === 'toggle' && (
                        <button
                          id={controlId}
                          type="button"
                          role="switch"
                          aria-checked={Boolean(settings[option.value as keyof typeof settings])}
                          onClick={() => toggleSetting(option.value)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings[option.value as keyof typeof settings]
                              ? 'bg-blue-600'
                              : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block size-4 transform rounded-full bg-white transition-transform ${
                              settings[option.value as keyof typeof settings]
                                ? 'translate-x-6'
                                : 'translate-x-1'
                            }`}
                          />
                        </button>
                      )}

                      {option.type === 'select' && 'options' in option && (
                        <select
                          id={`settings-select-${option.value}`}
                          value={settings[option.value as keyof typeof settings] as string}
                          disabled={option.value === 'lockTimeout' && !settings.autoLock}
                          onChange={(e) =>
                            handleSettingChange(option.value as keyof AppSettings, e.target.value)
                          }
                          className="rounded-md border border-gray-300 px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {(option.options || []).map((opt: string, optIndex: number) => (
                            <option key={optIndex} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      )}

                      {option.type === 'input' && (
                        <div className="flex items-center gap-2">
                          <input
                            id={`settings-input-${option.value}`}
                            type="text"
                            value={settings[option.value as keyof typeof settings] as string}
                            onChange={(e) =>
                              handleSettingChange(option.value as keyof AppSettings, e.target.value)
                            }
                            placeholder={
                              option.value === 'username'
                                ? '输入用户名'
                                : option.value === 'backgroundImageUrl'
                                  ? '输入背景图URL'
                                  : option.value === 'logoUrl'
                                    ? '输入logo图URL'
                                    : ''
                            }
                            className="w-32 rounded-md border border-gray-300 px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          {(option.value === 'backgroundImageUrl' ||
                            option.value === 'logoUrl') && (
                            <div className="relative">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) =>
                                  handleImageFileSelect(option.value as 'background' | 'logo', e)
                                }
                                className="hidden"
                                id={`image-upload-${option.value}`}
                                disabled={uploadingImage}
                              />
                              <label
                                htmlFor={`image-upload-${option.value}`}
                                className={`flex cursor-pointer items-center gap-1 rounded-md border border-transparent px-2 py-1 text-xs font-medium text-white ${
                                  uploadingImage
                                    ? 'cursor-not-allowed bg-gray-400'
                                    : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
                                }`}
                                title={`上传${option.value === 'backgroundImageUrl' ? '背景图' : 'logo图'}`}
                              >
                                <Upload className="size-3" />
                                {uploadingImage ? '上传中...' : '上传'}
                              </label>
                            </div>
                          )}
                        </div>
                      )}

                      {option.type === 'custom' && (
                        <Backup
                          optionValue={String(option.value)}
                          labelId={labelId}
                          cloudSyncing={cloudSyncing}
                          gistSyncing={gistSyncing}
                          r2Syncing={r2Syncing}
                          onUploadNotes={handleUploadNotes}
                          onDownloadNotes={handleDownloadNotes}
                          onUploadToCloud={handleUploadToCloud}
                          onDownloadFromCloud={handleDownloadFromCloud}
                          onUploadToGist={handleUploadToGist}
                          onDownloadFromGist={handleDownloadFromGist}
                          onUploadToR2={handleUploadToR2}
                          onDownloadFromR2={handleDownloadFromR2}
                          onViewLogs={handleViewLogs}
                        />
                      )}
                    </div>
                  )
                })}
                {category.title === '体验设置' && (
                  <Pwd
                    passwordSource={passwordSource}
                    newPassword={newPassword}
                    showPassword={showPassword}
                    changing={changing}
                    recoveryConfigured={recoveryConfigured}
                    settingUpRecovery={settingUpRecovery}
                    onNewPasswordChange={setNewPassword}
                    onToggleShowPassword={() => setShowPassword(!showPassword)}
                    onChangePassword={handleChangePassword}
                    onSetupRecovery={handleSetupRecovery}
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center gap-4 border-t border-white/20 bg-white/20 px-6 py-4 backdrop-blur-lg">
          <button
            onClick={handleLogout}
            className="min-w-[100px] rounded-lg border border-transparent bg-red-600 px-8 py-3 font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            退出
          </button>
          <button
            onClick={handleSave}
            className="min-w-[100px] rounded-lg border border-transparent bg-blue-600 px-8 py-3 font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            保存
          </button>
        </div>
      </div>

      <Import
        isOpen={isUploadModalOpen}
        uploadFile={uploadFile}
        uploadPreview={uploadPreview}
        uploading={uploading}
        onClose={handleCloseUploadModal}
        onFileSelect={handleFileSelect}
        onConfirm={handleConfirmUpload}
      />

      <Logs
        isOpen={logsOpen}
        loading={logsLoading}
        logsText={logsText}
        logsData={logsData}
        logsView={logsView}
        onClose={() => setLogsOpen(false)}
        onRefresh={handleViewLogs}
        onToggleView={() => setLogsView((v) => (v === 'table' ? 'json' : 'table'))}
        onClear={async () => {
          const ok = await modal.showConfirm('确定要清空所有日志吗？该操作不可恢复。', {
            title: '清空日志确认',
            type: 'warning',
            confirmText: '清空',
            cancelText: '取消',
          } as { type: 'warning'; confirmText: string; cancelText: string })
          if (!ok) return
          try {
            setLogsLoading(true)
            await logsApi.clearLogs()
            await handleViewLogs()
          } finally {
            setLogsLoading(false)
          }
        }}
      />

      <Recovery
        isOpen={recoveryCode !== null}
        code={recoveryCode ?? ''}
        onClose={() => setRecoveryCode(null)}
      />

      <AlertModal
        isOpen={modal.alertState.isOpen}
        onClose={modal.closeAlert}
        title={modal.alertState.title}
        message={modal.alertState.message}
        type={modal.alertState.type}
        confirmText={modal.alertState.confirmText}
        onConfirm={modal.alertState.onConfirm}
      />

      <ConfirmModal
        isOpen={modal.confirmState.isOpen}
        onClose={modal.closeConfirm}
        title={modal.confirmState.title}
        message={modal.confirmState.message}
        type={modal.confirmState.type}
        confirmText={modal.confirmState.confirmText}
        cancelText={modal.confirmState.cancelText}
        onConfirm={modal.confirmState.onConfirm || (() => {})}
        onCancel={modal.confirmState.onCancel}
      />

      <PromptModal
        isOpen={modal.promptState.isOpen}
        onClose={modal.closePrompt}
        title={modal.promptState.title}
        message={modal.promptState.message}
        placeholder={modal.promptState.placeholder}
        defaultValue={modal.promptState.defaultValue}
        confirmText={modal.promptState.confirmText}
        cancelText={modal.promptState.cancelText}
        onConfirm={modal.promptState.onConfirm || (() => {})}
        onCancel={modal.promptState.onCancel}
      />

      <SelectModal
        isOpen={modal.selectState.isOpen}
        onClose={modal.closeSelect}
        title={modal.selectState.title}
        message={modal.selectState.message}
        options={modal.selectState.options}
        defaultValue={modal.selectState.defaultValue}
        confirmText={modal.selectState.confirmText}
        cancelText={modal.selectState.cancelText}
        onConfirm={modal.selectState.onConfirm || (() => {})}
        onCancel={modal.selectState.onCancel}
      />
    </div>
  )
}

export default SettingsModal

import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Sparkles, Copy, Check, Loader2, X } from 'lucide-react'
import { Modal } from '@/components/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useEscapeClose, useFocusTrap } from '@/hooks/Trap'
import {
  aiApi,
  parseTagSuggestions,
  hasAiPrivacyAck,
  setAiPrivacyAck,
  getStoredAiModel,
  setStoredAiModel,
  getStoredAiProvider,
  setStoredAiProvider,
  getAiProviderLabel,
  type AiAction,
  type AiProviderStatus,
  type AiStatus,
} from '@/lib/ai'
import {
  getEditorContentForAi,
  getEditorContextBeforeCursor,
  insertEditorText,
  replaceEditorSelection,
  hasEditorSelection,
} from '@/lib/edIns'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface AiPanelProps {
  isOpen: boolean
  onClose: () => void
  title: string
  onApplyTags: (tags: string[]) => void
}

const ACTIONS: { id: AiAction; label: string }[] = [
  { id: 'summarize', label: '总结' },
  { id: 'suggest', label: '建议' },
  { id: 'polish', label: '润色' },
  { id: 'expand', label: '扩写' },
  { id: 'continue', label: '续写' },
  { id: 'tags', label: '标签' },
  { id: 'custom', label: '自定义' },
]

const SELECT_CLASS =
  'max-w-[min(100%,20rem)] truncate rounded border-2 border-blue-500 bg-white/20 px-3 py-2 text-lg text-white focus:outline-none'

const AiPanel: React.FC<AiPanelProps> = ({ isOpen, onClose, title, onApplyTags }) => {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const providerSelectId = useId()
  const modelSelectId = useId()
  const abortRef = useRef<AbortController | null>(null)

  const [status, setStatus] = useState<AiStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [action, setAction] = useState<AiAction>('summarize')
  const [instruction, setInstruction] = useState('')
  const [result, setResult] = useState('')
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [truncated, setTruncated] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [pendingAction, setPendingAction] = useState<AiAction | null>(null)
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [selectedProvider, setSelectedProvider] = useState<string>('')

  const getProviderEntry = useCallback(
    (providerId: string, providers: AiProviderStatus[]): AiProviderStatus | undefined =>
      providers.find((p) => p.id === providerId),
    []
  )

  const resolveModels = useCallback((entry: AiProviderStatus | undefined): string[] => {
    if (!entry) return []
    return entry.models?.length ? entry.models : entry.model ? [entry.model] : []
  }, [])

  const loadStatus = useCallback(async () => {
    setStatusLoading(true)
    try {
      const data = await aiApi.getStatus()
      setStatus(data)
    } catch {
      setStatus({
        enabled: false,
        provider: null,
        model: null,
        models: [],
        providers: [],
        limits: {
          maxInputChars: 32000,
          rateLimitMax: 20,
          rateLimitWindowSec: 3600,
        },
      })
    } finally {
      setStatusLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!status?.enabled) return

    const providers = status.providers?.length
      ? status.providers
      : status.provider
        ? [
            {
              id: status.provider,
              model: status.model ?? '',
              models: status.models?.length ? status.models : status.model ? [status.model] : [],
              cfMode: status.cfMode,
            },
          ]
        : []

    if (providers.length === 0) return

    const ids = providers.map((p) => p.id)
    const storedProvider = getStoredAiProvider()
    const providerId =
      storedProvider && ids.includes(storedProvider) ? storedProvider : (status.provider ?? ids[0])

    setSelectedProvider(providerId)

    const entry = getProviderEntry(providerId, providers)
    const models = resolveModels(entry)
    if (models.length === 0) return

    const storedModel = getStoredAiModel(providerId)
    const model =
      storedModel && models.includes(storedModel) ? storedModel : (entry?.model ?? models[0])
    setSelectedModel(model)
  }, [status, getProviderEntry, resolveModels])

  useFocusTrap(isOpen, dialogRef)
  useEscapeClose(isOpen, onClose)

  useEffect(() => {
    if (isOpen) {
      loadStatus()
      setResult('')
      setTagSuggestions([])
      setSelectedTags(new Set())
      setError('')
      setTruncated(false)
    } else {
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [isOpen, loadStatus])

  const buildPayload = useCallback(
    (act: AiAction) => {
      if (act === 'continue') {
        return {
          action: act,
          title,
          content: getEditorContextBeforeCursor(4000),
          model: selectedModel || undefined,
          provider: selectedProvider || undefined,
        }
      }
      const { content } = getEditorContentForAi()
      return {
        action: act,
        title,
        content,
        instruction: act === 'custom' ? instruction : undefined,
        model: selectedModel || undefined,
        provider: selectedProvider || undefined,
      }
    },
    [title, instruction, selectedModel, selectedProvider]
  )

  const runAction = useCallback(
    async (act: AiAction) => {
      if (!status?.enabled) return
      if (act === 'custom' && !instruction.trim()) {
        setError('请输入自定义指令')
        return
      }

      const payload = buildPayload(act)
      if (!payload.content.trim()) {
        setError('编辑器内容为空，请先输入笔记正文')
        return
      }

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setLoading(true)
      setError('')
      setResult('')
      setTagSuggestions([])
      setTruncated(false)

      try {
        const res = await aiApi.complete(payload, controller.signal)
        if (!res.success || !res.text) {
          setError(res.error || 'AI 请求失败')
          return
        }
        setTruncated(Boolean(res.truncated))
        if (act === 'tags') {
          const tags = parseTagSuggestions(res.text)
          setTagSuggestions(tags)
          setSelectedTags(new Set(tags))
        } else {
          setResult(res.text)
        }
      } catch (e) {
        if (controller.signal.aborted) return
        const err = e as { response?: { data?: { error?: string }; status?: number } }
        if (err.response?.status === 429) {
          setError('请求过于频繁，请稍后再试')
        } else {
          setError(err.response?.data?.error || 'AI 服务暂时不可用')
        }
      } finally {
        setLoading(false)
      }
    },
    [status?.enabled, buildPayload, instruction]
  )

  const handleActionClick = (act: AiAction) => {
    setAction(act)
    if (!hasAiPrivacyAck()) {
      setPendingAction(act)
      setShowPrivacy(true)
      return
    }
    void runAction(act)
  }

  const handlePrivacyConfirm = () => {
    setAiPrivacyAck()
    setShowPrivacy(false)
    if (pendingAction) {
      void runAction(pendingAction)
      setPendingAction(null)
    }
  }

  const handleCopy = async () => {
    if (!result) return
    await navigator.clipboard.writeText(result)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  const handleInsert = () => {
    if (!result) return
    insertEditorText(result)
    onClose()
  }

  const handleReplace = () => {
    if (!result || !hasEditorSelection()) return
    replaceEditorSelection(result)
    onClose()
  }

  const handleApplyTags = () => {
    const tags = [...selectedTags]
    if (tags.length) onApplyTags(tags)
    onClose()
  }

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  const handleProviderChange = (providerId: string) => {
    setSelectedProvider(providerId)
    setStoredAiProvider(providerId)

    const providers = status?.providers ?? []
    const entry = getProviderEntry(providerId, providers)
    const models = resolveModels(entry)
    const stored = getStoredAiModel(providerId)
    const next = stored && models.includes(stored) ? stored : (entry?.model ?? models[0] ?? '')
    setSelectedModel(next)
  }

  const handleModelChange = (model: string) => {
    setSelectedModel(model)
    if (selectedProvider) setStoredAiModel(selectedProvider, model)
  }

  const providerOptions = status?.providers?.length
    ? status.providers
    : status?.provider
      ? [
          {
            id: status.provider,
            model: status.model ?? '',
            models: status.models?.length ? status.models : status.model ? [status.model] : [],
            cfMode: status.cfMode,
          },
        ]
      : []

  const currentProviderEntry = getProviderEntry(selectedProvider, providerOptions)
  const modelOptions = resolveModels(currentProviderEntry)
  const currentCfMode = currentProviderEntry?.cfMode

  if (!isOpen) {
    return (
      <Modal
        isOpen={showPrivacy}
        onClose={() => {
          setShowPrivacy(false)
          setPendingAction(null)
        }}
        title="AI 隐私提示"
        type="warning"
      >
        <p className="text-sm text-gray-700">
          正文将发送至服务端并转发至所配置的 AI 提供商，请确认您信任该部署与提供商。
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setShowPrivacy(false)}>
            取消
          </Button>
          <Button variant="primary" onClick={handlePrivacyConfirm}>
            我知道了
          </Button>
        </div>
      </Modal>
    )
  }

  return (
    <>
      <div className="pointer-events-auto fixed inset-0 z-[70] flex items-center justify-center">
        <button
          type="button"
          className="absolute inset-0 bg-black/30"
          aria-label="关闭 AI 面板"
          onClick={onClose}
        />
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="relative mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-white/30 bg-white/30 shadow backdrop-blur-md"
        >
          <div className="flex items-center justify-between border-b border-white/30 px-6 py-4">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-blue-600" />
              <h2 id={titleId} className="text-lg font-semibold text-gray-900">
                AI 助手
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex size-10 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:text-gray-700"
              aria-label="关闭"
            >
              <X className="size-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {statusLoading ? (
              <div className="flex items-center gap-2 text-gray-600">
                <Loader2 className="size-4 animate-spin" />
                检查 AI 配置…
              </div>
            ) : !status?.enabled ? (
              <p className="text-sm text-amber-700">
                AI 未启用。请在服务端配置 AI 环境变量（见 .env.example）。
              </p>
            ) : (
              <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-lg text-white">
                {providerOptions.length > 1 ? (
                  <label className="flex items-center gap-1.5 text-lg text-white">
                    <span id={`${providerSelectId}-label`}>提供商：</span>
                    <select
                      id={providerSelectId}
                      name="ai-provider"
                      aria-labelledby={`${providerSelectId}-label`}
                      value={selectedProvider}
                      onChange={(e) => handleProviderChange(e.target.value)}
                      disabled={loading}
                      className={SELECT_CLASS}
                    >
                      {providerOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {getAiProviderLabel(p.id)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <span>
                    提供商：{getAiProviderLabel(providerOptions[0]?.id ?? status.provider ?? '')}
                  </span>
                )}
                {currentCfMode === 'binding' && <span>Workers AI 绑定</span>}
                {currentCfMode === 'rest' && <span>REST</span>}
                {modelOptions.length > 1 ? (
                  <label className="flex items-center gap-1.5 text-lg text-white">
                    <span id={`${modelSelectId}-label`}>模型：</span>
                    <select
                      id={modelSelectId}
                      name="ai-model"
                      aria-labelledby={`${modelSelectId}-label`}
                      value={selectedModel}
                      onChange={(e) => handleModelChange(e.target.value)}
                      disabled={loading}
                      className={SELECT_CLASS}
                    >
                      {modelOptions.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <span>模型：{selectedModel || status.model}</span>
                )}
              </div>
            )}

            <div className="mb-4 flex flex-wrap gap-2">
              {ACTIONS.map(({ id, label }) => (
                <Button
                  key={id}
                  variant={action === id ? 'success' : 'secondary-outline'}
                  onClick={() => handleActionClick(id)}
                  disabled={!status?.enabled || loading}
                >
                  {label}
                </Button>
              ))}
            </div>

            {action === 'custom' && (
              <div className="mb-4">
                <Input
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="输入自定义指令，例如：改写成更正式的语气"
                />
              </div>
            )}

            {loading && (
              <div className="mb-4 flex items-center gap-2 text-gray-600">
                <Loader2 className="size-4 animate-spin" />
                生成中…
              </div>
            )}

            {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

            {truncated && <p className="mb-2 text-xs text-amber-600">正文过长，已截断后发送。</p>}

            {tagSuggestions.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-sm font-medium text-gray-700">建议标签（点击选择）：</p>
                <div className="flex flex-wrap gap-2">
                  {tagSuggestions.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`rounded-full px-3 py-1 text-sm ${
                        selectedTags.has(tag)
                          ? 'bg-blue-500 text-white'
                          : 'bg-white/60 text-gray-700 ring-1 ring-gray-300'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <div className="mt-4">
                  <Button
                    variant="success"
                    onClick={handleApplyTags}
                    disabled={selectedTags.size === 0}
                  >
                    添加所选标签
                  </Button>
                </div>
              </div>
            )}

            {result && (
              <div className="rounded-lg border border-white/30 bg-white/30 p-4">
                <div className="prose prose-sm max-w-none text-gray-800">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="success" onClick={handleInsert}>
                    插入光标处
                  </Button>
                  {hasEditorSelection() && (
                    <Button variant="primary" onClick={handleReplace}>
                      替换选区
                    </Button>
                  )}
                  <Button variant="secondary" onClick={handleCopy}>
                    {copied ? <Check className="mr-1 size-4" /> : <Copy className="mr-1 size-4" />}
                    {copied ? '已复制' : '复制'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => void runAction(action)}
                    disabled={loading || !status?.enabled}
                  >
                    重新生成
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={showPrivacy}
        onClose={() => {
          setShowPrivacy(false)
          setPendingAction(null)
        }}
        title="AI 隐私提示"
        type="warning"
      >
        <p className="text-sm text-gray-700">
          正文将发送至服务端并转发至所配置的 AI 提供商，请确认您信任该部署与提供商。
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setShowPrivacy(false)}>
            取消
          </Button>
          <Button variant="primary" onClick={handlePrivacyConfirm}>
            我知道了
          </Button>
        </div>
      </Modal>
    </>
  )
}

export default AiPanel

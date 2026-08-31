import React, { useState, useEffect, useCallback, useRef, useMemo, useId } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Search, FileText, Hash, Loader2, SlidersHorizontal, Clock, X } from 'lucide-react'
import { debounce, getTagClassName, cn } from '@/lib/utils'
import {
  searchNotes,
  getSearchSuggestions,
  primeSearchCache,
  getSearchIndexWarmProgress,
  readSearchFilters,
  saveSearchFilters,
  readSearchHistory,
  addSearchHistory,
  clearSearchHistory,
  type SearchSuggestion,
  type ResolvedSearchOptions,
} from '@/lib/search'
import type { Note, SearchHistory } from '@/types'

interface AdvancedSearchProps {
  notes: Note[]
  loadSearchSummaries: () => Promise<Note[]>
  onSearch: (_filteredNotes: Note[]) => void
  onSearchActiveChange?: (_active: boolean) => void
  placeholder?: string
  className?: string
}

const FILTER_LABELS: Array<{ key: keyof ResolvedSearchOptions; label: string }> = [
  { key: 'searchInTitle', label: '标题' },
  { key: 'searchInTags', label: '标签' },
  { key: 'searchInContent', label: '正文' },
  { key: 'caseSensitive', label: '区分大小写' },
  { key: 'useRegex', label: '正则' },
]

type SearchListItem =
  | { kind: 'history'; query: string }
  | { kind: 'suggestion'; suggestion: SearchSuggestion }

const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  notes,
  loadSearchSummaries,
  onSearch,
  onSearchActiveChange,
  placeholder = '搜索笔记...',
  className = '',
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState<ResolvedSearchOptions>(() => readSearchFilters())
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [history, setHistory] = useState<SearchHistory[]>(() => readSearchHistory())
  const [searching, setSearching] = useState(false)
  const [indexWarm, setIndexWarm] = useState<{ done: number; total: number } | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [suggestionPosition, setSuggestionPosition] = useState({ top: 0, left: 0, width: 0 })
  const listboxId = useId()
  const searchRef = useRef<HTMLDivElement>(null)
  const searchRequestRef = useRef(0)
  const searchAbortRef = useRef<AbortController | null>(null)
  const filtersRef = useRef(filters)
  filtersRef.current = filters
  const navigate = useNavigate()

  useEffect(() => {
    primeSearchCache(notes)
  }, [notes])

  useEffect(() => {
    const tick = () => setIndexWarm(getSearchIndexWarmProgress())
    tick()
    const id = window.setInterval(tick, 500)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    onSearchActiveChange?.(searchTerm.trim().length > 0)
  }, [searchTerm, onSearchActiveChange])

  const updateSuggestionPosition = useCallback(() => {
    if (searchRef.current) {
      const rect = searchRef.current.getBoundingClientRect()
      setSuggestionPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: rect.width,
      })
    }
  }, [])

  const runSearch = useCallback(
    async (query: string) => {
      searchAbortRef.current?.abort()
      const controller = new AbortController()
      searchAbortRef.current = controller

      const requestId = ++searchRequestRef.current
      const trimmed = query.trim()
      const searchOpts = { signal: controller.signal, ...filtersRef.current }

      if (!trimmed) {
        onSearch(notes)
        setSuggestions([])
        setSearching(false)
        return
      }

      setSearching(true)
      try {
        const scope = await loadSearchSummaries()
        if (controller.signal.aborted || requestId !== searchRequestRef.current) return

        primeSearchCache(scope)

        const [results, suggestionList] = await Promise.all([
          searchNotes(trimmed, scope, searchOpts),
          trimmed.length >= 2
            ? getSearchSuggestions(trimmed, scope, searchOpts)
            : Promise.resolve([]),
        ])
        if (controller.signal.aborted || requestId !== searchRequestRef.current) return
        onSearch(results)
        setSuggestions(suggestionList)
        addSearchHistory(trimmed)
        setHistory(readSearchHistory())
      } catch {
        if (controller.signal.aborted || requestId !== searchRequestRef.current) return
        onSearch(notes)
        setSuggestions([])
      } finally {
        if (requestId === searchRequestRef.current) {
          setSearching(false)
        }
      }
    },
    [notes, onSearch, loadSearchSummaries]
  )

  const debouncedSearch = useRef(
    debounce((...args: unknown[]) => {
      void runSearch(args[0] as string)
    }, 300)
  ).current

  useEffect(() => {
    return () => {
      searchAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    debouncedSearch(searchTerm)
  }, [searchTerm, debouncedSearch])

  useEffect(() => {
    if (searchTerm.trim()) {
      void runSearch(searchTerm)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅筛选变更时立即重搜
  }, [filters])

  useEffect(() => {
    saveSearchFilters(filters)
  }, [filters])

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const searchComponent = target.closest('[data-search-component]')
      const suggestionPanel = target.closest('[data-suggestion-panel]')
      if (!searchComponent && !suggestionPanel && showSuggestions) {
        setShowSuggestions(false)
        setFiltersOpen(false)
      }
    }

    if (showSuggestions || filtersOpen) {
      const timer = setTimeout(() => {
        document.addEventListener('click', handleGlobalClick)
      }, 0)
      return () => {
        clearTimeout(timer)
        document.removeEventListener('click', handleGlobalClick)
      }
    }
  }, [showSuggestions, filtersOpen])

  const toggleFilter = (key: keyof ResolvedSearchOptions) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      const anyScope = next.searchInTitle || next.searchInTags || next.searchInContent
      if (!anyScope) return prev
      return next
    })
  }

  const handleSuggestionClick = useCallback(
    (suggestion: SearchSuggestion) => {
      setSearchTerm(suggestion.text)
      setShowSuggestions(false)
      navigate(`/notes/${suggestion.note.id}`, {
        state: {
          note: suggestion.note,
          highlightPosition: suggestion.position,
        },
      })
    },
    [navigate]
  )

  const handleHistoryClick = useCallback((query: string) => {
    setSearchTerm(query)
    setShowSuggestions(false)
  }, [])

  const getSuggestionIcon = (suggestion: SearchSuggestion) => {
    switch (suggestion.type) {
      case 'title':
        return <FileText className="mr-2 size-3 text-blue-500" />
      case 'tag':
        return <Hash className="mr-2 size-3 text-green-500" />
      case 'content':
        return <Search className="mr-2 size-3 text-gray-500" />
      default:
        return <Search className="mr-2 size-3 text-gray-400" />
    }
  }

  const showHistory = showSuggestions && !searchTerm.trim() && history.length > 0 && !filtersOpen
  const showResults = showSuggestions && searchTerm.trim().length > 0 && suggestions.length > 0
  const listExpanded = showHistory || showResults

  const listItems = useMemo((): SearchListItem[] => {
    if (showHistory) return history.map((item) => ({ kind: 'history', query: item.query }))
    if (showResults) return suggestions.map((suggestion) => ({ kind: 'suggestion', suggestion }))
    return []
  }, [showHistory, showResults, history, suggestions])

  useEffect(() => {
    setActiveIndex(-1)
  }, [listItems])

  useEffect(() => {
    if (activeIndex < 0) return
    document
      .getElementById(`${listboxId}-option-${activeIndex}`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, listboxId])

  const activateListItem = useCallback(
    (index: number) => {
      const item = listItems[index]
      if (!item) return
      if (item.kind === 'history') handleHistoryClick(item.query)
      else handleSuggestionClick(item.suggestion)
    },
    [listItems, handleHistoryClick, handleSuggestionClick]
  )

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setShowSuggestions(false)
      setFiltersOpen(false)
      setActiveIndex(-1)
      return
    }

    if (listItems.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (prev + 1) % listItems.length)
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev <= 0 ? listItems.length - 1 : prev - 1))
      return
    }

    if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      activateListItem(activeIndex)
    }
  }

  return (
    <div className={`relative ${className}`} data-search-component ref={searchRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 transform text-gray-400" />
        <button
          type="button"
          aria-label="搜索选项"
          aria-expanded={filtersOpen}
          onClick={() => {
            updateSuggestionPosition()
            setFiltersOpen((open) => !open)
            setShowSuggestions(true)
          }}
          className={`absolute right-9 top-1/2 -translate-y-1/2 rounded p-0.5 ${
            filtersOpen ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <SlidersHorizontal className="size-4" />
        </button>
        {searching ? (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-gray-400" />
        ) : searchTerm ? (
          <button
            type="button"
            aria-label="清除搜索"
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="size-4" />
          </button>
        ) : null}
        <label htmlFor="search-input" className="sr-only">
          搜索
        </label>
        <input
          id="search-input"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={listExpanded}
          aria-controls={listExpanded ? listboxId : undefined}
          aria-activedescendant={
            listExpanded && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
          }
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleInputKeyDown}
          onFocus={() => {
            updateSuggestionPosition()
            setShowSuggestions(true)
            setHistory(readSearchHistory())
          }}
          className="w-full rounded-lg border border-white/40 bg-white/50 py-2 pl-10 pr-16 backdrop-blur-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {indexWarm && indexWarm.done < indexWarm.total && (
        <p className="mt-1 text-xs text-gray-400" role="status">
          正在建立搜索索引 {indexWarm.done}/{indexWarm.total}…
        </p>
      )}

      {filtersOpen &&
        createPortal(
          <div
            className="fixed z-[99999] rounded-lg border border-white/40 bg-white/95 p-3 shadow-xl backdrop-blur-md"
            data-suggestion-panel
            style={{
              top: suggestionPosition.top,
              left: suggestionPosition.left,
              width: suggestionPosition.width,
              maxWidth: '90vw',
            }}
          >
            <div className="mb-2 text-xs font-medium text-gray-500">搜索范围</div>
            <div className="flex flex-wrap gap-2">
              {FILTER_LABELS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleFilter(key)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                    filters[key]
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}

      {showHistory &&
        createPortal(
          <div
            className="fixed z-[99999] rounded-lg border border-white/40 bg-white/95 shadow-xl backdrop-blur-md"
            data-suggestion-panel
            style={{
              top: suggestionPosition.top,
              left: suggestionPosition.left,
              width: suggestionPosition.width,
              maxWidth: '90vw',
            }}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
              <span className="text-xs font-medium text-gray-500">最近搜索</span>
              <button
                type="button"
                onClick={() => {
                  clearSearchHistory()
                  setHistory([])
                }}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                清空
              </button>
            </div>
            <div
              id={listboxId}
              role="listbox"
              aria-label="最近搜索"
              className="max-h-48 overflow-y-auto p-2"
            >
              {history.map((item, index) => (
                <div
                  key={`${item.query}-${item.timestamp}`}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={activeIndex === index}
                  className={cn(
                    'flex cursor-pointer items-center rounded p-2 text-sm text-gray-900 hover:bg-gray-50',
                    activeIndex === index && 'bg-gray-100'
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => handleHistoryClick(item.query)}
                >
                  <Clock className="mr-2 size-3 shrink-0 text-gray-400" />
                  <span className="truncate">{item.query}</span>
                </div>
              ))}
            </div>
          </div>,
          document.body
        )}

      {showResults &&
        createPortal(
          <div
            className="fixed z-[99999] rounded-lg border border-white/40 bg-white/95 shadow-xl backdrop-blur-md"
            data-suggestion-panel
            style={{
              top: suggestionPosition.top,
              left: suggestionPosition.left,
              width: suggestionPosition.width,
              maxWidth: '90vw',
            }}
          >
            <div className="p-2">
              <div
                id={listboxId}
                role="listbox"
                aria-label="搜索建议"
                className="max-h-48 space-y-1 overflow-y-auto"
              >
                {suggestions.map((suggestion, index) => (
                  <div
                    key={`${suggestion.note.id}-${index}`}
                    id={`${listboxId}-option-${index}`}
                    role="option"
                    aria-selected={activeIndex === index}
                    className={cn(
                      'flex cursor-pointer items-center rounded p-2 text-sm text-gray-900 hover:bg-gray-50',
                      activeIndex === index && 'bg-gray-100'
                    )}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleSuggestionClick(suggestion)
                    }}
                  >
                    {getSuggestionIcon(suggestion)}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {suggestion.type === 'tag' ? (
                          <span
                            className={cn(
                              'mr-2 inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium',
                              getTagClassName(suggestion.text)
                            )}
                          >
                            <Hash className="mr-1 size-3" />
                            {suggestion.text}
                          </span>
                        ) : (
                          suggestion.text
                        )}
                      </div>
                      <div className="truncate text-xs text-gray-500">
                        {suggestion.type === 'title'
                          ? '标题'
                          : suggestion.type === 'tag'
                            ? '标签'
                            : '内容'}{' '}
                        · {suggestion.note.title}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}

      {(showSuggestions || filtersOpen) &&
        createPortal(
          <div className="fixed inset-0 z-[99998]" style={{ pointerEvents: 'none' }} />,
          document.body
        )}
    </div>
  )
}

export default AdvancedSearch

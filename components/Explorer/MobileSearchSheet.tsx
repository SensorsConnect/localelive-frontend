'use client'

import { useState, useCallback, useContext, useRef, useEffect } from 'react'
import { FiSearch, FiSend, FiMenu } from 'react-icons/fi'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import toast from 'react-hot-toast'
import { v4 as uuid } from 'uuid'
import { useAuth } from '@clerk/nextjs'
import { useMapContext } from './MapContext'
import ChatContext from '../Chat/chatContext'
import { useLocation } from '@/components/Location'
import { config } from '@/utils/environment'
import PlaceCard from '../PlaceCard/PlaceCard'
import { Markdown } from '@/components'
import { useTheme } from '@/components/Themes'
import { useAutoResizeTextarea } from '@/hooks/useAutoResizeTextarea'

interface MobileSearchSheetProps {
  onToggleHistory: () => void
}

const DEFAULT_SEARCH_ROW_HEIGHT_PX = 56
const SEARCH_BAR_BOTTOM_PADDING_PX = 16
const TEXTAREA_MAX_HEIGHT_PX = 128

export default function MobileSearchSheet({ onToggleHistory }: MobileSearchSheetProps) {
  const [input, setInput] = useState('')
  const { getToken } = useAuth()
  const { location: contextLocation } = useLocation()
  const {
    activePlaces, aiResponse, isQuerying, selectedPlaceId, mobileMapRatio,
    activeUserLocation, setActivePlaces, setActiveUserLocation, setAiResponse,
    setIsQuerying, setSelectedPlaceId, setMobileMapRatio, pendingQuery, setPendingQuery
  } = useMapContext()
  const { currentChatRef } = useContext(ChatContext)
  const { resolvedTheme } = useTheme()
  const cardVariant = resolvedTheme === 'dark' ? 'dark' : 'light'

  useEffect(() => {
    console.log(`[MobileSheet] mount, apiUrl="${config.apiUrl}"`)
  }, [])

  // Pre-fill input when AppTour sets a demo query
  useEffect(() => {
    if (pendingQuery) {
      setInput(pendingQuery)
      setPendingQuery(null)
    }
  }, [pendingQuery, setPendingQuery])

  // Sync GPS location into MapContext so the map centers on the user before any query
  useEffect(() => {
    if (contextLocation && contextLocation.latitude !== null && contextLocation.longitude !== null) {
      if (!activeUserLocation ||
          activeUserLocation.latitude !== contextLocation.latitude ||
          activeUserLocation.longitude !== contextLocation.longitude) {
        setActiveUserLocation({ latitude: contextLocation.latitude, longitude: contextLocation.longitude })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextLocation])
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const searchRowRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [keyboardOffset, setKeyboardOffset] = useState(0)
  const [searchRowHeight, setSearchRowHeight] = useState(DEFAULT_SEARCH_ROW_HEIGHT_PX)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) {
      setKeyboardOffset(0)
      return
    }

    let delayedUpdate: ReturnType<typeof setTimeout> | null = null

    const updateKeyboardOffset = () => {
      const parentBottom = containerRef.current?.parentElement?.getBoundingClientRect().bottom ?? window.innerHeight
      const visualViewportBottom = vv.offsetTop + vv.height
      const overlap = Math.max(0, parentBottom - visualViewportBottom)
      setKeyboardOffset(overlap)
    }

    const scheduleKeyboardOffsetUpdate = () => {
      updateKeyboardOffset()
      if (delayedUpdate) clearTimeout(delayedUpdate)
      delayedUpdate = setTimeout(updateKeyboardOffset, 250)
    }

    const input = inputRef.current
    updateKeyboardOffset()
    vv.addEventListener('resize', updateKeyboardOffset)
    vv.addEventListener('scroll', updateKeyboardOffset)
    window.addEventListener('resize', updateKeyboardOffset)
    input?.addEventListener('focus', scheduleKeyboardOffsetUpdate)
    input?.addEventListener('blur', scheduleKeyboardOffsetUpdate)

    return () => {
      if (delayedUpdate) clearTimeout(delayedUpdate)
      vv.removeEventListener('resize', updateKeyboardOffset)
      vv.removeEventListener('scroll', updateKeyboardOffset)
      window.removeEventListener('resize', updateKeyboardOffset)
      input?.removeEventListener('focus', scheduleKeyboardOffsetUpdate)
      input?.removeEventListener('blur', scheduleKeyboardOffsetUpdate)
    }
  }, [])

  useAutoResizeTextarea(inputRef, input, TEXTAREA_MAX_HEIGHT_PX)

  useEffect(() => {
    const el = searchRowRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      const height = el.getBoundingClientRect().height
      if (height) setSearchRowHeight(Math.ceil(height))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const hasResults = !!(aiResponse || activePlaces.length > 0)
  const idleSheetHeight = keyboardOffset > 0
    ? `${searchRowHeight + SEARCH_BAR_BOTTOM_PADDING_PX}px`
    : `calc(${searchRowHeight + SEARCH_BAR_BOTTOM_PADDING_PX}px + env(safe-area-inset-bottom, 0px))`

  // Auto-scroll to the selected card when a pin is tapped
  useEffect(() => {
    if (!selectedPlaceId) return
    const el = cardRefs.current.get(selectedPlaceId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selectedPlaceId])

  const handleSubmit = useCallback(async () => {
    const query = input.trim()
    if (!query || isQuerying) return

    setIsQuerying(true)
    setInput('')
    setActivePlaces([])
    setAiResponse(null)
    setSelectedPlaceId(null)
    setMobileMapRatio(50)

    const effectiveLocation = contextLocation && contextLocation.latitude !== null && contextLocation.longitude !== null
      ? { latitude: contextLocation.latitude, longitude: contextLocation.longitude }
      : null

    console.log(`[MobileSheet] query="${query.slice(0, 60)}" hasLocation=${!!effectiveLocation}`)

    try {
      const threadId = currentChatRef?.current?.id ?? uuid()
      if (currentChatRef && !currentChatRef.current) {
        currentChatRef.current = { id: threadId }
      }

      const token = await getToken()
      const response = await fetch(`${config.apiUrl}/api/v1/query`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          threadId,
          text: query,
          location: effectiveLocation,
        }),
      })

      if (response.ok) {
        const parsed = await response.json()
        const places = parsed.places || []
        console.log(`[MobileSheet] response ok, places=${places.length}`)
        setAiResponse(parsed.answer || '')
        setActivePlaces(places)
        if (parsed.userLocation) setActiveUserLocation(parsed.userLocation)
      } else {
        const result = await response.json().catch(() => ({}))
        const message = typeof result.error === 'string'
          ? result.error
          : typeof result.detail === 'string'
            ? result.detail
            : Array.isArray(result.detail)
              ? result.detail.map((d: any) => d.msg).join('; ')
              : `Request failed (${response.status})`
        console.log(`[MobileSheet] error ${response.status}: ${message}`)
        toast.error(message)
      }
    } catch (error: any) {
      console.error('[MobileSheet] fetch error:', error.message)
      toast.error(error.message || 'An error occurred')
    } finally {
      setIsQuerying(false)
    }
  }, [input, isQuerying, contextLocation, getToken, currentChatRef, setActivePlaces, setActiveUserLocation, setAiResponse, setIsQuerying, setSelectedPlaceId, setMobileMapRatio])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const parent = containerRef.current?.parentElement
    if (!parent) return
    const touch = e.touches[0]
    const parentRect = parent.getBoundingClientRect()
    const ratio = ((touch.clientY - parentRect.top) / parentRect.height) * 100
    setMobileMapRatio(Math.min(85, Math.max(30, ratio)))
  }, [setMobileMapRatio])

  return (
    <div
      ref={containerRef}
      data-mobile-sheet
      className="absolute bottom-0 left-0 right-0 z-20 flex flex-col min-h-0 md:hidden bg-white/95 dark:bg-surface/95 md:backdrop-blur-xl border-t border-gray-200 dark:border-white/10 transition-[height] duration-200"
      style={{ height: hasResults ? `${100 - mobileMapRatio}%` : idleSheetHeight, bottom: keyboardOffset }}
    >
      {/* Drag handle — only when results are showing */}
      {hasResults && (
        <div
          className="flex justify-center py-3 cursor-row-resize touch-none flex-shrink-0"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
        >
          <div className="w-12 h-1.5 rounded-full bg-gray-300 dark:bg-white/20" />
        </div>
      )}

      {/* Search input */}
      <div ref={searchRowRef} className="flex items-end gap-2 px-4 py-2 flex-shrink-0">
        <button type="button" onClick={onToggleHistory} className="text-gray-500 dark:text-gray-400 flex-shrink-0">
          <FiMenu className="size-5" />
        </button>
        <form
          role="search"
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          className="flex-1 flex items-end gap-2 px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10"
        >
          <FiSearch className="size-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
          <textarea
            ref={inputRef}
            data-tour="mobile-search-input"
            name="q"
            rows={1}
            aria-label="Search places"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            inputMode="search"
            enterKeyHint="search"
            data-lpignore="true"
            data-1p-ignore="true"
            data-bwignore="true"
            data-form-type="other"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search places..."
            style={{ maxHeight: TEXTAREA_MAX_HEIGHT_PX }}
            className="flex-1 bg-transparent resize-none overflow-y-auto dark-scrollbar text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 outline-none text-sm leading-5"
          />
          <button type="submit" data-tour="mobile-search-submit" disabled={isQuerying} className="text-blue-600 dark:text-neon-cyan flex-shrink-0">
            {isQuerying ? (
              <AiOutlineLoading3Quarters className="size-4 animate-spin" />
            ) : (
              <FiSend className="size-4" />
            )}
          </button>
        </form>
      </div>

      {/* Scrollable content area */}
      {hasResults && (
        <div className="flex-1 overflow-y-auto dark-scrollbar px-4 pb-4 min-h-0">
          {/* AI Response */}
          {aiResponse && (
            <div className="mb-3 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 dark:bg-neon-cyan animate-live-pulse" />
                <span className="text-xs text-gray-500 uppercase tracking-wider">AI Response</span>
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300">
                <Markdown>{aiResponse}</Markdown>
              </div>
            </div>
          )}

          {/* Place cards — all listed, clicking zooms map */}
          {activePlaces.length > 0 && (
            <div data-tour="mobile-place-cards" className="-mx-1 space-y-3 px-1 overflow-x-hidden">
              <span className="text-xs text-gray-500 uppercase tracking-wider">
                {activePlaces.length} place{activePlaces.length !== 1 ? 's' : ''} found
              </span>
              {activePlaces.map((place, i) => (
                <div
                  key={place.id}
                  ref={(el) => {
                    if (el) cardRefs.current.set(place.id, el)
                    else cardRefs.current.delete(place.id)
                  }}
                >
                  <PlaceCard
                    place={place}
                    isSelected={selectedPlaceId === place.id}
                    onClick={() => setSelectedPlaceId(
                      selectedPlaceId === place.id ? null : place.id
                    )}
                    variant={cardVariant}
                    index={i + 1}
                    fullWidth
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

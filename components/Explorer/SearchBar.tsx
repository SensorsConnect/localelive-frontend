'use client'

import { useState, useCallback, useRef, useContext, useEffect } from 'react'
import { FiSearch, FiSend, FiMenu } from 'react-icons/fi'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import toast from 'react-hot-toast'
import { v4 as uuid } from 'uuid'
import { useAuth } from '@clerk/nextjs'
import { useMapContext } from './MapContext'
import ChatContext from '../Chat/chatContext'
import { useLocation } from '@/components/Location'
import { config } from '@/utils/environment'
import { useAutoResizeTextarea } from '@/hooks/useAutoResizeTextarea'

const SUGGESTIONS = [
  'Restaurants nearby',
  'Pharmacies open now',
  'Parking with low occupancy',
  'Coffee shops',
]

const TEXTAREA_MAX_HEIGHT_PX = 128

interface SearchBarProps {
  onToggleHistory: () => void
}

export default function SearchBar({ onToggleHistory }: SearchBarProps) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { getToken } = useAuth()
  const { location: contextLocation } = useLocation()
  const { activeUserLocation, setActivePlaces, setActiveUserLocation, setAiResponse, isQuerying, setIsQuerying, setSelectedPlaceId, pendingQuery, setPendingQuery } = useMapContext()
  const { currentChatRef } = useContext(ChatContext)

  useEffect(() => {
    console.log(`[SearchBar] mount, apiUrl="${config.apiUrl}"`)
  }, [])

  // Pre-fill input when AppTour sets a demo query
  useEffect(() => {
    if (pendingQuery) {
      setInput(pendingQuery)
      setPendingQuery(null)
      inputRef.current?.focus()
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

  const handleSubmit = useCallback(async (text?: string) => {
    const query = text || input.trim()
    if (!query || isQuerying) return

    setIsQuerying(true)
    setInput('')
    setActivePlaces([])
    setAiResponse(null)
    setSelectedPlaceId(null)

    const effectiveLocation = contextLocation && contextLocation.latitude !== null && contextLocation.longitude !== null
      ? { latitude: contextLocation.latitude, longitude: contextLocation.longitude }
      : null

    console.log(`[SearchBar] query="${query.slice(0, 60)}" hasLocation=${!!effectiveLocation}`)

    try {
      const threadId = currentChatRef?.current?.id ?? uuid()
      if (currentChatRef && !currentChatRef.current) {
        currentChatRef.current = { id: threadId }
      }

      const token = await getToken()
      const data: any = {
        threadId,
        text: query,
        location: effectiveLocation,
      }

      const response = await fetch(`${config.apiUrl}/api/v1/query`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        const parsed = await response.json()
        const answer = parsed.answer || ''
        const places = parsed.places || []
        const userLoc = parsed.userLocation || null

        console.log(`[SearchBar] response ok, places=${places.length}`)
        setAiResponse(answer)
        setActivePlaces(places)
        if (userLoc) setActiveUserLocation(userLoc)
      } else {
        const result = await response.json().catch(() => ({}))
        const message = typeof result.error === 'string'
          ? result.error
          : typeof result.detail === 'string'
            ? result.detail
            : Array.isArray(result.detail)
              ? result.detail.map((d: any) => d.msg).join('; ')
              : `Request failed (${response.status})`
        console.log(`[SearchBar] error ${response.status}: ${message}`)
        toast.error(message)
      }
    } catch (error: any) {
      console.error('[SearchBar] fetch error:', error.message)
      toast.error(error.message || 'An error occurred')
    } finally {
      setIsQuerying(false)
    }
  }, [input, isQuerying, contextLocation, getToken, currentChatRef, setActivePlaces, setActiveUserLocation, setAiResponse, setIsQuerying, setSelectedPlaceId])

  useAutoResizeTextarea(inputRef, input, TEXTAREA_MAX_HEIGHT_PX)

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  return (
    <div className="hidden md:block absolute top-4 left-4 md:w-[340px] lg:w-[420px] z-20">
      {/* Search input */}
      <form
        role="search"
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault()
          handleSubmit()
        }}
        className="glass-panel flex items-end gap-3 px-4 py-3 focus-within:border-blue-400/50 dark:focus-within:border-neon-cyan/50 focus-within:shadow-[0_0_15px_rgba(59,130,246,0.15)] dark:focus-within:shadow-[0_0_15px_rgba(34,211,238,0.15)] transition-all"
      >
        <button
          type="button"
          onClick={onToggleHistory}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors flex-shrink-0"
        >
          <FiMenu className="size-5" />
        </button>
        <FiSearch className="size-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
        <textarea
          ref={inputRef}
          data-tour="search-input"
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
          placeholder="Search for places, services..."
          disabled={isQuerying}
          style={{ maxHeight: TEXTAREA_MAX_HEIGHT_PX }}
          className="flex-1 bg-transparent resize-none overflow-y-auto dark-scrollbar text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 outline-none text-sm leading-5"
        />
        <button
          type="submit"
          data-tour="search-submit"
          disabled={isQuerying || !input.trim()}
          className="text-blue-600 dark:text-neon-cyan hover:text-blue-500 dark:hover:text-cyan-300 disabled:text-gray-400 dark:disabled:text-gray-600 transition-colors flex-shrink-0"
        >
          {isQuerying ? (
            <AiOutlineLoading3Quarters className="size-4 animate-spin" />
          ) : (
            <FiSend className="size-4" />
          )}
        </button>
      </form>

      {/* Suggestion chips */}
      <div className="flex gap-2 mt-2 flex-wrap">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => {
              setInput(s)
              handleSubmit(s)
            }}
            disabled={isQuerying}
            className="px-3 py-1.5 rounded-full text-xs text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-surface/80 backdrop-blur-sm hover:border-blue-400/30 dark:hover:border-neon-cyan/30 hover:text-gray-800 dark:hover:text-gray-200 transition-all disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

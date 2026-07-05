'use client'

import { createContext, useContext, ReactNode } from 'react'

interface TourContextType {
  startTour: () => void
  isTourActive: boolean
}

const TourContext = createContext<TourContextType>({ startTour: () => {}, isTourActive: false })

export function TourProvider({
  children,
  startTour,
  isTourActive,
}: {
  children: ReactNode
  startTour: () => void
  isTourActive: boolean
}) {
  return <TourContext.Provider value={{ startTour, isTourActive }}>{children}</TourContext.Provider>
}

export function useTourContext() {
  return useContext(TourContext)
}

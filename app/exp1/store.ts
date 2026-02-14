import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { INITIAL_DATA, ImageData, ObservationRecord } from './data'

export type { ImageData, SubImage, DrawableArea } from './data'

export interface ObservationRecord {
    sNo: number
    concentration: number
    amountAdded: number
    concInBath: number
    response: string
    percentResponse: string
}

interface ExperimentState {
    activeTab: 'theory' | 'setup' | 'observation' | 'graphs'
    theorySubTab: 'introduction' | 'procedure' | 'precautions'
    imageData: ImageData
    experimentRunning: boolean
    selectedBaseline: number
    selectedConcentration: number
    currentLeverRotation: number
    observations: ObservationRecord[]
    autoScroll: boolean
    currentGraphX: number
    maxResponse: number
    canvasData: Record<string, string>
    canvasWidths: Record<string, number>

    // Actions
    setActiveTab: (tab: 'theory' | 'setup' | 'observation' | 'graphs') => void
    setTheorySubTab: (tab: 'introduction' | 'procedure' | 'precautions') => void
    setImageData: (data: ImageData | ((prev: ImageData) => ImageData)) => void
    setExperimentRunning: (running: boolean) => void
    setSelectedBaseline: (baseline: number) => void
    setSelectedConcentration: (concentration: number) => void
    setCurrentLeverRotation: (rotation: number) => void
    setObservations: (observations: ObservationRecord[] | ((prev: ObservationRecord[]) => ObservationRecord[])) => void
    setAutoScroll: (autoScroll: boolean) => void
    setCurrentGraphX: (x: number) => void
    setMaxResponse: (max: number) => void
    setCanvasData: (data: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void
    setCanvasWidths: (widths: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void
    resetExperiment: () => void
}

export const useExperimentStore = create<ExperimentState>()(
    persist(
        (set) => ({
            activeTab: 'setup',
            theorySubTab: 'introduction',
            imageData: INITIAL_DATA,
            experimentRunning: false,
            selectedBaseline: 20,
            selectedConcentration: 0.05,
            currentLeverRotation: 0,
            observations: [],
            autoScroll: true,
            currentGraphX: 0,
            maxResponse: 100,
            canvasData: {},
            canvasWidths: {},

            setActiveTab: (activeTab) => set({ activeTab }),
            setTheorySubTab: (theorySubTab) => set({ theorySubTab }),
            setImageData: (updater) => set((state) => ({
                imageData: typeof updater === 'function' ? updater(state.imageData) : updater
            })),
            setExperimentRunning: (experimentRunning) => set({ experimentRunning }),
            setSelectedBaseline: (selectedBaseline) => set({ selectedBaseline }),
            setSelectedConcentration: (selectedConcentration) => set({ selectedConcentration }),
            setCurrentLeverRotation: (currentLeverRotation) => set({ currentLeverRotation }),
            setObservations: (updater) => set((state) => ({
                observations: typeof updater === 'function' ? updater(state.observations) : updater
            })),
            setAutoScroll: (autoScroll) => set({ autoScroll }),
            setCurrentGraphX: (currentGraphX) => set({ currentGraphX }),
            setMaxResponse: (maxResponse) => set({ maxResponse }),
            setCanvasData: (updater) => set((state) => ({
                canvasData: typeof updater === 'function' ? updater(state.canvasData) : updater
            })),
            setCanvasWidths: (updater) => set((state) => ({
                canvasWidths: typeof updater === 'function' ? updater(state.canvasWidths) : updater
            })),
            resetExperiment: () => set({
                currentLeverRotation: 0,
                currentGraphX: 0,
                observations: [],
                canvasData: {},
                experimentRunning: false
            })
        }),
        {
            name: 'experiment-storage',
        }
    )
)

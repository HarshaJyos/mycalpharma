'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { BookOpen, Settings, ClipboardList, BarChart3, Home, RotateCcw } from 'lucide-react'
import { useExperimentStore, SubImage, DrawableArea } from './store'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

const ORGAN_BATH_VOLUME = 20
const MAX_ROTATION_ANGLE = 20

export default function Exp1Page() {
  const {
    activeTab, setActiveTab,
    theorySubTab, setTheorySubTab,
    imageData, setImageData,
    experimentRunning, setExperimentRunning,
    selectedBaseline, setSelectedBaseline,
    selectedConcentration, setSelectedConcentration,
    currentLeverRotation, setCurrentLeverRotation,
    observations, setObservations,
    autoScroll, setAutoScroll,
    currentGraphX, setCurrentGraphX,
    maxResponse, setMaxResponse,
    canvasData, setCanvasData,
    canvasWidths, setCanvasWidths,
    resetExperiment: resetStore
  } = useExperimentStore()

  const availableBaselines = [20, 50, 100, 200, 400]
  const availableConcentrations = [0.05, 0.1, 0.2, 0.4, 0.8]

  const canvasWrapperRef = useRef<HTMLDivElement>(null)

  const canvasRefs = useRef<Record<string, HTMLCanvasElement>>({})
  const contextRefs = useRef<Record<string, CanvasRenderingContext2D>>({})
  const drawableAreaRefs = useRef<Record<string, HTMLDivElement>>({})
  const animationFrameRef = useRef<number>()

  // UI Scale can remain local as it's derived from window size/layout
  const [scale, setScale] = useState(1)
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null)

  // Ref to store the last pen position for continuity across animations
  const lastPenPositionRef = useRef<Record<string, { x: number; y: number }>>({})

  useEffect(() => {
    // Inject styles to hide scrollbar but keep functionality
    const style = document.createElement('style')
    style.innerHTML = `
      .no-scrollbar::-webkit-scrollbar {
        display: none;
      }
    `
    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ message, type })
  }

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  // Scale calculation
  useEffect(() => {
    if (imageData.baseImageDimensions && canvasWrapperRef.current) {
      const maxWidth = canvasWrapperRef.current.clientWidth - 48
      const maxHeight = 700
      const scaleX = maxWidth / imageData.baseImageDimensions.width
      const scaleY = maxHeight / imageData.baseImageDimensions.height
      setScale(Math.min(scaleX, scaleY, 1))
    }
  }, [imageData.baseImageDimensions, activeTab]) // Recalculate on tab change if coming back to setup

  // Initialize Canvas and Restore Data
  useEffect(() => {
    if (activeTab === 'setup') {
      imageData.drawableAreas.forEach(area => {
        const canvas = canvasRefs.current[area.id]
        if (canvas) {
          const storedWidth = canvasWidths[area.id] || area.scrollWidth * 3

          if (canvas.width !== storedWidth) {
            canvas.width = storedWidth
          }
          canvas.height = area.height

          const ctx = canvas.getContext('2d')
          if (ctx) {
            contextRefs.current[area.id] = ctx

            // Restore data
            const savedData = canvasData[area.id]
            if (savedData) {
              const img = new Image()
              img.src = savedData
              img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height)
                ctx.drawImage(img, 0, 0)
              }
            } else {
              // Initial Grid
              ctx.fillStyle = area.color
              ctx.fillRect(0, 0, canvas.width, canvas.height)
              ctx.strokeStyle = '#e0e0e0'
              ctx.lineWidth = 1
              for (let x = 0; x < canvas.width; x += 50) {
                ctx.beginPath()
                ctx.moveTo(x, 0)
                ctx.lineTo(x, canvas.height)
                ctx.stroke()
              }
              for (let y = 0; y < canvas.height; y += 50) {
                ctx.beginPath()
                ctx.moveTo(0, y)
                ctx.lineTo(canvas.width, y)
                ctx.stroke()
              }
            }
          }
        }
      })
    }
  }, [activeTab, imageData.drawableAreas, canvasData, canvasWidths, scale])

  // Restore Scroll Position separately to avoid clearing canvas on scroll update
  useEffect(() => {
    if (activeTab === 'setup') {
      imageData.drawableAreas.forEach(area => {
        if (drawableAreaRefs.current[area.id]) {
          drawableAreaRefs.current[area.id].scrollLeft = currentGraphX * scale
        }
      })
    }
  }, [activeTab, imageData.drawableAreas, currentGraphX, scale])

  const handleTabChange = (newTab: 'theory' | 'setup' | 'observation' | 'graphs') => {
    if (activeTab === 'setup') {
      // Save canvas data before leaving setup
      const newCanvasData: Record<string, string> = { ...canvasData }
      imageData.drawableAreas.forEach(area => {
        const canvas = canvasRefs.current[area.id]
        if (canvas) {
          newCanvasData[area.id] = canvas.toDataURL()
        }
      })
      setCanvasData(newCanvasData)
    }
    setActiveTab(newTab)
  }

  const rotatePoint = useCallback((x: number, y: number, centerX: number, centerY: number, angle: number) => {
    const radians = (angle * Math.PI) / 180
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)
    const dx = x - centerX
    const dy = y - centerY
    return {
      x: centerX + (dx * cos - dy * sin),
      y: centerY + (dx * sin + dy * cos)
    }
  }, [])



  const calculateResponse = (baseline: number, concentration: number): number => {
    // Formula: Dose = Stock (baseline) * Volume (concentration)
    // Bath Conc = Dose / Bath Volume
    const dose = baseline * concentration
    const concInBath = dose / ORGAN_BATH_VOLUME

    // Adjusted EC50 to 0.5 based on simulation
    const EC50 = 0.5
    const hillCoefficient = 1.5

    const numerator = Math.pow(concInBath, hillCoefficient)
    const denominator = Math.pow(EC50, hillCoefficient) + Math.pow(concInBath, hillCoefficient)
    const responsePercent = 100 * (numerator / denominator)
    return responsePercent
  }

  const performWash = useCallback(async () => {
    if (!imageData.baseImage || imageData.subImages.length === 0) {
      showToast('Please load experiment data first!', 'error')
      return
    }
    const leverImage = imageData.subImages.find(img => img.id === 'sub-1770900057664-0')
    if (!leverImage || leverImage.centerX === undefined || leverImage.centerY === undefined) {
      showToast('Lever image not properly configured!', 'error')
      return
    }
    if (leverImage.penTipOffsetX === undefined || leverImage.penTipOffsetY === undefined) {
      showToast('Pen tip not set on lever image!', 'error')
      return
    }
    showToast('Washing organ bath...', 'info')
    setExperimentRunning(true)
    const startRotation = currentLeverRotation
    const targetRotation = 0
    const duration = 1500
    const startTime = Date.now()

    const penTipLocalX = leverImage.x + leverImage.penTipOffsetX
    const penTipLocalY = leverImage.y + leverImage.penTipOffsetY

    const startPenTip = rotatePoint(
      penTipLocalX,
      penTipLocalY,
      leverImage.centerX,
      leverImage.centerY,
      startRotation
    )
    const baselinePenTip = rotatePoint(
      penTipLocalX,
      penTipLocalY,
      leverImage.centerX,
      leverImage.centerY,
      0
    )
    const animate = () => {
      const now = Date.now()
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easeProgress = 1 - Math.exp(-5 * progress)
      const currentRotation = startRotation + (targetRotation - startRotation) * easeProgress

      setCurrentLeverRotation(currentRotation)
      // Note: We don't need to setImageData just for rotation if we use currentLeverRotation for rendering
      // BUT the original code updated imageData.subImages.rotation too. 
      // We should probably keep that consistent or just rely on currentLeverRotation in render.
      // The render loop below uses imageData, so we should update it or make render use state.
      // Optimally, rendering should rely on state, but the structure has rotation in subImages. 
      // Let's update it to be safe.
      setImageData(prev => ({
        ...prev,
        subImages: prev.subImages.map(img =>
          img.id === leverImage.id ? { ...img, rotation: currentRotation } : img
        )
      }))

      if (progress >= 1) {
        imageData.drawableAreas?.forEach(area => {
          if (
            startPenTip.x >= area.x &&
            startPenTip.x <= area.x + area.width &&
            startPenTip.y >= area.y &&
            startPenTip.y <= area.y + area.height
          ) {
            // Use last known pen position if available to ensure continuity
            const lastPos = lastPenPositionRef.current[area.id]

            const currentScroll = drawableAreaRefs.current[area.id]?.scrollLeft / scale || 0

            // If we have a last position, use it. Otherwise calculate from theoretical start.
            // Note: lastPos is in canvas coordinates.
            const startCanvasX = lastPos ? lastPos.x : (startPenTip.x - area.x) + currentScroll
            const startCanvasY = lastPos ? lastPos.y : (startPenTip.y - area.y)

            const endCanvasX = (baselinePenTip.x - area.x) + currentScroll
            const endCanvasY = baselinePenTip.y - area.y

            const ctx = contextRefs.current[area.id]
            if (ctx) {
              ctx.strokeStyle = '#ffffff'
              ctx.lineWidth = 2
              ctx.beginPath()
              ctx.moveTo(startCanvasX, startCanvasY)
              ctx.lineTo(endCanvasX, endCanvasY)
              ctx.stroke()

              // Update last pen position to the end of wash line
              lastPenPositionRef.current[area.id] = { x: endCanvasX, y: endCanvasY }
            }
          }
        })

        // Save canvas data on wash completion
        const canvasUpdates: Record<string, string> = {}
        imageData.drawableAreas?.forEach(area => {
          const canvas = canvasRefs.current[area.id]
          if (canvas) {
            canvasUpdates[area.id] = canvas.toDataURL()
          }
        })
        setCanvasData(prev => ({ ...prev, ...canvasUpdates }))

        setExperimentRunning(false)
        const area = imageData.drawableAreas?.[0]
        if (area && drawableAreaRefs.current[area.id]) {
          const currentScroll = drawableAreaRefs.current[area.id].scrollLeft / scale
          const newScroll = currentScroll + 15
          const canvas = canvasRefs.current[area.id]
          const visibleWidth = area.width
          const maxScrollLeft = (canvas?.width || area.scrollWidth * 3) - visibleWidth
          const clampedScroll = Math.max(0, Math.min(newScroll, maxScrollLeft))
          drawableAreaRefs.current[area.id].scrollLeft = clampedScroll * scale
          setCurrentGraphX(clampedScroll)
        }
        showToast('Wash completed', 'success')
      } else {
        animationFrameRef.current = requestAnimationFrame(animate)
      }
    }
    animationFrameRef.current = requestAnimationFrame(animate)
  }, [imageData, currentLeverRotation, scale, rotatePoint, setCurrentLeverRotation, setImageData, setExperimentRunning, setCurrentGraphX, setCanvasData])

  const expandCanvasIfNeeded = useCallback((areaId: string, requiredWidth: number) => {
    const canvas = canvasRefs.current[areaId]
    const ctx = contextRefs.current[areaId]
    if (canvas && ctx && requiredWidth > canvas.width - 200) {
      const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const newWidth = canvas.width * 2
      canvas.width = newWidth
      ctx.putImageData(currentImageData, 0, 0)

      // Update store with new width so it persists
      setCanvasWidths(prev => ({ ...prev, [areaId]: newWidth }))

      const area = imageData.drawableAreas.find(a => a.id === areaId)
      if (area) {
        ctx.fillStyle = area.color
        ctx.strokeStyle = '#e0e0e0'
        ctx.lineWidth = 1
        for (let x = 0; x < newWidth; x += 50) {
          ctx.beginPath()
          ctx.moveTo(x, 0)
          ctx.lineTo(x, canvas.height)
          ctx.stroke()
        }
      }
    }
  }, [imageData, setCanvasWidths])

  const performInjection = useCallback(async () => {
    if (!imageData.baseImage || imageData.subImages.length === 0) {
      showToast('Please load experiment data first!', 'error')
      return
    }
    const leverImage = imageData.subImages.find(img => img.id === 'sub-1770900057664-0')
    if (!leverImage || leverImage.centerX === undefined || leverImage.centerY === undefined) {
      showToast('Lever image not properly configured!', 'error')
      return
    }
    if (leverImage.penTipOffsetX === undefined || leverImage.penTipOffsetY === undefined) {
      showToast('Pen tip not set on lever image!', 'error')
      return
    }
    showToast(`Injecting ${selectedConcentration} µg/mL ACh on ${selectedBaseline} µg/mL baseline...`, 'info')
    setExperimentRunning(true)
    const responsePercent = calculateResponse(selectedBaseline, selectedConcentration)
    const targetRotation = -(responsePercent / 100) * MAX_ROTATION_ANGLE

    const startRotation = currentLeverRotation
    const duration = 3000
    const startTime = Date.now()
    // Initialize areaLastPos from the persistent ref to ensure continuity
    const areaLastPos: Record<string, { x: number; y: number }> = { ...lastPenPositionRef.current }
    const startScrollPositions: Record<string, number> = {}
    const scrollDistance = 150

    const animate = () => {
      const now = Date.now()
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easeProgress = 1 / (1 + Math.exp(-8 * (progress - 0.5)))
      const currentRotation = startRotation + (targetRotation - startRotation) * easeProgress

      setCurrentLeverRotation(currentRotation)
      setImageData(prev => ({
        ...prev,
        subImages: prev.subImages.map(img =>
          img.id === leverImage.id ? { ...img, rotation: currentRotation } : img
        )
      }))

      const penTipLocalX = leverImage.x + leverImage.penTipOffsetX
      const penTipLocalY = leverImage.y + leverImage.penTipOffsetY
      const rotatedPenTip = rotatePoint(
        penTipLocalX,
        penTipLocalY,
        leverImage.centerX!,
        leverImage.centerY!,
        currentRotation
      )

      imageData.drawableAreas?.forEach(area => {
        const isInArea = rotatedPenTip.x >= area.x &&
          rotatedPenTip.x <= area.x + area.width &&
          rotatedPenTip.y >= area.y &&
          rotatedPenTip.y <= area.y + area.height

        if (isInArea) {
          if (startScrollPositions[area.id] === undefined && drawableAreaRefs.current[area.id]) {
            startScrollPositions[area.id] = drawableAreaRefs.current[area.id].scrollLeft / scale
          }
          const canvas = canvasRefs.current[area.id]
          const startScroll = startScrollPositions[area.id] || 0
          const currentScrollOffset = startScroll + (scrollDistance * progress)

          if (autoScroll && drawableAreaRefs.current[area.id]) {
            const visibleWidth = area.width
            const maxScrollLeft = (canvas?.width || area.scrollWidth * 3) - visibleWidth
            // Update currentGraphX state less frequently if possible, but here we drive animation
            const clampedScroll = Math.max(0, Math.min(currentScrollOffset, maxScrollLeft))
            drawableAreaRefs.current[area.id].scrollLeft = clampedScroll * scale
          }

          const penTipRelativeX = rotatedPenTip.x - area.x
          expandCanvasIfNeeded(area.id, penTipRelativeX + currentScrollOffset + 300)

          const canvasX = (rotatedPenTip.x - area.x) + currentScrollOffset
          const canvasY = rotatedPenTip.y - area.y

          const lastPos = areaLastPos[area.id]
          if (lastPos) {
            const ctx = contextRefs.current[area.id]
            if (ctx) {
              ctx.strokeStyle = '#ffffff'
              ctx.lineWidth = 2
              ctx.lineCap = 'round'
              ctx.lineJoin = 'round'
              ctx.beginPath()
              ctx.moveTo(lastPos.x, lastPos.y)
              ctx.lineTo(canvasX, canvasY)
              ctx.stroke()
            }
          }
          areaLastPos[area.id] = { x: canvasX, y: canvasY }
          // Update persistent ref
          lastPenPositionRef.current[area.id] = { x: canvasX, y: canvasY }
        }
      })
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate)
      } else {
        // Save canvas data BEFORE changing state that might trigger re-renders
        const canvasUpdates: Record<string, string> = {}
        imageData.drawableAreas?.forEach(area => {
          const canvas = canvasRefs.current[area.id]
          if (canvas) {
            canvasUpdates[area.id] = canvas.toDataURL()
          }
        })
        setCanvasData(prev => ({ ...prev, ...canvasUpdates }))

        setExperimentRunning(false)
        const area = imageData.drawableAreas?.[0]
        if (area && drawableAreaRefs.current[area.id]) {
          const finalScrollPos = drawableAreaRefs.current[area.id].scrollLeft / scale || 0
          setCurrentGraphX(finalScrollPos + 20)
        }

        const quantity = selectedBaseline * selectedConcentration
        const concInBath = quantity / ORGAN_BATH_VOLUME
        setObservations(prev => [...prev, {
          sNo: prev.length + 1,
          concentration: selectedBaseline,
          amountAdded: selectedConcentration,
          concInBath,
          response: '',
          percentResponse: ''
        }])
        showToast('Injection completed!', 'success')
      }
    }
    animationFrameRef.current = requestAnimationFrame(animate)
  }, [imageData, currentLeverRotation, selectedBaseline, selectedConcentration, autoScroll, scale, rotatePoint, expandCanvasIfNeeded, setCurrentLeverRotation, setImageData, setExperimentRunning, setObservations, setCurrentGraphX, setCanvasData])

  const updateObservationResponse = (index: number, response: string) => {
    setObservations(prev => {
      const updated = [...prev]
      updated[index].response = response
      if (response && !isNaN(parseFloat(response)) && maxResponse > 0) {
        const responseValue = parseFloat(response)
        updated[index].percentResponse = ((responseValue / maxResponse) * 100).toFixed(2)
        updated.forEach((obs, i) => {
          if (obs.response && !isNaN(parseFloat(obs.response))) {
            updated[i].percentResponse = ((parseFloat(obs.response) / maxResponse) * 100).toFixed(2)
          }
        })
      }
      return updated
    })
  }

  const resetExperiment = () => {
    resetStore() // Resets state in store
    showToast('Experiment reset - ready for new trial', 'info')
  }

  const allItems = [
    ...imageData.subImages.map(img => ({ ...img, type: 'image' as const })),
    ...(imageData.drawableAreas || []).map(area => ({ ...area, type: 'area' as const }))
  ].sort((a, b) => a.zIndex - b.zIndex)

  // Chart data
  const sortedObs = [...observations].sort((a, b) => a.concInBath - b.concInBath)
  const doseData = {
    labels: sortedObs.map(o => o.concInBath.toFixed(3)),
    datasets: [{
      label: '% Response',
      data: sortedObs.map(o => Number(o.percentResponse) || 0),
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      tension: 0.4,
      pointRadius: 5,
    }]
  }

  const logDoseData = {
    labels: sortedObs.map(o => o.concInBath > 0 ? Math.log10(o.concInBath).toFixed(2) : '–'),
    datasets: [{
      label: '% Response',
      data: sortedObs.map(o => Number(o.percentResponse) || 0),
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      tension: 0.4,
      pointRadius: 5,
    }]
  }

  const chartOptions = (title: string, xLabel: string) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const },
      title: { display: true, text: title, font: { size: 16 } },
    },
    scales: {
      y: { min: 0, max: 110, title: { display: true, text: '% Response' } },
      x: { title: { display: true, text: xLabel } },
    },
  })

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-5 py-8">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Acetylcholine Dose-Response Curve</h1>
            <p className="text-slate-600">Frog Rectus Abdominis Muscle – Kymograph Simulation</p>
          </div>
          <Link href="/" className="flex items-center gap-2 px-5 py-2.5 bg-white rounded-lg shadow-sm border hover:bg-slate-50">
            <Home size={18} /> Home
          </Link>
        </div>

        <div className="flex border-b mb-8">
          {[
            { id: 'theory', label: 'Theory', icon: BookOpen },
            { id: 'setup', label: 'Setup', icon: Settings },
            { id: 'observation', label: 'Observation', icon: ClipboardList },
            { id: 'graphs', label: 'Graphs', icon: BarChart3 },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id as 'theory' | 'setup' | 'observation' | 'graphs')}
              className={`flex-1 py-4 px-6 font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === tab.id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Toast */}
        {toast && (
          <div className="fixed top-8 right-8 z-50 animate-in slide-in-from-top duration-300">
            <div className={`px-6 py-4 rounded-lg shadow-2xl border-2 backdrop-blur-md ${toast.type === 'success' ? 'bg-green-500/90 border-green-300 text-white' :
              toast.type === 'error' ? 'bg-red-500/90 border-red-300 text-white' :
                'bg-blue-500/90 border-blue-300 text-white'
              }`}>
              <div className="flex items-center space-x-3">
                <div className="text-2xl">
                  {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}
                </div>
                <div className="font-semibold">{toast.message}</div>
              </div>
            </div>
          </div>
        )}

        {/* SETUP TAB */}
        {activeTab === 'setup' && (
          <div className="grid lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 bg-white rounded-xl shadow border overflow-hidden">
              <div className="p-5 border-b">
                <h2 className="text-lg font-semibold">Kymograph</h2>
              </div>
              <div ref={canvasWrapperRef} className="p-6 bg-slate-50 min-h-[700px]">
                <div
                  className="relative"
                  style={{
                    width: `${imageData.baseImageDimensions.width * scale}px`,
                    height: `${imageData.baseImageDimensions.height * scale}px`,
                  }}
                >
                  <img
                    src={imageData.baseImage}
                    alt="Base"
                    style={{
                      width: '100%',
                      height: '100%',
                      pointerEvents: 'none',
                    }}
                  />
                  {allItems.map(item => {
                    if (item.type === 'image') {
                      const img = item as SubImage
                      const rot = img.rotation || 0
                      let origin = 'center'
                      if (img.centerX && img.centerY) {
                        origin = `${((img.centerX - img.x) / img.width) * 100}% ${((img.centerY - img.y) / img.height) * 100}%`
                      }
                      const penTip = img.centerX && img.centerY && img.penTipOffsetX !== undefined && img.penTipOffsetY !== undefined
                        ? rotatePoint(img.x + img.penTipOffsetX, img.y + img.penTipOffsetY, img.centerX, img.centerY, rot)
                        : null

                      return (
                        <div key={img.id}>
                          <div
                            className="absolute pointer-events-none"
                            style={{
                              left: `${img.x * scale}px`,
                              top: `${img.y * scale}px`,
                              width: `${img.width * scale}px`,
                              height: `${img.height * scale}px`,
                              transform: `rotate(${rot}deg)`,
                              transformOrigin: origin,
                              zIndex: img.zIndex,
                            }}
                          >
                            <img src={img.url} alt="" style={{ width: '100%', height: '100%', pointerEvents: 'none' }} />
                          </div>
                          {/* Center Point Debug Marker */}
                          {/*{img.centerX && img.centerY && (
                            <div
                              className="absolute w-3 h-3 bg-red-500 rounded-full border-2 border-white pointer-events-none"
                              style={{
                                left: `${img.centerX * scale - 6}px`,
                                top: `${img.centerY * scale - 6}px`,
                                zIndex: 9999,
                              }}
                            />
                          )}*/}
                          {/* Pen Tip Debug Marker */}
                          {/*{penTip && (
                            <div
                              className="absolute w-4 h-4 bg-green-500 rounded-full border-2 border-white pointer-events-none"
                              style={{
                                left: `${penTip.x * scale - 8}px`,
                                top: `${penTip.y * scale - 8}px`,
                                zIndex: 10000,
                              }}
                            />
                          )}*/}
                          {/* Pen Tip Highlight  */}
                          {/*{penTip && (
                            <div
                              className="absolute w-6 h-6 bg-yellow-400 rounded-full border-2 border-black pointer-events-none opacity-75"
                              style={{
                                left: `${penTip.x * scale - 12}px`,
                                top: `${penTip.y * scale - 12}px`,
                                zIndex: 9998,
                              }}
                            />
                          )}*/}
                        </div>
                      )
                    } else {
                      const area = item as DrawableArea
                      return (
                        <div
                          key={area.id}
                          ref={el => { if (el) drawableAreaRefs.current[area.id] = el }}
                          className="absolute overflow-x-auto overflow-y-hidden border border-slate-200 rounded no-scrollbar"
                          style={{
                            left: `${area.x * scale}px`,
                            top: `${area.y * scale}px`,
                            width: `${area.width * scale}px`,
                            height: `${area.height * scale}px`,
                            zIndex: area.zIndex,
                          }}
                        >
                          <canvas
                            ref={el => { if (el) canvasRefs.current[area.id] = el }}
                            style={{
                              width: `${(canvasWidths[area.id] || area.scrollWidth * 3) * scale}px`,
                              height: `${area.height * scale}px`,
                            }}
                          />
                        </div>
                      )
                    }
                  })}
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white rounded-xl shadow border p-6">
                <h3 className="font-medium mb-4">Parameters</h3>
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm text-slate-600 mb-1.5">Stock Concentration (µg/mL)</label>
                    <select
                      value={selectedBaseline}
                      onChange={e => setSelectedBaseline(Number(e.target.value))}
                      disabled={experimentRunning}
                      className="w-full border rounded-lg px-3 py-2.5 disabled:opacity-60"
                    >
                      {availableBaselines.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1.5">Volume (mL)</label>
                    <select
                      value={selectedConcentration}
                      onChange={e => setSelectedConcentration(Number(e.target.value))}
                      disabled={experimentRunning}
                      className="w-full border rounded-lg px-3 py-2.5 disabled:opacity-60"
                    >
                      {availableConcentrations.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-4">
                  <button
                    onClick={performWash}
                    disabled={experimentRunning}
                    className="py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    Wash
                  </button>
                  <button
                    onClick={performInjection}
                    disabled={experimentRunning}
                    className="py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Inject
                  </button>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-slate-600">Auto-scroll</span>
                  <button
                    onClick={() => setAutoScroll(!autoScroll)}
                    className={`px-4 py-1.5 rounded text-sm font-medium ${autoScroll ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                      }`}
                  >
                    {autoScroll ? 'ON' : 'OFF'}
                  </button>
                </div>

                <button
                  onClick={resetExperiment}
                  disabled={experimentRunning}
                  className="mt-6 w-full py-2.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <RotateCcw size={16} /> Reset
                </button>
              </div>

              <div className="bg-white rounded-xl shadow border p-6">
                <h3 className="font-medium mb-3">Status</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Rotation</span>
                    <span className="font-medium">{Math.round(Math.abs(currentLeverRotation))}°</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">State</span>
                    <span className={experimentRunning ? "text-emerald-600 font-medium" : "text-slate-500"}>
                      {experimentRunning ? "Running" : "Ready"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow border p-6">
                <h3 className="font-medium mb-4">Instructions</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600">
                  <li>Select baseline and concentration</li>
                  <li>Inject to start contraction</li>
                  <li>Measure response on kymograph</li>
                  <li>Enter in observation tab</li>
                  <li>Wash to reset</li>
                  <li>Repeat for curve</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* OBSERVATION TAB */}
        {activeTab === 'observation' && (
          <div className="space-y-10">
            <div className="bg-white rounded-xl shadow border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Kymograph Recording</h2>
                <button
                  onClick={resetExperiment}
                  disabled={experimentRunning}
                  className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 flex items-center gap-2"
                >
                  <RotateCcw size={16} /> Reset
                </button>
              </div>
              <div className="border border-slate-200 rounded overflow-x-auto">
                {imageData.drawableAreas.map(area => {
                  const displayScale = 0.8
                  const usedWidth = Math.max(currentGraphX + 100, area.scrollWidth)
                  const storedData = canvasData[area.id]

                  return (
                    <div key={area.id} className="mb-4">
                      <div className="overflow-x-auto overflow-y-hidden border border-slate-200 rounded">
                        {/* 
                           Here we use an IMG instead of Canvas for observation if data exists, 
                           which is much more reliable than trying to clone a canvas that might not exist 
                        */}
                        {storedData ? (
                          <img
                            src={storedData}
                            alt="Graph Recording"
                            style={{
                              width: `${(canvasWidths[area.id] || area.scrollWidth * 3) * displayScale}px`,
                              height: `${area.height * displayScale}px`,
                              maxWidth: 'none', // Ensure it doesn't shrink
                              display: 'block'
                            }}
                          />
                        ) : (
                          <div className="p-10 text-center text-gray-400">No graph data recorded yet</div>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-2 text-center">
                        Total graph width: {Math.round(currentGraphX)}px
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow border overflow-hidden">
              {/* Observation Table Content - same as before */}
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold">Observation Table</h2>
              </div>
              <div className="px-6 py-4 border-b">
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium text-slate-600">Maximum Response (mm):</label>
                  <input
                    type="number"
                    value={maxResponse}
                    onChange={e => setMaxResponse(Number(e.target.value))}
                    className="w-32 px-3 py-2 border rounded focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-4 text-left font-medium text-slate-600">S.No</th>
                      <th className="px-6 py-4 text-left font-medium text-slate-600">Conc. ACh (µg/mL)</th>
                      <th className="px-6 py-4 text-left font-medium text-slate-600">Amount Added (mL)</th>
                      <th className="px-6 py-4 text-left font-medium text-slate-600">Conc. in Bath</th>
                      <th className="px-6 py-4 text-left font-medium text-slate-600">Response (mm)</th>
                      <th className="px-6 py-4 text-left font-medium text-slate-600"> % Response</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {observations.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          No observations yet
                        </td>
                      </tr>
                    ) : (
                      observations.map((obs, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-6 py-4">{obs.sNo}</td>
                          <td className="px-6 py-4">{obs.concentration.toFixed(2)}</td>
                          <td className="px-6 py-4">{obs.amountAdded.toFixed(2)}</td>
                          <td className="px-6 py-4">{obs.concInBath.toFixed(4)}</td>
                          <td className="px-6 py-3">
                            <input
                              type="number"
                              step="0.1"
                              value={obs.response}
                              onChange={e => updateObservationResponse(i, e.target.value)}
                              className="w-24 px-3 py-1.5 border rounded focus:outline-none focus:border-blue-400"
                            />
                          </td>
                          <td className="px-6 py-4 font-medium text-emerald-600">
                            {obs.percentResponse || '—'}%
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* GRAPHS TAB */}
        {activeTab === 'graphs' && (
          <div className="space-y-10">
            <div className="bg-white rounded-xl shadow border p-8">
              <h2 className="text-xl font-semibold mb-6">Dose vs % Response</h2>
              <div className="h-96">
                <Line data={doseData} options={chartOptions("Dose vs % Response curve of Acetylcholine on Frog Rectus Abdominis Muscle", "Dose (µg/ml)")} />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow border p-8">
              <h2 className="text-xl font-semibold mb-6">Log-Dose vs % Response</h2>
              <div className="h-96">
                <Line data={logDoseData} options={chartOptions("Log-Dose vs % Response curve of Acetylcholine on Frog Rectus Abdominis Muscle", "Log₁₀(Dose)")} />
              </div>
            </div>
          </div>
        )}

        {/* THEORY TAB */}
        {activeTab === 'theory' && (
          <div className="bg-white rounded-xl shadow border p-6">
            <div className="flex gap-2 mb-6 border-b pb-4">
              {[
                { id: 'introduction', label: 'Introduction' },
                { id: 'procedure', label: 'Procedure' },
                { id: 'precautions', label: 'Precautions' },
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setTheorySubTab(sub.id as 'introduction' | 'procedure' | 'precautions')}
                  className={`px-6 py-2 rounded-full text-sm font-medium transition ${theorySubTab === sub.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {theorySubTab === 'introduction' && (
              <div className="prose max-w-none">
                <h2>Introduction</h2>
                <p>The experiment demonstrates the dose-response relationship of acetylcholine (ACh) on the frog rectus abdominis muscle. ACh binds to nicotinic receptors, causing muscle contraction. The response is recorded on a kymograph, showing increasing contraction with higher doses until a maximum is reached. This curve is used to determine potency (EC50) and efficacy.</p>
              </div>
            )}

            {theorySubTab === 'procedure' && (
              <div className="prose max-w-none">
                <h2>Procedure</h2>
                <ol>
                  <li>Dissect the frog and isolate the rectus abdominis muscle.</li>
                  <li>Mount the muscle in an organ bath containing aerated frog Ringer&apos;s solution at room temperature.</li>
                  <li>Attach the muscle to an isotonic lever connected to a kymograph drum.</li>
                  <li>Record a baseline contraction.</li>
                  <li>Add increasing concentrations of ACh (e.g., 0.05 to 0.8 µg/mL) to the bath.</li>
                  <li>Record the contraction height for each dose.</li>
                  <li>Wash the bath with fresh Ringer&apos;s solution between doses to return to baseline.</li>
                  <li>Calculate % response relative to the maximum contraction.</li>
                  <li>Plot dose-response and log-dose-response curves.</li>
                </ol>
              </div>
            )}

            {theorySubTab === 'precautions' && (
              <div className="prose max-w-none">
                <h2>Precautions</h2>
                <ul>
                  <li>Use fresh frog preparation to avoid fatigue.</li>
                  <li>Maintain constant temperature (25-30°C) and aeration.</li>
                  <li>Ensure the lever is friction-free and properly balanced.</li>
                  <li>Wash thoroughly between doses to prevent cumulative effects.</li>
                  <li>Calibrate the kymograph drum speed.</li>
                  <li>Avoid air bubbles in the organ bath.</li>
                  <li>Handle acetylcholine solutions carefully as they are unstable.</li>
                  <li>Follow ethical guidelines for animal use.</li>
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

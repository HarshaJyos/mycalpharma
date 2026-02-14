// app/exp1/page.tsx
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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

interface SubImage {
  id: string
  url: string
  x: number
  y: number
  width: number
  height: number
  centerX?: number
  centerY?: number
  penTipOffsetX?: number
  penTipOffsetY?: number
  rotation?: number
  zIndex: number
}

interface DrawableArea {
  id: string
  x: number
  y: number
  width: number
  height: number
  scrollWidth: number
  zIndex: number
  color: string
}

interface ImageData {
  baseImage: string
  baseImageDimensions: { width: number; height: number }
  subImages: SubImage[]
  drawableAreas: DrawableArea[]
}

interface ObservationRecord {
  sNo: number
  concentration: number
  amountAdded: number
  concInBath: number
  response: string
  percentResponse: string
}

const ORGAN_BATH_VOLUME = 20
const MAX_ROTATION_ANGLE = 20

// Hardcoded initial data
const INITIAL_DATA: ImageData = {
  "baseImage": "data:image/png;base64,examplebase64string",
  "baseImageDimensions": {
    "width": 2133,
    "height": 1200
  },
  "subImages": [
    {
      "id": "sub-1770900016794-0",
      "url": "data:image/png;base64,examplebase64string",
      "x": 486,
      "y": 237,
      "width": 600,
      "height": 906,
      "zIndex": 1
    },
    {
      "id": "sub-1770900057664-0",
      "url": "data:image/png;base64,examplebase64string",
      "x": 770,
      "y": 328,
      "width": 680,
      "height": 59,
      "centerX": 986,
      "centerY": 358,
      "penTipOffsetX": 649,
      "penTipOffsetY": 27,
      "zIndex": 4
    },
    {
      "id": "sub-1770900032250-0",
      "url": "data:image/png;base64,examplebase64string",
      "x": 1147,
      "y": 39,
      "width": 488,
      "height": 1092,
      "zIndex": 2
    }
  ],
  "drawableAreas": [
    {
      "id": "area-1770900050218",
      "x": 1245,
      "y": 175,
      "width": 264.9523212045169,
      "height": 278.33375156838144,
      "scrollWidth": 794.8569636135508,
      "zIndex": 3,
      "color": "#ffffff"
    }
  ]
}



export default function Exp1Page() {
  const [activeTab, setActiveTab] = useState<'theory' | 'setup' | 'observation' | 'graphs'>('setup')
  const [theorySubTab, setTheorySubTab] = useState<'introduction' | 'procedure' | 'precautions'>('introduction')

  // Core state
  const [imageData, setImageData] = useState<ImageData>(INITIAL_DATA)
  const [experimentRunning, setExperimentRunning] = useState(false)
  const [selectedBaseline, setSelectedBaseline] = useState<number>(20)
  const [selectedConcentration, setSelectedConcentration] = useState<number>(0.05)
  const [currentLeverRotation, setCurrentLeverRotation] = useState(0)
  const [observations, setObservations] = useState<ObservationRecord[]>([])
  const [autoScroll, setAutoScroll] = useState(true)
  const [currentGraphX, setCurrentGraphX] = useState(0)
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null)
  const [maxResponse, setMaxResponse] = useState(100)
  const availableBaselines = [20, 50, 100, 200, 400]
  const availableConcentrations = [0.05, 0.1, 0.2, 0.4, 0.8]
  const canvasWrapperRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRefs = useRef<Record<string, HTMLCanvasElement>>({})
  const contextRefs = useRef<Record<string, CanvasRenderingContext2D>>({})
  const drawableAreaRefs = useRef<Record<string, HTMLDivElement>>({})
  const animationFrameRef = useRef<number>()

  const [scale, setScale] = useState(1)
  const [canvasWidths, setCanvasWidths] = useState<Record<string, number>>({})
  const [canvasData, setCanvasData] = useState<Record<string, string>>({})

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ message, type })
  }

  // Load from localStorage on mount
  useEffect(() => {
    const savedImageData = localStorage.getItem('imageData')
    if (savedImageData) {
      setImageData(JSON.parse(savedImageData))
    }

    const savedObservations = localStorage.getItem('observations')
    if (savedObservations) {
      setObservations(JSON.parse(savedObservations))
    }

    const savedCurrentLeverRotation = localStorage.getItem('currentLeverRotation')
    if (savedCurrentLeverRotation) {
      setCurrentLeverRotation(Number(savedCurrentLeverRotation))
    }

    const savedCurrentGraphX = localStorage.getItem('currentGraphX')
    if (savedCurrentGraphX) {
      setCurrentGraphX(Number(savedCurrentGraphX))
    }

    const savedMaxResponse = localStorage.getItem('maxResponse')
    if (savedMaxResponse) {
      setMaxResponse(Number(savedMaxResponse))
    }

    const savedAutoScroll = localStorage.getItem('autoScroll')
    if (savedAutoScroll) {
      setAutoScroll(JSON.parse(savedAutoScroll))
    }

    const savedSelectedBaseline = localStorage.getItem('selectedBaseline')
    if (savedSelectedBaseline) {
      setSelectedBaseline(Number(savedSelectedBaseline))
    }

    const savedSelectedConcentration = localStorage.getItem('selectedConcentration')
    if (savedSelectedConcentration) {
      setSelectedConcentration(Number(savedSelectedConcentration))
    }

    const savedCanvasData = localStorage.getItem('canvasData')
    if (savedCanvasData) {
      setCanvasData(JSON.parse(savedCanvasData))
    }
  }, [])

  // Save to localStorage when state changes
  useEffect(() => {
    localStorage.setItem('imageData', JSON.stringify(imageData))
  }, [imageData])

  useEffect(() => {
    localStorage.setItem('observations', JSON.stringify(observations))
  }, [observations])

  useEffect(() => {
    localStorage.setItem('currentLeverRotation', currentLeverRotation.toString())
  }, [currentLeverRotation])

  useEffect(() => {
    localStorage.setItem('currentGraphX', currentGraphX.toString())
  }, [currentGraphX])

  useEffect(() => {
    localStorage.setItem('maxResponse', maxResponse.toString())
  }, [maxResponse])

  useEffect(() => {
    localStorage.setItem('autoScroll', JSON.stringify(autoScroll))
  }, [autoScroll])

  useEffect(() => {
    localStorage.setItem('selectedBaseline', selectedBaseline.toString())
  }, [selectedBaseline])

  useEffect(() => {
    localStorage.setItem('selectedConcentration', selectedConcentration.toString())
  }, [selectedConcentration])

  useEffect(() => {
    localStorage.setItem('canvasData', JSON.stringify(canvasData))
  }, [canvasData])

  // Scale
  useEffect(() => {
    if (imageData.baseImageDimensions && canvasWrapperRef.current) {
      const maxWidth = canvasWrapperRef.current.clientWidth - 48
      const maxHeight = 700
      const scaleX = maxWidth / imageData.baseImageDimensions.width
      const scaleY = maxHeight / imageData.baseImageDimensions.height
      setScale(Math.min(scaleX, scaleY, 1))
    }
  }, [imageData.baseImageDimensions])

  // Canvas init + grid + set initial width state + restore canvas data
  useEffect(() => {
    imageData.drawableAreas.forEach(area => {
      const canvas = canvasRefs.current[area.id]
      if (canvas) {
        const needsInit = !contextRefs.current[area.id]
        
        if (needsInit) {
          const initialWidth = area.scrollWidth * 3
          canvas.width = initialWidth
          canvas.height = area.height
          const ctx = canvas.getContext('2d')
          if (ctx) {
            contextRefs.current[area.id] = ctx
            setCanvasWidths(prev => ({ ...prev, [area.id]: initialWidth }))
          }
        }

        const ctx = contextRefs.current[area.id]
        if (ctx) {
          // Check if we have saved data to restore
          const savedData = canvasData[area.id]
          if (savedData) {
            // Clear and restore from saved image data
            const img = new Image()
            img.src = savedData
            img.onload = () => {
              // Clear the canvas first
              ctx.clearRect(0, 0, canvas.width, canvas.height)
              // Draw the saved image
              ctx.drawImage(img, 0, 0)
            }
          } else if (needsInit) {
            // Draw fresh grid only on initial load if no saved data
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
  }, [imageData.drawableAreas, canvasData, activeTab])

  // Save canvas data when tab changes
  useEffect(() => {
    if (activeTab !== 'setup') {
      const newCanvasData: Record<string, string> = {}
      imageData.drawableAreas.forEach(area => {
        const canvas = canvasRefs.current[area.id]
        if (canvas) {
          newCanvasData[area.id] = canvas.toDataURL()
        }
      })
      setCanvasData(newCanvasData)
    }
  }, [activeTab, imageData.drawableAreas])


  const rotatePoint = (x: number, y: number, centerX: number, centerY: number, angle: number) => {
    const radians = (angle * Math.PI) / 180
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)

    const dx = x - centerX
    const dy = y - centerY

    return {
      x: centerX + (dx * cos - dy * sin),
      y: centerY + (dx * sin + dy * cos)
    }
  }

  const drawOnCanvas = useCallback((areaId: string, x: number, y: number, lastX?: number, lastY?: number, isVertical: boolean = false) => {
    const ctx = contextRefs.current[areaId]
    if (!ctx) return
    ctx.strokeStyle = isVertical ? '#0000ff' : '#ff0000'
    ctx.lineWidth = isVertical ? 1 : 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (lastX !== undefined && lastY !== undefined) {
      ctx.beginPath()
      ctx.moveTo(lastX, lastY)
      ctx.lineTo(x, y)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.arc(x, y, 1, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [])

  const calculateResponse = (baseline: number, concentration: number): number => {
    const amountAdded = 1
    const concInBath = (concentration * amountAdded) / ORGAN_BATH_VOLUME

    const EC50 = 0.008
    const hillCoefficient = 1.5

    const numerator = Math.pow(concInBath, hillCoefficient)
    const denominator = Math.pow(EC50, hillCoefficient) + Math.pow(concInBath, hillCoefficient)
    const responsePercent = 100 * (numerator / denominator)

    console.log('=== DOSE-RESPONSE CALCULATION ===')
    console.log('Stock concentration:', concentration, 'µg/mL')
    console.log('Baseline:', baseline, 'µg/mL')
    console.log('Amount added:', amountAdded, 'mL')
    console.log('Bath volume:', ORGAN_BATH_VOLUME, 'mL')
    console.log('Final conc in bath:', concInBath.toFixed(4), 'µg/mL')
    console.log('EC50:', EC50, 'µg/mL')
    console.log('Response %:', responsePercent.toFixed(1), '%')
    console.log('Expected angle:', (-(responsePercent / 100) * MAX_ROTATION_ANGLE).toFixed(1), '°')
    console.log('==================================')

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
    console.log('=== WASH START ===')
    console.log('Current rotation:', startRotation.toFixed(2), '°')
    // FIXED: Calculate pen tip position correctly
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
      setImageData(prev => ({
        ...prev,
        subImages: prev.subImages.map(img =>
          img.id === leverImage.id ? { ...img, rotation: currentRotation } : img
        )
      }))
      if (progress >= 1) {
        // Draw final vertical line from current position back to baseline
        imageData.drawableAreas?.forEach(area => {
          if (
            startPenTip.x >= area.x &&
            startPenTip.x <= area.x + area.width &&
            startPenTip.y >= area.y &&
            startPenTip.y <= area.y + area.height
          ) {
            // Get current scroll position
            const currentScroll = drawableAreaRefs.current[area.id]?.scrollLeft / scale || 0

            // Use actual pen tip world coordinates + scroll offset
            const startCanvasX = (startPenTip.x - area.x) + currentScroll
            const startCanvasY = startPenTip.y - area.y
            const endCanvasX = (baselinePenTip.x - area.x) + currentScroll
            const endCanvasY = baselinePenTip.y - area.y
            console.log('Wash line:', {
              startCanvasX: startCanvasX.toFixed(1),
              startCanvasY: startCanvasY.toFixed(1),
              endCanvasX: endCanvasX.toFixed(1),
              endCanvasY: endCanvasY.toFixed(1),
              currentScroll: currentScroll.toFixed(1)
            })
            const ctx = contextRefs.current[area.id]
            if (ctx) {
              ctx.strokeStyle = '#0000ff'
              ctx.lineWidth = 2
              ctx.beginPath()
              ctx.moveTo(startCanvasX, startCanvasY)
              ctx.lineTo(endCanvasX, endCanvasY)
              ctx.stroke()
            }
          }
        })
        setExperimentRunning(false)

        // Update currentGraphX: During wash, scroll a small distance for the vertical line
        const area = imageData.drawableAreas?.[0]
        if (area && drawableAreaRefs.current[area.id]) {
          // Add small scroll for the wash line spacing
          const currentScroll = drawableAreaRefs.current[area.id].scrollLeft / scale
          const newScroll = currentScroll + 15 // Small spacing after wash
          const canvas = canvasRefs.current[area.id]
          const visibleWidth = area.width
          const maxScrollLeft = (canvas?.width || area.scrollWidth * 3) - visibleWidth
          const clampedScroll = Math.max(0, Math.min(newScroll, maxScrollLeft))

          drawableAreaRefs.current[area.id].scrollLeft = clampedScroll * scale
          setCurrentGraphX(clampedScroll)
        }

        console.log('=== WASH COMPLETE ===')
        showToast('Wash completed', 'success')
      } else {
        animationFrameRef.current = requestAnimationFrame(animate)
      }
    }
    animationFrameRef.current = requestAnimationFrame(animate)
  }, [imageData, currentLeverRotation, currentGraphX, rotatePoint, scale, drawOnCanvas])

    const expandCanvasIfNeeded = useCallback((areaId: string, requiredWidth: number) => {
      const canvas = canvasRefs.current[areaId]
      const ctx = contextRefs.current[areaId]
      if (canvas && ctx && requiredWidth > canvas.width - 200) {
        const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const newWidth = canvas.width * 2
        canvas.width = newWidth
        ctx.putImageData(currentImageData, 0, 0)
  
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
    }, [imageData])

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
    console.log('=== INJECTION START ===')
    console.log('Baseline:', selectedBaseline, 'µg/mL')
    console.log('Concentration:', selectedConcentration, 'µg/mL')
    console.log('Response %:', responsePercent.toFixed(2), '%')
    console.log('Target rotation:', targetRotation.toFixed(2), '°')
    const startRotation = currentLeverRotation
    const duration = 3000
    const startTime = Date.now()
    // Track last position per area for continuous lines
    const areaLastPos: Record<string, { x: number; y: number }> = {}

    // For auto-scroll: track the starting scroll position
    const startScrollPositions: Record<string, number> = {}
    const scrollDistance = 150 // How far to scroll during the injection (simulate paper movement)
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
      // FIXED: Calculate pen tip position correctly (same as show page)
      const penTipLocalX = leverImage.x + leverImage.penTipOffsetX
      const penTipLocalY = leverImage.y + leverImage.penTipOffsetY

      const rotatedPenTip = rotatePoint(
        penTipLocalX,
        penTipLocalY,
        leverImage.centerX,
        leverImage.centerY,
        currentRotation
      )
      // Draw on canvas - CRITICAL: Account for scroll position!
      imageData.drawableAreas?.forEach(area => {
        console.log('=== CHECKING DRAWABLE AREA ===')
        console.log('Area bounds:', {
          areaX: area.x,
          areaY: area.y,
          areaWidth: area.width,
          areaHeight: area.height,
          areaRight: area.x + area.width,
          areaBottom: area.y + area.height
        })
        console.log('Pen tip position:', {
          penTipX: rotatedPenTip.x.toFixed(1),
          penTipY: rotatedPenTip.y.toFixed(1)
        })

        // Check if pen tip is over this drawable area
        const isInArea = rotatedPenTip.x >= area.x &&
          rotatedPenTip.x <= area.x + area.width &&
          rotatedPenTip.y >= area.y &&
          rotatedPenTip.y <= area.y + area.height

        console.log('Is pen in area?', isInArea)

        if (isInArea) {
          console.log('✅ PEN IS IN AREA - DRAWING!')

          // Initialize start scroll position if not set
          if (startScrollPositions[area.id] === undefined && drawableAreaRefs.current[area.id]) {
            startScrollPositions[area.id] = drawableAreaRefs.current[area.id].scrollLeft / scale
          }

          // AUTO-SCROLL: Simulate paper movement - scroll gradually during injection
          const canvas = canvasRefs.current[area.id]
          const startScroll = startScrollPositions[area.id] || 0

          // Scroll distance increases with progress
          const currentScrollOffset = startScroll + (scrollDistance * progress)

          if (autoScroll && drawableAreaRefs.current[area.id]) {
            const visibleWidth = area.width
            const maxScrollLeft = (canvas?.width || area.scrollWidth * 3) - visibleWidth
            const clampedScroll = Math.max(0, Math.min(currentScrollOffset, maxScrollLeft))

            drawableAreaRefs.current[area.id].scrollLeft = clampedScroll * scale

            console.log('Auto-scroll:', {
              progress: (progress * 100).toFixed(1) + '%',
              startScroll: startScroll.toFixed(1),
              currentOffset: currentScrollOffset.toFixed(1),
              actualScroll: clampedScroll.toFixed(1)
            })
          }

          // Check if we need to expand canvas
          const penTipRelativeX = rotatedPenTip.x - area.x
          expandCanvasIfNeeded(area.id, penTipRelativeX + currentScrollOffset + 300)

          // CRITICAL FIX: Canvas coordinates must account for the scroll offset!
          // The pen tip appears to stay in one place on screen, but we're scrolling the canvas
          // So we need to draw at: pen position + scroll offset
          const canvasX = (rotatedPenTip.x - area.x) + currentScrollOffset
          const canvasY = rotatedPenTip.y - area.y
          console.log('Drawing at pen tip:', {
            progress: (progress * 100).toFixed(1) + '%',
            penTipWorldX: rotatedPenTip.x.toFixed(1),
            penTipWorldY: rotatedPenTip.y.toFixed(1),
            penTipRelativeX: (rotatedPenTip.x - area.x).toFixed(1),
            scrollOffset: currentScrollOffset.toFixed(1),
            canvasX: canvasX.toFixed(1),
            canvasY: canvasY.toFixed(1),
            rotation: currentRotation.toFixed(1) + '°'
          })
          // Always draw line from last position to create continuous curve
          const lastPos = areaLastPos[area.id]
          if (lastPos) {
            console.log('Drawing line from', lastPos, 'to', { x: canvasX, y: canvasY })
            const ctx = contextRefs.current[area.id]
            if (ctx) {
              ctx.strokeStyle = '#ff0000'
              ctx.lineWidth = 2
              ctx.lineCap = 'round'
              ctx.lineJoin = 'round'
              ctx.beginPath()
              ctx.moveTo(lastPos.x, lastPos.y)
              ctx.lineTo(canvasX, canvasY)
              ctx.stroke()
              console.log('✅ LINE DRAWN!')
            } else {
              console.log('❌ NO CONTEXT!')
            }
          } else {
            console.log('⚠️ NO LAST POSITION - FIRST FRAME')
          }
          // Update last position for next frame
          areaLastPos[area.id] = { x: canvasX, y: canvasY }
        } else {
          console.log('❌ PEN IS OUTSIDE AREA - NO DRAWING')
        }
      })
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate)
      } else {
        setExperimentRunning(false)

        // Update currentGraphX to the furthest right position the pen reached
        const leverImage = imageData.subImages.find(img => img.id === 'sub-1770900057664-0')
        if (leverImage && leverImage.penTipOffsetX !== undefined && leverImage.penTipOffsetY !== undefined) {
          const penTipLocalX = leverImage.x + leverImage.penTipOffsetX
          const penTipLocalY = leverImage.y + leverImage.penTipOffsetY

          const finalPenTip = rotatePoint(
            penTipLocalX,
            penTipLocalY,
            leverImage.centerX!,
            leverImage.centerY!,
            currentRotation
          )

          const area = imageData.drawableAreas?.[0]
          if (area) {
            // Record where we ended for the next operation
            const finalScrollPos = drawableAreaRefs.current[area.id]?.scrollLeft / scale || 0
            setCurrentGraphX(finalScrollPos + 20) // Add spacing for next injection
          }
        }

        const amountAdded = 1
        const concInBath = (selectedConcentration * amountAdded) / ORGAN_BATH_VOLUME

        setObservations(prev => [...prev, {
          sNo: prev.length + 1,
          concentration: selectedConcentration,
          amountAdded,
          concInBath,
          response: '',
          percentResponse: ''
        }])

        console.log('=== INJECTION COMPLETE ===')
        console.log('Final rotation:', currentRotation.toFixed(2), '°')

        showToast('Injection completed!', 'success')
      }
    }
    animationFrameRef.current = requestAnimationFrame(animate)
  }, [imageData, currentLeverRotation, currentGraphX, selectedBaseline, selectedConcentration, autoScroll, rotatePoint, calculateResponse, expandCanvasIfNeeded, scale, drawOnCanvas])

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
    setCurrentLeverRotation(0)
    setCurrentGraphX(0)
    setObservations([])

    setImageData(prev => ({
      ...prev,
      subImages: prev.subImages.map(img =>
        img.id === 'sub-1770900057664-0' ? { ...img, rotation: 0 } : img
      )
    }))

    imageData.drawableAreas?.forEach(area => {
      const ctx = contextRefs.current[area.id]
      if (ctx) {
        ctx.fillStyle = area.color
        ctx.fillRect(0, 0, area.scrollWidth, area.height)

        ctx.strokeStyle = '#e0e0e0'
        ctx.lineWidth = 1
        for (let x = 0; x < area.scrollWidth; x += 50) {
          ctx.beginPath()
          ctx.moveTo(x, 0)
          ctx.lineTo(x, area.height)
          ctx.stroke()
        }
        for (let y = 0; y < area.height; y += 50) {
          ctx.beginPath()
          ctx.moveTo(0, y)
          ctx.lineTo(area.scrollWidth, y)
          ctx.stroke()
        }
      }
      if (drawableAreaRefs.current[area.id]) {
        drawableAreaRefs.current[area.id].scrollLeft = 0
      }
      setCanvasWidths(prev => ({ ...prev, [area.id]: area.scrollWidth * 3 }))
    })

    localStorage.clear()
    showToast('Experiment reset - ready for new trial', 'info')
  }

  const allItems = [
    ...imageData.subImages.map(img => ({ ...img, type: 'image' as const })),
    ...(imageData.drawableAreas || []).map(area => ({ ...area, type: 'area' as const }))
  ].sort((a, b) => a.zIndex - b.zIndex)

  // Chart data
  const sortedObs = [...observations].sort((a, b) => a.concentration - b.concentration)

  const doseData = {
    labels: sortedObs.map(o => o.concentration.toFixed(2)),
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
    labels: sortedObs.map(o => o.concentration > 0 ? Math.log10(o.concentration).toFixed(2) : '–'),
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
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-4 px-6 font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
                activeTab === tab.id
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
            <div className={`px-6 py-4 rounded-lg shadow-2xl border-2 backdrop-blur-md ${
              toast.type === 'success' ? 'bg-green-500/90 border-green-300 text-white' :
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
            {/* Canvas */}
            <div className="lg:col-span-8 bg-white rounded-xl shadow border overflow-hidden">
              <div className="p-5 border-b">
                <h2 className="text-lg font-semibold">Kymograph</h2>
              </div>
              <div ref={canvasWrapperRef} className="p-6 bg-slate-50 min-h-[700px]">
                <div
                  ref={containerRef}
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
                            <img
                              src={img.url}
                              alt=""
                              style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
                            />
                          </div>

                          {img.centerX && img.centerY && (
                            <div
                              className="absolute w-3 h-3 bg-red-500 rounded-full border-2 border-white pointer-events-none"
                              style={{
                                left: `${img.centerX * scale - 6}px`,
                                top: `${img.centerY * scale - 6}px`,
                                zIndex: 9999,
                              }}
                            />
                          )}

                          {penTip && (
                            <div
                              className="absolute w-4 h-4 bg-green-500 rounded-full border-2 border-white pointer-events-none"
                              style={{
                                left: `${penTip.x * scale - 8}px`,
                                top: `${penTip.y * scale - 8}px`,
                                zIndex: 10000,
                              }}
                            />
                          )}

                          {penTip && (
                            <div
                              className="absolute w-6 h-6 bg-yellow-400 rounded-full border-2 border-black pointer-events-none opacity-75"
                              style={{
                                left: `${penTip.x * scale - 12}px`,
                                top: `${penTip.y * scale - 12}px`,
                                zIndex: 9998,
                              }}
                            />
                          )}
                        </div>
                      )
                    } else {
                      const area = item as DrawableArea
                      return (
                        <div
                          key={area.id}
                          ref={el => {
                            if (el) drawableAreaRefs.current[area.id] = el
                          }}
                          className="absolute overflow-x-auto overflow-y-hidden border border-slate-200 rounded"
                          style={{
                            left: `${area.x * scale}px`,
                            top: `${area.y * scale}px`,
                            width: `${area.width * scale}px`,
                            height: `${area.height * scale}px`,
                            zIndex: area.zIndex,
                          }}
                        >
                          <canvas
                            ref={el => {
                              if (el) canvasRefs.current[area.id] = el
                            }}
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

            {/* Controls */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white rounded-xl shadow border p-6">
                <h3 className="font-medium mb-4">Parameters</h3>
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm text-slate-600 mb-1.5">Baseline (µg/mL)</label>
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
                    <label className="block text-sm text-slate-600 mb-1.5">Concentration (µg/mL)</label>
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
                    className={`px-4 py-1.5 rounded text-sm font-medium ${
                      autoScroll ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
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
            {/* Complete Kymograph View */}
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
                  
                  return (
                    <div key={area.id} className="mb-4">
                      <div className="overflow-x-auto overflow-y-hidden border border-slate-200 rounded">
                        <canvas
                          ref={(el) => {
                            if (el) {
                              const sourceCanvas = canvasRefs.current[area.id]
                              if (sourceCanvas) {
                                el.width = sourceCanvas.width
                                el.height = sourceCanvas.height
                                const ctx = el.getContext('2d')
                                if (ctx) {
                                  ctx.drawImage(sourceCanvas, 0, 0)
                                }
                              }
                            }
                          }}
                          style={{
                            width: `${usedWidth * displayScale}px`,
                            height: `${area.height * displayScale}px`,
                            display: 'block',
                          }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-2 text-center">
                        Total graph width: {Math.round(currentGraphX)}px | Canvas: {canvasWidths[area.id] || area.scrollWidth * 3}px
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow border overflow-hidden">
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
                  onClick={() => setTheorySubTab(sub.id as any)}
                  className={`px-6 py-2 rounded-full text-sm font-medium transition ${
                    theorySubTab === sub.id
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

            { theorySubTab === 'procedure' && (
              <div className="prose max-w-none">
                <h2>Procedure</h2>
                <ol>
                  <li>Dissect the frog and isolate the rectus abdominis muscle.</li>
                  <li>Mount the muscle in an organ bath containing aerated frog Ringer's solution at room temperature.</li>
                  <li>Attach the muscle to an isotonic lever connected to a kymograph drum.</li>
                  <li>Record a baseline contraction.</li>
                  <li>Add increasing concentrations of ACh (e.g., 0.05 to 0.8 µg/mL) to the bath.</li>
                  <li>Record the contraction height for each dose.</li>
                  <li>Wash the bath with fresh Ringer's solution between doses to return to baseline.</li>
                  <li>Calculate % response relative to the maximum contraction.</li>
                  <li>Plot dose-response and log-dose-response curves.</li>
                </ol>
              </div>
            )}

            { theorySubTab === 'precautions' && (
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
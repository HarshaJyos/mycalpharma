'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'

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
  baseImage: string | null
  baseImageDimensions?: { width: number; height: number }
  subImages: SubImage[]
  drawableAreas?: DrawableArea[]
}

interface ObservationRecord {
  sNo: number
  concentration: number
  amountAdded: number
  concInBath: number
  response: string
  percentResponse: string
}

export default function Experiment() {
  const [imageData, setImageData] = useState<ImageData>({
    baseImage: null,
    subImages: [],
    drawableAreas: [],
  })
  const [jsonInput, setJsonInput] = useState('')
  const [error, setError] = useState('')
  const [scale, setScale] = useState(1)
  
  // Experiment state
  const [experimentRunning, setExperimentRunning] = useState(false)
  const [selectedBaseline, setSelectedBaseline] = useState<number>(20)
  const [selectedConcentration, setSelectedConcentration] = useState<number>(0.05)
  const [currentLeverRotation, setCurrentLeverRotation] = useState(0)
  const [observations, setObservations] = useState<ObservationRecord[]>([])
  const [autoScroll, setAutoScroll] = useState(true)
  const [currentGraphX, setCurrentGraphX] = useState(0)
  const [maxResponse, setMaxResponse] = useState(100)
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null)
  const [showCompleteGraph, setShowCompleteGraph] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasWrapperRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRefs = useRef<Record<string, HTMLCanvasElement>>({})
  const contextRefs = useRef<Record<string, CanvasRenderingContext2D>>({})
  const drawableAreaRefs = useRef<Record<string, HTMLDivElement>>({})
  const animationFrameRef = useRef<number>()
  
  const availableBaselines = [20, 50, 100, 200, 400]
  const availableConcentrations = [0.05, 0.1, 0.2, 0.4, 0.8]
  const organBathVolume = 20
  const MAX_ROTATION_ANGLE = 20

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ message, type })
  }

  useEffect(() => {
    if (imageData.baseImageDimensions && canvasWrapperRef.current) {
      const wrapper = canvasWrapperRef.current
      const maxWidth = wrapper.clientWidth - 48
      const maxHeight = 700
      
      const scaleX = maxWidth / imageData.baseImageDimensions.width
      const scaleY = maxHeight / imageData.baseImageDimensions.height
      const newScale = Math.min(scaleX, scaleY, 1)
      
      setScale(newScale)
    }
  }, [imageData.baseImageDimensions])

  useEffect(() => {
    imageData.drawableAreas?.forEach(area => {
      const canvas = canvasRefs.current[area.id]
      if (canvas && !contextRefs.current[area.id]) {
        const initialWidth = area.scrollWidth * 3
        canvas.width = initialWidth
        canvas.height = area.height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          contextRefs.current[area.id] = ctx
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
    })
  }, [imageData.drawableAreas])
  
  const expandCanvasIfNeeded = useCallback((areaId: string, requiredWidth: number) => {
    const canvas = canvasRefs.current[areaId]
    const ctx = contextRefs.current[areaId]
    
    if (canvas && ctx && requiredWidth > canvas.width - 200) {
      const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      
      const newWidth = canvas.width * 2
      canvas.width = newWidth
      
      ctx.putImageData(currentImageData, 0, 0)
      
      const area = imageData.drawableAreas?.find(a => a.id === areaId)
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
      
      console.log(`Canvas ${areaId} expanded to ${newWidth}px`)
    }
  }, [imageData])

  const handleJSONInput = () => {
    try {
      setError('')
      const data = JSON.parse(jsonInput)
      
      if (!data.baseImage || !Array.isArray(data.subImages)) {
        throw new Error('Invalid JSON format')
      }
      
      const processedData = {
        ...data,
        subImages: data.subImages.map((img: SubImage) => ({
          ...img,
          rotation: img.rotation || 0,
          zIndex: img.zIndex || 0,
        })),
        drawableAreas: data.drawableAreas || [],
      }
      
      setImageData(processedData)
      contextRefs.current = {}
      setCurrentGraphX(0)
      setObservations([])
    } catch (err) {
      setError('Invalid JSON format. Please check your input.')
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string)
          if (!data.baseImage || !Array.isArray(data.subImages)) {
            throw new Error('Invalid JSON format')
          }
          
          const processedData = {
            ...data,
            subImages: data.subImages.map((img: SubImage) => ({
              ...img,
              rotation: img.rotation || 0,
              zIndex: img.zIndex || 0,
            })),
            drawableAreas: data.drawableAreas || [],
          }
          
          setImageData(processedData)
          setJsonInput(JSON.stringify(data, null, 2))
          setError('')
          contextRefs.current = {}
          setCurrentGraphX(0)
          setObservations([])
        } catch (err) {
          setError('Invalid JSON file. Please check the file format.')
        }
      }
      reader.readAsText(file)
    }
  }

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
    const concInBath = (concentration * amountAdded) / organBathVolume
    
    const EC50 = 0.008
    const hillCoefficient = 1.5
    
    const numerator = Math.pow(concInBath, hillCoefficient)
    const denominator = Math.pow(EC50, hillCoefficient) + Math.pow(concInBath, hillCoefficient)
    const responsePercent = 100 * (numerator / denominator)
    
    console.log('=== DOSE-RESPONSE CALCULATION ===')
    console.log('Stock concentration:', concentration, 'µg/mL')
    console.log('Baseline:', baseline, 'µg/mL')
    console.log('Amount added:', amountAdded, 'mL')
    console.log('Bath volume:', organBathVolume, 'mL')
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
  }, [imageData, currentLeverRotation, currentGraphX, rotatePoint])

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
        const concInBath = (selectedConcentration * amountAdded) / organBathVolume
        
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
  }, [imageData, currentLeverRotation, currentGraphX, selectedBaseline, selectedConcentration, autoScroll, rotatePoint, calculateResponse, expandCanvasIfNeeded])

  const updateObservationResponse = (index: number, response: string) => {
    setObservations(prev => {
      const updated = [...prev]
      updated[index].response = response
      
      if (response && !isNaN(parseFloat(response))) {
        const responseValue = parseFloat(response)
        
        const allResponses = updated
          .map(obs => obs.response ? parseFloat(obs.response) : 0)
          .filter(r => r > 0)
        
        const currentMax = Math.max(...allResponses, responseValue)
        
        const percent = ((responseValue / currentMax) * 100).toFixed(2)
        updated[index].percentResponse = percent
        
        updated.forEach((obs, i) => {
          if (obs.response && !isNaN(parseFloat(obs.response))) {
            const obsResponse = parseFloat(obs.response)
            updated[i].percentResponse = ((obsResponse / currentMax) * 100).toFixed(2)
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
    })
    
    showToast('Experiment reset - ready for new trial', 'info')
  }

  const allItems = [
    ...imageData.subImages.map(img => ({ ...img, type: 'image' as const })),
    ...(imageData.drawableAreas || []).map(area => ({ ...area, type: 'area' as const }))
  ].sort((a, b) => a.zIndex - b.zIndex)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
      {/* Toast Notification */}
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
      
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              Acetylcholine Dose-Response Curve
            </h1>
            <p className="text-blue-200">Frog Rectus Abdominis Muscle Contraction</p>
          </div>
          <Link 
            href="/" 
            className="px-6 py-3 bg-white/10 backdrop-blur-sm text-white rounded-lg hover:bg-white/20 transition border border-white/20"
          >
            Home
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Controls */}
          <div className="lg:col-span-1 space-y-4">
            {/* Load Data */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-2xl p-6 border border-white/20">
              <h2 className="text-xl font-semibold mb-4 text-white">Load Experiment Data</h2>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-blue-100 mb-2">
                  Upload JSON File
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-500 file:text-white hover:file:bg-blue-600"
                />
              </div>

              <div className="border-t border-white/20 pt-4">
                <label className="block text-sm font-medium text-blue-100 mb-2">
                  Or Paste JSON
                </label>
                <textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder='{"baseImage": "...", "subImages": [...], "drawableAreas": [...]}'
                  className="w-full h-32 p-3 bg-white/5 border border-white/20 rounded-lg text-sm font-mono text-white placeholder-gray-500 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                
                {error && (
                  <p className="mt-2 text-sm text-red-400">{error}</p>
                )}

                <button
                  onClick={handleJSONInput}
                  className="w-full mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
                >
                  Load Data
                </button>
              </div>
            </div>

            {/* Experiment Controls */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-2xl p-6 border border-white/20">
              <h2 className="text-xl font-semibold mb-4 text-white">Experiment Controls</h2>
              
              <div className="space-y-4">
                {/* Baseline Selection */}
                <div>
                  <label className="block text-sm font-medium text-blue-100 mb-2">
                    Baseline (µg/mL)
                  </label>
                  <select
                    value={selectedBaseline}
                    onChange={(e) => setSelectedBaseline(Number(e.target.value))}
                    disabled={experimentRunning}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {availableBaselines.map(baseline => (
                      <option key={baseline} value={baseline} className="bg-slate-800">
                        {baseline}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Concentration Selection */}
                <div>
                  <label className="block text-sm font-medium text-blue-100 mb-2">
                    Concentration (µg/mL)
                  </label>
                  <select
                    value={selectedConcentration}
                    onChange={(e) => setSelectedConcentration(Number(e.target.value))}
                    disabled={experimentRunning}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {availableConcentrations.map(conc => (
                      <option key={conc} value={conc} className="bg-slate-800">
                        {conc}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-4">
                  <button
                    onClick={performWash}
                    disabled={experimentRunning || !imageData.baseImage}
                    className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    💧 Wash
                  </button>
                  
                  <button
                    onClick={performInjection}
                    disabled={experimentRunning || !imageData.baseImage}
                    className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    💉 Inject
                  </button>
                </div>

                <button
                  onClick={resetExperiment}
                  disabled={experimentRunning}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold disabled:opacity-50"
                >
                  🔄 Reset
                </button>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/20">
                  <label className="text-sm font-medium text-blue-100">
                    Auto-scroll
                  </label>
                  <button
                    onClick={() => setAutoScroll(!autoScroll)}
                    className={`px-4 py-2 rounded-lg transition font-semibold ${
                      autoScroll
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-gray-600 text-white hover:bg-gray-700'
                    }`}
                  >
                    {autoScroll ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>
            </div>

            {/* Current Status */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-2xl p-6 border border-white/20">
              <h2 className="text-xl font-semibold mb-4 text-white">Current Status</h2>
              
              <div className="space-y-4">
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="text-sm text-blue-100 mb-1">Selected Settings</div>
                  <div className="text-lg font-bold text-white">
                    Baseline: {selectedBaseline} µg/mL
                  </div>
                  <div className="text-sm text-blue-200">
                    Concentration: {selectedConcentration} µg/mL
                  </div>
                </div>

                <div>
                  <div className="text-sm text-blue-100 mb-1">Muscle Contraction</div>
                  <div className="text-3xl font-bold text-white">
                    {Math.abs(Math.round(currentLeverRotation))}°
                  </div>
                </div>

                <div>
                  <div className="text-sm text-blue-100 mb-1">Status</div>
                  <div className={`text-lg font-bold ${
                    experimentRunning ? 'text-green-400' : 'text-gray-400'
                  }`}>
                    {experimentRunning ? 'RUNNING' : 'READY'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Apparatus Display */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-2xl p-6 border border-white/20" ref={canvasWrapperRef}>
              <h2 className="text-xl font-semibold mb-4 text-white">Experimental Apparatus</h2>
              
              {!imageData.baseImage ? (
                <div className="border-2 border-dashed border-white/30 rounded-lg h-[600px] flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-gray-400 text-lg mb-2">Load experiment data to begin</p>
                    <p className="text-gray-500 text-sm">Upload or paste JSON configuration</p>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-white/20 rounded-lg overflow-hidden inline-block bg-black/30">
                  <div 
                    ref={containerRef}
                    className="relative"
                    style={{
                      width: imageData.baseImageDimensions ? `${imageData.baseImageDimensions.width * scale}px` : 'auto',
                      height: imageData.baseImageDimensions ? `${imageData.baseImageDimensions.height * scale}px` : 'auto',
                    }}
                  >
                    <img
                      src={imageData.baseImage}
                      alt="Experimental Setup"
                      className="block pointer-events-none"
                      style={imageData.baseImageDimensions ? {
                        width: `${imageData.baseImageDimensions.width * scale}px`,
                        height: `${imageData.baseImageDimensions.height * scale}px`,
                      } : {}}
                    />
                    
                    {allItems.map(item => {
                      if (item.type === 'image') {
                        const img = item as SubImage
                        const rotation = img.rotation || 0
                        const hasCenterPoint = img.centerX !== undefined && img.centerY !== undefined
                        
                        let transformOrigin = 'center'
                        
                        if (hasCenterPoint) {
                          const originX = ((img.centerX - img.x) / img.width) * 100
                          const originY = ((img.centerY - img.y) / img.height) * 100
                          transformOrigin = `${originX}% ${originY}%`
                        }
                        
                        return (
                          <div key={img.id}>
                            <div
                              className="absolute pointer-events-none transition-transform duration-100"
                              style={{
                                left: `${img.x * scale}px`,
                                top: `${img.y * scale}px`,
                                width: `${img.width * scale}px`,
                                height: `${img.height * scale}px`,
                                transform: `rotate(${rotation}deg)`,
                                transformOrigin: transformOrigin,
                                zIndex: img.zIndex,
                              }}
                            >
                              <img
                                src={img.url}
                                alt=""
                                className="pointer-events-none"
                                style={{
                                  width: `${img.width * scale}px`,
                                  height: `${img.height * scale}px`,
                                }}
                              />
                            </div>
                            
                            {/* Show pivot point (red dot) */}
                            {hasCenterPoint && (
                              <div
                                className="absolute w-3 h-3 bg-red-500 rounded-full border-2 border-white pointer-events-none"
                                style={{
                                  left: `${img.centerX * scale - 6}px`,
                                  top: `${img.centerY * scale - 6}px`,
                                  zIndex: 9999,
                                }}
                              />
                            )}
                            
                            {/* Show pen tip (green dot) - This is where drawing SHOULD happen */}
                            {hasCenterPoint && img.penTipOffsetX !== undefined && img.penTipOffsetY !== undefined && (() => {
                              // Calculate rotated pen tip position
                              const penTipLocalX = img.x + img.penTipOffsetX
                              const penTipLocalY = img.y + img.penTipOffsetY
                              
                              const rotatedPenTip = rotatePoint(
                                penTipLocalX,
                                penTipLocalY,
                                img.centerX!,
                                img.centerY!,
                                rotation
                              )
                              
                              return (
                                <div
                                  className="absolute w-4 h-4 bg-green-500 rounded-full border-2 border-white pointer-events-none"
                                  style={{
                                    left: `${rotatedPenTip.x * scale - 8}px`,
                                    top: `${rotatedPenTip.y * scale - 8}px`,
                                    zIndex: 10000,
                                  }}
                                  title={`Pen tip world: (${rotatedPenTip.x.toFixed(1)}, ${rotatedPenTip.y.toFixed(1)})`}
                                />
                              )
                            })()}
                            
                            {/* DEBUG: Show where canvas drawing happens (yellow dot) */}
                            {hasCenterPoint && img.penTipOffsetX !== undefined && img.penTipOffsetY !== undefined && (() => {
                              const penTipLocalX = img.x + img.penTipOffsetX
                              const penTipLocalY = img.y + img.penTipOffsetY
                              
                              const rotatedPenTip = rotatePoint(
                                penTipLocalX,
                                penTipLocalY,
                                img.centerX!,
                                img.centerY!,
                                rotation
                              )
                              
                              // Canvas now draws at the EXACT same world position as the pen tip
                              // So yellow dot should overlap with green dot
                              const canvasDrawX = rotatedPenTip.x
                              const canvasDrawY = rotatedPenTip.y
                              
                              return (
                                <div
                                  className="absolute w-6 h-6 bg-yellow-400 rounded-full border-2 border-black pointer-events-none opacity-75"
                                  style={{
                                    left: `${canvasDrawX * scale - 12}px`,
                                    top: `${canvasDrawY * scale - 12}px`,
                                    zIndex: 9998, // Behind green dot
                                  }}
                                  title={`Canvas draws here: (${canvasDrawX.toFixed(1)}, ${canvasDrawY.toFixed(1)})`}
                                />
                              )
                            })()}
                          </div>
                        )
                      } else {
                        const area = item as DrawableArea
                        return (
                          <div
                            key={area.id}
                            ref={(el) => {
                              if (el) drawableAreaRefs.current[area.id] = el
                            }}
                            className="absolute overflow-x-auto overflow-y-hidden"
                            style={{
                              left: `${area.x * scale}px`,
                              top: `${area.y * scale}px`,
                              width: `${area.width * scale}px`,
                              height: `${area.height * scale}px`,
                              zIndex: area.zIndex,
                              scrollbarWidth: 'thin',
                              scrollbarColor: '#4B5563 #1F2937',
                            }}
                          >
                            <canvas
                              ref={(el) => {
                                if (el) canvasRefs.current[area.id] = el
                              }}
                              style={{
                                width: `${(canvasRefs.current[area.id]?.width || area.scrollWidth * 3) * scale}px`,
                                height: `${area.height * scale}px`,
                              }}
                            />
                          </div>
                        )
                      }
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Observation Table */}
            <div className="mt-6 bg-white/10 backdrop-blur-md rounded-xl shadow-2xl p-6 border border-white/20">
              <h2 className="text-xl font-semibold mb-4 text-white">Observation Records</h2>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-white">
                  <thead className="bg-white/10 border-b border-white/20">
                    <tr>
                      <th className="px-4 py-3 text-left">S.No</th>
                      <th className="px-4 py-3 text-left">Conc. of ACh (µg/mL)</th>
                      <th className="px-4 py-3 text-left">Amount Added (mL)</th>
                      <th className="px-4 py-3 text-left">Conc. in Organ Bath (µg/mL)</th>
                      <th className="px-4 py-3 text-left">Response (mm)</th>
                      <th className="px-4 py-3 text-left">Percent Dose Response (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {observations.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                          No observations recorded yet. Start the experiment!
                        </td>
                      </tr>
                    ) : (
                      observations.map((obs, index) => (
                        <tr key={index} className="border-b border-white/10 hover:bg-white/5">
                          <td className="px-4 py-3">{obs.sNo}</td>
                          <td className="px-4 py-3">{obs.concentration.toFixed(2)}</td>
                          <td className="px-4 py-3">{obs.amountAdded.toFixed(2)}</td>
                          <td className="px-4 py-3">{obs.concInBath.toFixed(4)}</td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              step="0.1"
                              value={obs.response}
                              onChange={(e) => updateObservationResponse(index, e.target.value)}
                              placeholder="Enter"
                              className="w-24 px-2 py-1 bg-white/10 border border-white/20 rounded text-white focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3 font-semibold text-green-300">
                            {obs.percentResponse}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Show Complete Graph Button and Display */}
            <div className="mt-6 bg-white/10 backdrop-blur-md rounded-xl shadow-2xl p-6 border border-white/20">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white">Complete Graph View</h2>
                <button
                  onClick={() => setShowCompleteGraph(!showCompleteGraph)}
                  className={`px-6 py-3 rounded-lg transition font-semibold ${
                    showCompleteGraph
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {showCompleteGraph ? '✕ Hide Graph' : '📊 Show Complete Graph'}
                </button>
              </div>

              {showCompleteGraph && (
                <div className="border-2 border-white/20 rounded-lg overflow-hidden bg-black/30 p-4">
                  <p className="text-sm text-blue-200 mb-4">
                    Complete kymograph showing all recorded contractions:
                  </p>
                  
                  {imageData.drawableAreas?.map(area => {
                    const canvas = canvasRefs.current[area.id]
                    if (!canvas) return null

                    const usedWidth = Math.max(currentGraphX + 100, area.scrollWidth)
                    const displayScale = 0.8

                    return (
                      <div key={area.id} className="mb-4">
                        <div className="overflow-x-auto overflow-y-hidden border border-white/10 rounded">
                          <canvas
                            ref={(el) => {
                              if (el && canvas) {
                                el.width = canvas.width
                                el.height = canvas.height
                                const ctx = el.getContext('2d')
                                if (ctx) {
                                  ctx.drawImage(canvas, 0, 0)
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
                          Total graph width: {Math.round(currentGraphX)}px | Canvas: {canvas.width}px
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Information Panel */}
            <div className="mt-6 bg-white/10 backdrop-blur-md rounded-xl shadow-2xl p-6 border border-white/20">
              <h2 className="text-xl font-semibold mb-4 text-white">Instructions</h2>
              
              <div className="space-y-3 text-blue-100 text-sm">
                <ol className="list-decimal list-inside space-y-2">
                  <li>Load the experimental apparatus JSON file</li>
                  <li>Select a baseline concentration (20, 50, 100, 200, or 400 µg/mL)</li>
                  <li>Select an ACh concentration (0.05, 0.1, 0.2, 0.4, or 0.8 µg/mL)</li>
                  <li>Click "Inject" to add the drug to the organ bath</li>
                  <li>Observe the muscle contraction on the kymograph</li>
                  <li>Enter the response measurement (mm) in the observation table</li>
                  <li>Click "Wash" to return the lever to baseline between injections</li>
                  <li>Repeat with different concentrations to build the dose-response curve</li>
                  <li>The percent dose response is calculated automatically</li>
                </ol>

                <div className="bg-white/5 rounded-lg p-4 mt-4 border border-white/10">
                  <strong className="text-white block mb-2">About the Experiment:</strong>
                  <p className="text-xs text-blue-200">
                    This simulation demonstrates the dose-response relationship of acetylcholine on the frog rectus abdominis muscle. 
                    The muscle contraction is proportional to the drug concentration, following pharmacological principles.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
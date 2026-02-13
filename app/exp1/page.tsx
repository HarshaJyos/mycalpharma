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

interface ConcentrationStep {
  concentration: number // in M (Molar)
  label: string
  response: number // percentage of max response (0-100)
  duration: number // seconds for this step
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
  const [experimentState, setExperimentState] = useState<'idle' | 'running' | 'paused' | 'completed'>('idle')
  const [currentStep, setCurrentStep] = useState(0)
  const [progress, setProgress] = useState(0)
  const [leverRotation, setLeverRotation] = useState(0)
  const [autoScroll, setAutoScroll] = useState(true)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasWrapperRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRefs = useRef<Record<string, HTMLCanvasElement>>({})
  const contextRefs = useRef<Record<string, CanvasRenderingContext2D>>({})
  const animationFrameRef = useRef<number>()
  const startTimeRef = useRef<number>(0)
  const drawableAreaRefs = useRef<Record<string, HTMLDivElement>>({})

  // Acetylcholine dose-response curve data (based on Hill equation)
  // EC50 for ACh on frog rectus abdominis is approximately 10^-6 M
  const concentrationSteps: ConcentrationStep[] = [
    { concentration: 0, label: 'Baseline', response: 0, duration: 3 },
    { concentration: 1e-9, label: '10⁻⁹ M', response: 5, duration: 4 },
    { concentration: 1e-8, label: '10⁻⁸ M', response: 15, duration: 4 },
    { concentration: 1e-7, label: '10⁻⁷ M', response: 35, duration: 4 },
    { concentration: 1e-6, label: '10⁻⁶ M (EC50)', response: 50, duration: 5 },
    { concentration: 1e-5, label: '10⁻⁵ M', response: 85, duration: 5 },
    { concentration: 1e-4, label: '10⁻⁴ M', response: 95, duration: 5 },
    { concentration: 1e-3, label: '10⁻³ M', response: 98, duration: 5 },
    { concentration: 0, label: 'Wash', response: 0, duration: 4 },
  ]

  // Calculate scale based on canvas dimensions
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

  // Initialize canvases
  useEffect(() => {
    imageData.drawableAreas?.forEach(area => {
      const canvas = canvasRefs.current[area.id]
      if (canvas && !contextRefs.current[area.id]) {
        canvas.width = area.scrollWidth
        canvas.height = area.height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          contextRefs.current[area.id] = ctx
          ctx.fillStyle = area.color
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          
          // Draw grid lines
          ctx.strokeStyle = '#e0e0e0'
          ctx.lineWidth = 1
          
          // Vertical lines every 50px
          for (let x = 0; x < canvas.width; x += 50) {
            ctx.beginPath()
            ctx.moveTo(x, 0)
            ctx.lineTo(x, canvas.height)
            ctx.stroke()
          }
          
          // Horizontal lines every 50px
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

  const drawOnCanvas = useCallback((areaId: string, x: number, y: number, lastX?: number, lastY?: number) => {
    const ctx = contextRefs.current[areaId]
    if (!ctx) return

    ctx.strokeStyle = '#ff0000'
    ctx.lineWidth = 2
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

  const startExperiment = useCallback(() => {
    if (!imageData.baseImage || imageData.subImages.length === 0) {
      alert('Please load experiment data first!')
      return
    }

    // Find the lever image (sub-1770900057664-0)
    const leverImage = imageData.subImages.find(img => img.id === 'sub-1770900057664-0')
    if (!leverImage || leverImage.centerX === undefined || leverImage.centerY === undefined) {
      alert('Lever image not properly configured with pivot point!')
      return
    }

    if (!leverImage.penTipOffsetX || !leverImage.penTipOffsetY) {
      alert('Pen tip not set on lever image!')
      return
    }

    setExperimentState('running')
    setCurrentStep(0)
    setProgress(0)
    setLeverRotation(0)
    startTimeRef.current = Date.now()

    // Clear all canvases
    imageData.drawableAreas?.forEach(area => {
      const ctx = contextRefs.current[area.id]
      if (ctx) {
        ctx.fillStyle = area.color
        ctx.fillRect(0, 0, area.scrollWidth, area.height)
        
        // Redraw grid
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
    })

    runExperimentAnimation()
  }, [imageData])

  const runExperimentAnimation = useCallback(() => {
    const leverImage = imageData.subImages.find(img => img.id === 'sub-1770900057664-0')
    if (!leverImage || leverImage.centerX === undefined || leverImage.centerY === undefined) return

    const animate = () => {
      if (experimentState !== 'running') return

      const now = Date.now()
      const elapsed = (now - startTimeRef.current) / 1000 // seconds

      // Calculate total duration up to current step
      let totalDuration = 0
      let stepIndex = 0
      for (let i = 0; i < concentrationSteps.length; i++) {
        totalDuration += concentrationSteps[i].duration
        if (elapsed < totalDuration) {
          stepIndex = i
          break
        }
        if (i === concentrationSteps.length - 1) {
          // Experiment completed
          setExperimentState('completed')
          setCurrentStep(concentrationSteps.length)
          return
        }
      }

      setCurrentStep(stepIndex)

      // Calculate progress within current step
      const stepStartTime = concentrationSteps.slice(0, stepIndex).reduce((sum, step) => sum + step.duration, 0)
      const stepProgress = (elapsed - stepStartTime) / concentrationSteps[stepIndex].duration
      setProgress(Math.min(stepProgress * 100, 100))

      // Calculate muscle contraction (lever rotation)
      const currentConcentration = concentrationSteps[stepIndex]
      const targetResponse = currentConcentration.response

      // Smooth transition to target response
      const currentResponse = targetResponse * Math.min(stepProgress, 1)
      
      // Convert response (0-100%) to rotation angle
      // Assuming 0° = baseline, -45° = maximum contraction
      const targetRotation = -(currentResponse / 100) * 45
      setLeverRotation(targetRotation)

      // Update lever rotation in image data
      setImageData(prev => ({
        ...prev,
        subImages: prev.subImages.map(img =>
          img.id === leverImage.id
            ? { ...img, rotation: targetRotation }
            : img
        )
      }))

      // Calculate pen tip position and draw
      if (leverImage.penTipOffsetX !== undefined && leverImage.penTipOffsetY !== undefined) {
        const penTipLocalX = leverImage.x + leverImage.penTipOffsetX
        const penTipLocalY = leverImage.y + leverImage.penTipOffsetY
        
        const rotatedPenTip = rotatePoint(
          penTipLocalX,
          penTipLocalY,
          leverImage.centerX,
          leverImage.centerY,
          targetRotation
        )

        imageData.drawableAreas?.forEach(area => {
          if (
            rotatedPenTip.x >= area.x &&
            rotatedPenTip.x <= area.x + area.width &&
            rotatedPenTip.y >= area.y &&
            rotatedPenTip.y <= area.y + area.height
          ) {
            // Calculate scroll position based on elapsed time
            // Scroll from left to right over the entire experiment
            const totalExperimentDuration = concentrationSteps.reduce((sum, step) => sum + step.duration, 0)
            const scrollProgress = elapsed / totalExperimentDuration
            const scrollPosition = scrollProgress * (area.scrollWidth - area.width)

            // Auto-scroll the drawable area
            if (autoScroll && drawableAreaRefs.current[area.id]) {
              drawableAreaRefs.current[area.id].scrollLeft = scrollPosition * scale
            }

            const localX = rotatedPenTip.x - area.x + scrollPosition
            const localY = rotatedPenTip.y - area.y

            // Get last drawn position for this area
            const lastPosKey = `${area.id}_last`
            const lastPos = (window as any)[lastPosKey]
            
            if (lastPos) {
              drawOnCanvas(area.id, localX, localY, lastPos.x, lastPos.y)
            } else {
              drawOnCanvas(area.id, localX, localY)
            }

            (window as any)[lastPosKey] = { x: localX, y: localY }
          }
        })
      }

      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animationFrameRef.current = requestAnimationFrame(animate)
  }, [imageData, experimentState, autoScroll, drawOnCanvas])

  useEffect(() => {
    if (experimentState === 'running') {
      runExperimentAnimation()
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [experimentState, runExperimentAnimation])

  const pauseExperiment = () => {
    setExperimentState('paused')
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
  }

  const resumeExperiment = () => {
    setExperimentState('running')
    startTimeRef.current = Date.now() - (currentStep * concentrationSteps[currentStep]?.duration * 1000)
    runExperimentAnimation()
  }

  const resetExperiment = () => {
    setExperimentState('idle')
    setCurrentStep(0)
    setProgress(0)
    setLeverRotation(0)
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    // Reset lever rotation
    setImageData(prev => ({
      ...prev,
      subImages: prev.subImages.map(img =>
        img.id === 'sub-1770900057664-0'
          ? { ...img, rotation: 0 }
          : img
      )
    }))

    // Clear all canvases
    imageData.drawableAreas?.forEach(area => {
      const ctx = contextRefs.current[area.id]
      if (ctx) {
        ctx.fillStyle = area.color
        ctx.fillRect(0, 0, area.scrollWidth, area.height)
        
        // Redraw grid
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
      delete (window as any)[`${area.id}_last`]
    })
  }

  const allItems = [
    ...imageData.subImages.map(img => ({ ...img, type: 'image' as const })),
    ...(imageData.drawableAreas || []).map(area => ({ ...area, type: 'area' as const }))
  ].sort((a, b) => a.zIndex - b.zIndex)

  const totalDuration = concentrationSteps.reduce((sum, step) => sum + step.duration, 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
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
              
              <div className="space-y-3">
                {experimentState === 'idle' && (
                  <button
                    onClick={startExperiment}
                    disabled={!imageData.baseImage}
                    className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ▶ Start Experiment
                  </button>
                )}

                {experimentState === 'running' && (
                  <button
                    onClick={pauseExperiment}
                    className="w-full px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition font-semibold text-lg"
                  >
                    ⏸ Pause
                  </button>
                )}

                {experimentState === 'paused' && (
                  <button
                    onClick={resumeExperiment}
                    className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold text-lg"
                  >
                    ▶ Resume
                  </button>
                )}

                {experimentState !== 'idle' && (
                  <button
                    onClick={resetExperiment}
                    className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold"
                  >
                    🔄 Reset
                  </button>
                )}

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
                <div>
                  <div className="flex justify-between text-sm text-blue-100 mb-1">
                    <span>Step Progress</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-100"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {currentStep < concentrationSteps.length && (
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="text-sm text-blue-100 mb-1">Current Concentration</div>
                    <div className="text-2xl font-bold text-white">
                      {concentrationSteps[currentStep].label}
                    </div>
                    <div className="text-sm text-blue-200 mt-2">
                      Response: {concentrationSteps[currentStep].response}%
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-sm text-blue-100 mb-1">Muscle Contraction</div>
                  <div className="text-3xl font-bold text-white">
                    {Math.abs(Math.round(leverRotation))}°
                  </div>
                </div>

                <div>
                  <div className="text-sm text-blue-100 mb-1">Experiment State</div>
                  <div className={`text-lg font-bold ${
                    experimentState === 'running' ? 'text-green-400' :
                    experimentState === 'paused' ? 'text-yellow-400' :
                    experimentState === 'completed' ? 'text-blue-400' :
                    'text-gray-400'
                  }`}>
                    {experimentState.toUpperCase()}
                  </div>
                </div>
              </div>
            </div>

            {/* Concentration Steps */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-2xl p-6 border border-white/20">
              <h2 className="text-xl font-semibold mb-4 text-white">Protocol Steps</h2>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {concentrationSteps.map((step, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border transition ${
                      index === currentStep && experimentState === 'running'
                        ? 'bg-blue-500/30 border-blue-400'
                        : index < currentStep
                        ? 'bg-green-500/20 border-green-400/50'
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-white">{step.label}</div>
                        <div className="text-xs text-blue-200">
                          Response: {step.response}% • Duration: {step.duration}s
                        </div>
                      </div>
                      {index === currentStep && experimentState === 'running' && (
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                      )}
                      {index < currentStep && (
                        <div className="text-green-400">✓</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel - Apparatus Display */}
          <div className="lg:col-span-2">
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
                          <div
                            key={img.id}
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
                                width: `${area.scrollWidth * scale}px`,
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

              {experimentState === 'completed' && (
                <div className="mt-6 p-4 bg-green-500/20 border border-green-400 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-bold text-green-300">Experiment Completed!</div>
                      <div className="text-sm text-green-200 mt-1">
                        Total duration: {totalDuration} seconds
                      </div>
                    </div>
                    <div className="text-4xl">✓</div>
                  </div>
                </div>
              )}
            </div>

            {/* Information Panel */}
            <div className="mt-6 bg-white/10 backdrop-blur-md rounded-xl shadow-2xl p-6 border border-white/20">
              <h2 className="text-xl font-semibold mb-4 text-white">About This Experiment</h2>
              
              <div className="space-y-3 text-blue-100 text-sm">
                <p>
                  <strong className="text-white">Objective:</strong> To study the dose-response relationship of 
                  acetylcholine on the frog rectus abdominis muscle and determine the EC₅₀ value.
                </p>
                
                <p>
                  <strong className="text-white">Principle:</strong> Acetylcholine (ACh) is a neurotransmitter that 
                  causes muscle contraction by binding to nicotinic receptors. The degree of contraction is 
                  proportional to the concentration of ACh, following the Hill equation.
                </p>
                
                <p>
                  <strong className="text-white">EC₅₀:</strong> The concentration at which 50% of the maximum 
                  response is observed. For ACh on frog rectus abdominis, EC₅₀ ≈ 10⁻⁶ M.
                </p>

                <div className="bg-white/5 rounded-lg p-4 mt-4 border border-white/10">
                  <strong className="text-white block mb-2">Hill Equation:</strong>
                  <div className="font-mono text-xs bg-black/30 p-3 rounded border border-white/10">
                    Response = (E<sub>max</sub> × [ACh]<sup>n</sup>) / (EC₅₀<sup>n</sup> + [ACh]<sup>n</sup>)
                  </div>
                  <p className="text-xs mt-2 text-blue-200">
                    Where E<sub>max</sub> is maximum response, [ACh] is concentration, and n is Hill coefficient
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
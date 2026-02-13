'use client'

import { useState, useRef, useEffect } from 'react'
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

export default function Showcase() {
  const [imageData, setImageData] = useState<ImageData>({
    baseImage: null,
    subImages: [],
    drawableAreas: [],
  })
  const [jsonInput, setJsonInput] = useState('')
  const [error, setError] = useState('')
  const [scale, setScale] = useState(1)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [settingCenter, setSettingCenter] = useState(false)
  const [settingPenTip, setSettingPenTip] = useState(false)
  const [areaScrollPositions, setAreaScrollPositions] = useState<Record<string, number>>({})
  const [rotatingImage, setRotatingImage] = useState<string | null>(null)
  const [penColor, setPenColor] = useState('#000000')
  const [penWidth, setPenWidth] = useState(2)
  const [isDrawingMode, setIsDrawingMode] = useState(true)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasWrapperRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRefs = useRef<Record<string, HTMLCanvasElement>>({})
  const contextRefs = useRef<Record<string, CanvasRenderingContext2D>>({})
  const lastDrawnPositions = useRef<Record<string, { x: number; y: number }>>({})
  const rotationStartAngle = useRef<number>(0)
  const rotationStartMouseAngle = useRef<number>(0)

  useEffect(() => {
    if (imageData.baseImageDimensions && canvasWrapperRef.current) {
      const wrapper = canvasWrapperRef.current
      const maxWidth = wrapper.clientWidth - 48
      const maxHeight = 600
      
      const scaleX = maxWidth / imageData.baseImageDimensions.width
      const scaleY = maxHeight / imageData.baseImageDimensions.height
      const newScale = Math.min(scaleX, scaleY, 1)
      
      setScale(newScale)
    }
  }, [imageData.baseImageDimensions])

  // Initialize canvases when drawable areas change
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
      
      const scrollPos: Record<string, number> = {}
      processedData.drawableAreas?.forEach((area: DrawableArea) => {
        scrollPos[area.id] = 0
      })
      setAreaScrollPositions(scrollPos)
      
      contextRefs.current = {}
      lastDrawnPositions.current = {}
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
          
          const scrollPos: Record<string, number> = {}
          processedData.drawableAreas?.forEach((area: DrawableArea) => {
            scrollPos[area.id] = 0
          })
          setAreaScrollPositions(scrollPos)
          
          contextRefs.current = {}
          lastDrawnPositions.current = {}
        } catch (err) {
          setError('Invalid JSON file. Please check the file format.')
        }
      }
      reader.readAsText(file)
    }
  }

  const drawOnCanvas = (areaId: string, x: number, y: number) => {
    const ctx = contextRefs.current[areaId]
    if (!ctx) return

    const lastPos = lastDrawnPositions.current[areaId]
    
    ctx.strokeStyle = penColor
    ctx.lineWidth = penWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (lastPos) {
      ctx.beginPath()
      ctx.moveTo(lastPos.x, lastPos.y)
      ctx.lineTo(x, y)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.arc(x, y, penWidth / 2, 0, Math.PI * 2)
      ctx.fill()
    }

    lastDrawnPositions.current[areaId] = { x, y }
  }

  const calculateAngle = (centerX: number, centerY: number, pointX: number, pointY: number) => {
    return Math.atan2(pointY - centerY, pointX - centerX) * (180 / Math.PI)
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

  const handleImageMouseDown = (e: React.MouseEvent, imageId: string) => {
    if (!containerRef.current || settingCenter || settingPenTip) return
    
    e.preventDefault()
    e.stopPropagation()
    
    const img = imageData.subImages.find(i => i.id === imageId)
    if (!img || img.centerX === undefined || img.centerY === undefined) {
      alert('Please set a pivot point for this image first!')
      return
    }
    
    setSelectedImage(imageId)
    setRotatingImage(imageId)
    
    const containerRect = containerRef.current.getBoundingClientRect()
    const mouseX = (e.clientX - containerRect.left) / scale
    const mouseY = (e.clientY - containerRect.top) / scale
    
    rotationStartAngle.current = img.rotation || 0
    rotationStartMouseAngle.current = calculateAngle(img.centerX, img.centerY, mouseX, mouseY)
    
    if (isDrawingMode) {
      lastDrawnPositions.current = {}
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!rotatingImage || !containerRef.current) return

    const img = imageData.subImages.find(i => i.id === rotatingImage)
    if (!img || img.centerX === undefined || img.centerY === undefined) return

    const containerRect = containerRef.current.getBoundingClientRect()
    const mouseX = (e.clientX - containerRect.left) / scale
    const mouseY = (e.clientY - containerRect.top) / scale
    
    const currentMouseAngle = calculateAngle(img.centerX, img.centerY, mouseX, mouseY)
    const angleDelta = currentMouseAngle - rotationStartMouseAngle.current
    const newRotation = rotationStartAngle.current + angleDelta
    
    setImageData(prev => ({
      ...prev,
      subImages: prev.subImages.map(image =>
        image.id === rotatingImage
          ? { ...image, rotation: newRotation }
          : image
      )
    }))

    // Draw if pen tip is set and drawing mode is on
    if (isDrawingMode && img.penTipOffsetX !== undefined && img.penTipOffsetY !== undefined) {
      // Calculate pen tip position after rotation
      const penTipLocalX = img.x + img.penTipOffsetX
      const penTipLocalY = img.y + img.penTipOffsetY
      
      const rotatedPenTip = rotatePoint(
        penTipLocalX,
        penTipLocalY,
        img.centerX,
        img.centerY,
        newRotation
      )

      imageData.drawableAreas?.forEach(area => {
        if (
          rotatedPenTip.x >= area.x &&
          rotatedPenTip.x <= area.x + area.width &&
          rotatedPenTip.y >= area.y &&
          rotatedPenTip.y <= area.y + area.height
        ) {
          const scrollOffset = areaScrollPositions[area.id] || 0
          const localX = rotatedPenTip.x - area.x + scrollOffset
          const localY = rotatedPenTip.y - area.y

          drawOnCanvas(area.id, localX, localY)
        }
      })
    }
  }

  const handleMouseUp = () => {
    setRotatingImage(null)
    lastDrawnPositions.current = {}
  }

  useEffect(() => {
    if (rotatingImage) {
      const onMove = (e: MouseEvent) => handleMouseMove(e as any)
      const onUp = () => handleMouseUp()
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
      return () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
    }
  }, [rotatingImage, imageData, areaScrollPositions, isDrawingMode, penColor, penWidth])

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!containerRef.current) return

    const containerRect = containerRef.current.getBoundingClientRect()
    const clickX = (e.clientX - containerRect.left) / scale
    const clickY = (e.clientY - containerRect.top) / scale

    if (settingCenter && selectedImage) {
      setImageData(prev => ({
        ...prev,
        subImages: prev.subImages.map(img =>
          img.id === selectedImage
            ? { ...img, centerX: clickX, centerY: clickY }
            : img
        )
      }))
      setSettingCenter(false)
      alert('Pivot point set!')
    } else if (settingPenTip && selectedImage) {
      const img = imageData.subImages.find(i => i.id === selectedImage)
      if (img) {
        const offsetX = clickX - img.x
        const offsetY = clickY - img.y
        
        setImageData(prev => ({
          ...prev,
          subImages: prev.subImages.map(image =>
            image.id === selectedImage
              ? { ...image, penTipOffsetX: offsetX, penTipOffsetY: offsetY }
              : image
          )
        }))
      }
      setSettingPenTip(false)
      alert('Pen tip set!')
    }
  }

  const updateRotation = (id: string, rotation: number) => {
    setImageData(prev => ({
      ...prev,
      subImages: prev.subImages.map(img =>
        img.id === id ? { ...img, rotation } : img
      )
    }))
  }

  const updateCenterPoint = (id: string, field: 'centerX' | 'centerY', value: number) => {
    setImageData(prev => ({
      ...prev,
      subImages: prev.subImages.map(img =>
        img.id === id ? { ...img, [field]: value } : img
      )
    }))
  }

  const updatePenTipOffset = (id: string, field: 'penTipOffsetX' | 'penTipOffsetY', value: number) => {
    setImageData(prev => ({
      ...prev,
      subImages: prev.subImages.map(img =>
        img.id === id ? { ...img, [field]: value } : img
      )
    }))
  }

  const handleAreaScroll = (areaId: string, scrollLeft: number) => {
    setAreaScrollPositions(prev => ({
      ...prev,
      [areaId]: scrollLeft
    }))
  }

  const clearDrawings = (areaId?: string) => {
    if (areaId) {
      const area = imageData.drawableAreas?.find(a => a.id === areaId)
      if (area) {
        const ctx = contextRefs.current[areaId]
        if (ctx) {
          ctx.fillStyle = area.color
          ctx.fillRect(0, 0, area.scrollWidth, area.height)
        }
      }
      delete lastDrawnPositions.current[areaId]
    } else {
      imageData.drawableAreas?.forEach(area => {
        const ctx = contextRefs.current[area.id]
        if (ctx) {
          ctx.fillStyle = area.color
          ctx.fillRect(0, 0, area.scrollWidth, area.height)
        }
      })
      lastDrawnPositions.current = {}
    }
  }

  const clearData = () => {
    setImageData({ baseImage: null, subImages: [], drawableAreas: [] })
    setJsonInput('')
    setError('')
    setSelectedImage(null)
    setAreaScrollPositions({})
    contextRefs.current = {}
    lastDrawnPositions.current = {}
  }

  const selectedImg = imageData.subImages.find(img => img.id === selectedImage)

  const allItems = [
    ...imageData.subImages.map(img => ({ ...img, type: 'image' as const })),
    ...(imageData.drawableAreas || []).map(area => ({ ...area, type: 'area' as const }))
  ].sort((a, b) => a.zIndex - b.zIndex)

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Image Showcase</h1>
          <Link href="/" className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition">
            Home
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - JSON Input */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-700">Load Coordinates</h2>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload JSON File
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                />
              </div>

              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Or Paste JSON
                </label>
                <textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder='{"baseImage": "...", "subImages": [...]}'
                  className="w-full h-64 p-3 border border-gray-300 rounded-lg text-sm font-mono resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                
                {error && (
                  <p className="mt-2 text-sm text-red-600">{error}</p>
                )}

                <button
                  onClick={handleJSONInput}
                  className="w-full mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  Load from JSON
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-700">Drawing Controls</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    Drawing Mode
                  </label>
                  <button
                    onClick={() => setIsDrawingMode(!isDrawingMode)}
                    className={`px-4 py-2 rounded-lg transition ${
                      isDrawingMode
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-gray-400 text-white hover:bg-gray-500'
                    }`}
                  >
                    {isDrawingMode ? 'ON' : 'OFF'}
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pen Color
                  </label>
                  <input
                    type="color"
                    value={penColor}
                    onChange={(e) => setPenColor(e.target.value)}
                    className="w-full h-10 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pen Width: {penWidth}px
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={penWidth}
                    onChange={(e) => setPenWidth(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                <button
                  onClick={() => clearDrawings()}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  Clear All Drawings
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-700">Loaded Items</h2>
              
              {imageData.subImages.length === 0 ? (
                <p className="text-sm text-gray-500">No items loaded yet</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">
                    {imageData.subImages.length} image(s), {imageData.drawableAreas?.length || 0} area(s)
                  </p>
                  {imageData.baseImageDimensions && (
                    <p className="text-xs text-gray-500">
                      Canvas: {imageData.baseImageDimensions.width} × {imageData.baseImageDimensions.height} px
                      {scale < 1 && <span className="block">Display scale: {(scale * 100).toFixed(0)}%</span>}
                    </p>
                  )}
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {imageData.subImages.map((img, index) => (
                      <div 
                        key={img.id} 
                        className={`flex items-center space-x-2 p-2 rounded cursor-pointer border-2 ${
                          selectedImage === img.id ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-gray-50'
                        }`}
                        onClick={() => setSelectedImage(img.id)}
                      >
                        <img src={img.url} alt="" className="w-10 h-10 object-cover rounded" />
                        <div className="text-xs flex-1">
                          <div className="font-semibold">Image {index + 1} (z:{img.zIndex})</div>
                          <div className="text-gray-500">
                            Rotation: {Math.round(img.rotation || 0)}°
                          </div>
                          {img.centerX !== undefined && (
                            <div className="text-red-600 text-xs">✓ Pivot set</div>
                          )}
                          {img.penTipOffsetX !== undefined && (
                            <div className="text-green-600 text-xs">✓ Pen tip set</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <button
                    onClick={clearData}
                    className="w-full mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Display */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-lg shadow p-6" ref={canvasWrapperRef}>
              <h2 className="text-xl font-semibold mb-4 text-gray-700">Preview</h2>
              
              {!imageData.baseImage ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg h-96 flex items-center justify-center">
                  <p className="text-gray-500">Load coordinates to preview</p>
                </div>
              ) : (
                <div className="border-2 border-gray-200 rounded-lg overflow-hidden inline-block">
                  <div 
                    ref={containerRef}
                    className="relative"
                    style={{
                      width: imageData.baseImageDimensions ? `${imageData.baseImageDimensions.width * scale}px` : 'auto',
                      height: imageData.baseImageDimensions ? `${imageData.baseImageDimensions.height * scale}px` : 'auto',
                      cursor: settingCenter || settingPenTip ? 'crosshair' : 'default'
                    }}
                    onClick={(settingCenter || settingPenTip) ? handleCanvasClick : undefined}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                  >
                    <img
                      src={imageData.baseImage}
                      alt="Base"
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
                        let imageLeft = img.x
                        let imageTop = img.y
                        
                        if (hasCenterPoint) {
                          const originX = ((img.centerX - img.x) / img.width) * 100
                          const originY = ((img.centerY - img.y) / img.height) * 100
                          transformOrigin = `${originX}% ${originY}%`
                        }
                        
                        // Calculate pen tip position after rotation
                        let penTipX = undefined
                        let penTipY = undefined
                        if (hasCenterPoint && img.penTipOffsetX !== undefined && img.penTipOffsetY !== undefined) {
                          const penTipLocalX = img.x + img.penTipOffsetX
                          const penTipLocalY = img.y + img.penTipOffsetY
                          
                          const rotatedPenTip = rotatePoint(
                            penTipLocalX,
                            penTipLocalY,
                            img.centerX,
                            img.centerY,
                            rotation
                          )
                          
                          penTipX = rotatedPenTip.x
                          penTipY = rotatedPenTip.y
                        }
                        
                        return (
                          <div key={img.id}>
                            <div
                              className={`absolute ${settingCenter || settingPenTip ? 'pointer-events-none' : 'cursor-pointer'} ${
                                selectedImage === img.id ? 'ring-4 ring-blue-500' : ''
                              }`}
                              style={{
                                left: `${imageLeft * scale}px`,
                                top: `${imageTop * scale}px`,
                                width: `${img.width * scale}px`,
                                height: `${img.height * scale}px`,
                                transform: `rotate(${rotation}deg)`,
                                transformOrigin: transformOrigin,
                                zIndex: img.zIndex,
                              }}
                              onMouseDown={(e) => !(settingCenter || settingPenTip) && handleImageMouseDown(e, img.id)}
                              onClick={() => !(settingCenter || settingPenTip) && setSelectedImage(img.id)}
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
                            
                            {hasCenterPoint && (
                              <div
                                className="absolute w-3 h-3 bg-red-500 rounded-full border-2 border-white pointer-events-none z-[9999]"
                                style={{
                                  left: `${img.centerX * scale - 6}px`,
                                  top: `${img.centerY * scale - 6}px`,
                                }}
                              />
                            )}
                            
                            {penTipX !== undefined && penTipY !== undefined && (
                              <div
                                className="absolute w-4 h-4 bg-green-500 rounded-full border-2 border-white pointer-events-none z-[9999]"
                                style={{
                                  left: `${penTipX * scale - 8}px`,
                                  top: `${penTipY * scale - 8}px`,
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
                            className="absolute overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200"
                            style={{
                              left: `${area.x * scale}px`,
                              top: `${area.y * scale}px`,
                              width: `${area.width * scale}px`,
                              height: `${area.height * scale}px`,
                              zIndex: area.zIndex,
                            }}
                            onScroll={(e) => handleAreaScroll(area.id, e.currentTarget.scrollLeft / scale)}
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
            </div>

            {selectedImg && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-gray-700">
                    Image Controls
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSettingCenter(!settingCenter)
                        setSettingPenTip(false)
                      }}
                      className={`px-4 py-2 rounded-lg transition ${
                        settingCenter
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-orange-600 text-white hover:bg-orange-700'
                      }`}
                    >
                      {settingCenter ? 'Cancel' : 'Set Pivot'}
                    </button>
                    <button
                      onClick={() => {
                        setSettingPenTip(!settingPenTip)
                        setSettingCenter(false)
                      }}
                      className={`px-4 py-2 rounded-lg transition ${
                        settingPenTip
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      {settingPenTip ? 'Cancel' : 'Set Pen Tip'}
                    </button>
                  </div>
                </div>

                {settingCenter && (
                  <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
                    <strong>Setting Pivot Mode:</strong> Click anywhere to set the pivot point. Image will rotate around this point and stay locked to it.
                  </div>
                )}

                {settingPenTip && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                    <strong>Setting Pen Tip Mode:</strong> Click anywhere to set the pen tip. This point will follow rotation and draw on areas.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pivot X (px)
                    </label>
                    <input
                      type="number"
                      value={selectedImg.centerX !== undefined ? Math.round(selectedImg.centerX) : ''}
                      onChange={(e) => updateCenterPoint(selectedImg.id, 'centerX', Number(e.target.value))}
                      placeholder="Not set"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pivot Y (px)
                    </label>
                    <input
                      type="number"
                      value={selectedImg.centerY !== undefined ? Math.round(selectedImg.centerY) : ''}
                      onChange={(e) => updateCenterPoint(selectedImg.id, 'centerY', Number(e.target.value))}
                      placeholder="Not set"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pen Tip Offset X (px)
                    </label>
                    <input
                      type="number"
                      value={selectedImg.penTipOffsetX !== undefined ? Math.round(selectedImg.penTipOffsetX) : ''}
                      onChange={(e) => updatePenTipOffset(selectedImg.id, 'penTipOffsetX', Number(e.target.value))}
                      placeholder="Not set"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pen Tip Offset Y (px)
                    </label>
                    <input
                      type="number"
                      value={selectedImg.penTipOffsetY !== undefined ? Math.round(selectedImg.penTipOffsetY) : ''}
                      onChange={(e) => updatePenTipOffset(selectedImg.id, 'penTipOffsetY', Number(e.target.value))}
                      placeholder="Not set"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rotation Angle (degrees)
                  </label>
                  <div className="flex items-center space-x-4">
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      value={selectedImg.rotation || 0}
                      onChange={(e) => updateRotation(selectedImg.id, Number(e.target.value))}
                      className="flex-1"
                    />
                    <input
                      type="number"
                      min="-180"
                      max="180"
                      value={Math.round(selectedImg.rotation || 0)}
                      onChange={(e) => updateRotation(selectedImg.id, Number(e.target.value))}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600 w-8">°</span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-4">
                  <button
                    onClick={() => updateRotation(selectedImg.id, 0)}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition"
                  >
                    0°
                  </button>
                  <button
                    onClick={() => updateRotation(selectedImg.id, 90)}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition"
                  >
                    90°
                  </button>
                  <button
                    onClick={() => updateRotation(selectedImg.id, 180)}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition"
                  >
                    180°
                  </button>
                  <button
                    onClick={() => updateRotation(selectedImg.id, 270)}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition"
                  >
                    270°
                  </button>
                </div>

                <div className="p-3 bg-purple-50 rounded-lg text-sm text-gray-700">
                  <strong>How it works:</strong>
                  <ul className="mt-2 space-y-1">
                    <li>• 🔴 Red dot = Pivot point (image rotates around this and stays locked)</li>
                    <li>• 🟢 Green dot = Pen tip (follows rotation, draws on areas)</li>
                    <li>• Click and drag image to rotate around pivot</li>
                    <li>• Pen tip draws automatically when over drawable areas</li>
                  </ul>
                </div>
              </div>
            )}

            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Instructions:</h3>
              <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
                <li>Load JSON with pivot points and pen tips from Editor</li>
                <li>Images are locked to their pivot points (red dot)</li>
                <li>Click and drag an image to rotate it around its pivot</li>
                <li>Pen tip (green dot) follows the rotation</li>
                <li>When pen tip is over a drawable area, it draws!</li>
                <li>Toggle Drawing Mode ON/OFF to control drawing</li>
                <li>Adjust pen color and width as needed</li>
                <li>Scroll drawable areas to see more canvas</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
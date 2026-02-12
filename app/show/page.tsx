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

interface DrawingPath {
  areaId: string
  points: { x: number; y: number }[]
  color: string
  width: number
}

interface ImageData {
  baseImage: string | null
  baseImageDimensions?: { width: number; height: number }
  subImages: SubImage[]
  drawableAreas?: DrawableArea[]
}

interface DragState {
  isDragging: boolean
  imageId: string | null
  startX: number
  startY: number
  initialImageX: number
  initialImageY: number
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
  const [areaScrollPositions, setAreaScrollPositions] = useState<Record<string, number>>({})
  const [drawings, setDrawings] = useState<DrawingPath[]>([])
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    imageId: null,
    startX: 0,
    startY: 0,
    initialImageX: 0,
    initialImageY: 0,
  })
  const [penColor, setPenColor] = useState('#000000')
  const [penWidth, setPenWidth] = useState(2)
  const [isDrawingMode, setIsDrawingMode] = useState(true)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasWrapperRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRefs = useRef<Record<string, HTMLCanvasElement>>({})

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
      if (canvas) {
        canvas.width = area.scrollWidth
        canvas.height = area.height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.fillStyle = area.color
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }
      }
    })
  }, [imageData.drawableAreas])

  // Redraw all paths on canvases
  useEffect(() => {
    drawings.forEach(path => {
      const canvas = canvasRefs.current[path.areaId]
      if (canvas && path.points.length > 1) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.strokeStyle = path.color
          ctx.lineWidth = path.width
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          
          ctx.beginPath()
          ctx.moveTo(path.points[0].x, path.points[0].y)
          for (let i = 1; i < path.points.length; i++) {
            ctx.lineTo(path.points[i].x, path.points[i].y)
          }
          ctx.stroke()
        }
      }
    })
  }, [drawings])

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
      
      // Initialize scroll positions
      const scrollPos: Record<string, number> = {}
      processedData.drawableAreas?.forEach((area: DrawableArea) => {
        scrollPos[area.id] = 0
      })
      setAreaScrollPositions(scrollPos)
      setDrawings([])
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
          
          // Initialize scroll positions
          const scrollPos: Record<string, number> = {}
          processedData.drawableAreas?.forEach((area: DrawableArea) => {
            scrollPos[area.id] = 0
          })
          setAreaScrollPositions(scrollPos)
          setDrawings([])
        } catch (err) {
          setError('Invalid JSON file. Please check the file format.')
        }
      }
      reader.readAsText(file)
    }
  }

  const handleImageMouseDown = (e: React.MouseEvent, imageId: string) => {
    if (!containerRef.current || settingCenter) return
    
    e.preventDefault()
    e.stopPropagation()
    
    const img = imageData.subImages.find(i => i.id === imageId)
    if (!img) return
    
    const containerRect = containerRef.current.getBoundingClientRect()
    
    setSelectedImage(imageId)
    setDragState({
      isDragging: true,
      imageId,
      startX: e.clientX,
      startY: e.clientY,
      initialImageX: img.x,
      initialImageY: img.y,
    })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState.isDragging || !dragState.imageId || !containerRef.current || !imageData.baseImageDimensions) return

    const containerRect = containerRef.current.getBoundingClientRect()
    const img = imageData.subImages.find(i => i.id === dragState.imageId)
    if (!img) return

    const deltaX = (e.clientX - dragState.startX) / scale
    const deltaY = (e.clientY - dragState.startY) / scale

    let newX = dragState.initialImageX + deltaX
    let newY = dragState.initialImageY + deltaY

    newX = Math.max(0, Math.min(newX, imageData.baseImageDimensions.width - img.width))
    newY = Math.max(0, Math.min(newY, imageData.baseImageDimensions.height - img.height))

    // Update image position
    setImageData(prev => ({
      ...prev,
      subImages: prev.subImages.map(image =>
        image.id === dragState.imageId
          ? { ...image, x: newX, y: newY }
          : image
      )
    }))

    // Check if image tip is over any drawable area and draw
    if (isDrawingMode && img.centerX !== undefined && img.centerY !== undefined) {
      imageData.drawableAreas?.forEach(area => {
        // Check if center point (tip) is within the area bounds
        if (
          img.centerX! >= area.x &&
          img.centerX! <= area.x + area.width &&
          img.centerY! >= area.y &&
          img.centerY! <= area.y + area.height
        ) {
          // Calculate position within the scrollable canvas
          const scrollOffset = areaScrollPositions[area.id] || 0
          const localX = img.centerX! - area.x + scrollOffset
          const localY = img.centerY! - area.y

          // Add point to current drawing path
          setDrawings(prev => {
            const lastPath = prev[prev.length - 1]
            if (lastPath && lastPath.areaId === area.id) {
              // Continue existing path
              return [
                ...prev.slice(0, -1),
                {
                  ...lastPath,
                  points: [...lastPath.points, { x: localX, y: localY }]
                }
              ]
            } else {
              // Start new path
              return [
                ...prev,
                {
                  areaId: area.id,
                  points: [{ x: localX, y: localY }],
                  color: penColor,
                  width: penWidth,
                }
              ]
            }
          })
        }
      })
    }
  }

  const handleMouseUp = () => {
    setDragState({
      isDragging: false,
      imageId: null,
      startX: 0,
      startY: 0,
      initialImageX: 0,
      initialImageY: 0,
    })
  }

  useEffect(() => {
    if (dragState.isDragging) {
      const onMove = (e: MouseEvent) => handleMouseMove(e as any)
      const onUp = () => handleMouseUp()
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
      return () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
    }
  }, [dragState.isDragging, dragState, imageData, areaScrollPositions, isDrawingMode, penColor, penWidth])

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!settingCenter || !selectedImage || !containerRef.current) return

    const containerRect = containerRef.current.getBoundingClientRect()
    const centerX = (e.clientX - containerRect.left) / scale
    const centerY = (e.clientY - containerRect.top) / scale

    setImageData(prev => ({
      ...prev,
      subImages: prev.subImages.map(img =>
        img.id === selectedImage
          ? { ...img, centerX, centerY }
          : img
      )
    }))
    
    setSettingCenter(false)
    alert('Center point set!')
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

  const handleAreaScroll = (areaId: string, scrollLeft: number) => {
    setAreaScrollPositions(prev => ({
      ...prev,
      [areaId]: scrollLeft
    }))
  }

  const clearDrawings = (areaId?: string) => {
    if (areaId) {
      setDrawings(prev => prev.filter(p => p.areaId !== areaId))
      const canvas = canvasRefs.current[areaId]
      if (canvas) {
        const area = imageData.drawableAreas?.find(a => a.id === areaId)
        if (area) {
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.fillStyle = area.color
            ctx.fillRect(0, 0, canvas.width, canvas.height)
          }
        }
      }
    } else {
      setDrawings([])
      imageData.drawableAreas?.forEach(area => {
        const canvas = canvasRefs.current[area.id]
        if (canvas) {
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.fillStyle = area.color
            ctx.fillRect(0, 0, canvas.width, canvas.height)
          }
        }
      })
    }
  }

  const clearData = () => {
    setImageData({ baseImage: null, subImages: [], drawableAreas: [] })
    setJsonInput('')
    setError('')
    setSelectedImage(null)
    setDrawings([])
    setAreaScrollPositions({})
  }

  const selectedImg = imageData.subImages.find(img => img.id === selectedImage)

  // Sort all items by zIndex for rendering
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
                            <div className="text-green-600 text-xs">
                              ✓ Center (pen tip)
                            </div>
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
                      cursor: settingCenter ? 'crosshair' : 'default'
                    }}
                    onClick={settingCenter ? handleCanvasClick : undefined}
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
                    
                    {/* Render all items in z-index order */}
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
                              className={`absolute ${settingCenter && selectedImage === img.id ? 'pointer-events-none' : 'cursor-move'} ${
                                selectedImage === img.id ? 'ring-4 ring-blue-500' : ''
                              }`}
                              style={{
                                left: `${img.x * scale}px`,
                                top: `${img.y * scale}px`,
                                width: `${img.width * scale}px`,
                                height: `${img.height * scale}px`,
                                transform: `rotate(${rotation}deg)`,
                                transformOrigin: transformOrigin,
                                zIndex: img.zIndex,
                              }}
                              onMouseDown={(e) => !settingCenter && handleImageMouseDown(e, img.id)}
                              onClick={() => !settingCenter && setSelectedImage(img.id)}
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

            {/* Rotation Controls */}
            {selectedImg && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-gray-700">
                    Rotation Controls
                  </h2>
                  <button
                    onClick={() => setSettingCenter(!settingCenter)}
                    className={`px-4 py-2 rounded-lg transition ${
                      settingCenter
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-orange-600 text-white hover:bg-orange-700'
                    }`}
                  >
                    {settingCenter ? 'Cancel Set Center' : 'Set Center Point'}
                  </button>
                </div>

                {settingCenter && (
                  <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
                    <strong>Setting Center Mode:</strong> Click anywhere on the canvas to set the rotation center point for the selected image.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Center X (px)
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
                      Center Y (px)
                    </label>
                    <input
                      type="number"
                      value={selectedImg.centerY !== undefined ? Math.round(selectedImg.centerY) : ''}
                      onChange={(e) => updateCenterPoint(selectedImg.id, 'centerY', Number(e.target.value))}
                      placeholder="Not set"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
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

                <div className="grid grid-cols-4 gap-2">
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
              </div>
            )}

            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">How to use:</h3>
              <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
                <li>Load JSON with drawable areas from the Editor</li>
                <li>Select an image and set its center point (pen tip)</li>
                <li>Toggle "Drawing Mode" ON</li>
                <li>Drag the image over drawable areas - the center point will draw!</li>
                <li>Scroll drawable areas horizontally to see more canvas</li>
                <li>Adjust pen color and width as needed</li>
                <li>Rotate images while they draw for creative effects</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
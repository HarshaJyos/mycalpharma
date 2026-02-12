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
  zIndex: number
}

interface DrawableArea {
  id: string
  x: number
  y: number
  width: number
  height: number
  scrollWidth: number // Total scrollable width
  zIndex: number
  color: string
}

interface DragState {
  isDragging: boolean
  imageId: string | null
  areaId: string | null
  startX: number
  startY: number
  offsetX: number
  offsetY: number
}

export default function Editor() {
  const [baseImage, setBaseImage] = useState<string | null>(null)
  const [baseImageDimensions, setBaseImageDimensions] = useState<{ width: number; height: number } | null>(null)
  const [subImages, setSubImages] = useState<SubImage[]>([])
  const [drawableAreas, setDrawableAreas] = useState<DrawableArea[]>([])
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [selectedArea, setSelectedArea] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    imageId: null,
    areaId: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
  })
  const [settingCenter, setSettingCenter] = useState(false)
  const [creatingArea, setCreatingArea] = useState(false)
  const [areaStart, setAreaStart] = useState<{ x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasWrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (baseImageDimensions && canvasWrapperRef.current) {
      const wrapper = canvasWrapperRef.current
      const maxWidth = wrapper.clientWidth - 48
      const maxHeight = 600
      
      const scaleX = maxWidth / baseImageDimensions.width
      const scaleY = maxHeight / baseImageDimensions.height
      const newScale = Math.min(scaleX, scaleY, 1)
      
      setScale(newScale)
    }
  }, [baseImageDimensions])

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!baseImageDimensions) return
      
      if (selectedImage) {
        const img = subImages.find(i => i.id === selectedImage)
        if (!img) return

        let newX = img.x
        let newY = img.y
        const step = e.shiftKey ? 10 : 1

        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault()
            newX = Math.max(0, img.x - step)
            break
          case 'ArrowRight':
            e.preventDefault()
            newX = Math.min(baseImageDimensions.width - img.width, img.x + step)
            break
          case 'ArrowUp':
            e.preventDefault()
            newY = Math.max(0, img.y - step)
            break
          case 'ArrowDown':
            e.preventDefault()
            newY = Math.min(baseImageDimensions.height - img.height, img.y + step)
            break
          default:
            return
        }

        setSubImages(prev =>
          prev.map(image =>
            image.id === selectedImage
              ? { ...image, x: newX, y: newY }
              : image
          )
        )
      } else if (selectedArea) {
        const area = drawableAreas.find(a => a.id === selectedArea)
        if (!area) return

        let newX = area.x
        let newY = area.y
        const step = e.shiftKey ? 10 : 1

        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault()
            newX = Math.max(0, area.x - step)
            break
          case 'ArrowRight':
            e.preventDefault()
            newX = Math.min(baseImageDimensions.width - area.width, area.x + step)
            break
          case 'ArrowUp':
            e.preventDefault()
            newY = Math.max(0, area.y - step)
            break
          case 'ArrowDown':
            e.preventDefault()
            newY = Math.min(baseImageDimensions.height - area.height, area.y + step)
            break
          default:
            return
        }

        setDrawableAreas(prev =>
          prev.map(a =>
            a.id === selectedArea
              ? { ...a, x: newX, y: newY }
              : a
          )
        )
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedImage, selectedArea, subImages, drawableAreas, baseImageDimensions])

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
  }, [dragState.isDragging])

  const handleBaseImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const img = new Image()
        img.onload = () => {
          setBaseImage(event.target?.result as string)
          setBaseImageDimensions({ width: img.naturalWidth, height: img.naturalHeight })
        }
        img.src = event.target?.result as string
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      const maxZ = Math.max(0, ...subImages.map(img => img.zIndex), ...drawableAreas.map(a => a.zIndex))
      
      Array.from(files).forEach((file, index) => {
        const reader = new FileReader()
        reader.onload = (event) => {
          const img = new Image()
          img.onload = () => {
            const newImage: SubImage = {
              id: `sub-${Date.now()}-${index}`,
              url: event.target?.result as string,
              x: 50 + index * 20,
              y: 50 + index * 20,
              width: img.naturalWidth,
              height: img.naturalHeight,
              zIndex: maxZ + index + 1,
            }
            setSubImages(prev => [...prev, newImage])
          }
          img.src = event.target?.result as string
        }
        reader.readAsDataURL(file)
      })
    }
  }

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return
    
    if (creatingArea) {
      const containerRect = containerRef.current.getBoundingClientRect()
      const x = (e.clientX - containerRect.left) / scale
      const y = (e.clientY - containerRect.top) / scale
      setAreaStart({ x, y })
    }
  }

  const handleCanvasMouseUp = (e: React.MouseEvent) => {
    if (creatingArea && areaStart && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect()
      const endX = (e.clientX - containerRect.left) / scale
      const endY = (e.clientY - containerRect.top) / scale
      
      const x = Math.min(areaStart.x, endX)
      const y = Math.min(areaStart.y, endY)
      const width = Math.abs(endX - areaStart.x)
      const height = Math.abs(endY - areaStart.y)
      
      if (width > 20 && height > 20) {
        const maxZ = Math.max(0, ...subImages.map(img => img.zIndex), ...drawableAreas.map(a => a.zIndex))
        const newArea: DrawableArea = {
          id: `area-${Date.now()}`,
          x,
          y,
          width,
          height,
          scrollWidth: width * 3, // Default 3x scrollable width
          zIndex: maxZ + 1,
          color: '#ffffff',
        }
        setDrawableAreas(prev => [...prev, newArea])
      }
      
      setAreaStart(null)
      setCreatingArea(false)
    }
  }

  const handleMouseDown = (e: React.MouseEvent, imageId?: string, areaId?: string) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (imageId) {
      const img = subImages.find(i => i.id === imageId)
      if (!img || !containerRef.current) return

      const containerRect = containerRef.current.getBoundingClientRect()
      
      setSelectedImage(imageId)
      setSelectedArea(null)
      setDragState({
        isDragging: true,
        imageId,
        areaId: null,
        startX: e.clientX,
        startY: e.clientY,
        offsetX: (e.clientX - containerRect.left) / scale - img.x,
        offsetY: (e.clientY - containerRect.top) / scale - img.y,
      })
    } else if (areaId) {
      const area = drawableAreas.find(a => a.id === areaId)
      if (!area || !containerRef.current) return

      const containerRect = containerRef.current.getBoundingClientRect()
      
      setSelectedArea(areaId)
      setSelectedImage(null)
      setDragState({
        isDragging: true,
        imageId: null,
        areaId,
        startX: e.clientX,
        startY: e.clientY,
        offsetX: (e.clientX - containerRect.left) / scale - area.x,
        offsetY: (e.clientX - containerRect.top) / scale - area.y,
      })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState.isDragging || !containerRef.current || !baseImageDimensions) return

    const containerRect = containerRef.current.getBoundingClientRect()

    if (dragState.imageId) {
      const img = subImages.find(i => i.id === dragState.imageId)
      if (!img) return

      let newX = (e.clientX - containerRect.left) / scale - dragState.offsetX
      let newY = (e.clientY - containerRect.top) / scale - dragState.offsetY

      newX = Math.max(0, Math.min(newX, baseImageDimensions.width - img.width))
      newY = Math.max(0, Math.min(newY, baseImageDimensions.height - img.height))

      setSubImages(prev =>
        prev.map(image =>
          image.id === dragState.imageId
            ? { ...image, x: newX, y: newY }
            : image
        )
      )
    } else if (dragState.areaId) {
      const area = drawableAreas.find(a => a.id === dragState.areaId)
      if (!area) return

      let newX = (e.clientX - containerRect.left) / scale - dragState.offsetX
      let newY = (e.clientY - containerRect.top) / scale - dragState.offsetY

      newX = Math.max(0, Math.min(newX, baseImageDimensions.width - area.width))
      newY = Math.max(0, Math.min(newY, baseImageDimensions.height - area.height))

      setDrawableAreas(prev =>
        prev.map(a =>
          a.id === dragState.areaId
            ? { ...a, x: newX, y: newY }
            : a
        )
      )
    }
  }

  const handleMouseUp = () => {
    setDragState({
      isDragging: false,
      imageId: null,
      areaId: null,
      startX: 0,
      startY: 0,
      offsetX: 0,
      offsetY: 0,
    })
  }

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!settingCenter || !selectedImage || !containerRef.current) return

    const containerRect = containerRef.current.getBoundingClientRect()
    const centerX = (e.clientX - containerRect.left) / scale
    const centerY = (e.clientY - containerRect.top) / scale

    setSubImages(prev =>
      prev.map(image =>
        image.id === selectedImage
          ? { ...image, centerX, centerY }
          : image
      )
    )
    
    setSettingCenter(false)
    alert('Center point set!')
  }

  const removeSubImage = (id: string) => {
    setSubImages(prev => prev.filter(img => img.id !== id))
    if (selectedImage === id) setSelectedImage(null)
  }

  const removeDrawableArea = (id: string) => {
    setDrawableAreas(prev => prev.filter(a => a.id !== id))
    if (selectedArea === id) setSelectedArea(null)
  }

  const updateImageCoordinates = (id: string, field: 'x' | 'y' | 'centerX' | 'centerY', value: number) => {
    setSubImages(prev =>
      prev.map(img =>
        img.id === id ? { ...img, [field]: value } : img
      )
    )
  }

  const updateAreaProperty = (id: string, field: keyof DrawableArea, value: any) => {
    setDrawableAreas(prev =>
      prev.map(area =>
        area.id === id ? { ...area, [field]: value } : area
      )
    )
  }

  const changeZIndex = (id: string, direction: 'up' | 'down', type: 'image' | 'area') => {
    if (type === 'image') {
      const items = [...subImages].sort((a, b) => a.zIndex - b.zIndex)
      const index = items.findIndex(i => i.id === id)
      if (index === -1) return
      
      if (direction === 'up' && index < items.length - 1) {
        const temp = items[index].zIndex
        items[index].zIndex = items[index + 1].zIndex
        items[index + 1].zIndex = temp
      } else if (direction === 'down' && index > 0) {
        const temp = items[index].zIndex
        items[index].zIndex = items[index - 1].zIndex
        items[index - 1].zIndex = temp
      }
      
      setSubImages(items)
    } else {
      const items = [...drawableAreas].sort((a, b) => a.zIndex - b.zIndex)
      const index = items.findIndex(a => a.id === id)
      if (index === -1) return
      
      if (direction === 'up' && index < items.length - 1) {
        const temp = items[index].zIndex
        items[index].zIndex = items[index + 1].zIndex
        items[index + 1].zIndex = temp
      } else if (direction === 'down' && index > 0) {
        const temp = items[index].zIndex
        items[index].zIndex = items[index - 1].zIndex
        items[index - 1].zIndex = temp
      }
      
      setDrawableAreas(items)
    }
  }

  const exportCoordinates = () => {
    const data = {
      baseImage,
      baseImageDimensions,
      subImages: subImages.map(img => ({
        id: img.id,
        url: img.url,
        x: Math.round(img.x),
        y: Math.round(img.y),
        width: img.width,
        height: img.height,
        centerX: img.centerX !== undefined ? Math.round(img.centerX) : undefined,
        centerY: img.centerY !== undefined ? Math.round(img.centerY) : undefined,
        zIndex: img.zIndex,
      })),
      drawableAreas: drawableAreas.map(area => ({
        id: area.id,
        x: Math.round(area.x),
        y: Math.round(area.y),
        width: area.width,
        height: area.height,
        scrollWidth: area.scrollWidth,
        zIndex: area.zIndex,
        color: area.color,
      })),
    }
    return JSON.stringify(data, null, 2)
  }

  const copyToClipboard = () => {
    const coordinates = exportCoordinates()
    navigator.clipboard.writeText(coordinates)
    alert('Coordinates copied to clipboard!')
  }

  const downloadJSON = () => {
    const coordinates = exportCoordinates()
    const blob = new Blob([coordinates], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'image-positions.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const selectedImg = subImages.find(img => img.id === selectedImage)
  const selectedAreaObj = drawableAreas.find(a => a.id === selectedArea)

  // Sort all items by zIndex for rendering
  const allItems = [
    ...subImages.map(img => ({ ...img, type: 'image' as const })),
    ...drawableAreas.map(area => ({ ...area, type: 'area' as const }))
  ].sort((a, b) => a.zIndex - b.zIndex)

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Image Position Editor</h1>
          <Link href="/" className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition">
            Home
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Controls */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-700">Upload Images</h2>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Base Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleBaseImageUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {baseImageDimensions && (
                  <p className="text-xs text-gray-500 mt-1">
                    Actual size: {baseImageDimensions.width} × {baseImageDimensions.height} px
                    {scale < 1 && <span className="block">Display scale: {(scale * 100).toFixed(0)}%</span>}
                  </p>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sub Images (Multiple)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleSubImagesUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                />
              </div>

              <div>
                <button
                  onClick={() => {
                    setCreatingArea(!creatingArea)
                    setAreaStart(null)
                  }}
                  className={`w-full px-4 py-2 rounded-lg transition ${
                    creatingArea
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {creatingArea ? 'Cancel Create Area' : 'Create Drawable Area'}
                </button>
                {creatingArea && (
                  <p className="text-xs text-gray-600 mt-2">
                    Click and drag on canvas to create a drawable area
                  </p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-700">Layers</h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {allItems.sort((a, b) => b.zIndex - a.zIndex).map(item => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-2 rounded border-2 cursor-pointer ${
                      (item.type === 'image' && selectedImage === item.id) || 
                      (item.type === 'area' && selectedArea === item.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200'
                    }`}
                    onClick={() => {
                      if (item.type === 'image') {
                        setSelectedImage(item.id)
                        setSelectedArea(null)
                      } else {
                        setSelectedArea(item.id)
                        setSelectedImage(null)
                      }
                    }}
                  >
                    <div className="flex items-center space-x-2 flex-1">
                      {item.type === 'image' ? (
                        <>
                          <img src={(item as SubImage).url} alt="" className="w-10 h-10 object-cover rounded" />
                          <div className="text-xs">
                            <div className="font-semibold">Image (z:{item.zIndex})</div>
                            <div className="text-gray-500">
                              {(item as SubImage).width} × {(item as SubImage).height} px
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-10 h-10 rounded border-2 border-gray-400" style={{ backgroundColor: (item as DrawableArea).color }} />
                          <div className="text-xs">
                            <div className="font-semibold">Area (z:{item.zIndex})</div>
                            <div className="text-gray-500">
                              {(item as DrawableArea).width} × {(item as DrawableArea).height} px
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex flex-col space-y-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          changeZIndex(item.id, 'up', item.type)
                        }}
                        className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded"
                      >
                        ▲
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          changeZIndex(item.id, 'down', item.type)
                        }}
                        className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded"
                      >
                        ▼
                      </button>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (item.type === 'image') {
                          removeSubImage(item.id)
                        } else {
                          removeDrawableArea(item.id)
                        }
                      }}
                      className="ml-2 text-red-500 hover:text-red-700 text-sm font-semibold"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-700">Export</h2>
              <div className="space-y-2">
                <button
                  onClick={copyToClipboard}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Copy Coordinates
                </button>
                <button
                  onClick={downloadJSON}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  Download JSON
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel - Canvas */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-lg shadow p-6" ref={canvasWrapperRef}>
              <h2 className="text-xl font-semibold mb-4 text-gray-700">Canvas</h2>
              
              {!baseImage || !baseImageDimensions ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg h-96 flex items-center justify-center">
                  <p className="text-gray-500">Upload a base image to get started</p>
                </div>
              ) : (
                <div className="border-2 border-gray-200 rounded-lg overflow-hidden inline-block">
                  <div 
                    ref={containerRef}
                    className="relative select-none"
                    style={{ 
                      width: `${baseImageDimensions.width * scale}px`,
                      height: `${baseImageDimensions.height * scale}px`,
                      cursor: settingCenter ? 'crosshair' : creatingArea ? 'crosshair' : 'default'
                    }}
                    onMouseMove={handleMouseMove}
                    onMouseUp={creatingArea ? handleCanvasMouseUp : handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onMouseDown={creatingArea ? handleCanvasMouseDown : undefined}
                    onClick={settingCenter && !creatingArea ? handleCanvasClick : undefined}
                  >
                    <img
                      src={baseImage}
                      alt="Base"
                      className="block pointer-events-none"
                      style={{
                        width: `${baseImageDimensions.width * scale}px`,
                        height: `${baseImageDimensions.height * scale}px`,
                      }}
                      draggable={false}
                    />
                    
                    {/* Render all items in z-index order */}
                    {allItems.map(item => {
                      if (item.type === 'image') {
                        const img = item as SubImage
                        return (
                          <div key={img.id}>
                            <div
                              className={`absolute ${settingCenter || creatingArea ? 'pointer-events-none' : 'cursor-move'} ${
                                selectedImage === img.id ? 'ring-4 ring-blue-500' : 'ring-2 ring-white'
                              }`}
                              style={{
                                left: `${img.x * scale}px`,
                                top: `${img.y * scale}px`,
                                width: `${img.width * scale}px`,
                                height: `${img.height * scale}px`,
                                zIndex: img.zIndex,
                              }}
                              onMouseDown={settingCenter || creatingArea ? undefined : (e) => handleMouseDown(e, img.id)}
                              onClick={settingCenter || creatingArea ? undefined : () => {
                                setSelectedImage(img.id)
                                setSelectedArea(null)
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
                                draggable={false}
                              />
                            </div>
                            
                            {img.centerX !== undefined && img.centerY !== undefined && (
                              <div
                                className="absolute w-3 h-3 bg-red-500 rounded-full border-2 border-white pointer-events-none"
                                style={{
                                  left: `${img.centerX * scale - 6}px`,
                                  top: `${img.centerY * scale - 6}px`,
                                  zIndex: img.zIndex + 1000,
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
                            className={`absolute overflow-hidden ${settingCenter || creatingArea ? 'pointer-events-none' : 'cursor-move'} ${
                              selectedArea === area.id ? 'ring-4 ring-indigo-500' : 'ring-2 ring-gray-400'
                            }`}
                            style={{
                              left: `${area.x * scale}px`,
                              top: `${area.y * scale}px`,
                              width: `${area.width * scale}px`,
                              height: `${area.height * scale}px`,
                              backgroundColor: area.color,
                              zIndex: area.zIndex,
                            }}
                            onMouseDown={settingCenter || creatingArea ? undefined : (e) => handleMouseDown(e, undefined, area.id)}
                            onClick={settingCenter || creatingArea ? undefined : () => {
                              setSelectedArea(area.id)
                              setSelectedImage(null)
                            }}
                          >
                            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs pointer-events-none">
                              Drawable Area
                            </div>
                          </div>
                        )
                      }
                    })}
                    
                    {/* Area creation preview */}
                    {creatingArea && areaStart && (
                      <div
                        className="absolute border-2 border-dashed border-indigo-500 bg-indigo-100 bg-opacity-30 pointer-events-none"
                        style={{
                          left: `${areaStart.x * scale}px`,
                          top: `${areaStart.y * scale}px`,
                        }}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Image Controls */}
            {selectedImg && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-gray-700">
                    Image Controls
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
                    <strong>Setting Center Mode:</strong> Click anywhere on the canvas to set the center point for rotation.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      X Position (px)
                    </label>
                    <input
                      type="number"
                      value={Math.round(selectedImg.x)}
                      onChange={(e) => updateImageCoordinates(selectedImg.id, 'x', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Y Position (px)
                    </label>
                    <input
                      type="number"
                      value={Math.round(selectedImg.y)}
                      onChange={(e) => updateImageCoordinates(selectedImg.id, 'y', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Center X (px)
                    </label>
                    <input
                      type="number"
                      value={selectedImg.centerX !== undefined ? Math.round(selectedImg.centerX) : ''}
                      onChange={(e) => updateImageCoordinates(selectedImg.id, 'centerX', Number(e.target.value))}
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
                      onChange={(e) => updateImageCoordinates(selectedImg.id, 'centerY', Number(e.target.value))}
                      placeholder="Not set"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-gray-700">
                  <strong>Keyboard Controls:</strong>
                  <ul className="mt-2 space-y-1">
                    <li>• Arrow keys: Move 1px</li>
                    <li>• Shift + Arrow keys: Move 10px</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Area Controls */}
            {selectedAreaObj && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">
                  Drawable Area Controls
                </h2>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      X Position (px)
                    </label>
                    <input
                      type="number"
                      value={Math.round(selectedAreaObj.x)}
                      onChange={(e) => updateAreaProperty(selectedAreaObj.id, 'x', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Y Position (px)
                    </label>
                    <input
                      type="number"
                      value={Math.round(selectedAreaObj.y)}
                      onChange={(e) => updateAreaProperty(selectedAreaObj.id, 'y', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Width (px)
                    </label>
                    <input
                      type="number"
                      value={selectedAreaObj.width}
                      onChange={(e) => updateAreaProperty(selectedAreaObj.id, 'width', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Height (px)
                    </label>
                    <input
                      type="number"
                      value={selectedAreaObj.height}
                      onChange={(e) => updateAreaProperty(selectedAreaObj.id, 'height', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Scroll Width (px)
                    </label>
                    <input
                      type="number"
                      value={selectedAreaObj.scrollWidth}
                      onChange={(e) => updateAreaProperty(selectedAreaObj.id, 'scrollWidth', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Background Color
                    </label>
                    <input
                      type="color"
                      value={selectedAreaObj.color}
                      onChange={(e) => updateAreaProperty(selectedAreaObj.id, 'color', e.target.value)}
                      className="w-full h-10 px-1 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="mt-4 p-3 bg-indigo-50 rounded-lg text-sm text-gray-700">
                  <strong>Info:</strong> This area will be scrollable horizontally in the showcase page. Objects moving over it will draw on the canvas.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
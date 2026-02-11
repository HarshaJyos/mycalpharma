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
}

interface DragState {
  isDragging: boolean
  imageId: string | null
  startX: number
  startY: number
  offsetX: number
  offsetY: number
}

export default function Editor() {
  const [baseImage, setBaseImage] = useState<string | null>(null)
  const [baseImageDimensions, setBaseImageDimensions] = useState<{ width: number; height: number } | null>(null)
  const [subImages, setSubImages] = useState<SubImage[]>([])
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    imageId: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
  })
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasWrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (baseImageDimensions && canvasWrapperRef.current) {
      const wrapper = canvasWrapperRef.current
      const maxWidth = wrapper.clientWidth - 48 // padding
      const maxHeight = 600 // max height for canvas
      
      const scaleX = maxWidth / baseImageDimensions.width
      const scaleY = maxHeight / baseImageDimensions.height
      const newScale = Math.min(scaleX, scaleY, 1) // Never scale up, only down
      
      setScale(newScale)
    }
  }, [baseImageDimensions])

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
            }
            setSubImages(prev => [...prev, newImage])
          }
          img.src = event.target?.result as string
        }
        reader.readAsDataURL(file)
      })
    }
  }

  const handleMouseDown = (e: React.MouseEvent, imageId: string) => {
    e.preventDefault()
    const img = subImages.find(i => i.id === imageId)
    if (!img || !containerRef.current) return

    const containerRect = containerRef.current.getBoundingClientRect()
    
    setSelectedImage(imageId)
    setDragState({
      isDragging: true,
      imageId,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: (e.clientX - containerRect.left) / scale - img.x,
      offsetY: (e.clientY - containerRect.top) / scale - img.y,
    })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState.isDragging || !dragState.imageId || !containerRef.current || !baseImageDimensions) return

    const containerRect = containerRef.current.getBoundingClientRect()
    const img = subImages.find(i => i.id === dragState.imageId)
    if (!img) return

    let newX = (e.clientX - containerRect.left) / scale - dragState.offsetX
    let newY = (e.clientY - containerRect.top) / scale - dragState.offsetY

    // Bounds checking - keep within canvas based on actual pixel dimensions
    newX = Math.max(0, Math.min(newX, baseImageDimensions.width - img.width))
    newY = Math.max(0, Math.min(newY, baseImageDimensions.height - img.height))

    setSubImages(prev =>
      prev.map(image =>
        image.id === dragState.imageId
          ? { ...image, x: newX, y: newY }
          : image
      )
    )
  }

  const handleMouseUp = () => {
    setDragState({
      isDragging: false,
      imageId: null,
      startX: 0,
      startY: 0,
      offsetX: 0,
      offsetY: 0,
    })
  }

  const removeSubImage = (id: string) => {
    setSubImages(prev => prev.filter(img => img.id !== id))
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

              <div>
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
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-700">Sub Images</h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {subImages.map(img => (
                  <div
                    key={img.id}
                    className={`flex items-center justify-between p-2 rounded border-2 cursor-pointer ${
                      selectedImage === img.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                    onClick={() => setSelectedImage(img.id)}
                  >
                    <div className="flex items-center space-x-2">
                      <img src={img.url} alt="" className="w-10 h-10 object-cover rounded" />
                      <div className="text-xs">
                        <div className="font-semibold">x: {Math.round(img.x)}, y: {Math.round(img.y)}</div>
                        <div className="text-gray-500">{img.width} × {img.height} px</div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeSubImage(img.id)
                      }}
                      className="text-red-500 hover:text-red-700 text-sm font-semibold"
                    >
                      Remove
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
          <div className="lg:col-span-2">
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
                    }}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
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
                    
                    {subImages.map(img => (
                      <div
                        key={img.id}
                        className={`absolute cursor-move ${
                          selectedImage === img.id ? 'ring-4 ring-blue-500' : 'ring-2 ring-white'
                        }`}
                        style={{
                          left: `${img.x * scale}px`,
                          top: `${img.y * scale}px`,
                          width: `${img.width * scale}px`,
                          height: `${img.height * scale}px`,
                        }}
                        onMouseDown={(e) => handleMouseDown(e, img.id)}
                        onClick={() => setSelectedImage(img.id)}
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
                        <div className="absolute top-0 left-0 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded pointer-events-none whitespace-nowrap">
                          ({Math.round(img.x)}, {Math.round(img.y)})
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 text-sm text-gray-600">
                <p><strong>Instructions:</strong></p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Canvas scales to fit the viewport (coordinates remain accurate)</li>
                  <li>Drag sub-images to position them on the canvas</li>
                  <li>Click on a sub-image to select it</li>
                  <li>Pixel coordinates reflect actual image dimensions</li>
                  <li>Export coordinates when done</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
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

interface ImageData {
  baseImage: string | null
  baseImageDimensions?: { width: number; height: number }
  subImages: SubImage[]
}

export default function Showcase() {
  const [imageData, setImageData] = useState<ImageData>({
    baseImage: null,
    subImages: [],
  })
  const [jsonInput, setJsonInput] = useState('')
  const [error, setError] = useState('')
  const [scale, setScale] = useState(1)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasWrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (imageData.baseImageDimensions && canvasWrapperRef.current) {
      const wrapper = canvasWrapperRef.current
      const maxWidth = wrapper.clientWidth - 48 // padding
      const maxHeight = 600 // max height for canvas
      
      const scaleX = maxWidth / imageData.baseImageDimensions.width
      const scaleY = maxHeight / imageData.baseImageDimensions.height
      const newScale = Math.min(scaleX, scaleY, 1) // Never scale up, only down
      
      setScale(newScale)
    }
  }, [imageData.baseImageDimensions])

  const handleJSONInput = () => {
    try {
      setError('')
      const data = JSON.parse(jsonInput)
      
      if (!data.baseImage || !Array.isArray(data.subImages)) {
        throw new Error('Invalid JSON format')
      }
      
      setImageData(data)
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
          setImageData(data)
          setJsonInput(JSON.stringify(data, null, 2))
          setError('')
        } catch (err) {
          setError('Invalid JSON file. Please check the file format.')
        }
      }
      reader.readAsText(file)
    }
  }

  const clearData = () => {
    setImageData({ baseImage: null, subImages: [] })
    setJsonInput('')
    setError('')
  }

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
              <h2 className="text-xl font-semibold mb-4 text-gray-700">Loaded Images</h2>
              
              {imageData.subImages.length === 0 ? (
                <p className="text-sm text-gray-500">No images loaded yet</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">
                    {imageData.subImages.length} sub-image(s) loaded
                  </p>
                  {imageData.baseImageDimensions && (
                    <p className="text-xs text-gray-500">
                      Actual size: {imageData.baseImageDimensions.width} × {imageData.baseImageDimensions.height} px
                      {scale < 1 && <span className="block">Display scale: {(scale * 100).toFixed(0)}%</span>}
                    </p>
                  )}
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {imageData.subImages.map((img, index) => (
                      <div key={img.id} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                        <img src={img.url} alt="" className="w-10 h-10 object-cover rounded" />
                        <div className="text-xs flex-1">
                          <div className="font-semibold">Image {index + 1}</div>
                          <div className="text-gray-500">
                            Position: ({Math.round(img.x)}, {Math.round(img.y)})
                          </div>
                          <div className="text-gray-500">
                            Size: {img.width} × {img.height} px
                          </div>
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
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6" ref={canvasWrapperRef}>
              <h2 className="text-xl font-semibold mb-4 text-gray-700">Preview</h2>
              
              {!imageData.baseImage ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg h-96 flex items-center justify-center">
                  <p className="text-gray-500">Load coordinates to preview</p>
                </div>
              ) : (
                <div className="border-2 border-gray-200 rounded-lg overflow-hidden inline-block">
                  <div 
                    className="relative"
                    style={imageData.baseImageDimensions ? {
                      width: `${imageData.baseImageDimensions.width * scale}px`,
                      height: `${imageData.baseImageDimensions.height * scale}px`,
                    } : {}}
                  >
                    <img
                      src={imageData.baseImage}
                      alt="Base"
                      className="block"
                      style={imageData.baseImageDimensions ? {
                        width: `${imageData.baseImageDimensions.width * scale}px`,
                        height: `${imageData.baseImageDimensions.height * scale}px`,
                      } : {}}
                    />
                    
                    {imageData.subImages.map(img => (
                      <div
                        key={img.id}
                        className="absolute"
                        style={{
                          left: `${img.x * scale}px`,
                          top: `${img.y * scale}px`,
                          width: `${img.width * scale}px`,
                          height: `${img.height * scale}px`,
                        }}
                      >
                        <img
                          src={img.url}
                          alt=""
                          style={{
                            width: `${img.width * scale}px`,
                            height: `${img.height * scale}px`,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">How to use:</h3>
                <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
                  <li>Upload a JSON file or paste JSON from the Editor page</li>
                  <li>Click "Load from JSON" to display the positioned images</li>
                  <li>Canvas scales to fit the viewport (coordinates remain accurate)</li>
                  <li>Images are displayed at their exact pixel coordinates</li>
                  <li>This page shows the final result of your positioning work</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
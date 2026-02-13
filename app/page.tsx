import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl shadow-2xl p-12 max-w-3xl w-full">
        <h1 className="text-4xl font-bold text-gray-800 mb-4 text-center">
          Image Positioner & Experiment Simulator
        </h1>
        <p className="text-gray-600 mb-8 text-center">
          Position sub-images on a base image and run scientific experiments
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/layout-editor">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl p-8 cursor-pointer transition-all transform hover:scale-105 shadow-lg">
              <h2 className="text-2xl font-bold mb-3">Editor</h2>
              <p className="text-blue-100">
                Position images and get pixel coordinates
              </p>
            </div>
          </Link>
          
          <Link href="/show">
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl p-8 cursor-pointer transition-all transform hover:scale-105 shadow-lg">
              <h2 className="text-2xl font-bold mb-3">Showcase</h2>
              <p className="text-purple-100">
                Display images using saved coordinates
              </p>
            </div>
          </Link>

          <Link href="/exp1">
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl p-8 cursor-pointer transition-all transform hover:scale-105 shadow-lg">
              <h2 className="text-2xl font-bold mb-3">Experiment 1</h2>
              <p className="text-green-100">
                Acetylcholine DRC Simulation
              </p>
            </div>
          </Link>
        </div>

        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-700 mb-2">How it works:</h3>
          <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
            <li>Upload a base image and sub-images in the Editor</li>
            <li>Drag sub-images to position them on the base image</li>
            <li>Use keyboard arrows or input fields for precise positioning</li>
            <li>Set center points for rotation (optional)</li>
            <li>Copy the generated coordinates JSON</li>
            <li>Paste coordinates in the Showcase page to display</li>
            <li>Use Experiment 1 to simulate the Acetylcholine dose-response curve</li>
          </ol>
        </div>
      </div>
    </main>
  )
}
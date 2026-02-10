"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Tooltip from "react-tooltip";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend
);

// SVG Components as fallbacks
const MuscleSVG = ({ contracted = false }: { contracted?: boolean }) => (
  <svg width="120" height="200" viewBox="0 0 120 200" className="mx-auto">
    <rect x="40" y="20" width="40" height={contracted ? 120 : 160} fill="#ff9999" stroke="#cc0000" strokeWidth="4" />
    <text x="60" y="190" fontSize="12" textAnchor="middle">Rectus Abdominis</text>
  </svg>
);

const KymographSVG = () => (
  <svg width="180" height="120" viewBox="0 0 180 120" className="mx-auto">
    <circle cx="90" cy="60" r="50" fill="#8B4513" stroke="#000" strokeWidth="4" />
    <motion.circle
      cx="90" cy="60" r="45"
      fill="url(#paper)"
      animate={{ rotate: 360 }}
      transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
    />
    <defs>
      <pattern id="paper" width="20" height="100" patternUnits="userSpaceOnUse">
        <rect width="20" height="100" fill="#f5f5dc" />
        <line x1="0" y1="0" x2="20" y2="100" stroke="#000" strokeWidth="0.5" opacity="0.3" />
      </pattern>
    </defs>
    {/* Simulate trace */}
    <polyline points="40,80 60,60 80,70 100,50 120,65 140,55" fill="none" stroke="#006400" strokeWidth="3" />
    <text x="90" y="110" fontSize="12" textAnchor="middle">Kymograph Drum</text>
  </svg>
);

const AchVialSVG = () => (
  <svg width="80" height="120" viewBox="0 0 80 120" className="mx-auto">
    <rect x="20" y="20" width="40" height="80" rx="10" fill="#add8e6" stroke="#000" strokeWidth="3" />
    <rect x="30" y="10" width="20" height="10" fill="#808080" />
    <text x="40" y="65" fontSize="10" textAnchor="middle" fill="#000">ACh</text>
    <text x="40" y="100" fontSize="9" textAnchor="middle">Acetylcholine</text>
  </svg>
);

export default function DrcAchExperiment() {
  const [step, setStep] = useState(0); // 0: Setup, 1: Dose Application, 2: Response Recording, 3: Plot DRC
  const [doses, setDoses] = useState<number[]>([]); // Log doses (e.g., -6 to -3)
  const [responses, setResponses] = useState<number[]>([]); // % max contraction
  const [currentDose, setCurrentDose] = useState(-6); // Starting log dose
  const [isAnimating, setIsAnimating] = useState(false);

  // Simulated response (Hill equation)
  const calculateResponse = (logDose: number) => {
    const ec50 = -4.5; // Approx log EC50 for ACh
    const hill = 1;
    return 100 / (1 + Math.pow(10, hill * (ec50 - logDose)));
  };

  const handleAddDose = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setTimeout(() => {
      const response = calculateResponse(currentDose);
      setDoses([...doses, currentDose]);
      setResponses([...responses, response]);
      setCurrentDose(currentDose + 0.5);
      setIsAnimating(false);
    }, 2000);
  };

  const chartData = {
    labels: doses.map((d) => d.toFixed(1)),
    datasets: [
      {
        label: "Dose-Response Curve",
        data: responses,
        borderColor: "rgb(75, 192, 192)",
        tension: 0.1,
      },
    ],
  };

  const steps = [
    {
      title: "Setup the Apparatus",
      content: (
        <div className="flex flex-col items-center">
          <p className="mb-4">Assemble the isolated tissue bath for frog rectus abdominis.</p>
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
            className="relative"
          >
            <img
              src="https://orchidscientific.com/wp-content/uploads/2018/02/isolated-ob-1.jpg"
              alt="Tissue Bath"
              className="w-64"
              data-tip="Aerated bath with Ringer's solution at 25°C."
            />
            <img
              src="https://i.ytimg.com/vi/z8Lmv4jMM1Q/maxresdefault.jpg"
              alt="Muscle"
              className="absolute top-20 left-20 w-32"
              data-tip="Frog rectus abdominis muscle (skeletal, slow-twitch)."
            />
            {/* Lever can be implied in setup image */}
            <img
              src="https://image.slidesharecdn.com/commoninstruments-240527044854-c17fb2b4/75/Common-instruments-used-in-pharmacology-pptx-5-2048.jpg"
              alt="Kymograph"
              className="absolute bottom-10 w-48"
              data-tip="Rotating drum for tracing responses."
            />
          </motion.div>
          <button onClick={() => setStep(1)} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">Proceed to Dosing</button>
        </div>
      ),
    },
    {
      title: "Apply Doses of Acetylcholine",
      content: (
        <div className="flex flex-col items-center">
          <p className="mb-4">Add cumulative doses of ACh (10^-6 to 10^-3 M) and observe contractions.</p>
          <input
            type="range"
            min="-6"
            max="-3"
            step="0.5"
            value={currentDose}
            onChange={(e) => setCurrentDose(parseFloat(e.target.value))}
            className="w-64 mb-4"
            data-tip="Log dose (M). Start low to avoid desensitization."
          />
          <motion.img
            src="https://usmed-media.usamedpremium.com/public/assets/Catalog/Images/USAMP-71966742.webp"
            alt="ACh Vial"
            animate={isAnimating ? { y: [0, -20, 0], rotate: [0, 10, -10, 0] } : {}}
            transition={{ duration: 2 }}
            className="w-32 mb-4"
            data-tip="Acetylcholine: Muscarinic agonist causing contraction via M3 receptors."
            onError={(e) => { e.currentTarget.src = ''; /* Fallback to SVG if image fails */ }}
          />
          {/* Fallback to SVG for muscle animation */}
          <motion.div
            animate={isAnimating ? { scale: [1, 1.2, 1], y: [0, -10, 0] } : {}}
            transition={{ duration: 1.5 }}
          >
            <MuscleSVG contracted={isAnimating} />
          </motion.div>
          <button onClick={handleAddDose} disabled={isAnimating} className="mt-4 px-4 py-2 bg-green-500 text-white rounded">
            {isAnimating ? "Applying Dose..." : "Add Dose"}
          </button>
          <button onClick={() => setStep(2)} disabled={doses.length < 5} className="mt-2 px-4 py-2 bg-blue-500 text-white rounded">Record Responses</button>
        </div>
      ),
    },
    {
      title: "Record and Analyze Responses",
      content: (
        <div className="flex flex-col items-center">
          <p className="mb-4">Trace contractions on the kymograph and measure twitch heights.</p>
          <motion.img
            src="https://image.slidesharecdn.com/commoninstruments-240527044854-c17fb2b4/75/Common-instruments-used-in-pharmacology-pptx-5-2048.jpg"
            alt="Kymograph Recording"
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
            className="w-48 mb-4"
            data-tip="Smoked drum records graded responses."
            onError={(e) => { e.currentTarget.src = ''; /* Fallback */ }}
          />
          {/* SVG fallback */}
          <KymographSVG />
          <button onClick={() => setStep(3)} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">Plot DRC</button>
        </div>
      ),
    },
    {
      title: "Plot Dose-Response Curve",
      content: (
        <div className="flex flex-col items-center w-full max-w-2xl">
          <p className="mb-4">Sigmoidal curve: Response (%) vs. Log Dose (M).</p>
          <Line 
            data={chartData} 
            options={{ 
              responsive: true, 
              scales: { 
                x: { title: { display: true, text: "Log Dose (M)" } }, 
                y: { title: { display: true, text: "% Max Response" } } 
              } 
            }} 
          />
          <p className="mt-4" data-tip="EC50 is the dose producing 50% max response.">Interpret: EC50 ≈ 10^{-4.5} M.</p>
          <button onClick={() => setStep(0)} className="mt-4 px-4 py-2 bg-gray-500 text-white rounded">Reset Experiment</button>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <h1 className="text-3xl font-bold mb-8">DRC for Acetylcholine on Frog Rectus Abdominis</h1>
      {steps[step].content}
      <Tooltip place="top" type="dark" effect="solid" />
    </div>
  );
}
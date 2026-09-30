import React, { useRef, useMemo, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, Center, Environment } from "@react-three/drei";
import * as THREE from "three";
import { Flame, X } from 'lucide-react';

// Helper to Create a Height Map from the Image (Heuristic)
// (Not strictly used if we rely on Texture as height map, but kept for reference)
function generateHeightMap(imageSrc) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = imageSrc;
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, 256, 256);
            const imageData = ctx.getImageData(0, 0, 256, 256);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                data[i] = avg;
                data[i + 1] = avg;
                data[i + 2] = avg;
            }
            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL());
        };
    });
}

function WoundMesh({ originalUrl, thermalUrl, isThermal }) {
    const meshRef = useRef();

    // Always load original texture for Geometry (Displacement)
    const originalTexture = useLoader(THREE.TextureLoader, originalUrl);

    // Load active texture for Color Map
    // Ideally we load both to avoid flicker, but conditional useLoader is tricky.
    // However, useLoader caches results. So we can load both unconditionally? 
    // No, Hooks cannot be conditional.
    // So we must call useLoader for thermalUrl if it exists?
    // Actually, simply:
    const textureUrl = (isThermal && thermalUrl) ? thermalUrl : originalUrl;
    const colorTexture = useLoader(THREE.TextureLoader, textureUrl);

    const materialProps = useMemo(() => ({
        map: colorTexture,
        displacementMap: originalTexture, // Always use original for depth
        displacementScale: 2,
        displacementBias: -0.5,
        roughness: 0.6,
        metalness: 0.1,
    }), [colorTexture, originalTexture]);

    useFrame(() => {
        // meshRef.current.rotation.y += 0.002;
    });

    return (
        <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[10, 10, 256, 256]} />
            <meshStandardMaterial {...materialProps} />
        </mesh>
    );
}

export default function Wound3DViewer({ imageUrl, thermalUrl, initialIsThermal, onClose }) {
    const [isThermal, setIsThermal] = useState(initialIsThermal || false);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
            <div className="w-full max-w-5xl h-[80vh] bg-slate-900 rounded-2xl overflow-hidden relative border border-slate-700 shadow-2xl flex flex-col">
                <div className="absolute top-4 right-4 z-10 flex gap-4">

                    {thermalUrl && (
                        <button
                            onClick={() => setIsThermal(!isThermal)}
                            className={`px-4 py-2 rounded-lg font-bold transition-all shadow-lg flex items-center gap-2 ${isThermal
                                    ? "bg-red-600 text-white shadow-red-900/50 hover:bg-red-700"
                                    : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                                }`}
                        >
                            <Flame className="w-4 h-4" />
                            {isThermal ? "Thermal Model" : "Toggle Thermal"}
                        </button>
                    )}

                    <div className="bg-black/50 text-white px-4 py-2 rounded-lg text-sm backdrop-blur-sm pointer-events-none hidden sm:block">
                        Rotate • Pan • Zoom
                    </div>
                    <button
                        onClick={onClose}
                        className="bg-slate-800 hover:bg-red-600 text-white px-3 py-2 rounded-lg font-bold transition-colors shadow-lg flex items-center justify-center"
                        title="Close 3D View"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 w-full h-full cursor-move">
                    <Canvas camera={{ position: [0, 10, 10], fov: 50 }}>
                        <color attach="background" args={['#0f172a']} />
                        <ambientLight intensity={0.5} />
                        <pointLight position={[10, 10, 10]} intensity={1} />
                        <pointLight position={[-10, 10, -10]} intensity={0.5} />

                        <Center>
                            <React.Suspense fallback={null}>
                                {imageUrl && (
                                    <WoundMesh
                                        originalUrl={imageUrl}
                                        thermalUrl={thermalUrl}
                                        isThermal={isThermal}
                                    />
                                )}
                            </React.Suspense>
                        </Center>

                        <OrbitControls
                            enableDamping
                            autoRotate={false}
                            maxPolarAngle={Math.PI / 2}
                        />
                        <Environment preset="city" />
                    </Canvas>
                </div>

                <div className="bg-slate-800 p-4 border-t border-slate-700 flex justify-between items-center text-slate-300 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span>High (Skin)</span>
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <span>Low (Wound Bed)</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="opacity-50">|</span>
                        <span>Mode: <strong className={isThermal ? "text-red-400" : "text-blue-400"}>{isThermal ? "Thermal Texture" : "Original RGB"}</strong></span>
                    </div>
                </div>
            </div>
        </div>
    );
}

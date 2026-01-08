import React, { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, Center, Environment } from "@react-three/drei";
import * as THREE from "three";

// Helper to Create a Height Map from the Image (Heuristic)
// Wounds are "depressions". Darker areas might be deeper, or we can use the separate mask if available.
// For now, simple luminance-based displacement: Bright = High, Dark = Low?
// Actually, usually wounds are red/dark. Skin is bright.
// So if we invert it: Skin (Bright) -> High Z. Wound (Dark/Red) -> Low Z.
function generateHeightMap(imageSrc) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = imageSrc;
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = 256; // Low res for performance, or 512
            canvas.height = 256;
            const ctx = canvas.getContext("2d");

            // Draw image
            ctx.drawImage(img, 0, 0, 256, 256);
            const imageData = ctx.getImageData(0, 0, 256, 256);
            const data = imageData.data;

            // Process: Convert to Grayscale & Invert?
            // Skin is usually lighter than the wound bed (granulation is red, eschar black).
            // Lighter = Higher (0-255).
            // So White Skin = 255 (High). Red Wound = ~100 (Lower). Black Eschar = 0 (Deepest).
            // This actually works well for a "Crater" effect!

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                // Simple Luminance
                const avg = (r + g + b) / 3;

                // Enhance contrast to make the hole deeper
                // If avg > 150 (Skin), boost to 255.
                // If avg < 100 (Wound), keep low.
                // This is a rough heuristic.

                data[i] = avg;
                data[i + 1] = avg;
                data[i + 2] = avg;
            }

            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL());
        };
    });
}

function WoundMesh({ imageUrl }) {
    const meshRef = useRef();
    // Load Texture
    const colorMap = useLoader(THREE.TextureLoader, imageUrl);

    // We need to generate the displacement map.
    // Since we can't easily rely on async generation inside the render loop without Suspense fallback complexity, 
    // we will just use the color map as displacement map directly for V1.
    // THREE.js parses the Green channel (?) for displacement usually.

    const materialProps = useMemo(() => ({
        map: colorMap,
        displacementMap: colorMap, // Using the image itself as height map
        displacementScale: 2, // Intensity of depth
        displacementBias: -0.5,
        roughness: 0.6,
        metalness: 0.1,
    }), [colorMap]);

    useFrame(() => {
        // meshRef.current.rotation.y += 0.002; // Slow rotate
    });

    return (
        <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
            {/* 256x256 segments for smooth displacement */}
            <planeGeometry args={[10, 10, 256, 256]} />
            <meshStandardMaterial {...materialProps} />
        </mesh>
    );
}

export default function Wound3DViewer({ imageUrl, onClose }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
            <div className="w-full max-w-5xl h-[80vh] bg-slate-900 rounded-2xl overflow-hidden relative border border-slate-700 shadow-2xl flex flex-col">
                <div className="absolute top-4 right-4 z-10 flex gap-4">
                    <div className="bg-black/50 text-white px-4 py-2 rounded-lg text-sm backdrop-blur-sm pointer-events-none">
                        Hint: Left Click to Rotate • Right Click to Pan • Scroll to Zoom
                    </div>
                    <button
                        onClick={onClose}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold transition-colors shadow-lg"
                    >
                        Close 3D View
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
                                {imageUrl && <WoundMesh imageUrl={imageUrl} />}
                            </React.Suspense>
                        </Center>

                        <OrbitControls
                            enableDamping
                            autoRotate={false}
                            maxPolarAngle={Math.PI / 2} // Don't allow going under the ground
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
                    <div>
                        Visualization based on Tissue Luminance
                    </div>
                </div>
            </div>
        </div>
    );
}

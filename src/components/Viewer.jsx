import { Suspense, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Grid, Lightformer, OrbitControls } from '@react-three/drei';

const MOBILE_QUERY = '(max-width: 860px)';

/**
 * Keep the character centred in the part of the screen the glass panels don't cover.
 * The numbers match the panel sizes in styles.css.
 */
function FitToFreeArea() {
  const { camera, size } = useThree();
  useEffect(() => {
    const mobile = window.matchMedia(MOBILE_QUERY).matches;
    const right = mobile ? 0 : 392; // side panel (360) + margins
    const top = mobile ? 64 : 84; // top bar
    const bottom = mobile ? 150 : 112; // player bar (two rows on phones)
    camera.setViewOffset(size.width, size.height, right / 2, (bottom - top) / 2, size.width, size.height);
    // phones: zoom in as far as fits — the character fills ~85% of the free height,
    // while ~2.5 m stays visible across the narrow width (arms out, dance steps)
    const fitHeight = (size.height - top - bottom) / (size.height * 0.66);
    const fitWidth = (1.3 * size.width) / size.height;
    camera.zoom = mobile ? Math.min(fitHeight, fitWidth) : 1;
    camera.updateProjectionMatrix();
    return () => {
      camera.clearViewOffset();
      camera.zoom = 1;
      camera.updateProjectionMatrix();
    };
  }, [camera, size]);
  return null;
}

/** Glowing glass ring under the character. */
function Pedestal() {
  const pulse = useRef();
  useFrame(({ clock }) => {
    pulse.current.material.opacity = 0.45 + Math.sin(clock.elapsedTime * 1.6) * 0.15;
  });
  return (
    <group rotation-x={-Math.PI / 2} position-y={0.003}>
      <mesh>
        <circleGeometry args={[0.72, 96]} />
        <meshBasicMaterial color="#1f6bff" transparent opacity={0.09} depthWrite={false} />
      </mesh>
      <mesh ref={pulse}>
        <ringGeometry args={[0.7, 0.735, 128]} />
        <meshBasicMaterial color="#7fe0ff" transparent opacity={0.45} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh>
        <ringGeometry args={[0.86, 0.868, 128]} />
        <meshBasicMaterial color="#3d8bff" transparent opacity={0.35} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** The 3D stage: camera, lights, floor and orbit controls. Put the character inside it. */
export default function Viewer({ children }) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 1.25, 4.4], fov: 40, near: 0.05, far: 100 }}
    >
      {/* the page's blue background shows through the transparent canvas */}
      <hemisphereLight args={['#cfe6ff', '#0a1a3a', 0.7]} />
      <directionalLight
        position={[3, 5, 4]}
        intensity={2.2}
        color="#f2f8ff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-2.5}
        shadow-camera-right={2.5}
        shadow-camera-top={2.5}
        shadow-camera-bottom={-1}
      />
      <directionalLight position={[-3, 3, -4]} intensity={2.4} color="#5fc8ff" /> {/* cyan rim light */}
      <directionalLight position={[-4, 2, 2]} intensity={0.8} color="#3b6dff" />

      {/* soft blue reflections, generated locally (no download) */}
      <Environment resolution={256} frames={1}>
        <Lightformer intensity={2} color="#9fd8ff" position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} />
        <Lightformer intensity={1.4} color="#3d7bff" position={[-5, 1, 0]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer intensity={1.4} color="#7fe3ff" position={[5, 1, 0]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} />
      </Environment>

      <Suspense fallback={null}>{children}</Suspense>

      <Pedestal />
      <ContactShadows position={[0, 0.001, 0]} color="#000a26" opacity={0.6} scale={8} blur={2.4} far={2.5} />
      <Grid
        infiniteGrid
        cellSize={0.25}
        sectionSize={1}
        cellThickness={0.6}
        sectionThickness={1}
        cellColor="#173a73"
        sectionColor="#2f74e0"
        fadeDistance={18}
        fadeStrength={1.4}
      />
      <OrbitControls makeDefault target={[0, 0.92, 0]} enableDamping minDistance={1.2} maxDistance={8} maxPolarAngle={Math.PI / 2 - 0.05} />
      <FitToFreeArea />
    </Canvas>
  );
}

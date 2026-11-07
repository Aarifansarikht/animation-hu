import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF } from '@react-three/drei';
import { createRetargetTarget } from '../lib/retarget';
import { loadAnimationFile } from '../lib/loadAnimationFile';

const FADE_SECONDS = 0.4;

// Fitted clips per model + file, so switching back to a model doesn't load its files again.
const clipCache = new Map(); // `${model url}|${animation id}` → Promise<AnimationClip>

/** Height of the model in its rest pose (skinned vertices included). */
function measureHeight(scene) {
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene, true);
  return box.isEmpty() ? 0 : box.max.y - box.min.y;
}

/**
 * The animated character.
 *
 * @param model        entry to show (from src/models.js)
 * @param animation    entry to play (from src/animations.js)
 * @param replayKey    change it to restart the current animation
 * @param paused       freeze the animation
 * @param speed        playback speed multiplier
 * @param progressRef  optional DOM element whose width shows the clip progress
 * @param onStatus     called with { loading: true }, { error } or null for file animations
 * @param onModelInfo  called with { bones, height, hasOwnAnimation } once the model is loaded
 */
export default function Character({ model, animation, replayKey, paused, speed, progressRef, onStatus, onModelInfo }) {
  const group = useRef();
  const { scene, animations: modelClips } = useGLTF(model.url);

  // The character's rest pose, recorded the first time we see it (before anything animates it).
  // Needed to fit the animation files (FBX / GLB) to this skeleton.
  scene.userData.retargetTarget ??= createRetargetTarget(scene);
  scene.userData.height ??= measureHeight(scene);
  const target = scene.userData.retargetTarget;

  // The model's own animation, if it has a real one (some files only carry a single-frame pose).
  const ownClip = useMemo(() => modelClips.find((c) => c.duration > 0 && c.tracks.length > 0), [modelClips]);

  // Clips loaded from animation files (each file is loaded the first time it is selected).
  const [fileClips, setFileClips] = useState([]);
  const [fileErrors, setFileErrors] = useState({});
  const fileLoads = useRef(new Set());

  // The model's own clip is exposed as "original"; the rest come from the animation files.
  const clips = useMemo(() => {
    if (!ownClip) return fileClips;
    const original = ownClip.clone();
    original.name = 'original';
    return [original, ...fileClips];
  }, [ownClip, fileClips]);

  const { actions, mixer } = useAnimations(clips, group);

  useEffect(() => {
    scene.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true;
        object.frustumCulled = false; // skinned meshes move outside their original bounds
      }
    });
    onModelInfo?.({ bones: target.bones.length, height: scene.userData.height, hasOwnAnimation: Boolean(ownClip) });
  }, [scene, target, ownClip, onModelInfo]);

  // Put the skeleton back in its rest pose when this model is swapped out.
  useEffect(() => () => mixer.stopAllAction(), [mixer]);

  // Load a file animation when it is selected for the first time.
  useEffect(() => {
    if (!animation.url || fileLoads.current.has(animation.id)) return;
    fileLoads.current.add(animation.id);
    const key = `${model.url}|${animation.id}`;
    if (!clipCache.has(key)) clipCache.set(key, loadAnimationFile(animation, target));
    clipCache
      .get(key)
      .then((clip) => setFileClips((list) => [...list, clip]))
      .catch((error) => {
        clipCache.delete(key);
        console.error(error);
        setFileErrors((errors) => ({ ...errors, [animation.id]: error.message }));
      });
  }, [animation, model.url, target]);

  // Tell the UI whether the selected file animation is still loading or failed.
  const isLoading = Boolean(animation.url) && !fileClips.some((c) => c.name === animation.id) && !fileErrors[animation.id];
  const error = fileErrors[animation.id];
  useEffect(() => {
    onStatus?.(error ? { error: `Could not use "${animation.label}": ${error}` } : isLoading ? { loading: true } : null);
  }, [onStatus, isLoading, error, animation]);

  // Play the selected animation, cross-fading from the one that was playing before.
  const current = useRef({ action: null, replayKey: null });
  useEffect(() => {
    const previous = current.current;

    // "Original" on a model without its own animation: fade back to the rest pose.
    if (animation.id === 'original' && !actions.original) {
      previous.action?.fadeOut(FADE_SECONDS);
      current.current = { action: null, replayKey };
      return;
    }

    const next = actions[animation.id];
    if (!next) return; // a file animation that is still loading: keep the previous one playing
    if (next === previous.action && replayKey === previous.replayKey) return; // already playing

    const playOnce = animation.loop === 'once';
    next.setLoop(playOnce ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = playOnce; // hold the last pose of one-shot clips

    if (next === previous.action) {
      next.reset().play(); // replay
    } else {
      next.reset().fadeIn(FADE_SECONDS).play();
      previous.action?.fadeOut(FADE_SECONDS);
    }
    current.current = { action: next, replayKey };
  }, [actions, animation, replayKey]);

  useEffect(() => {
    mixer.timeScale = paused ? 0 : speed;
  }, [mixer, paused, speed]);

  // Drive the progress bar directly (no React re-render every frame).
  useFrame(() => {
    if (!progressRef?.current) return;
    const action = current.current.action;
    const progress = action ? action.time / action.getClip().duration : 0;
    progressRef.current.style.transform = `scaleX(${THREE.MathUtils.clamp(progress, 0, 1)})`;
  });

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  );
}

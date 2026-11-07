import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { retargetClip } from './retarget.js';

// Only the movement is needed, so any texture an FBX file points to is replaced by an empty image
// (avoids 404 errors for Mixamo files downloaded "with skin").
const EMPTY_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const manager = new THREE.LoadingManager();
manager.setURLModifier((url) => (/\.(png|jpe?g|tga|bmp|gif|webp|dds|tiff?)$/i.test(url) ? EMPTY_IMAGE : url));

const fbxLoader = new FBXLoader(manager);
const gltfLoader = new GLTFLoader(manager); // own manager: animation files don't trigger the full-screen model loader

/** Load a file and return its skeleton (root object) and animation clips. */
async function loadFile(animation) {
  if (animation.format === 'glb') {
    const gltf = await gltfLoader.loadAsync(animation.url);
    return { root: gltf.scene, clips: gltf.animations };
  }
  const fbx = await fbxLoader.loadAsync(animation.url);
  return { root: fbx, clips: fbx.animations };
}

/**
 * Load an animation file (.fbx or .glb) and fit its animation to the character.
 * @param animation  entry from src/animations.js ({ id, url, format })
 * @param target     createRetargetTarget(character) — the character's rest pose
 * @returns an AnimationClip named `animation.id`
 */
export async function loadAnimationFile(animation, target) {
  const { root, clips } = await loadFile(animation);
  const clip = clips.find((c) => c.tracks.length > 0 && c.duration > 0);
  if (!clip) throw new Error('no animation found in this file');

  const fitted = retargetClip({ target, sourceRoot: root, clip, name: animation.id });
  if (!fitted) throw new Error("its skeleton doesn't match the character (bone names not recognised)");
  return fitted;
}

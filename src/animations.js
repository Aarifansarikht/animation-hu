/**
 * Every animation in the app = the clip inside the model + every .fbx / .glb file in src/assets/animations/.
 *
 * Add an animation by dropping a file (e.g. FBX from Mixamo, or a GLB exported from Blender)
 * into src/assets/animations/. One file = one animation (the first clip in the file).
 *
 *   src/assets/animations/dance/Hip Hop.fbx       →  "Hip Hop" in the Dance tab
 *   src/assets/animations/action/Jump (once).glb  →  "Jump" in Actions, plays one time
 *   src/assets/animations/Wave.glb                →  "Wave" in the My Files tab
 *
 * Subfolders that become tabs: idle, move, gesture, action, dance.
 */

export const CATEGORIES = [
  { id: 'idle', label: 'Idle' },
  { id: 'move', label: 'Walk & Run' },
  { id: 'gesture', label: 'Gestures' },
  { id: 'action', label: 'Actions' },
  { id: 'dance', label: 'Dance' },
  { id: 'custom', label: 'My Files' }, // files placed directly in src/assets/animations/
];

// Vite finds the files when the app starts; each entry is the file's URL.
const animationFiles = import.meta.glob('./assets/animations/**/*.{fbx,FBX,glb,GLB}', {
  query: '?url',
  import: 'default',
  eager: true,
});

const fileAnimations = Object.entries(animationFiles)
  .map(([path, url]) => {
    const parts = path.replace('./assets/animations/', '').split('/');
    const fileName = parts.pop();
    const folder = (parts[0] || '').toLowerCase();
    const format = fileName.split('.').pop().toLowerCase(); // 'fbx' or 'glb'
    const name = fileName.replace(/\.(fbx|glb)$/i, '');

    return {
      id: path,
      label: name.replace(/\(once\)/i, '').trim(),
      from: `${format.toUpperCase()} file`,
      category: CATEGORIES.some((c) => c.id === folder) ? folder : 'custom',
      loop: /\(once\)/i.test(name) ? 'once' : 'repeat',
      format,
      url, // loaded the first time it is selected (see components/Character.jsx)
    };
  })
  .sort((a, b) => a.label.localeCompare(b.label));

export const ANIMATIONS = [
  { id: 'original', label: 'Original', from: 'Your model', category: 'idle' }, // the clip inside the model's own .glb
  ...fileAnimations,
];

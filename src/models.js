/**
 * Every character model in the app = every .glb file in src/assets/models/.
 * The file name is the button label: Human.glb → "Human".
 *
 * Models need a Mixamo skeleton (bones named mixamorig:Hips, mixamorig:LeftArm, …)
 * so the animation files fit them.
 */

// Vite finds the files when the app starts; each entry is the file's URL.
const modelFiles = import.meta.glob('./assets/models/*.glb', { query: '?url', import: 'default', eager: true });

export const MODELS = Object.entries(modelFiles).map(([path, url]) => {
  const name = path.split('/').pop().replace('.glb', '');
  return { id: name, label: name.replace(/_/g, ' '), url };
});

/** The model shown when the app opens. */
export const DEFAULT_MODEL_ID = 'Human';

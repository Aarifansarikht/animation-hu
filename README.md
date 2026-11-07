# Human Animation Studio

Pick an animation and watch the character perform it. Built with three.js, React and react-three-fiber. Animations come from FBX or GLB files.

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # production build → dist/ (models and animation files are included)
```

## Adding a model

Drop a `.glb` into `src/assets/models/` and reload. It gets its own button in the **Model** switch at the top left (named after the file, e.g. `Human.glb` → "Human").
It should have a Mixamo skeleton (bones named `mixamorig:Hips`, `mixamorig:LeftArm`, …) so the animation files fit it.
If the model has its own animation it is listed as **Original**; otherwise that card shows the model's **Rest pose**.
The model opened by default is set in `src/models.js` (`DEFAULT_MODEL_ID`).

## Adding an animation

Drop an `.fbx` or `.glb` file into `src/assets/animations/` and reload the app. One file = one animation.

```
src/assets/animations/
  dance/Hip Hop Dancing.fbx     → "Hip Hop Dancing" in the Dance tab
  action/Jump (once).glb        → "Jump" in Actions, plays one time
  Wave.glb                      → "Wave" in the My Files tab
```

- Subfolders that become tabs: `idle`, `move`, `gesture`, `action`, `dance`. Anything else goes to **My Files**.
- Add `(once)` to the file name to play it once instead of looping.
- To remove an animation, delete the file.
- From Mixamo, download **FBX Binary, Without Skin, 30 fps**, and tick **In Place** for walks and runs.

### Exporting a GLB animation from Blender

GLB is the better format for the web (the Samba GLB is 0.5 MB, the same FBX is 3.7 MB).

1. Import or create the animation on a Mixamo skeleton (bone names `mixamorig:Hips`, `mixamorig:LeftArm`, …).
2. Select only the armature, then **File → Export → glTF 2.0**:
   - Format: **glTF Binary (.glb)**
   - Include → **Limit to Selected Objects**
   - Animation → on, and **Set all glTF Animation starting at 0** (otherwise the animation starts one frame late)
3. Put the `.glb` in `src/assets/animations/`. Only the first animation in the file is used.

## How it works

```
src/
  assets/models/              the character models (.glb)
  assets/animations/          the FBX / GLB animation files
  models.js                   finds the model files and names them
  animations.js               finds the animation files (Vite import.meta.glob) and lists them with categories
  App.jsx                     state: selected model, selected animation, paused, speed
  lib/
    loadAnimationFile.js      loads a file with three.js FBXLoader or GLTFLoader
    retarget.js               fits the animation to the character's skeleton
  components/
    Character.jsx             loads a file the first time it is selected, plays it (drei useAnimations + cross-fade)
    Viewer.jsx                canvas, lights, floor, glowing ring, orbit camera
    ModelPicker.jsx           top-left buttons to switch models
    AnimationPicker.jsx       glass side panel with search and category tabs
    NowPlaying.jsx            bottom bar: progress, play/pause, replay, speed, loading status
    Icon.jsx                  small SVG icons
```

When you select a file animation for the first time:

1. `FBXLoader` or `GLTFLoader` loads the file.
2. `retarget.js` fits its movement to the character. Bones match by Mixamo name, but the file's skeleton can have a different rotation, scale and proportions than the character, so each frame is converted rather than copied as-is.
3. The clip is added to the character's other clips and cross-fades in.

Bones are matched by Mixamo name. A file made for another skeleton shows "skeleton doesn't match" in the bottom bar: rename its bones to Mixamo names in Blender (or retarget it there) first.

`Samba Dancing.fbx` and `Mixamo Dance.fbx` are Mixamo animations from the three.js examples.

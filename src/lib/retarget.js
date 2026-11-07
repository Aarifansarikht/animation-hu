import * as THREE from 'three';

/**
 * Retargets an animation from one humanoid skeleton onto another.
 *
 * For every frame the source clip is played on its own skeleton, and each mapped bone's
 * world-space rotation change (relative to its rest pose) is copied onto the target bone:
 *
 *   W_target(t) = Y · ΔW_source(t) · Y⁻¹ · R_align · W_target_rest
 *
 *   Y        turns the source character to face the same way as the target
 *   R_align  lines up rest-pose bone directions (e.g. A-pose source → T-pose target)
 *
 * Local rotations are then rebuilt parent-first. Unmapped target bones keep their rest pose.
 */

const UP = new THREE.Vector3(0, 1, 0);

/** Bones are matched by Mixamo name: "mixamorig:LeftArm", "mixamorigLeftArm", "mixamorig1:LeftArm" → "LeftArm" */
const boneKey = (name) => name.replace(/^mixamorig\d*[:_]?/i, '');

/**
 * The joint each bone points at — used to line up rest-pose bone directions.
 * Collarbones are left out on purpose: they are too short and too differently built across
 * characters (some point steeply down), so only their motion is copied.
 */
const AIM = { Spine: 'Spine1', Spine1: 'Spine2', Spine2: 'Neck', Neck: 'Head' };
for (const s of ['Left', 'Right']) {
  Object.assign(AIM, {
    [`${s}Arm`]: `${s}ForeArm`, [`${s}ForeArm`]: `${s}Hand`,
    [`${s}Hand`]: `${s}HandMiddle1`, [`${s}UpLeg`]: `${s}Leg`, [`${s}Leg`]: `${s}Foot`, [`${s}Foot`]: `${s}ToeBase`,
  });
  for (const f of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) {
    AIM[`${s}Hand${f}1`] = `${s}Hand${f}2`;
    AIM[`${s}Hand${f}2`] = `${s}Hand${f}3`;
  }
}

/**
 * A direction alone leaves a bone free to roll around it. For hands the roll matters (it decides
 * where the palm and thumb face), so they also match the line across the knuckles.
 */
const ACROSS = {
  LeftHand: ['LeftHandIndex1', 'LeftHandRing1'],
  RightHand: ['RightHandIndex1', 'RightHandRing1'],
};

// Read world transforms straight from matrixWorld. Callers update the whole hierarchy once
// (root.updateMatrixWorld(true)) before reading, which is much faster than getWorldPosition().
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();
const worldPos = (o) => new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
const worldQuat = (o) => {
  const q = new THREE.Quaternion();
  o.matrixWorld.decompose(_pos, q, _scale);
  return q;
};

/** Orientation whose x-axis is `along` and whose xy-plane contains `across`. */
function frame(along, across) {
  const x = along.clone().normalize();
  const z = new THREE.Vector3().crossVectors(x, across).normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/** Rotation that turns the frame (fromAlong, fromAcross) onto the frame (toAlong, toAcross). */
const frameRotation = (fromAlong, fromAcross, toAlong, toAcross) =>
  frame(toAlong, toAcross).multiply(frame(fromAlong, fromAcross).invert());

/** Snapshot of the target skeleton's rest pose. Call before any animation touches it. */
export function createRetargetTarget(root) {
  root.updateMatrixWorld(true);
  const bones = [];
  root.traverse((o) => o.isBone && bones.push(o));
  const rest = new Map(
    bones.map((b) => [
      b,
      {
        localQ: b.quaternion.clone(),
        worldQ: worldQuat(b),
        worldPos: worldPos(b),
        parentWorldQ: worldQuat(b.parent),
        parentWorldInv: b.parent.matrixWorld.clone().invert(),
      },
    ]),
  );
  return { bones, byKey: new Map(bones.map((b) => [boneKey(b.name), b])), rest };
}

/** Find the source bone for each target bone (same Mixamo name). The first bone with a name wins, like three.js does. */
function mapSourceBones(sourceRoot, target) {
  const map = new Map(); // key → source bone
  sourceRoot.traverse((o) => {
    const key = o.isBone && boneKey(o.name);
    if (key && target.byKey.has(key) && !map.has(key)) map.set(key, o);
  });
  return map;
}

/** Yaw angle a character faces, measured from its shoulders (or hips). */
function facingAngle(getPos) {
  const left = getPos('LeftArm') || getPos('LeftUpLeg');
  const right = getPos('RightArm') || getPos('RightUpLeg');
  if (!left || !right) return 0;
  const forward = new THREE.Vector3().crossVectors(UP, right.sub(left).setY(0).normalize());
  return Math.atan2(forward.x, forward.z);
}

/**
 * Times to sample: the source's own keyframe times (so playback reproduces it exactly),
 * falling back to a fixed rate. Always starts at 0 and ends exactly at the clip duration.
 */
function sampleTimes(clip, fps) {
  const keys = new Set();
  for (const track of clip.tracks) for (const t of track.times) if (t >= 0 && t <= clip.duration) keys.add(Math.round(t * 1e5) / 1e5);
  let times = [...keys].sort((a, b) => a - b);
  if (times.length < 2) times = Array.from({ length: Math.ceil(clip.duration * fps - 1e-6) + 1 }, (_, i) => Math.min(i / fps, clip.duration));
  if (times[0] > 0) times.unshift(0);
  if (times[times.length - 1] < clip.duration - 1e-5) times.push(clip.duration);
  return Float32Array.from(times);
}

/**
 * Fit `clip` (played on `sourceRoot`, the skeleton from the animation file) to the target character.
 * Returns a new AnimationClip for the character, or null if the skeletons don't match.
 */
export function retargetClip({ target, sourceRoot, clip, name = clip.name, fps = 30 }) {
  const map = mapSourceBones(sourceRoot, target);
  if (map.size < 5 || !map.has('Hips')) return null;

  // remember the source's rest pose so it can be restored afterwards (sources are reused per clip)
  const restSnapshot = [];
  sourceRoot.traverse((o) => restSnapshot.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]));
  sourceRoot.updateMatrixWorld(true);

  // Y: turn the source so it faces the same way as the target
  const srcFacing = facingAngle((k) => map.get(k) && worldPos(map.get(k)));
  const tgtFacing = facingAngle((k) => target.byKey.get(k) && target.rest.get(target.byKey.get(k)).worldPos.clone());
  const Y = new THREE.Quaternion().setFromAxisAngle(UP, tgtFacing - srcFacing);
  const facingPos = (o) => worldPos(o).applyQuaternion(Y);

  // source rest pose (facing-corrected)
  const srcRestInv = new Map(); // (Y · W_rest)⁻¹
  const srcRestPos = new Map();
  for (const sb of map.values()) {
    srcRestInv.set(sb, Y.clone().multiply(worldQuat(sb)).invert());
    srcRestPos.set(sb, facingPos(sb));
  }

  // per bone: the joint it points at, its rest direction, and R_align
  const aimOf = new Map(); // key → aim key
  const restDir = new Map(); // key → target rest bone direction (world, unit)
  const acrossOf = new Map(); // key → [a, b] knuckle keys (hands only)
  const restAcross = new Map(); // key → target rest knuckle line (world)
  const align = new Map(); // key → R_align
  const tgtRestPos = (k) => target.rest.get(target.byKey.get(k)).worldPos.clone();
  for (const [key, sb] of map) {
    let aim = AIM[key];
    while (aim && !map.has(aim)) aim = AIM[aim];
    const R = new THREE.Quaternion();
    if (aim) {
      const dT = tgtRestPos(aim).sub(tgtRestPos(key));
      const dS = srcRestPos.get(map.get(aim)).clone().sub(srcRestPos.get(sb));
      if (dT.lengthSq() > 1e-10 && dS.lengthSq() > 1e-10) {
        R.setFromUnitVectors(dT.normalize(), dS.normalize());
        aimOf.set(key, aim);
        restDir.set(key, dT);

        const across = ACROSS[key];
        if (across && across.every((k) => map.has(k))) {
          const aT = tgtRestPos(across[0]).sub(tgtRestPos(across[1]));
          const aS = srcRestPos.get(map.get(across[0])).clone().sub(srcRestPos.get(map.get(across[1])));
          R.copy(frameRotation(dT, aT, dS, aS));
          acrossOf.set(key, across);
          restAcross.set(key, aT);
        }
      }
    }
    align.set(key, R);
  }

  // scale root motion by leg length (hip height above the ankle)
  const tHips = target.byKey.get('Hips');
  const tFoot = target.byKey.get('LeftFoot');
  const sHips = map.get('Hips');
  const sFoot = map.get('LeftFoot');
  const tLeg = tFoot ? target.rest.get(tHips).worldPos.y - target.rest.get(tFoot).worldPos.y : 0;
  const sLeg = sFoot ? srcRestPos.get(sHips).y - srcRestPos.get(sFoot).y : 0;
  const scale = tLeg > 1e-6 && sLeg > 1e-6 ? tLeg / sLeg : 1;

  // play the source clip frame by frame
  const mixer = new THREE.AnimationMixer(sourceRoot);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();

  const times = sampleTimes(clip, fps);
  const frames = times.length;
  const mappedBones = target.bones.filter((b) => map.has(boneKey(b.name)));
  const rotations = new Map(mappedBones.map((b) => [b, new Float32Array(frames * 4)]));
  const hipPath = [];
  let ground = Infinity;

  const worldQ = new Map();
  const delta = new THREE.Quaternion();
  const local = new THREE.Quaternion();
  const swing = new THREE.Quaternion();

  for (let f = 0; f < frames; f++) {
    mixer.setTime(times[f]);
    sourceRoot.updateMatrixWorld(true);

    for (const tb of target.bones) {
      const rest = target.rest.get(tb);
      const parentW = tb.parent.isBone ? worldQ.get(tb.parent) : rest.parentWorldQ;
      const key = boneKey(tb.name);
      const sb = map.get(key);
      if (!sb) {
        worldQ.set(tb, parentW.clone().multiply(rest.localQ));
        continue;
      }
      delta.copy(Y).multiply(worldQuat(sb)).multiply(srcRestInv.get(sb)).multiply(align.get(key)); // ΔW · R_align
      const w = delta.clone().multiply(rest.worldQ);

      // Stretchy (cartoon) rigs move joints by translation too, so rotation alone
      // can miss. Swing the bone so it points exactly where the source bone points.
      const aim = aimOf.get(key);
      const across = acrossOf.get(key);
      if (aim) {
        const actual = facingPos(map.get(aim)).sub(facingPos(sb));
        const predicted = restDir.get(key).clone().applyQuaternion(delta);
        if (across) {
          // hands: match direction and roll
          const actualAcross = facingPos(map.get(across[0])).sub(facingPos(map.get(across[1])));
          const predictedAcross = restAcross.get(key).clone().applyQuaternion(delta);
          w.premultiply(frameRotation(predicted, predictedAcross, actual, actualAcross));
        } else if (actual.lengthSq() > 1e-12) {
          w.premultiply(swing.setFromUnitVectors(predicted, actual.normalize()));
        }
      }
      local.copy(parentW).invert().multiply(w).normalize();
      local.toArray(rotations.get(tb), f * 4);
      worldQ.set(tb, w);
    }
    hipPath.push(facingPos(sHips));
    for (const k of ['LeftFoot', 'RightFoot']) if (map.has(k)) ground = Math.min(ground, worldPos(map.get(k)).y);
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(sourceRoot);
  for (const [o, p, q, s] of restSnapshot) {
    o.position.copy(p);
    o.quaternion.copy(q);
    o.scale.copy(s);
  }
  sourceRoot.updateMatrixWorld(true);

  const tracks = [];
  for (const [bone, v] of rotations) {
    // keep neighbouring quaternions in the same hemisphere so interpolation takes the short path
    for (let i = 4; i < v.length; i += 4) {
      if (v[i] * v[i - 4] + v[i + 1] * v[i - 3] + v[i + 2] * v[i - 2] + v[i + 3] * v[i - 1] < 0)
        for (let k = 0; k < 4; k++) v[i + k] = -v[i + k];
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, v));
  }

  // hips position: horizontal travel relative to frame 0, height measured above the ground
  const rest = target.rest.get(tHips);
  const tGround = tFoot ? target.rest.get(tFoot).worldPos.y : 0;
  if (!Number.isFinite(ground)) ground = srcRestPos.get(sHips).y - sLeg;
  const positions = new Float32Array(frames * 3);
  const p = new THREE.Vector3();
  hipPath.forEach((h, f) => {
    p.set(
      rest.worldPos.x + (h.x - hipPath[0].x) * scale,
      tGround + (h.y - ground) * scale,
      rest.worldPos.z + (h.z - hipPath[0].z) * scale,
    )
      .applyMatrix4(rest.parentWorldInv)
      .toArray(positions, f * 3);
  });
  tracks.push(new THREE.VectorKeyframeTrack(`${tHips.name}.position`, times, positions));

  return new THREE.AnimationClip(name, clip.duration, tracks);
}

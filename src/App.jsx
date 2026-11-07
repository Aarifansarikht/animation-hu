import { useMemo, useRef, useState } from 'react';
import { Loader, useGLTF } from '@react-three/drei';
import { ANIMATIONS } from './animations';
import { DEFAULT_MODEL_ID, MODELS } from './models';
import Viewer from './components/Viewer';
import Character from './components/Character';
import ModelPicker from './components/ModelPicker';
import AnimationPicker from './components/AnimationPicker';
import NowPlaying from './components/NowPlaying';

const findModel = (id) => MODELS.find((m) => m.id === id);
useGLTF.preload((findModel(DEFAULT_MODEL_ID) ?? MODELS[0]).url);

// Colours of drei's full-screen loader (shown while a model downloads).
const LOADER_STYLES = {
  containerStyles: { background: 'radial-gradient(circle at 50% 40%, #0b2a63, #020814 70%)' },
  innerStyles: { width: 220, height: 4, borderRadius: 4, background: 'rgba(160, 210, 255, 0.15)' },
  barStyles: { height: 4, borderRadius: 4, background: 'linear-gradient(90deg, #6fe1ff, #3da2ff)' },
  dataStyles: { color: '#bfe3ff', fontFamily: 'inherit', fontSize: 13 },
};

export default function App() {
  const [modelId, setModelId] = useState(findModel(DEFAULT_MODEL_ID) ? DEFAULT_MODEL_ID : MODELS[0].id);
  const [modelInfo, setModelInfo] = useState(null); // { bones, height, hasOwnAnimation }
  const [selectedId, setSelectedId] = useState('original');
  const [replayKey, setReplayKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [fileStatus, setFileStatus] = useState(null); // { loading } | { error } | null
  const [listOpen, setListOpen] = useState(false); // phones: animation list bottom sheet
  const progressRef = useRef(null);

  const model = findModel(modelId);

  // "Original" is the model's own animation — or its rest pose if it has none.
  const animations = useMemo(
    () =>
      ANIMATIONS.map((a) => {
        if (a.id !== 'original') return a;
        if (modelInfo && !modelInfo.hasOwnAnimation) return { ...a, label: 'Rest pose', from: 'No built-in animation' };
        return { ...a, from: "Model's own animation" };
      }),
    [modelInfo],
  );
  const animation = animations.find((a) => a.id === selectedId);

  // Selecting an animation plays it; selecting the current one again restarts it.
  const play = (id) => {
    setSelectedId(id);
    setReplayKey((k) => k + 1);
    setPaused(false);
  };

  const chooseModel = (id) => {
    setModelId(id);
    setModelInfo(null);
    setFileStatus(null);
  };

  return (
    <div className="app">
      <div className="backdrop" aria-hidden="true">
        <span className="blob b1" />
        <span className="blob b2" />
        <span className="blob b3" />
      </div>

      <main className="stage">
        <Viewer>
          <Character
            key={model.id} // a fresh character (and fresh clips) for every model
            model={model}
            animation={animation}
            replayKey={replayKey}
            paused={paused}
            speed={speed}
            progressRef={progressRef}
            onStatus={setFileStatus}
            onModelInfo={setModelInfo}
          />
        </Viewer>
      </main>
      <Loader {...LOADER_STYLES} />

      <header className="topbar">
        <div className="brand glass">
          <span className="brand-orb" />
          <span className="brand-text">
            <span className="brand-name">Animation Studio</span>
            <span className="brand-sub">three.js · React</span>
          </span>
        </div>
        <ModelPicker models={MODELS} model={model} info={modelInfo} onSelect={chooseModel} />
      </header>

      <NowPlaying
        animation={animation}
        status={fileStatus}
        paused={paused}
        speed={speed}
        progressRef={progressRef}
        onTogglePause={() => setPaused((p) => !p)}
        onReplay={() => play(selectedId)}
        onSpeed={setSpeed}
        onOpenList={() => setListOpen(true)}
      />

      <div className={`sheet-backdrop${listOpen ? ' open' : ''}`} onClick={() => setListOpen(false)} />
      <AnimationPicker
        animations={animations}
        selectedId={selectedId}
        onSelect={(id) => {
          play(id);
          setListOpen(false); // close the sheet so the character is visible again
        }}
        open={listOpen}
        onClose={() => setListOpen(false)}
      />
    </div>
  );
}

// Color conversion utilities
window.CGL = window.CGL || {};
window.CGL.colorConvert = function() {
  const canvas = document.createElement('canvas');
  canvas.height = 1;
  canvas.width = 1;
  const ctx = canvas.getContext('2d');

  const mixBlendColors = function(color1, color2, weight, compositeOperation) {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = color1;
    ctx.fillRect(0, 0, 1, 1);

    ctx.globalAlpha = weight;
    ctx.globalCompositeOperation = compositeOperation || 'source-over';
    ctx.fillStyle = color2;
    ctx.fillRect(0, 0, 1, 1);

    let [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    a = a / 255;
    return `rgba(${r},${g},${b},${a})`;
  };

  const opacity = function(color, opacity) {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';

    ctx.globalAlpha = opacity;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);

    let [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    a = a / 255;
    return `rgba(${r},${g},${b},${a})`;
  };

  return {
    mixBlendColors,
    opacity
  };
}();

// Default state
let settings = {
  background: '#111',
  rotationX: 30,
  treeShape: 'linear'
}
let chains = [
  { bulbRadius: 2, bulbsCount: 100, endColor: "#FFC", glowOffset: 0, opacity: 1, startAngle: 0, startColor: "#FFC", turnsCount: 14},
  { bulbRadius: 50, bulbsCount: 20, endColor: "#0FF", glowOffset: 0, opacity: 0.3, startAngle: 120, startColor: "#FF0", turnsCount: 3},
  { bulbRadius: 12, bulbsCount: 50, endColor: "#FF0", glowOffset: 0, opacity: 0.68, startAngle: 240, startColor: "#0FF", turnsCount: -3}
];


// Global vars
const pixelRatio = window.devicePixelRatio;
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let gui = null;
let guiFirstFolder = null;
let guiLastFolder = null;
let rotationZ = 0;


// Predefined easing functions (avoid eval in render loop)
const easingMap = {
  linear: t => t,
  easeInQuad: t => t * t,
  easeOutQuad: t => t * (2 - t),
  easeInOutQuad: t => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: t => t * t * t
};

// Customisation via dat.GUI
function getRandomChain() {
  return {
    bulbsCount: Math.round(Math.random() * (100 - 10) + 10),
    bulbRadius: Math.round(Math.random() * (20 - 1) + 1),
    glowOffset: Math.random() < 0.5 ? 0 : Math.round(Math.random() * (20 - 10) + 10),
    turnsCount: Math.round(Math.random() * (10 - 3) + 3) * (Math.random() < 0.5 ? -1 : 1),
    startAngle: Math.round(Math.random() * 360),
    startColor: '#FF0',
    endColor: '#0FF',
    opacity: Math.round(Math.random() * (100 - 60) + 60) / 100
  };
}

const guiMethods = {
  'ADD CHAIN': () => {
    chains.push(getRandomChain());
    updateDatGui();
    guiLastFolder.open();
  },
  'REMOVE CHAIN': null,
  removeChain: () => {
    const index = guiMethods['REMOVE CHAIN'];
    if (!Number.isNaN(parseInt(index))) {
      chains.splice(index, 1);
      guiMethods['REMOVE CHAIN'] = null;
      updateDatGui();
    }
  }
};

function updateDatGui() {
  if (gui) {
    gui.destroy();
  }
  gui = new dat.GUI();
  
  chains.forEach((chain, i) => {
    const guiChain = gui.addFolder('Chain ' + (i+1));
    guiChain.add(chains[i], 'bulbsCount', 10, 500, 1);
    guiChain.add(chains[i], 'bulbRadius', 1, 100, 1);
    guiChain.add(chains[i], 'glowOffset', 0, 100, 1);
    guiChain.add(chains[i], 'turnsCount', -50, 50, 1);
    guiChain.add(chains[i], 'startAngle', 0, 360, 1);
    guiChain.addColor(chains[i], 'startColor');
    guiChain.addColor(chains[i], 'endColor');
    guiChain.add(chains[i], 'opacity', 0, 1, .01);
    if (i === 0) {
      guiFirstFolder = guiChain;
    } else if (i === chains.length - 1) {
      guiLastFolder = guiChain;
    }
  });
  
  let folders = {};
  chains.forEach((chain, i) => folders[`Chain ${i+1}`] = i);
  const shapes = {
    linear: 'linear',
    easeInQuad: 'easeInQuad',
    easeOutQuad: 'easeOutQuad',
    easeInOutQuad: 'easeInOutQuad',
    easeInCubic: 'easeInCubic'
  };
  const guiOptions = gui.addFolder('Options');
  guiOptions.addColor(settings, 'background');
  guiOptions.add(settings, 'treeShape', shapes);
  guiOptions.add(guiMethods, 'ADD CHAIN');
  guiOptions.add(guiMethods, 'REMOVE CHAIN', folders).onChange(guiMethods.removeChain);
  guiOptions.open();

  return gui;
}
updateDatGui();
guiFirstFolder.open();


// Rendering of the tree
function updateScene() {
  let {innerWidth: canvasWidth, innerHeight: canvasHeight} = window;
  const tiltAngle = settings.rotationX / 180 * Math.PI;
  const treeHeight = Math.min(canvasWidth, canvasHeight) * .8;
  const baseRadius = treeHeight * .3;
  const baseCenter = {
    x: canvasWidth / 2,
    y: canvasHeight / 2 + (treeHeight / 2) * Math.cos(tiltAngle) - (baseRadius / 2) * Math.sin(tiltAngle)
  };
  ctx.canvas.width  = canvasWidth * pixelRatio;
  ctx.canvas.height = canvasHeight * pixelRatio;
  ctx.scale(pixelRatio, pixelRatio);
  ctx.fillStyle = settings.background;
  ctx.rect(0, 0, canvasWidth, canvasHeight);
  ctx.fill();
  ctx.lineWidth = 1.1;

  return { tiltAngle, treeHeight, baseRadius, baseCenter };
}

function renderChain(props, scene) {
  for (let i = 0; i < props.bulbsCount; i++) {
    let progress = i / (props.bulbsCount - 1);
    progress = Math.pow((progress), Math.sqrt(progress) + 1); // just an approximate amendment of the distances between lights
    const turnProgress = (progress * props.turnsCount) % 1;
    const easing = easingMap[settings.treeShape] || easingMap.linear;
    const sectionRadius = scene.baseRadius * (1 - easing(progress));
    const sectionAngle = ((turnProgress * 360 + props.startAngle + rotationZ) / 180 * Math.PI) % (Math.PI*2);
    const opacity = Math.min(1, Math.max(0, Math.cos(sectionAngle)) + .2);
    const X = scene.baseCenter.x + (Math.sin(sectionAngle) * sectionRadius);
    const Y = scene.baseCenter.y - progress * scene.treeHeight * Math.sin((90 - settings.rotationX) / 180 * Math.PI)
      + sectionRadius * Math.sin(scene.tiltAngle) * Math.cos(sectionAngle);
    const bulbRadius = props.bulbRadius * scene.treeHeight/1000;
    const glowRadius = (props.bulbRadius + props.glowOffset) * scene.treeHeight/1000;
    const currentColor = CGL.colorConvert.opacity(
      CGL.colorConvert.mixBlendColors(props.startColor, props.endColor, progress), opacity
    );
    
    // opacity
    ctx.globalAlpha = props.opacity;

    // glow circles
    if (props.glowOffset > 0) {
      const gradient = ctx.createRadialGradient(X, Y, bulbRadius, X, Y, glowRadius);
      gradient.addColorStop(0, CGL.colorConvert.opacity(CGL.colorConvert.mixBlendColors(currentColor, '#fff', .3), .5));
      gradient.addColorStop(.25, CGL.colorConvert.opacity(currentColor, .6));
      gradient.addColorStop(.5, CGL.colorConvert.opacity(currentColor, .3));
      gradient.addColorStop(.75, CGL.colorConvert.opacity(currentColor, .125));
      gradient.addColorStop(1, CGL.colorConvert.opacity(currentColor, 0));
      ctx.fillStyle = gradient;    
      ctx.beginPath();
      ctx.arc(X, Y, glowRadius, 0, 2 * Math.PI);
      ctx.fill();
    }

    // bulbs
    ctx.fillStyle = currentColor;
    ctx.beginPath();
    ctx.arc(X, Y, bulbRadius, 0, 2 * Math.PI);
    ctx.fill();
  }
}

function render() {
  const scene = updateScene();
  chains.forEach(chain => renderChain(chain, scene));
}

// Pointer-driven rotation control
let isPointerDown = false;
const dragStart = { x: 0, y: 0, rotX: 0, rotZ: 0 };
const clampRotationX = value => Math.min(75, Math.max(0, value));
function updateRotationFromDrag(evt) {
  const viewHeight = window.innerHeight || 1;
  const viewWidth = window.innerWidth || 1;
  const dx = evt.clientX - dragStart.x;
  const dy = evt.clientY - dragStart.y;
  const deltaZ = (dx / viewWidth) * 360; // horizontal drag adjusts spin
  const deltaX = (dy / viewHeight) * 75; // vertical drag adjusts tilt
  settings.rotationX = clampRotationX(dragStart.rotX + deltaX);
  rotationZ = dragStart.rotZ + deltaZ;
  render();
}

canvas.addEventListener('pointerdown', evt => {
  isPointerDown = true;
  dragStart.x = evt.clientX;
  dragStart.y = evt.clientY;
  dragStart.rotX = settings.rotationX;
  dragStart.rotZ = rotationZ;
  canvas.setPointerCapture(evt.pointerId);
});

canvas.addEventListener('pointermove', evt => {
  if (!isPointerDown) return;
  updateRotationFromDrag(evt);
});

canvas.addEventListener('pointerup', evt => {
  isPointerDown = false;
  canvas.releasePointerCapture(evt.pointerId);
});

canvas.addEventListener('pointercancel', () => {
  isPointerDown = false;
});

function rotate() {
  if (!isPointerDown) {
    rotationZ = (rotationZ - 1) % 360;
  }
  render();
  window.requestAnimationFrame(rotate);
}
rotate();

window.addEventListener('resize', render);
window.addEventListener('orientationchange', render);
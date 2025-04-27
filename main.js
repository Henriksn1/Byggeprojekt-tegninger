// === GLOBAL SETUP ===
const canvas = new fabric.Canvas('c', { selection: false });
let currentTool = 'select';
let drawingObject = null;
let startPoint = null;
let polyPoints = [];
let isDrawing = false;

// Patterns til skraveringer
const patterns = {
  concrete: new fabric.Pattern({ source: createDotPattern('#999', 2, 6), repeat: 'repeat' }),
  wood: new fabric.Pattern({ source: createStripePattern('sienna', 10, 10), repeat: 'repeat' }),
  'insulation-hard': new fabric.Pattern({ source: createZigzagPattern('#666', 6), repeat: 'repeat' }),
  'insulation-soft': new fabric.Pattern({ source: createWavePattern('#666', 6), repeat: 'repeat' }),
};

// Sæt canvas‐størrelse til browser‐vindue
function resizeCanvas() {
  const h = window.innerHeight - document.getElementById('toolbar').offsetHeight;
  const w = window.innerWidth;
  canvas.setHeight(h);
  canvas.setWidth(w);
  canvas.renderAll();
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// === TOOLBAR LOGIK ===
document.querySelectorAll('#toolbar button[data-tool]').forEach(btn => {
  btn.addEventListener('click', () => {
    currentTool = btn.getAttribute('data-tool');
    canvas.isDrawingMode = (currentTool === 'cloud');
    canvas.freeDrawingBrush.width = 2;
  });
});

// Materiale‐vælger
document.getElementById('material-selector').addEventListener('change', e => {
  const active = canvas.getActiveObject();
  if (!active) return alert('Vælg en form først!');
  const val = e.target.value;
  if (val === 'none') active.set('fill', 'transparent');
  else active.set('fill', patterns[val]);
  canvas.renderAll();
});

// === PDF UPLOAD ===
document.getElementById('file-input').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file || file.type !== 'application/pdf') return;
  const reader = new FileReader();
  reader.onload = ev => {
    pdfjsLib.getDocument(new Uint8Array(ev.target.result)).promise
      .then(pdf => pdf.getPage(1))
      .then(page => {
        const scale = 1.5;
        const vp = page.getViewport({ scale });
        const tmp = document.createElement('canvas');
        tmp.width = vp.width; tmp.height = vp.height;
        return page.render({ canvasContext: tmp.getContext('2d'), viewport: vp })
                   .promise.then(() => tmp.toDataURL());
      })
      .then(dataUrl => {
        fabric.Image.fromURL(dataUrl, img => {
          canvas.clear();
          canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
          resizeCanvas();
        });
      });
  };
  reader.readAsArrayBuffer(file);
});

// === UNDO/REDO ===
const state = [];
let idx = -1;
function saveState() {
  idx++;
  state.splice(idx);
  state.push(canvas.toJSON());
}
canvas.on('object:added', saveState);
document.getElementById('undo').onclick = () => {
  if (idx > 0) canvas.loadFromJSON(state[--idx], canvas.renderAll.bind(canvas));
};
document.getElementById('redo').onclick = () => {
  if (idx < state.length - 1) canvas.loadFromJSON(state[++idx], canvas.renderAll.bind(canvas));
};

// === GEM & EKSPORT ===
document.getElementById('save').onclick = () => {
  const a = document.createElement('a');
  a.href = 'data:text/json,' + encodeURIComponent(JSON.stringify(canvas.toDatalessJSON()));
  a.download = 'projekt.json';
  a.click();
};
document.getElementById('export').onclick = () => {
  const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 2 });
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = 'eksport.png';
  a.click();
};

// === TEGNE- & MÅLE-LOGIK ===
canvas.on('mouse:down', o => {
  const p = canvas.getPointer(o.e);
  isDrawing = true;
  startPoint = p;

  switch (currentTool) {
    case 'rect':
      drawingObject = new fabric.Rect({ left: p.x, top: p.y, width: 0, height: 0,
        stroke: '#f00', fill: 'transparent', strokeWidth: 1 });
      canvas.add(drawingObject);
      break;
    case 'circle':
      drawingObject = new fabric.Circle({ left: p.x, top: p.y, radius: 0,
        stroke: '#00f', fill: 'transparent', strokeWidth: 1 });
      canvas.add(drawingObject);
      break;
    case 'line':
    case 'measure':
      drawingObject = new fabric.Line([p.x, p.y, p.x, p.y], {
        stroke: currentTool==='measure' ? '#000' : '#0f0',
        strokeWidth: 1, strokeDashArray: currentTool==='measure' ? [5,5] : null
      });
      canvas.add(drawingObject);
      break;
    case 'polyline':
      if (!drawingObject) {
        polyPoints = [p];
      } else {
        polyPoints.push(p);
      }
      break;
    case 'text':
      drawingObject = new fabric.Textbox('Kommentar', { left: p.x, top: p.y, width: 100, fontSize: 14 });
      canvas.add(drawingObject);
      finalize();
      break;
  }
});

canvas.on('mouse:move', o => {
  if (!isDrawing || !drawingObject) return;
  const p = canvas.getPointer(o.e);
  if (drawingObject.type === 'rect') {
    drawingObject.set({ width: p.x - startPoint.x, height: p.y - startPoint.y });
  }
  if (drawingObject.type === 'circle') {
    const r = Math.hypot(p.x - startPoint.x, p.y - startPoint.y) / 2;
    drawingObject.set({ radius: r, left: startPoint.x - r, top: startPoint.y - r });
  }
  if (drawingObject.type === 'line') {
    drawingObject.set({ x2: p.x, y2: p.y });
  }
  canvas.renderAll();
});

canvas.on('mouse:up', o => {
  if (currentTool === 'polyline') {
    const p = canvas.getPointer(o.e);
    polyPoints.push(p);
    if (polyPoints.length > 1) {
      if (drawingObject) canvas.remove(drawingObject);
      drawingObject = new fabric.Polyline(polyPoints, { stroke: '#f0f', fill: 'transparent', strokeWidth: 1 });
      canvas.add(drawingObject);
    }
  }
  finalize();
});

function finalize() {
  isDrawing = false;
  drawingObject && drawingObject.setCoords();
  drawingObject = null;
  saveState();
}

// === VINKEL‐SNAP (Ctrl) ===
canvas.on('object:moving', e => {
  const obj = e.target;
  if (e.e.ctrlKey && (obj.type==='line' || obj.type==='polyline')) {
    obj.set({ angle: Math.round(obj.angle/45)*45 });
    canvas.renderAll();
  }
});

// === PATTERN‐HELPERS ===
function createDotPattern(color, r, s) {
  const c = document.createElement('canvas'), ctx = c.getContext('2d');
  c.width = c.height = s;
  ctx.fillStyle = color; ctx.beginPath();
  ctx.arc(s/2,s/2,r,0,2*Math.PI); ctx.fill();
  return c;
}
function createStripePattern(color, w, h) {
  const c = document.createElement('canvas'), ctx = c.getContext('2d');
  c.width = h; c.height = h;
  ctx.strokeStyle = color; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(0,h); ctx.lineTo(h,0); ctx.stroke();
  return c;
}
function createZigzagPattern(color, sz) {
  const c = document.createElement('canvas'), ctx = c.getContext('2d');
  c.width = c.height = sz;
  ctx.strokeStyle = color; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0,sz/2);
  ctx.lineTo(sz/2,0); ctx.lineTo(sz,sz/2); ctx.lineTo(sz/2,sz); ctx.stroke();
  return c;
}
function createWavePattern(color, sz) {
  const c = document.createElement('canvas'), ctx = c.getContext('2d');
  c.width = c.height = sz;
  ctx.strokeStyle = color; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0,sz/2);
  ctx.quadraticCurveTo(sz/4,0, sz/2,sz/2);
  ctx.quadraticCurveTo(3*sz/4,sz, sz,sz/2);
  ctx.stroke();
  return c;
}



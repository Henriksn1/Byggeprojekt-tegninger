// === INIT ===
const canvas = new fabric.Canvas('c', { selection: false });
let tool = 'select', activeObj = null, startPt = null, polyPts = [], isDrawing = false;
let scaleFactor = 1, calibPts = [];
let state = [], idx = -1;

// === RESIZE ===
function resizeCanvas() {
  const h = window.innerHeight - document.getElementById('toolbar').offsetHeight;
  canvas.setWidth(window.innerWidth).setHeight(h).renderAll();
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// === PATTERNS ===
function mk(sz, fn) {
  const c = document.createElement('canvas'), ctx = c.getContext('2d');
  c.width = c.height = sz;
  fn(ctx, sz);
  return c;
}
const patterns = {
  concrete: new fabric.Pattern({ source: mk(10, (c, s) => { c.fillStyle = '#999'; c.beginPath(); c.arc(s/2, s/2, 2, 0, 2*Math.PI); c.fill(); }), repeat: 'repeat' }),
  wood: new fabric.Pattern({ source: mk(10, (c, s) => { c.strokeStyle = 'sienna'; c.lineWidth = 3; c.moveTo(0, s); c.lineTo(s, 0); c.stroke(); }), repeat: 'repeat' }),
  brick: new fabric.Pattern({ source: mk(20, (c, s) => { c.strokeStyle = '#B22222'; c.lineWidth = 2; c.strokeRect(0,0,s/2,s/4); c.strokeRect(s/2,0,s/2,s/4); c.strokeRect(0,s/4,s/2,s/4); }), repeat: 'repeat' }),
  steel: new fabric.Pattern({ source: mk(10, (c, s) => { c.strokeStyle = '#555'; c.lineWidth = 2; c.moveTo(0,0); c.lineTo(s,s); c.stroke(); c.moveTo(s,0); c.lineTo(0,s); c.stroke(); }), repeat: 'repeat' }),
  insulationSoft: new fabric.Pattern({ source: mk(8, (c, s) => { c.strokeStyle = '#666'; c.beginPath(); c.moveTo(0,s/2); c.quadraticCurveTo(s/4,0,s/2,s/2); c.quadraticCurveTo(3*s/4,s,s,s/2); c.stroke(); }), repeat: 'repeat' }),
};

// === TOOLBAR ===
document.querySelectorAll('#toolbar button[data-tool]').forEach(btn => {
  btn.onclick = () => {
    tool = btn.dataset.tool;
    canvas.isDrawingMode = (tool === 'cloud');
    if (tool === 'cloud') canvas.freeDrawingBrush.width = 2;
  };
});
document.getElementById('finish-polyline').onclick = () => {
  if (polyPts.length > 1) {
    const pl = new fabric.Polyline(polyPts, { stroke: '#00f', strokeWidth: 2, fill: 'transparent' });
    canvas.add(pl);
    finalize();
  }
};
document.getElementById('material-selector').onchange = e => {
  const o = canvas.getActiveObject();
  if (!o) return alert('Vælg en form først!');
  const v = e.target.value;
  o.set('fill', v === 'none' ? 'transparent' : patterns[v]);
  canvas.renderAll();
};
document.getElementById('color-picker').onchange = e => {
  const color = e.target.value;
  canvas.freeDrawingBrush.color = color;
  const o = canvas.getActiveObject();
  if (o) { o.set('stroke', color); canvas.renderAll(); }
};
document.getElementById('apply-rotate').onclick = () => {
  const o = canvas.getActiveObject();
  if (o) {
    o.set('angle', parseInt(document.getElementById('rotate-angle').value) || 0);
    canvas.renderAll();
  }
};
document.getElementById('scale-factor').onchange = e => {
  const val = e.target.value;
  scaleFactor = eval(val.split(':').join('/')); // Fx. 1:50 => 1/50
};

// === FILE HANDLING ===
document.getElementById('file-input').onchange = e => {
  const f = e.target.files[0];
  if (!f || f.type !== 'application/pdf') return alert('Vælg en PDF!');
  const r = new FileReader();
  r.onload = ev => {
    pdfjsLib.getDocument(new Uint8Array(ev.target.result)).promise
      .then(pdf => pdf.getPage(1))
      .then(page => {
        const vp = page.getViewport({ scale: 1.5 });
        const tmp = document.createElement('canvas');
        tmp.width = vp.width; tmp.height = vp.height;
        return page.render({ canvasContext: tmp.getContext('2d'), viewport: vp })
                   .promise.then(() => tmp.toDataURL());
      })
      .then(url => {
        fabric.Image.fromURL(url, img => {
          canvas.clear();
          canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
          resizeCanvas();
        });
      })
      .catch(console.error);
  };
  r.readAsArrayBuffer(f);
};

// === UNDO / REDO ===
canvas.on('object:modified', saveState);
function saveState() {
  idx++;
  state.splice(idx);
  state.push(canvas.toJSON());
}
document.getElementById('undo').onclick = () => {
  if (idx > 0) canvas.loadFromJSON(state[--idx], canvas.renderAll.bind(canvas));
};
document.getElementById('redo').onclick = () => {
  if (idx < state.length - 1) canvas.loadFromJSON(state[++idx], canvas.renderAll.bind(canvas));
};

// === SAVE / EXPORT ===
document.getElementById('save').onclick = () => {
  const a = document.createElement('a');
  a.href = 'data:text/json,' + encodeURIComponent(JSON.stringify(canvas.toDatalessJSON()));
  a.download = 'projekt.json';
  a.click();
};
document.getElementById('export').onclick = () => {
  const d = canvas.toDataURL({ format: 'png', multiplier: 2 });
  const a = document.createElement('a');
  a.href = d;
  a.download = 'eksport.png';
  a.click();
};

// === DRAWING ===
canvas.on('mouse:down', e => {
  const p = canvas.getPointer(e.e);
  isDrawing = true;
  startPt = p;
  let newObj;
  if (tool === 'rect') {
    newObj = new fabric.Rect({ left: p.x, top: p.y, width: 0, height: 0, stroke: canvas.freeDrawingBrush.color || '#f00', fill: 'transparent', strokeWidth: 2 });
  }
  if (tool === 'circle') {
    newObj = new fabric.Circle({ left: p.x, top: p.y, radius: 0, stroke: '#00f', fill: 'transparent', strokeWidth: 2 });
  }
  if (tool === 'line' || tool === 'measure') {
    newObj = new fabric.Line([p.x, p.y, p.x, p.y], {
      stroke: tool === 'measure' ? '#000' : (canvas.freeDrawingBrush.color || '#0f0'),
      strokeDashArray: tool === 'measure' ? [5, 5] : null,
      strokeWidth: 2
    });
  }
  if (tool === 'polyline') {
    if (!activeObj) polyPts = [p];
    else polyPts.push(p);
    return;
  }
  if (tool === 'text') {
    newObj = new fabric.Textbox('Kommentar', { left: p.x, top: p.y, width: 120, fontSize: 14 });
    canvas.add(newObj);
    finalize();
    return;
  }
  activeObj = newObj;
  canvas.add(activeObj);
  activeObj.setCoords();
});

canvas.on('mouse:move', e => {
  if (!isDrawing || !activeObj) return;
  const p = canvas.getPointer(e.e);
  if (activeObj.type === 'rect') activeObj.set({ width: p.x - startPt.x, height: p.y - startPt.y });
  if (activeObj.type === 'circle') {
    const r = Math.hypot(p.x - startPt.x, p.y - startPt.y) / 2;
    activeObj.set({ radius: r, left: startPt.x - r, top: startPt.y - r });
  }
  if (activeObj.type === 'line') activeObj.set({ x2: p.x, y2: p.y });
  canvas.renderAll();
});

canvas.on('mouse:up', e => {
  if (tool === 'polyline') {
    polyPts.push(canvas.getPointer(e.e));
    if (activeObj) canvas.remove(activeObj);
    activeObj = new fabric.Polyline(polyPts, { stroke: '#00f', strokeWidth: 2, fill: 'transparent' });
    canvas.add(activeObj);
  }
  if (tool === 'measure') {
    const p2 = canvas.getPointer(e.e);
    const distPx = Math.hypot(p2.x - startPt.x, p2.y - startPt.y);
    const real = (distPx * scaleFactor).toFixed(2);
    const midX = (startPt.x + p2.x) / 2, midY = (startPt.y + p2.y) / 2;
    const text = new fabric.Text(real, { left: midX, top: midY-10, fontSize: 12, fill: '#000' });
    canvas.add(text);
  }
  finalize();
});

function finalize() {
  isDrawing = false;
  if (activeObj) activeObj.setCoords();
  saveState();
  activeObj = null;
}





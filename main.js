// main.js

// === INIT & RESIZE ===
const canvas = new fabric.Canvas('c', { selection: false });
let tool = 'select', obj = null, startPt = null, polyPts = [], isDrawing = false;
let scaleFactor = 1, calibPoints = [];
let state = [], idx = -1;

// Resize canvas to fill
function resize() {
  const h = window.innerHeight - document.getElementById('toolbar').offsetHeight;
  canvas.setWidth(window.innerWidth).setHeight(h).renderAll();
}
window.addEventListener('resize', resize);
resize();

// === PATTERN DEFINITIONS ===
function mk(sz, fn) {
  const c = document.createElement('canvas'), ctx = c.getContext('2d');
  c.width = c.height = sz;
  fn(ctx, sz);
  return c;
}
const patterns = {
  concrete: new fabric.Pattern({ source: mk(8, (ctx, s) => {
    ctx.fillStyle = '#999';
    ctx.beginPath(); ctx.arc(s/2, s/2, 2, 0, 2*Math.PI);
    ctx.fill();
  }), repeat: 'repeat' }),
  wood: new fabric.Pattern({ source: mk(10, (ctx, s) => {
    ctx.strokeStyle = 'sienna'; ctx.lineWidth = 3;
    ctx.moveTo(0, s); ctx.lineTo(s, 0); ctx.stroke();
  }), repeat: 'repeat' }),
  'insulation-hard': new fabric.Pattern({ source: mk(8, (ctx, s) => {
    ctx.strokeStyle = '#666'; ctx.beginPath();
    ctx.moveTo(0, s/2); ctx.lineTo(s/2, 0);
    ctx.lineTo(s, s/2); ctx.lineTo(s/2, s);
    ctx.stroke();
  }), repeat: 'repeat' }),
  'insulation-soft': new fabric.Pattern({ source: mk(8, (ctx, s) => {
    ctx.strokeStyle = '#666'; ctx.beginPath();
    ctx.moveTo(0, s/2);
    ctx.quadraticCurveTo(s/4, 0, s/2, s/2);
    ctx.quadraticCurveTo(3*s/4, s, s, s/2);
    ctx.stroke();
  }), repeat: 'repeat' }),
};

// === TOOLBAR HANDLERS ===
document.querySelectorAll('#toolbar button[data-tool]').forEach(btn => {
  btn.addEventListener('click', () => {
    tool = btn.dataset.tool;
    canvas.isDrawingMode = (tool === 'cloud');
    if (tool === 'cloud') canvas.freeDrawingBrush.width = 2;
  });
});

document.getElementById('material-selector').onchange = e => {
  const o = canvas.getActiveObject();
  if (!o) return alert('Vælg et objekt først!');
  const v = e.target.value;
  o.set('fill', v==='none' ? 'transparent' : patterns[v]);
  canvas.renderAll();
};

document.getElementById('color-picker').onchange = e => {
  canvas.freeDrawingBrush.color = e.target.value;
  const o = canvas.getActiveObject();
  if (o) o.set('stroke', e.target.value).canvas.renderAll();
};

// Rotation
document.getElementById('apply-rotate').onclick = () => {
  const o = canvas.getActiveObject();
  if (o) {
    const deg = parseInt(document.getElementById('rotate-angle').value, 10) || 0;
    o.set('angle', deg);
    canvas.renderAll();
  }
};

// Snap rotate with Ctrl
canvas.on('object:moving', e => {
  const o = e.target;
  if (e.e.ctrlKey && (o.type==='line' || o.type==='polyline')) {
    o.angle = Math.round(o.angle / 15) * 15;
    canvas.renderAll();
  }
});

// Calibration
document.getElementById('calibrate').onclick = () => {
  tool = 'calibrate';
  calibPoints = [];
  alert('Klik 2 punkter for kalibrering');
};
document.getElementById('calib-input').style.width = '80px';

// === PDF UPLOAD ===
document.getElementById('file-input').onchange = e => {
  const f = e.target.files[0];
  if (!f || f.type !== 'application/pdf') return;
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
          resize();
        });
      });
  };
  r.readAsArrayBuffer(f);
};

// Undo/Redo
canvas.on('object:modified', () => { 
  idx++; state.splice(idx); state.push(canvas.toJSON()); 
});
document.getElementById('undo').onclick = () => {
  if (idx > 0) canvas.loadFromJSON(state[--idx], canvas.renderAll.bind(canvas));
};
document.getElementById('redo').onclick = () => {
  if (idx < state.length - 1) canvas.loadFromJSON(state[++idx], canvas.renderAll.bind(canvas));
};

// Save & Export
document.getElementById('save').onclick = () => {
  const a = document.createElement('a');
  a.href = 'data:text/json,'+encodeURIComponent(JSON.stringify(canvas.toDatalessJSON()));
  a.download = 'projekt.json'; a.click();
};
document.getElementById('export').onclick = () => {
  const d = canvas.toDataURL({ format: 'png', multiplier: 2 });
  const a = document.createElement('a'); a.href = d; a.download = 'eksport.png'; a.click();
};

// DRAWING & MEASURING
canvas.on('mouse:down', o => {
  const p = canvas.getPointer(o.e);
  isDrawing = true; startPt = p;
  let newObj;
  switch(tool) {
    case 'calibrate':
      calibPoints.push(p);
      if (calibPoints.length === 2) {
        const d = Math.hypot(
          calibPoints[1].x - calibPoints[0].x,
          calibPoints[1].y - calibPoints[0].y
        );
        const real = parseFloat(document.getElementById('calib-input').value) || 1;
        scaleFactor = real / d;
        alert(`Kalibreret: 1 px = ${scaleFactor.toFixed(3)} enhed`);
        tool = 'select';
      }
      break;
    case 'rect':
      newObj = new fabric.Rect({ left: p.x, top: p.y, width:0, height:0, stroke:canvas.freeDrawingBrush.color||'#f00', fill:'transparent', strokeWidth:2 });
      break;
    case 'circle':
      newObj = new fabric.Circle({ left: p.x, top: p.y, radius:0, stroke:'#00f', fill:'transparent', strokeWidth:2 });
      break;
    case 'line':
    case 'measure':
      newObj = new fabric.Line([p.x,p.y,p.x,p.y], {
        stroke: tool==='measure' ? '#000' : (canvas.freeDrawingBrush.color||'#0f0'),
        strokeDashArray: tool==='measure' ? [5,5] : null, strokeWidth:2
      });
      break;
    case 'polyline':
      if (!obj) {
        polyPts = [p];
      } else {
        polyPts.push(p);
      }
      return;
    case 'text':
      newObj = new fabric.Textbox('Kommentar',{ left: p.x, top: p.y, width:120, fontSize:14 });
      canvas.add(newObj); finalize(); return;
  }
  if (newObj) {
    obj = newObj;
    canvas.add(obj);
    obj.setCoords();
  }
});

canvas.on('mouse:move', o => {
  if (!isDrawing || !obj) return;
  const p = canvas.getPointer(o.e);
  if (obj.type==='rect') {
    obj.set({ width: p.x - startPt.x, height: p.y - startPt.y });
  }
  if (obj.type==='circle') {
    const r = Math.hypot(p.x-startPt.x, p.y-startPt.y)/2;
    obj.set({ radius: r, left: startPt.x - r, top: startPt.y - r });
  }
  if (obj.type==='line') {
    obj.set({ x2: p.x, y2: p.y });
  }
  canvas.renderAll();
});

canvas.on('mouse:up', () => {
  if (tool==='polyline') {
    polyPts.push(canvas.getPointer(event.e));
    if (obj) canvas.remove(obj);
    obj = new fabric.Polyline(polyPts,{ stroke:'#f0f', fill:'transparent', strokeWidth:2 });
    canvas.add(obj);
  }
  if (tool==='measure') {
    const p2 = canvas.getPointer(event.e);
    const distPx = Math.hypot(p2.x-startPt.x, p2.y-startPt.y);
    const real = (distPx*scaleFactor).toFixed(2);
    const midX = (startPt.x + p2.x)/2, midY = (startPt.y + p2.y)/2;
    const tl = new fabric.Text(`${real}`,{ left: midX, top: midY-10, fontSize:12, fill:'#000' });
    canvas.add(tl);
  }
  finalize();
});

function finalize(){
  isDrawing = false;
  if (obj) obj.setCoords();
  saveState();
  obj = null;
}

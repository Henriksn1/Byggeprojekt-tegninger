// globaler canvas
const canvas = new fabric.Canvas('c', { selection: false });
let currentTool = 'select';
let line, polylinePoints = [];
let isDrawing = false;
let startPoint;

// Patterns til skravering
const patterns = {
  concrete: new fabric.Pattern({ source: createDotPattern('#999', 2, 6), repeat: 'repeat' }),
  wood: new fabric.Pattern({ source: createStripePattern('sienna', 10, 10), repeat: 'repeat' }),
  'insulation-hard': new fabric.Pattern({ source: createZigzagPattern('#666', 6), repeat: 'repeat' }),
  'insulation-soft': new fabric.Pattern({ source: createWavePattern('#666', 6), repeat: 'repeat' }),
};

// Initial setup
fabric.Object.prototype.transparentCorners = false;
canvas.setHeight(window.innerHeight - 48);
canvas.setWidth(window.innerWidth);

// Værktøjsvalg
document.querySelectorAll('#toolbar button[data-tool]').forEach(btn=>{
  btn.onclick = ()=> {
    currentTool = btn.getAttribute('data-tool');
    canvas.isDrawingMode = (currentTool==='cloud');
    if(currentTool==='cloud') canvas.freeDrawingBrush.width = 2;
  };
});

// Materiale-vælger
document.getElementById('material-selector').onchange = e=>{
  const sel = canvas.getActiveObject();
  if(!sel) return alert('Vælg en form først!');
  const mat = e.target.value;
  sel.set('fill', mat==='none'?'transparent':patterns[mat]||patterns[mat]);
  canvas.renderAll();
};

// Upload PDF
document.getElementById('file-input').onchange = function(e){
  const file = e.target.files[0];
  if(!file || file.type!=='application/pdf') return;
  const reader = new FileReader();
  reader.onload = function(ev){
    pdfjsLib.getDocument(new Uint8Array(ev.target.result))
      .promise.then(pdf=> pdf.getPage(1))
      .then(page=>{
        const scale = 1.5;
        const vp = page.getViewport({scale});
        const tmp = document.createElement('canvas');
        tmp.width = vp.width; tmp.height = vp.height;
        return page.render({ canvasContext: tmp.getContext('2d'), viewport: vp })
          .promise.then(()=> tmp.toDataURL());
      })
      .then(dataUrl=>{
        fabric.Image.fromURL(dataUrl, img=>{
          canvas.clear();
          canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
          canvas.setWidth(img.width); canvas.setHeight(img.height);
        });
      });
  };
  reader.readAsArrayBuffer(file);
};

// Undo/Redo
const state = [];
let stateIndex=0;
function saveState(){ state.splice(stateIndex); state.push(canvas.toJSON()); stateIndex = state.length; }
canvas.on('object:added', saveState);
document.getElementById('undo').onclick = ()=>{
  if(stateIndex>1) canvas.loadFromJSON(state[--stateIndex-1], canvas.renderAll.bind(canvas));
};
document.getElementById('redo').onclick = ()=>{
  if(stateIndex<state.length) canvas.loadFromJSON(state[stateIndex++], canvas.renderAll.bind(canvas));
};

// Save/Export
document.getElementById('save').onclick = ()=>{
  const a = document.createElement('a');
  a.href = 'data:text/json,'+encodeURIComponent(JSON.stringify(canvas.toDatalessJSON()));
  a.download = 'projekt.json';
  a.click();
};
document.getElementById('export').onclick = ()=>{
  const dataUrl = canvas.toDataURL({ format: 'jpeg', multiplier: 2 });
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = 'tegnings-eksport.jpg';
  a.click();
};

// Måling, figurer og polylinje
canvas.on('mouse:down', function(o){
  const p = canvas.getPointer(o.e);
  if(currentTool==='rect'){ isDrawing=true; startPoint=p; 
    const rect = new fabric.Rect({ left:p.x, top:p.y, width:0, height:0,
      stroke:'#f00', strokeWidth:1, fill:'transparent' });
    canvas.add(rect); canvas.setActiveObject(rect);
  }
  if(currentTool==='circle'){ isDrawing=true; startPoint=p;
    const circ = new fabric.Circle({ left:p.x, top:p.y, radius:0,
      stroke:'#00f', strokeWidth:1, fill:'transparent' });
    canvas.add(circ); canvas.setActiveObject(circ);
  }
  if(currentTool==='line'){ isDrawing=true; startPoint=p;
    line = new fabric.Line([p.x,p.y,p.x,p.y], { stroke:'#0f0', strokeWidth:1 });
    canvas.add(line);
  }
  if(currentTool==='polyline'){ if(!isDrawing){ isDrawing=true; polylinePoints=[p]; line=null; }
    else { polylinePoints.push(p); drawPolyline(); } 
  }
  if(currentTool==='measure'){ isDrawing=true; startPoint=p;
    line = new fabric.Line([p.x,p.y,p.x,p.y], { stroke:'#000', strokeWidth:1, strokeDashArray:[5,5] });
    canvas.add(line);
  }
  if(currentTool==='text'){ const txt = new fabric.Textbox('Kommentar',{ left:p.x, top:p.y, width:100, fontSize:14 });
    canvas.add(txt); canvas.setActiveObject(txt);
  }
});
canvas.on('mouse:move', function(o){
  if(!isDrawing) return;
  const p = canvas.getPointer(o.e);
  const obj = canvas.getActiveObject();
  if(currentTool==='rect'){
    obj.set({ width:p.x-startPoint.x, height:p.y-startPoint.y });
    canvas.renderAll();
  }
  if(currentTool==='circle'){
    const r = Math.hypot(p.x-startPoint.x,p.y-startPoint.y)/2;
    obj.set({ radius:r, left:startPoint.x-r, top:startPoint.y-r });
    canvas.renderAll();
  }
  if(currentTool==='line' || currentTool==='measure'){
    line.set({ x2:p.x, y2:p.y });
    canvas.renderAll();
  }
});
canvas.on('mouse:up', function(){
  if(currentTool==='polyline' && isDrawing) return;
  isDrawing=false; line=null; startPoint=null;
});

// Tegn polylinje
function drawPolyline(){
  if(line) canvas.remove(line);
  line = new fabric.Polyline(polylinePoints, { stroke:'#f0f', strokeWidth:1, fill:'transparent' });
  canvas.add(line);
}

// Vinkel-snap (Ctrl)
canvas.on('object:moving', function(e){
  const obj = e.target;
  if(e.e.ctrlKey && (obj.type==='line' || obj.type==='polyline')){
    // groft: kun lige vinkler: 0, 90
    const angle = Math.round(obj.angle/45)*45;
    obj.angle = angle;
    canvas.renderAll();
  }
});

// Pattern-generering: små canvas-mønstre
function createDotPattern(color, radius, spacing){
  const c = document.createElement('canvas'), ctx=c.getContext('2d');
  c.width = c.height = spacing;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(spacing/2,spacing/2,radius,0,2*Math.PI);
  ctx.fill();
  return c;
}
function createStripePattern(color, w, h){
  const c = document.createElement('canvas'), ctx=c.getContext('2d');
  c.width = c.height = h;
  ctx.strokeStyle = color; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(0,h); ctx.lineTo(h,0); ctx.stroke();
  return c;
}
function createZigzagPattern(color, size){
  const c = document.createElement('canvas'), ctx=c.getContext('2d');
  c.width = c.height = size;
  ctx.strokeStyle = color; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0,size/2); ctx.lineTo(size/2,0);
  ctx.lineTo(size, size/2); ctx.lineTo(size/2,size);
  ctx.closePath(); ctx.stroke();
  return c;
}
function createWavePattern(color, size){
  const c = document.createElement('canvas'), ctx=c.getContext('2d');
  c.width = c.height = size;
  ctx.strokeStyle = color; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0,size/2);
  ctx.quadraticCurveTo(size/4,0, size/2,size/2);
  ctx.quadraticCurveTo(3*size/4,size, size,size/2);
  ctx.stroke();
  return c;
}


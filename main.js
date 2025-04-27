// === INIT & RESIZE ===
const canvas = new fabric.Canvas('c', { selection: false });
let currentTool = 'select', drawingObject = null, startPt = null, polyPts = [];
let state = [], idx = -1;

// Resize canvas
function resize() {
  const h = window.innerHeight - document.getElementById('toolbar').offsetHeight;
  canvas.setWidth(window.innerWidth).setHeight(h).renderAll();
}
window.addEventListener('resize', resize);
resize();

// === PATTERN DEFINITION ===
function mk(csz, drawFn) {
  const c = document.createElement('canvas'), ctx = c.getContext('2d');
  c.width = c.height = csz; drawFn(ctx, csz);
  return c;
}
const patterns = {
  concrete: new fabric.Pattern({ source: mk(8, (ctx,s)=>{ctx.fillStyle='#999';ctx.beginPath();ctx.arc(s/2,s/2,2,0,2*Math.PI);ctx.fill();}), repeat:'repeat' }),
  wood:     new fabric.Pattern({ source: mk(10,(ctx,s)=>{ctx.strokeStyle='sienna';ctx.lineWidth=3;ctx.moveTo(0,s);ctx.lineTo(s,0);ctx.stroke();}), repeat:'repeat' }),
  'insulation-hard': new fabric.Pattern({ source: mk(8,(ctx,s)=>{ctx.strokeStyle='#666';ctx.lineWidth=1; ctx.beginPath();ctx.moveTo(0,s/2);ctx.lineTo(s/2,0);ctx.lineTo(s,s/2);ctx.lineTo(s/2,s);ctx.stroke();}), repeat:'repeat' }),
  'insulation-soft': new fabric.Pattern({ source: mk(8,(ctx,s)=>{ctx.strokeStyle='#666';ctx.beginPath();ctx.moveTo(0,s/2);ctx.quadraticCurveTo(s/4,0,s/2,s/2);ctx.quadraticCurveTo(3*s/4,s,s,s/2);ctx.stroke();}), repeat:'repeat' })
};

// === TOOLBAR HANDLERS ===
document.querySelectorAll('#toolbar button[data-tool]').forEach(btn=>{
  btn.addEventListener('click', ()=> {
    currentTool = btn.dataset.tool;
    canvas.isDrawingMode = (currentTool === 'cloud');
    if (currentTool==='cloud') canvas.freeDrawingBrush.width = 2;
  });
});

// Material-selector
document.getElementById('material-selector').addEventListener('change', e=>{
  const obj = canvas.getActiveObject();
  if (!obj) return alert('Vælg en form først!');
  const val = e.target.value;
  obj.set('fill', val==='none'?'transparent':patterns[val]);
  canvas.renderAll();
});

// Apply manual rotation
document.getElementById('apply-rotate').onclick = ()=>{
  const obj = canvas.getActiveObject();
  const deg = parseInt(document.getElementById('rotate-angle').value,10) || 0;
  if (obj) { obj.set('angle',deg); canvas.renderAll(); }
};

// === PDF UPLOAD & BACKGROUND ===
document.getElementById('file-input').addEventListener('change', function(e){
  const f = e.target.files[0];
  if (!f||f.type!=='application/pdf') return;
  const reader = new FileReader();
  reader.onload = ev => {
    pdfjsLib.getDocument(new Uint8Array(ev.target.result)).promise
      .then(pdf=>pdf.getPage(1))
      .then(page=>{
        const vp = page.getViewport({scale:1.5});
        const tmp = document.createElement('canvas');
        tmp.width = vp.width; tmp.height = vp.height;
        return page.render({ canvasContext:tmp.getContext('2d'), viewport:vp }).promise.then(()=>tmp.toDataURL());
      })
      .then(url=>{
        fabric.Image.fromURL(url,img=>{
          canvas.clear();
          canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
          resize();
        });
      });
  };
  reader.readAsArrayBuffer(f);
});

// === UNDO/REDO, SAVE, EXPORT ===
canvas.on('object:added',()=>{ idx++; state.splice(idx); state.push(canvas.toJSON()); });
document.getElementById('undo').onclick = ()=>{ if(idx>0) canvas.loadFromJSON(state[--idx], canvas.renderAll.bind(canvas)); };
document.getElementById('redo').onclick = ()=>{ if(idx<state.length-1) canvas.loadFromJSON(state[++idx], canvas.renderAll.bind(canvas)); };
document.getElementById('save').onclick = ()=>{
  const a=document.createElement('a');
  a.href='data:text/json,'+encodeURIComponent(JSON.stringify(canvas.toDatalessJSON()));
  a.download='projekt.json'; a.click();
};
document.getElementById('export').onclick = ()=>{
  const url = canvas.toDataURL({format:'png',multiplier:2});
  const a=document.createElement('a'); a.href=url; a.download='eksport.png'; a.click();
};

// === DRAWING LOGIC ===
canvas.on('mouse:down', o=>{
  const p = canvas.getPointer(o.e);
  startPt = p; let obj;
  switch(currentTool){
    case 'rect':
      obj = new fabric.Rect({ left:p.x, top:p.y, width:0, height:0, stroke:'#f00', fill:'transparent', strokeWidth:1 });
      break;
    case 'circle':
      obj = new fabric.Circle({ left:p.x, top:p.y, radius:0, stroke:'#00f', fill:'transparent', strokeWidth:1 });
      break;
    case 'line':
    case 'measure':
      obj = new fabric.Line([p.x,p.y,p.x,p.y], { stroke: currentTool==='measure'?'#000':'#0f0', strokeWidth:1, strokeDashArray: currentTool==='measure'? [5,5] : null });
      break;
    case 'polyline':
      if (!drawingObject) polyPts = [p];
      else { polyPts.push(p); }
      return;
    case 'text':
      obj = new fabric.Textbox('Kommentar', { left:p.x, top:p.y, width:100, fontSize:14 });
      canvas.add(obj); finalize(); return;
  }
  if(obj){ drawingObject = obj; canvas.add(obj); }
  canvas.selection = false;
});

canvas.on('mouse:move', o=>{
  if (!drawingObject) return;
  const p = canvas.getPointer(o.e);
  if (drawingObject.type==='rect') drawingObject.set({ width: p.x-startPt.x, height: p.y-startPt.y });
  if (drawingObject.type==='circle'){
    const r = Math.hypot(p.x-startPt.x, p.y-startPt.y)/2;
    drawingObject.set({ radius:r, left:startPt.x-r, top:startPt.y-r });
  }
  if (drawingObject.type==='line') drawingObject.set({ x2:p.x, y2:p.y });
  canvas.renderAll();
});

canvas.on('mouse:up', ()=>{
  if (currentTool==='polyline'){
    polyPts.push(canvas.getPointer(event.e));
    if (drawingObject) canvas.remove(drawingObject);
    drawingObject = new fabric.Polyline(polyPts, { stroke:'#f0f', fill:'transparent', strokeWidth:1 });
    canvas.add(drawingObject);
  }
  finalize();
});

// Snap rotation during move
canvas.on('object:moving', e=>{
  const o = e.target;
  if (e.e.ctrlKey && (o.type==='line' || o.type==='polyline')){
    o.angle = Math.round(o.angle/15)*15;
    canvas.renderAll();
  }
});

function finalize(){
  drawingObject && drawingObject.setCoords();
  drawingObject = null;
}

// Funktioner til pattern‐canvas
function createPatternCanvas(size, drawFn){
  const c = document.createElement('canvas'), ctx=c.getContext('2d');
  c.width = c.height = size; drawFn(ctx,size);
  return c;
}
function makePattern(ctx,size){ /* placeholder */ }

// (Patterns er defineret ovenfor)

  </script>

// === INIT ===
const canvas = new fabric.Canvas('c', { selection: true });
let tool = 'select', activeObj = null, startPt = null, polyPts = [], isDrawing = false;
let scaleFactor = 1, calibPts = [];
let state = [], idx = -1;

// === RESPONSIV ===
function resize() {
  const h = window.innerHeight - document.getElementById('toolbar').offsetHeight;
  canvas.setWidth(window.innerWidth).setHeight(h).renderAll();
}
window.addEventListener('resize', resize);
resize();

// === PATTERN-DEFINITIONER (avanceret fra Revit) ===
function mk(sz, drawFn) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  c.width = c.height = sz;
  drawFn(ctx, sz);
  return c;
}

const patterns = {
  concrete: new fabric.Pattern({
    source: mk(10, (ctx, sz) => {
      ctx.fillStyle = '#999';
      ctx.beginPath();
      ctx.arc(sz/2, sz/2, 2, 0, 2*Math.PI);
      ctx.fill();
    }),
    repeat: 'repeat'
  }),
  wood: new fabric.Pattern({
    source: mk(12, (ctx, sz) => {
      ctx.strokeStyle = 'sienna';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, sz);
      ctx.lineTo(sz, 0);
      ctx.stroke();
    }),
    repeat: 'repeat'
  }),
  brick: new fabric.Pattern({
    source: mk(16, (ctx, sz) => {
      ctx.strokeStyle = '#c1440e';
      ctx.lineWidth = 2;
      ctx.stroke



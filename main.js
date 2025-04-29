// Konfiguration
const DEFAULT_TOOL = 'pan';
const SNAP_THRESHOLD = 10; // pixels
let pdfDoc = null, pageNum = 1;
let scale = 1.5;
let currentTool = DEFAULT_TOOL;
let pdfCanvas, pdfCtx, overlayCanvas, overlayCtx;
let drawings = { draw: [], measure: [], text: [] };
let snapPoints = [];

// Initialisering efter DOM
window.addEventListener('DOMContentLoaded', () => {
  pdfCanvas = document.getElementById('pdfCanvas');
  overlayCanvas = document.getElementById('overlayCanvas');
  pdfCtx = pdfCanvas.getContext('2d');
  overlayCtx = overlayCanvas.getContext('2d');

  setupCanvasSize();
  setupTools();
  setupLayerToggles();
  setupFileInput();
  setupExport();
});

function setupCanvasSize() {
  overlayCanvas.width = pdfCanvas.width = 800;
  overlayCanvas.height = pdfCanvas.height = 600;
}

function setupFileInput() {
  const fileInput = document.getElementById('fileInput');
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    pdfDoc = await loadingTask.promise;
    renderPage(pageNum);
  });
}

async function renderPage(num) {
  const page = await pdfDoc.getPage(num);
  const viewport = page.getViewport({ scale });
  pdfCanvas.width = overlayCanvas.width = viewport.width;
  pdfCanvas.height = overlayCanvas.height = viewport.height;
  await page.render({ canvasContext: pdfCtx, viewport }).promise;
  computeSnapPoints(viewport);
  redrawOverlay();
}

function computeSnapPoints(viewport) {
  snapPoints = [];
  // PDF-corners
  snapPoints.push({ x: 0, y: 0 });
  snapPoints.push({ x: viewport.width, y: 0 });
  snapPoints.push({ x: 0, y: viewport.height });
  snapPoints.push({ x: viewport.width, y: viewport.height });
  // Tilføj øvrige endpoints fra drawings
  Object.values(drawings).flat().forEach(shape => {
    shape.points.forEach(pt => snapPoints.push(pt));
  });
}

function setupTools() {
  document.querySelectorAll('#toolbar button').forEach(btn => {
    btn.addEventListener('click', () => selectTool(btn.id.replace('Tool','').toLowerCase()));
  });
  overlayCanvas.addEventListener('mousedown', toolPointerDown);
  overlayCanvas.addEventListener('mouseup', toolPointerUp);
}

function selectTool(tool) {
  currentTool = tool;
  document.querySelectorAll('#toolbar button').forEach(btn => {
    btn.classList.toggle('active', btn.id === tool + 'Tool');
  });
}

let isDrawing = false;
let startPt = null;
function toolPointerDown(evt) {
  const pt = getMousePos(evt);
  const snapped = snapToPoint(pt);
  startPt = snapped || pt;
  isDrawing = true;
}

function toolPointerUp(evt) {
  if (!isDrawing) return;
  const pt = getMousePos(evt);
  const snapped = snapToPoint(pt);
  const endPt = snapped || pt;

  if (currentTool === 'draw') {
    drawings.draw.push({ points: [startPt, endPt] });
  } else if (currentTool === 'rect') {
    drawings.draw.push({ isRect: true, points: [startPt, endPt] });
  } else if (currentTool === 'measure') {
    const dist = getDistance(startPt, endPt);
    drawings.measure.push({ points: [startPt, endPt], text: dist.toFixed(2) + ' px' });
  } else if (currentTool === 'text') {
    const text = prompt('Indtast tekst:');
    if (text) drawings.text.push({ points: [endPt], text });
  }
  isDrawing = false;
  computeSnapPoints(pdfCtx.canvas);
  redrawOverlay();
}

function getMousePos(evt) {
  const rect = overlayCanvas.getBoundingClientRect();
  return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
}

function snapToPoint(pt) {
  let nearest = null;
  let minDist = SNAP_THRESHOLD;
  snapPoints.forEach(sp => {
    const d = getDistance(pt, sp);
    if (d < minDist) {
      minDist = d;
      nearest = sp;
    }
  });
  return nearest;
}

function getDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function setupLayerToggles() {
  document.querySelectorAll('#layers input').forEach(chk => {
    chk.addEventListener('change', redrawOverlay);
  });
}

function redrawOverlay() {
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  ['draw','measure','text'].forEach(layer => {
    const visible = document.querySelector(`input[data-layer="${layer}"]`).checked;
    if (!visible) return;
    overlayCtx.save();
    overlayCtx.strokeStyle = layer === 'measure' ? '#e91e63' : '#007acc';
    overlayCtx.fillStyle = '#e91e63';
    overlayCtx.lineWidth = 2;
    drawings[layer].forEach(item => {
      if (layer === 'draw') drawShape(item);
      if (layer === 'measure') drawMeasure(item);
      if (layer === 'text') drawText(item);
    });
    overlayCtx.restore();
  });
}

function drawShape(item) {
  const [a, b] = item.points;
  if (item.isRect) {
    overlayCtx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
  } else {
    overlayCtx.beginPath();
    overlayCtx.moveTo(a.x, a.y);
    overlayCtx.lineTo(b.x, b.y);
    overlayCtx.stroke();
  }
}

function drawMeasure(item) {
  drawShape(item);
  const [a, b] = item.points;
  const mid = { x: (a.x + b.x)/2, y: (a.y + b.y)/2 };
  overlayCtx.fillText(item.text, mid.x + 5, mid.y - 5);
}

function drawText(item) {
  const [pt] = item.points;
  overlayCtx.fillText(item.text, pt.x, pt.y);
}

function setupExport() {
  document.getElementById('exportPdf').addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: [pdfCanvas.width, pdfCanvas.height] });
    // Tilføj PDF-side
    doc.addImage(pdfCanvas.toDataURL('image/png'), 'PNG', 0, 0);
    // Tilføj annotations
    doc.addImage(overlayCanvas.toDataURL('image/png'), 'PNG', 0, 0);
    doc.save('annoteret.pdf');
  });
}

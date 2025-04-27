// Initialiser Fabric.js canvas
const canvas = new fabric.Canvas('c', { selection: false });

// Resize canvas til vindue
function resize() {
  const toolbarHeight = document.getElementById('toolbar').offsetHeight;
  canvas.setWidth(window.innerWidth);
  canvas.setHeight(window.innerHeight - toolbarHeight);
  canvas.renderAll();
}
window.addEventListener('resize', resize);
resize();

// PDF-upload og visning på baggrund
document.getElementById('file-input').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file || file.type !== 'application/pdf') return alert('Vælg en PDF!');
  const reader = new FileReader();
  reader.onload = ev => {
    pdfjsLib.getDocument(new Uint8Array(ev.target.result)).promise
      .then(pdf => pdf.getPage(1))
      .then(page => {
        const vp = page.getViewport({ scale: 1.0 });
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
      })
      .catch(console.error);
  };
  reader.readAsArrayBuffer(file);
});

// Tegn rektangel-knap
document.querySelector('[data-tool="rect"]').addEventListener('click', () => {
  let rect = new fabric.Rect({
    left: 50, top: 50, width: 100, height: 60,
    fill: 'rgba(255,0,0,0.3)',
    stroke: 'red',
    strokeWidth: 2
  });
  canvas.add(rect);
});

// Undo/Redo
let state = [], idx = -1;
function saveState() {
  idx++;
  state.splice(idx);
  state.push(JSON.stringify(canvas));
}
canvas.on('object:added', saveState);
canvas.on('object:modified', saveState);

document.getElementById('undo').onclick = () => {
  if (idx > 0) {
    idx--;
    canvas.clear();
    canvas.loadFromJSON(state[idx], canvas.renderAll.bind(canvas));
  }
};
document.getElementById('redo').onclick = () => {
  if (idx < state.length - 1) {
    idx++;
    canvas.clear();
    canvas.loadFromJSON(state[idx], canvas.renderAll.bind(canvas));
  }
};

document.getElementById('file-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file && file.type === "application/pdf") {
        const fileReader = new FileReader();
        fileReader.onload = function() {
            const typedarray = new Uint8Array(this.result);
            pdfjsLib.getDocument(typedarray).promise.then(function(pdf) {
                pdf.getPage(1).then(function(page) {
                    const canvas = document.getElementById('pdf-canvas');
                    const context = canvas.getContext('2d');
                    const viewport = page.getViewport({scale: 1.5});
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    page.render({canvasContext: context, viewport: viewport});
                });
            });
        };
        fileReader.readAsArrayBuffer(file);
    }
});

function setTool(tool) { console.log('Værktøj valgt:', tool); }
function undo() { console.log('Fortryd'); }
function redo() { console.log('Gendan'); }
function saveProject() { console.log('Gem projekt'); }
function exportPDF() { console.log('Eksportér PDF'); }

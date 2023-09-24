import "/dist/jszip.js"; // https://github.com/Stuk/jszip/)

const maxColors = 64;

const input = document.getElementById("inputZip");
const output = document.getElementById("output");

let zipToSave;

const vertexShaderSource = `
attribute vec2 position;
varying vec2 u_coords;

void main() {
   gl_Position = vec4(position, 0, 1);
   u_coords = gl_Position.xy * 0.5 + 0.5;
}
`;
const fragmentShaderSource = `
precision mediump float;
varying vec2 u_coords;

uniform sampler2D u_texture;
uniform int colorsCount;
uniform vec3 colorsToReplace[${maxColors}];
uniform vec3 colorsToReplaceWith[${maxColors}];

void main() {
   vec2 uv = u_coords;
   uv.y = 1.0 - uv.y;
   vec4 color = texture2D(u_texture, uv);
   for (int i = 0; i < ${maxColors}; i++) {
      if (i > colorsCount) break;
      if (length(color.rgb - colorsToReplace[i]) < 0.01) {
         color.rgb = colorsToReplaceWith[i];
      }
      // if (length(color.rgb - vec3(0.71, 0.75, 1)) < 0.01) {
      // color.rgb = vec3(0.96, 0.76, 0.91);
   }
   gl_FragColor = color;
}`

function compileShader(gl, type, shaderSource) {
   const shader = gl.createShader(type);
   gl.shaderSource(shader, shaderSource);
   gl.compileShader(shader);

   const outcome = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
   if (outcome === false) {
      // logging the error message on failure
      console.error(gl.getShaderInfoLog(shader));

      gl.deleteShader(shader);
   }

   return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
   const program = gl.createProgram();
   gl.attachShader(program, vertexShader);
   gl.attachShader(program, fragmentShader);
   gl.linkProgram(program);

   const outcome = gl.getProgramParameter(program, gl.LINK_STATUS);
   if (outcome === false) {
      // logging the error message on failure
      console.error(gl.getProgramInfoLog(program));

      gl.deleteProgram(program);
   }

   return program;
}

const canvas = document.createElement("canvas");
const gl = canvas.getContext("webgl");

const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

const shaderProgram = createProgram(gl, vertexShader, fragmentShader);

const positionAttributeLocation = gl.getAttribLocation(shaderProgram, "position");

// binding the position buffer to positionBuffer
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

// using the program defined above
gl.useProgram(shaderProgram);
// enabling the texcoord attribute
gl.enableVertexAttribArray(positionAttributeLocation);

// telling positionAttributeLocation how to retrieve data out of positionBuffer
gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

// provide the texture coordinates
gl.bufferData(
   gl.ARRAY_BUFFER,
   new Float32Array([-1, -1, -1, 1, 1, -1, 1, 1, 1, -1, -1, 1]),
   gl.STATIC_DRAW
);

async function applyShader(image) {
   canvas.width = image.width;
   canvas.height = image.height;

   gl.clearColor(1, 1, 1, 1);
   gl.clear(gl.COLOR_BUFFER_BIT);

   gl.viewport(0, 0, canvas.width, canvas.height);

   // loading the original image as a texture
   const texture = gl.createTexture();
   texture.image = new Image();
   // setting the anonymous mode
   texture.image.crossOrigin = "";
   texture.image.src = image.src;
   // wait for image to load
   await texture.image.decode();

   gl.bindTexture(gl.TEXTURE_2D, texture);
   // setting the parameters to be able to render any image,
   // regardless of its size
   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

   // loading the original image as a texture
   gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      texture.image
   );
   gl.drawArrays(gl.TRIANGLES, 0, 6);

   //return new image
   const newImage = document.createElement("img");
   newImage.src = canvas.toDataURL();
   return newImage;
}

function hexToRgb(hex) {
   const hexRgb = hex.match(/.{1,2}/g);
   return [
      parseInt(hexRgb[0], 16) / 255,
      parseInt(hexRgb[1], 16) / 255,
      parseInt(hexRgb[2], 16) / 255
   ];
}

let renderImagesCallId = 0;
async function renderImages() {
   // clear output and get file
   output.innerHTML = "<div></div>";
   const file = input.files[0];
   if (file == null) return;

   //disable download button
   document.getElementById("downloadButton").disabled = true;

   // get current output and id (for stopping this function)
   const currentOutput = output.children[0];
   const myId = ++renderImagesCallId;

   // get colors
   const colorsInput = document.getElementById("colorList").value;
   let colorCount = 0;
   for (const text of colorsInput.split("\n")) {
      const results = /(0x|#)?([0-9a-fA-F]{6})\s*(0x|#)?([0-9a-fA-F]{6})/.exec(text);
      if (results != null) {
         gl.uniform3fv(gl.getUniformLocation(shaderProgram, `colorsToReplace[${colorCount}]`), hexToRgb(results[2]));
         gl.uniform3fv(gl.getUniformLocation(shaderProgram, `colorsToReplaceWith[${colorCount}]`), hexToRgb(results[4]));

         if (++colorCount >= maxColors) break;
      }
   }
   gl.uniform1i(gl.getUniformLocation(shaderProgram, "colorsCount"), colorCount);

   // create zip
   const newZip = new JSZip();
   // read zip
   const zip = await JSZip.loadAsync(file)
   const files = [];

   zip.forEach(function (relativePath, zipEntry) {
      files[zipEntry.name] = zipEntry;
   });

   for (const name of Object.keys(files)) {
      if (myId != renderImagesCallId) return;
      if (name.substring(name.length - 1) == "/") continue;

      let folderToSave = newZip;
      const path = name.split("/");
      for (let i = 0; i < path.length - 1; i++) {
         folderToSave = folderToSave.folder(path[i]);
      }
      const fileName = path[path.length - 1];

      const zipEntry = files[name];
      const text = document.createElement("p");
      text.innerText = name;
      currentOutput.appendChild(text);

      if (/\.png$/.test(name)) {
         var binary = '';
         var bytes = new Uint8Array(await zipEntry.async("uint8array"));
         var len = bytes.byteLength;
         for (var i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
         }

         const image = document.createElement("img");
         image.src = 'data:image/png;base64,' + window.btoa(binary);
         await image.decode();
         const newImage = await applyShader(image);
         currentOutput.appendChild(newImage);

         folderToSave.file(fileName, newImage.src.replace(/^data:image\/?[A-z]*;base64,/, ''), { base64: true })
      } else {
         folderToSave.file(fileName, await zipEntry.async("string"))
      }
   }

   // set new zip to download and enable download button
   zipToSave = newZip;
   document.getElementById("downloadButton").disabled = false;
}

function downloadOutput() {
   if (zipToSave == null) return;
   zipToSave.generateAsync({ type: "base64" }).then(function(base64) {
      const link = document.createElement('a');
      link.download = 'nya.zip';
      link.href = "data:application/zip;base64," + base64;
      link.click();
      link.delete;
   })
}

input.addEventListener("change", renderImages);
document.getElementById("reloadInput").onclick = renderImages;
document.getElementById("downloadButton").onclick = downloadOutput;
# GLE GS3D
A typescript port of Mark Kellogg's excellent [GaussianSplats3D](https://github.com/mkkellogg/GaussianSplats3D) project.

## Demo
[demo](https://guyettinger.github.io/gle-scene-components/?path=/story/gle-scene-components-sceneview--gaussian-splat-clouds)

## Building and running locally
Install
```
npm install
```
Build Library
```
npm run build
```
Build Demo
```
npm run build-demo
```
Run Demo
```
npm run demo
```
The demo will be accessible locally at [http://127.0.0.1:8080/index.html](http://127.0.0.1:8080/index.html). You will need to download the data for the demo scenes and extract them into 
```
<code directory>/public/demo/assets/data
```
The demo scene data is available here: [https://projects.markkellogg.org/downloads/gaussian_splat_data.zip](https://projects.markkellogg.org/downloads/gaussian_splat_data.zip)
<br>
<br>
## Usage

To run the built-in viewer:

```typescript
import { Viewer } from 'gle-gs3d'
const viewer = new Viewer({
  'cameraUp': [0, -1, -0.6],
  'initialCameraPosition': [-1, -4, 6],
  'initialCameraLookAt': [0, 4, 0]
});
viewer.init();
viewer.loadFile('<path to .ply or .splat file>', {
    'splatAlphaRemovalThreshold': 5, // out of 255
    'halfPrecisionCovariancesOnGPU': true
})
.then(() => {
    viewer.start();
});
```
As an alternative to using `cameraUp` to adjust to the scene's natural orientation, you can pass an orientation (and/or position) to the `loadFile()` method to transform the entire scene:
```typescript
import { Viewer } from 'gle-gs3d'
import { Quaternion, Vector3 } from 'three'
const viewer = new Viewer({
    'initialCameraPosition': [-1, -4, 6],
    'initialCameraLookAt': [0, 4, 0]
});
const orientation = new Quaternion();
orientation.setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(0, -1, 0.6).normalize());
viewer.init();
viewer.loadFile('<path to .ply or .splat file>', {
    'splatAlphaRemovalThreshold': 5, // out of 255
    'halfPrecisionCovariancesOnGPU': true,
    'position': [0, 0, 0],
    'orientation': orientation.toArray(),
})
.then(() => {
    viewer.start();
});
```

The `loadFile()` method will accept the original `.ply` files as well as my custom `.splat` files.
<br>
<br>
### Creating SPLAT files
To convert a `.ply` file into the stripped-down `.splat` format (currently only compatible with this viewer):

```typescript
import { PlyLoader, SplatLoader } from 'gle-gs3d'
const compressionLevel = 1;
const splatAlphaRemovalThreshold = 10;
const plyLoader = new PlyLoader();
plyLoader.loadFromFile('<path to .ply file>', compressionLevel, splatAlphaRemovalThreshold)
.then((splatBuffer) => {
    new SplatLoader(splatBuffer).saveToFile('converted_file.splat');
});
```
This code will prompt your browser to automatically start downloading the converted `.splat` file. Currently supported values for `compressionLevel` are `0` or `1`. `0` means no compression, `1` means compression of scale, rotation, and position values from 32-bit to 16-bit.
<br>
<br>
### Integrating THREE.js scenes
It is now possible to integrate your own Three.js scene into the viewer (still somewhat experimental). The `Viewer` class now accepts two parameters by which you can pass in any 'normal' Three.js objects you want to be rendered along with the splats: `scene` and/or `simpleScene`. Rendering the splats correctly with external objects requires a special sequence of steps so the viewer needs to be aware of them:
```typescript
import { Viewer } from 'gle-gs3d'
import { Scene, Box, Mesh, MeshBasicMaterial } from 'three'
const scene = new Scene();

const boxColor = 0xBBBBBB;
const boxGeometry = new BoxGeometry(2, 2, 2);
const boxMesh = new Mesh(boxGeometry, new MeshBasicMaterial({'color': boxColor}));
scene.add(boxMesh);
boxMesh.position.set(3, 2, 2);

const viewer = new Viewer({
  'scene': scene,
  'cameraUp': [0, -1, -0.6],
  'initialCameraPosition': [-1, -4, 6],
  'initialCameraLookAt': [0, 4, -0]
});
viewer.init();
viewer.loadFile('<path to .ply or .splat file>')
.then(() => {
    viewer.start();
});
```
The difference between the `scene` and `simpleScene` parameters is a matter of optimization. Objects contained in `scene` will have their depths rendered using their standard shader, but objects contained in `simpleScene` will have their depths rendered using a very simple override shader.

The viewer allows for various levels of customization via constructor parameters. You can control when its `update()` and `render()` methods are called by passing `false` for the `selfDrivenMode` parameter and then calling those methods whenever/wherever you decide is appropriate. You can tell the viewer to not use its built-in camera controls by passing `false` for the `useBuiltInControls` parameter. You can also use your own Three.js renderer and camera by passing those values to the viewer's constructor. The sample below shows all of these options:

```typescript
import { Viewer } from 'gle-gs3d'
import { WebGLRenderer, PerspectiveCamera, Vector3 } from 'three'
const renderWidth = 800;
const renderHeight = 600;

const rootElement = document.createElement('div');
rootElement.style.width = renderWidth + 'px';
rootElement.style.height = renderHeight + 'px';
document.body.appendChild(rootElement);

const renderer = new WebGLRenderer({
    antialias: false
});
renderer.setSize(renderWidth, renderHeight);
rootElement.appendChild(renderer.domElement);

const camera = new PerspectiveCamera(65, renderWidth / renderHeight, 0.1, 500);
camera.position.copy(new Vector3().fromArray([-1, -4, 6]));
camera.lookAt(new Vector3().fromArray([0, 4, -0]));
camera.up = new Vector3().fromArray([0, -1, -0.6]).normalize();

const viewer = new Viewer({
    'selfDrivenMode': false,
    'renderer': renderer,
    'camera': camera,
    'useBuiltInControls': false
});
viewer.init();
viewer.loadFile('<path to .ply or .splat file>')
.then(() => {
    requestAnimationFrame(update);
});
```
Since `selfDrivenMode` is false, it is up to the developer to call the `update()` and `render()` methods on the `Viewer` class:
```typescript
function update() {
    requestAnimationFrame(update);
    viewer.update();
    viewer.render();
}
```
## Controls
Mouse
- Left click and drag to orbit around the focal point
- Right click and drag to pan the camera and focal point
  
Keyboard
- `C` Toggles the mesh cursor, which shows where a ray projected from the mouse cursor intersects the splat mesh

- `I` Toggles an info panel that displays the mesh cursor position, current FPS, and current window size
## Deploy
Shared Memory requires [Cross-origin Isolation to be configured](https://web.dev/articles/coop-coep) in deployment.  

This can be achieved by setting response headers on your server:
```
response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
```
... or deploying [coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker) in your webpage:
```html
<script src="coi-serviceworker.js"></script>
```
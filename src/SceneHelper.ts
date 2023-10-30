import {
    BoxGeometry, Camera,
    Color, ColorRepresentation,
    ConeGeometry, FrontSide,
    Mesh,
    MeshBasicMaterial,
    Object3D, Scene,
    ShaderMaterial,
    SphereGeometry, Vector3, Vector3Tuple
} from "three";

export class SceneHelper {
    debugRoot?: Object3D;
    meshCursor: Object3D | null;
    scene: Scene;
    secondaryDebugRoot?: Object3D;
    simpleScene: Scene;

    constructor(scene: Scene, simpleScene: Scene) {
        this.scene = scene;
        this.simpleScene = simpleScene;
        this.meshCursor = null;
    }

    setupMeshCursor() {
        if (!this.meshCursor) {
            const coneGeometry = new ConeGeometry(0.5, 1.5, 32);
            const coneMaterial = new MeshBasicMaterial({color: 0xFFFFFF});

            const downArrow = new Mesh(coneGeometry, coneMaterial);
            downArrow.rotation.set(0, 0, Math.PI);
            downArrow.position.set(0, 1, 0);
            const upArrow = new Mesh(coneGeometry, coneMaterial);
            upArrow.position.set(0, -1, 0);
            const leftArrow = new Mesh(coneGeometry, coneMaterial);
            leftArrow.rotation.set(0, 0, Math.PI / 2.0);
            leftArrow.position.set(1, 0, 0);
            const rightArrow = new Mesh(coneGeometry, coneMaterial);
            rightArrow.rotation.set(0, 0, -Math.PI / 2.0);
            rightArrow.position.set(-1, 0, 0);

            this.meshCursor = new Object3D();
            this.meshCursor.add(downArrow);
            this.meshCursor.add(upArrow);
            this.meshCursor.add(leftArrow);
            this.meshCursor.add(rightArrow);
            this.meshCursor.scale.set(0.1, 0.1, 0.1);
            this.simpleScene.add(this.meshCursor);
            this.meshCursor.visible = false;
        }
    }

    destroyMeshCursor() {
        if (this.meshCursor) {
            this.meshCursor.children.forEach((child: any) => {
                child.geometry.dispose();
                child.material.dispose();
            });
            this.simpleScene.remove(this.meshCursor);
            this.meshCursor = null;
        }
    }

    setMeshCursorVisibility(visible: boolean) {
        if (!this.meshCursor) return;
        this.meshCursor.visible = visible;
    }

    setMeshCursorPosition(position: Vector3) {
        if (!this.meshCursor) return;
        this.meshCursor.position.copy(position);
    }

    positionAndOrientMeshCursor(position: Vector3, camera: Camera) {
        if (!this.meshCursor) return;
        this.meshCursor.position.copy(position);
        this.meshCursor.up.copy(camera.up);
        this.meshCursor.lookAt(camera.position);
    }

    addDebugMeshes() {
        this.debugRoot = this.createDebugMeshes();
        this.secondaryDebugRoot = this.createSecondaryDebugMeshes();
        this.simpleScene.add(this.debugRoot);
        this.simpleScene.add(this.secondaryDebugRoot);
    }

    createDebugMeshes(renderOrder?: number) {
        const sphereGeometry = new SphereGeometry(1, 32, 32);
        const debugMeshRoot = new Object3D();

        const createMesh = (color: ColorRepresentation, position: Vector3Tuple) => {
            let sphereMesh = new Mesh(sphereGeometry, SceneHelper.buildDebugMaterial(color));
            if (renderOrder) {
                sphereMesh.renderOrder = renderOrder;
            }
            debugMeshRoot.add(sphereMesh);
            sphereMesh.position.fromArray(position);
        };

        createMesh(0xff0000, [-50, 0, 0]);
        createMesh(0xff0000, [50, 0, 0]);
        createMesh(0x00ff00, [0, 0, -50]);
        createMesh(0x00ff00, [0, 0, 50]);
        createMesh(0xffaa00, [5, 0, 5]);

        return debugMeshRoot;
    }

    createSecondaryDebugMeshes(renderOrder: number = 0) {
        const boxGeometry = new BoxGeometry(3, 3, 3);
        const debugMeshRoot = new Object3D();

        let boxColor = 0xBBBBBB;
        const createMesh = (position: any) => {
            let boxMesh = new Mesh(boxGeometry, SceneHelper.buildDebugMaterial(boxColor));
            boxMesh.renderOrder = renderOrder;
            debugMeshRoot.add(boxMesh);
            boxMesh.position.fromArray(position);
        };

        let separation = 10;
        createMesh([-separation, 0, -separation]);
        createMesh([-separation, 0, separation]);
        createMesh([separation, 0, -separation]);
        createMesh([separation, 0, separation]);

        return debugMeshRoot;
    }

    static buildDebugMaterial(color: ColorRepresentation) {
        const vertexShaderSource = `
            #include <common>
            varying float ndcDepth;

            void main() {
                gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position.xyz, 1.0);
                ndcDepth = gl_Position.z / gl_Position.w;
                gl_Position.x = gl_Position.x / gl_Position.w;
                gl_Position.y = gl_Position.y / gl_Position.w;
                gl_Position.z = 0.0;
                gl_Position.w = 1.0;
    
            }
        `;

        const fragmentShaderSource = `
            #include <common>
            uniform vec3 color;
            varying float ndcDepth;
            void main() {
                gl_FragDepth = (ndcDepth + 1.0) / 2.0;
                gl_FragColor = vec4(color.rgb, 0.0);
            }
        `;

        const uniforms = {
            'color': {
                'type': 'v3',
                'value': new Color(color)
            },
        };

        const material = new ShaderMaterial({
            uniforms: uniforms,
            vertexShader: vertexShaderSource,
            fragmentShader: fragmentShaderSource,
            transparent: false,
            depthTest: true,
            depthWrite: true,
            side: FrontSide
        });
        material.extensions.fragDepth = true;

        return material;
    }
}

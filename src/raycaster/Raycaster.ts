import { Camera, Matrix4, OrthographicCamera, PerspectiveCamera, Quaternion, Vector2, Vector3 } from "three";
import { Ray } from './Ray';
import { Hit } from './Hit';
import { SplatMesh } from "../SplatMesh";
import { SplatTree } from "../splattree/SplatTree";
import { SplatTreeNode } from "../splattree/SplatTreeNode";

export class Raycaster {
    ray: Ray;
    private camera: Camera | null = null;

    constructor(origin?: Vector3, direction?: Vector3) {
        this.ray = new Ray(origin, direction);
    }

    setFromCameraAndScreenPosition = function () {

        const ndcCoords = new Vector2();

        return function (this: Raycaster, camera: Camera, screenPosition: Vector2, screenDimensions: Vector2) {
            ndcCoords.x = screenPosition.x / screenDimensions.x * 2.0 - 1.0;
            ndcCoords.y = (screenDimensions.y - screenPosition.y) / screenDimensions.y * 2.0 - 1.0;
            const genericCamera = camera as any;
            if (genericCamera.isPerspectiveCamera) {
                this.ray.origin.setFromMatrixPosition(camera.matrixWorld);
                this.ray.direction.set(ndcCoords.x, ndcCoords.y, 0.5).unproject(camera).sub(this.ray.origin).normalize();
                this.camera = camera;
            } else if (!genericCamera.isPerspectiveCamera) {
                this.ray.origin.set(screenPosition.x, screenPosition.y,
                    (genericCamera.near + genericCamera.far) / (genericCamera.near - genericCamera.far)).unproject(camera);
                this.ray.direction.set(0, 0, -1).transformDirection(camera.matrixWorld);
                this.camera = camera;
            } else {
                throw new Error('Raycaster::setFromCameraAndScreenPosition() -> Unsupported camera type');
            }
        };

    }();

    intersectSplatMesh = function () {

        const toLocal = new Matrix4();
        const fromLocal = new Matrix4();
        const localRay = new Ray();

        return function (this: Raycaster, splatMesh: SplatMesh, outHits: Hit[] = []) {
            fromLocal.copy(splatMesh.matrixWorld);
            toLocal.copy(fromLocal).invert();
            localRay.origin.copy(this.ray.origin).applyMatrix4(toLocal);
            localRay.direction.copy(this.ray.direction).transformDirection(toLocal);

            const splatTree = splatMesh.getSplatTree();
            if (splatTree?.rootNode) {
                this.castRayAtSplatTreeNode(localRay, splatTree, splatTree.rootNode, outHits);
            }
            outHits.sort((a, b) => {
                if (a.distance > b.distance) return 1;
                else return -1;
            });
            outHits.forEach((hit) => {
                hit.origin.applyMatrix4(fromLocal);
                hit.normal.transformDirection(fromLocal);
            });
            return outHits;
        };

    }();

    castRayAtSplatTreeNode = function () {

        const tempPosition = new Vector3();
        const tempScale = new Vector3();
        const tempRotation = new Quaternion();
        const tempHit = new Hit();

        // Used for raycasting against splat ellipsoid
        /*
        const origin = new Vector3();
        const tempRotationMatrix = new Matrix4();
        const tempScaleMatrix = new Matrix4();
        const tempMatrix = new Matrix4();
        const tempMatrix3 = new Matrix3();
        const tempRay = new Ray();
        */

        return function (this: Raycaster, ray: Ray, splatTree: SplatTree, node: SplatTreeNode, outHits: Hit[] = []) {
            if (!ray.intersectBox(node.boundingBox, new Hit())) {
                return;
            }
            if (node.data.indexes && node.data.indexes.length > 0) {
                for (let i = 0; i < node.data.indexes.length; i++) {
                    const splatIndex = node.data.indexes[i];
                    splatTree.splatBuffer.getPosition(splatIndex, tempPosition);
                    splatTree.splatBuffer.getRotation(splatIndex, tempRotation);
                    splatTree.splatBuffer.getScale(splatIndex, tempScale);

                    // Simple approximated sphere intersection
                    const radius = Math.max(Math.max(tempScale.x, tempScale.y), tempScale.z);
                    if (ray.intersectSphere(tempPosition, radius, tempHit)) {
                        outHits.push(tempHit.clone());
                    }

                }
            }
            if (node.children && node.children.length > 0) {
                for (let child of node.children) {
                    this.castRayAtSplatTreeNode(ray, splatTree, child, outHits);
                }
            }
            return outHits;
        };

    }();
}

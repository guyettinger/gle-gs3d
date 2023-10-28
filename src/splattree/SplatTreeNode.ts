import { Box3, Vector3 } from "three";

let idGen = 0;

export class SplatTreeNode {
    boundingBox: Box3;
    center: Vector3;
    children: SplatTreeNode[];
    data: any;
    depth: number;
    id: any;
    max: Vector3;
    min: Vector3;

    constructor(min: Vector3, max: Vector3, depth: number, id: any = null) {
        this.min = new Vector3().copy(min);
        this.max = new Vector3().copy(max);
        this.boundingBox = new Box3(this.min, this.max);
        this.center = new Vector3().copy(this.max).sub(this.min).multiplyScalar(0.5).add(this.min);
        this.depth = depth;
        this.children = [];
        this.data = null;
        this.id = id || idGen++;
    }
}

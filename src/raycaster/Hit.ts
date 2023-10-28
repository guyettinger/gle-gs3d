import { Vector3 } from "three";

export class Hit {
    distance: number;
    normal: Vector3;
    origin: Vector3;

    constructor() {
        this.origin = new Vector3();
        this.normal = new Vector3();
        this.distance = 0;
    }

    set(origin: Vector3, normal: Vector3, distance: number) {
        this.origin.copy(origin);
        this.normal.copy(normal);
        this.distance = distance;
    }

    clone() {
        const hitClone = new Hit();
        hitClone.origin.copy(this.origin);
        hitClone.normal.copy(this.normal);
        hitClone.distance = this.distance;
        return hitClone;
    }
}

import { Box3, Vector3 } from "three";
import { SplatTreeNode } from './SplatTreeNode';
import { SplatBuffer } from "../SplatBuffer";

export class SplatTree {
    addedIndexes: any;
    maxDepth: number;
    maxPositionsPerNode: number;
    nodesWithIndexes: SplatTreeNode[];
    rootNode: SplatTreeNode | null;
    sceneDimensions: any;
    sceneMax: any;
    sceneMin: any;
    splatBuffer: any;

    constructor(maxDepth: number, maxPositionsPerNode: number) {
        this.maxDepth = maxDepth;
        this.maxPositionsPerNode = maxPositionsPerNode;
        this.splatBuffer = null;
        this.sceneDimensions = new Vector3();
        this.sceneMin = new Vector3();
        this.sceneMax = new Vector3();
        this.rootNode = null;
        this.addedIndexes = {};
        this.nodesWithIndexes = [];
    }

    processSplatBuffer(splatBuffer: SplatBuffer, filterFunc = (splatIndex?: number) => true) {
        this.splatBuffer = splatBuffer;
        this.addedIndexes = {};
        this.nodesWithIndexes = [];
        const splatCount = splatBuffer.getSplatCount();

        const position = new Vector3();
        for (let i = 0; i < splatCount; i++) {
            if (filterFunc(i)) {
                splatBuffer.getPosition(i, position);
                if (i === 0 || position.x < this.sceneMin.x) this.sceneMin.x = position.x;
                if (i === 0 || position.x > this.sceneMax.x) this.sceneMax.x = position.x;
                if (i === 0 || position.y < this.sceneMin.y) this.sceneMin.y = position.y;
                if (i === 0 || position.y > this.sceneMax.y) this.sceneMax.y = position.y;
                if (i === 0 || position.z < this.sceneMin.z) this.sceneMin.z = position.z;
                if (i === 0 || position.z > this.sceneMax.z) this.sceneMax.z = position.z;
            }
        }

        this.sceneDimensions.copy(this.sceneMin).sub(this.sceneMin);

        const indexes = [];
        for (let i = 0; i < splatCount; i++) {
            if (filterFunc(i)) {
                indexes.push(i);
            }
        }

        this.rootNode = new SplatTreeNode(this.sceneMin, this.sceneMax, 0);
        this.rootNode.data = {
            'indexes': indexes
        };
        this.processNode(this.rootNode, splatBuffer);
    }

    processNode(node: SplatTreeNode, splatBuffer: SplatBuffer) {
        const splatCount = node.data.indexes.length;

        if (splatCount < this.maxPositionsPerNode || node.depth > this.maxDepth) {
            const newIndexes = [];
            for (let i = 0; i < node.data.indexes.length; i++) {
                if (!this.addedIndexes[node.data.indexes[i]]) {
                    newIndexes.push(node.data.indexes[i]);
                    this.addedIndexes[node.data.indexes[i]] = true;
                }
            }
            node.data.indexes = newIndexes;
            this.nodesWithIndexes.push(node);
            return;
        }

        const nodeDimensions = new Vector3().copy(node.max).sub(node.min);
        const halfDimensions = new Vector3().copy(nodeDimensions).multiplyScalar(0.5);

        const nodeCenter = new Vector3().copy(node.min).add(halfDimensions);

        const childrenBounds = [
            // top section, clockwise from upper-left (looking from above, +Y)
            new Box3(new Vector3(nodeCenter.x - halfDimensions.x, nodeCenter.y, nodeCenter.z - halfDimensions.z),
                new Vector3(nodeCenter.x, nodeCenter.y + halfDimensions.y, nodeCenter.z)),
            new Box3(new Vector3(nodeCenter.x, nodeCenter.y, nodeCenter.z - halfDimensions.z),
                new Vector3(nodeCenter.x + halfDimensions.x, nodeCenter.y + halfDimensions.y, nodeCenter.z)),
            new Box3(new Vector3(nodeCenter.x, nodeCenter.y, nodeCenter.z),
                new Vector3(nodeCenter.x + halfDimensions.x,
                    nodeCenter.y + halfDimensions.y, nodeCenter.z + halfDimensions.z)),
            new Box3(new Vector3(nodeCenter.x - halfDimensions.x, nodeCenter.y, nodeCenter.z),
                new Vector3(nodeCenter.x, nodeCenter.y + halfDimensions.y, nodeCenter.z + halfDimensions.z)),

            // bottom section, clockwise from lower-left (looking from above, +Y)
            new Box3(new Vector3(nodeCenter.x - halfDimensions.x,
                    nodeCenter.y - halfDimensions.y, nodeCenter.z - halfDimensions.z),
                new Vector3(nodeCenter.x, nodeCenter.y, nodeCenter.z)),
            new Box3(new Vector3(nodeCenter.x, nodeCenter.y - halfDimensions.y, nodeCenter.z - halfDimensions.z),
                new Vector3(nodeCenter.x + halfDimensions.x, nodeCenter.y, nodeCenter.z)),
            new Box3(new Vector3(nodeCenter.x, nodeCenter.y - halfDimensions.y, nodeCenter.z),
                new Vector3(nodeCenter.x + halfDimensions.x, nodeCenter.y, nodeCenter.z + halfDimensions.z)),
            new Box3(new Vector3(nodeCenter.x - halfDimensions.x, nodeCenter.y - halfDimensions.y, nodeCenter.z),
                new Vector3(nodeCenter.x, nodeCenter.y, nodeCenter.z + halfDimensions.z)),
        ];

        const splatCounts = [];
        const baseIndexes = [];
        for (let i = 0; i < childrenBounds.length; i++) {
            splatCounts[i] = 0;
            baseIndexes[i] = [];
        }

        const position = new Vector3();
        for (let i = 0; i < splatCount; i++) {
            const splatIndex = node.data.indexes[i];
            splatBuffer.getPosition(splatIndex, position);
            for (let j = 0; j < childrenBounds.length; j++) {
                if (childrenBounds[j].containsPoint(position)) {
                    splatCounts[j]++;
                    // @ts-expect-error TS(2345): Argument of type 'any' is not assignable to parame... Remove this comment to see the full error message
                    baseIndexes[j].push(splatIndex);
                }
            }
        }

        for (let i = 0; i < childrenBounds.length; i++) {
            const childNode = new SplatTreeNode(childrenBounds[i].min, childrenBounds[i].max, node.depth + 1);
            childNode.data = {
                'indexes': baseIndexes[i]
            };
            node.children.push(childNode);
        }

        node.data = {};
        for (let child of node.children) {
            this.processNode(child, splatBuffer);
        }
    }


    countLeaves() {

        let leafCount = 0;
        this.visitLeaves(() => {
            leafCount++;
        });

        return leafCount;
    }

    visitLeaves(visitFunc: any) {

        const visitLeavesFromNode = (node: any, visitFunc: any) => {
            if (node.children.length === 0) visitFunc(node);
            for (let child of node.children) {
                visitLeavesFromNode(child, visitFunc);
            }
        };

        return visitLeavesFromNode(this.rootNode, visitFunc);
    }
}

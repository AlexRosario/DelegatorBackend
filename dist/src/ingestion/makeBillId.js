"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeBillId = makeBillId;
function makeBillId(congress, billType, billNumber) {
    return `${congress}-${billType.toLowerCase()}-${billNumber}`;
}

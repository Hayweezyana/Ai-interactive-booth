"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVideoProvider = getVideoProvider;
const bananaProvider_1 = require("./bananaProvider");
function getVideoProvider(name) {
    switch (name) {
        case 'banana':
        default:
            return bananaProvider_1.videoGen;
    }
}

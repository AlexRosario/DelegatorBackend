"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEmailValid = isEmailValid;
exports.isPhoneValid = isPhoneValid;
exports.isZipcodeValid = isZipcodeValid;
function isEmailValid(emailAddress) {
    // eslint-disable-next-line no-useless-escape
    const regex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    return !!emailAddress.match(regex);
}
function isPhoneValid(phoneInput) {
    return !!(phoneInput.join('').length === 9);
}
function isZipcodeValid(zipcode) {
    const zipCodePattern = /^\d{5}(-\d{4})?$/;
    return zipCodePattern.test(zipcode);
}

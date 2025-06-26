export function isEmailValid(emailAddress: string) {
  // eslint-disable-next-line no-useless-escape
  const regex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
  return !!emailAddress.match(regex);
}

export function isPhoneValid(phoneInput: [string, string, string, string]) {
  return !!(phoneInput.join('').length === 9);
}

export function isZipcodeValid(zipcode: string) {
  const zipCodePattern = /^\d{5}(-\d{4})?$/;
  return zipCodePattern.test(zipcode);
}

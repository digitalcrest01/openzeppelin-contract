const { expect } = require('chai');
const { expectRevertCustomError } = require('../helpers/customError');

const ShortStrings = artifacts.require('$ShortStrings');

contract('ShortStrings', function () {
  before(async function () {
    this.mock = await ShortStrings.new();
  });

  for (const str of [0, 1, 16, 31, 32, 64, 1024].map(length => 'a'.repeat(length))) {
    describe(`with string length ${str.length}`, function () {
      it('encode / decode', async function () {
        if (str.length < 32) {
          const encoded = await this.mock.$toShortString(str);
          const encoded_len = parseInt(encoded.slice(64), 16);
          const encoded_str = web3.utils.toUtf8(encoded).slice(0, encoded_len);
          expect(encoded_str).to.be.equal(str);

          const length = await this.mock.$length(encoded);
          expect(length.toNumber()).to.be.equal(str.length);

          const decoded = await this.mock.$toString(encoded);
          expect(decoded).to.be.equal(str);
        } else {
          await expectRevertCustomError(this.mock.$toShortString(str), `StringTooLong("${str}")`);
        }
      });

      it('set / get with fallback', async function () {
        const { ret0 } = await this.mock
          .$setWithFallback(str, 0)
          .then(({ logs }) => logs.find(({ event }) => event == 'return$setWithFallback').args);

        expect(await this.mock.$toString(ret0)).to.be.equal(str.length < 32 ? str : '');

        const recovered = await this.mock.$getWithFallback(ret0, 0);
        expect(recovered).to.be.equal(str);
      });
    });
  }
});

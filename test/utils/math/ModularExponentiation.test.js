const { BN, expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const ModularExponentiationMock = artifacts.require('ModularExponentiationMock');

contract('ModularExponentiation', function (accounts) {
  const base = new BN('3');
  const exponent = new BN('200');
  const modulus = new BN('50');
  const zeroModulus = new BN('0');
  const result = new BN('1');

  beforeEach(async function () {
    this.modularExponentiation = await ModularExponentiationMock.new();
  });

  describe('modExp', function () {
    it('is correctly calculating modulus', async function () {
      expect(await this.modularExponentiation.modExp.call(base, exponent, modulus)).to.be.bignumber.equal(result);
    });

    it('is correctly reverting when modulus is zero', async function () {
      await expectRevert(
        this.modularExponentiation.modExp.call(base, exponent, zeroModulus),
        'ModularExponentiation: Can\'t calculate for modulus equal to zero',
      );
    });
  });
});

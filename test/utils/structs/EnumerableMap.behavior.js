const { expect } = require('chai');
const { ethers } = require('hardhat');

const zip = (array1, array2) => array1.map((item, index) => [item, array2[index]]);

function shouldBehaveLikeMap(zeroValue, events) {
  async function expectMembersMatch(methods, keys, values) {
    expect(keys.length).to.equal(values.length);
    expect(await methods.length()).to.equal(keys.length);
    expect([...await methods.keys()]).to.have.members(keys);
    
    for (const index in keys) {
      const key = keys[index];
      const value = values[index];

      expect(await methods.contains(key)).to.equal(true);
      expect(await methods.get(key)).to.equal(value);
    }

    expect(await Promise.all(keys.map((_, index) => methods.at(index)))).to.have.deep.members(zip(keys, values))
  }

  it('starts empty', async function () {
    expect(await this.methods.contains(this.keyA)).to.equal(false);

    await expectMembersMatch(this.methods, [], []);
  });

  describe('set', function () {
    it('adds a key', async function () {
      await expect(this.methods.set(this.keyA, this.valueA)).to.emit(this.map, events.setReturn).withArgs(true);

      await expectMembersMatch(this.methods, [this.keyA], [this.valueA]);
    });

    it('adds several keys', async function () {
      await this.methods.set(this.keyA, this.valueA);
      await this.methods.set(this.keyB, this.valueB);

      await expectMembersMatch(this.methods, [this.keyA, this.keyB], [this.valueA, this.valueB]);
      expect(await this.methods.contains(this.keyC)).to.equal(false);
    });

    it('returns false when adding keys already in the set', async function () {
      await this.methods.set(this.keyA, this.valueA);

      await expect(this.methods.set(this.keyA, this.valueA)).to.emit(this.map, events.setReturn).withArgs(false);

      await expectMembersMatch(this.methods, [this.keyA], [this.valueA]);
    });

    it('updates values for keys already in the set', async function () {
      await this.methods.set(this.keyA, this.valueA);
      await this.methods.set(this.keyA, this.valueB);

      await expectMembersMatch(this.methods, [this.keyA], [this.valueB]);
    });
  });

  describe('remove', function () {
    it('removes added keys', async function () {
      await this.methods.set(this.keyA, this.valueA);

      await expect(this.methods.remove(this.keyA)).to.emit(this.map, events.removeReturn).withArgs(true);

      expect(await this.methods.contains(this.keyA)).to.equal(false);
      await expectMembersMatch(this.methods, [], []);
    });

    it('returns false when removing keys not in the set', async function () {
      await expect(await this.methods.remove(this.keyA))
        .to.emit(this.map, events.removeReturn)
        .withArgs(false);

      expect(await this.methods.contains(this.keyA)).to.equal(false);
    });

    it('adds and removes multiple keys', async function () {
      // []

      await this.methods.set(this.keyA, this.valueA);
      await this.methods.set(this.keyC, this.valueC);

      // [A, C]

      await this.methods.remove(this.keyA);
      await this.methods.remove(this.keyB);

      // [C]

      await this.methods.set(this.keyB, this.valueB);

      // [C, B]

      await this.methods.set(this.keyA, this.valueA);
      await this.methods.remove(this.keyC);

      // [A, B]

      await this.methods.set(this.keyA, this.valueA);
      await this.methods.set(this.keyB, this.valueB);

      // [A, B]

      await this.methods.set(this.keyC, this.valueC);
      await this.methods.remove(this.keyA);

      // [B, C]

      await this.methods.set(this.keyA, this.valueA);
      await this.methods.remove(this.keyB);

      // [A, C]

      await expectMembersMatch(this.methods, [this.keyA, this.keyC], [this.valueA, this.valueC]);

      expect(await this.methods.contains(this.keyA)).to.equal(true);
      expect(await this.methods.contains(this.keyB)).to.equal(false);
      expect(await this.methods.contains(this.keyC)).to.equal(true);
    });
  });

  describe('read', function () {
    beforeEach(async function () {
      await this.methods.set(this.keyA, this.valueA);
    });

    describe('get', function () {
      it('existing value', async function () {
        expect(await this.methods.get(this.keyA)).to.be.equal(this.valueA);
      });

      it('missing value', async function () {
        const key = ethers.hexlify(this.keyB);
        await expect(this.methods.get(this.keyB)).to.be.revertedWithCustomError(this.map, 'EnumerableMapNonexistentKey')
          .withArgs(
          key.length == 66 ? key : ethers.zeroPadValue(key, 32),
        );
      });
    });

    describe('tryGet', function () {
      it('existing value', async function () {
        const result = await this.methods.tryGet(this.keyA);
        expect(result['0']).to.be.equal(true);
        expect(result['1'].toString()).to.be.equal(this.valueA.toString());
      });

      it('missing value', async function () {
        const result = await this.methods.tryGet(this.keyB);
        expect(result['0']).to.be.equal(false);
        expect(result['1'].toString()).to.be.equal(zeroValue.toString());
      });
    });
  });
}

module.exports = {
  shouldBehaveLikeMap,
};

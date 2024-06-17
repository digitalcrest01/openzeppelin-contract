const { ethers } = require('hardhat');
const { expect } = require('chai');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const { PANIC_CODES } = require('@nomicfoundation/hardhat-chai-matchers/panic');

const { TYPES } = require('../../../scripts/generate/templates/Heap.opts');

async function fixture() {
  const mock = await ethers.deployContract('$Heap');
  return { mock };
}

describe('Heap', function () {
  beforeEach(async function () {
    Object.assign(this, await loadFixture(fixture));
  });

  for (const { struct, valueType } of TYPES) {
    describe(struct, function () {
      const returnEvent = `return$pop_Heap_${struct}`;

      beforeEach(async function () {
        this.helper = {
          clear: (...args) => this.mock[`$clear_Heap_${struct}`](0, ...args),
          insert: (...args) => this.mock[`$insert(uint256,${valueType})`](0, ...args),
          length: (...args) => this.mock[`$length_Heap_${struct}`](0, ...args),
          pop: (...args) => this.mock[`$pop_Heap_${struct}`](0, ...args),
          top: (...args) => this.mock[`$top_Heap_${struct}`](0, ...args),
        };
      });

      it('starts empty', async function () {
        await expect(this.helper.top()).to.be.revertedWithPanic(PANIC_CODES.ARRAY_ACCESS_OUT_OF_BOUNDS);
        expect(await this.helper.length()).to.equal(0n);
      });

      it('pop from empty', async function () {
        await expect(this.helper.pop()).to.be.revertedWithPanic(PANIC_CODES.POP_ON_EMPTY_ARRAY);
      });

      it('clear', async function () {
        await this.helper.insert(42n);

        expect(await this.helper.length()).to.equal(1n);
        expect(await this.helper.top()).to.equal(42n);

        await this.helper.clear();

        expect(await this.helper.length()).to.equal(0n);
        await expect(this.helper.top()).to.be.revertedWithPanic(PANIC_CODES.ARRAY_ACCESS_OUT_OF_BOUNDS);
      });

      it('support duplicated items', async function () {
        expect(await this.helper.length()).to.equal(0n);

        // insert 5 times
        await this.helper.insert(42n);
        await this.helper.insert(42n);
        await this.helper.insert(42n);
        await this.helper.insert(42n);
        await this.helper.insert(42n);

        // pop 5 times
        await expect(this.helper.pop()).to.emit(this.mock, returnEvent).withArgs(42n);
        await expect(this.helper.pop()).to.emit(this.mock, returnEvent).withArgs(42n);
        await expect(this.helper.pop()).to.emit(this.mock, returnEvent).withArgs(42n);
        await expect(this.helper.pop()).to.emit(this.mock, returnEvent).withArgs(42n);
        await expect(this.helper.pop()).to.emit(this.mock, returnEvent).withArgs(42n);

        // popping a 6th time panics
        await expect(this.helper.pop()).to.be.revertedWithPanic(PANIC_CODES.POP_ON_EMPTY_ARRAY);
      });

      it('insert and pop', async function () {
        const heap = [];
        for (const { op, value } of [
          { op: 'insert', value: 712 }, // [712]
          { op: 'insert', value: 20 }, // [20, 712]
          { op: 'insert', value: 4337 }, // [20, 712, 4437]
          { op: 'pop' }, // 20, [712, 4437]
          { op: 'insert', value: 1559 }, // [712, 1159, 4437]
          { op: 'insert', value: 155 }, // [155, 712, 1159, 4437]
          { op: 'insert', value: 7702 }, // [155, 712, 1159, 4437, 7702]
          { op: 'pop' }, // 155, [712, 1159, 4437, 7702]
          { op: 'insert', value: 721 }, // [712, 721, 1159, 4437, 7702]
          { op: 'pop' }, // 712, [721, 1159, 4437, 7702]
          { op: 'pop' }, // 721, [1159, 4437, 7702]
          { op: 'pop' }, // 1159, [4437, 7702]
          { op: 'pop' }, // 4437, [7702]
          { op: 'pop' }, // 7702, []
          { op: 'pop' }, // panic
        ]) {
          switch (op) {
            case 'insert':
              await this.helper.insert(value);
              heap.push(value);
              heap.sort((a, b) => a - b);
              break;
            case 'pop':
              if (heap.length == 0) {
                await expect(this.helper.pop()).to.be.revertedWithPanic(PANIC_CODES.POP_ON_EMPTY_ARRAY);
              } else {
                await expect(this.helper.pop()).to.emit(this.mock, returnEvent).withArgs(heap.shift());
              }
              break;
          }
          expect(await this.helper.length()).to.equal(heap.length);
          if (heap.length == 0) {
            await expect(this.helper.top()).to.be.revertedWithPanic(PANIC_CODES.ARRAY_ACCESS_OUT_OF_BOUNDS);
          } else {
            expect(await this.helper.top()).to.equal(heap[0]);
          }
        }
      });
    });
  }
});

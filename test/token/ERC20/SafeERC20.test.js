const { shouldFail } = require('openzeppelin-test-helpers');

const ERC20ReturnFalseMock = artifacts.require('ERC20ReturnFalseMock');
const ERC20ReturnTrueMock = artifacts.require('ERC20ReturnTrueMock');
const ERC20NoReturnMock = artifacts.require('ERC20NoReturnMock');
const SafeERC20Wrapper = artifacts.require('SafeERC20Wrapper');

contract('SafeERC20', function ([_, hasNoCode]) {
  describe('with address that has no contract code', function () {
    beforeEach(async function () {
      this.wrapper = await SafeERC20Wrapper.new(hasNoCode);
    });

    shouldRevertOnAllCalls();
  });

  describe('with token that returns false on all calls', function () {
    beforeEach(async function () {
      this.wrapper = await SafeERC20Wrapper.new((await ERC20ReturnFalseMock.new()).address);
    });

    shouldRevertOnAllCalls();
  });

  describe('with token that returns true on all calls', function () {
    beforeEach(async function () {
      this.wrapper = await SafeERC20Wrapper.new((await ERC20ReturnTrueMock.new()).address);
    });

    shouldOnlyRevertOnErrors();
  });

  describe('with token that returns no boolean values', function () {
    beforeEach(async function () {
      this.wrapper = await SafeERC20Wrapper.new((await ERC20NoReturnMock.new()).address);
    });

    shouldOnlyRevertOnErrors();
  });
});

function shouldRevertOnAllCalls () {
  it('reverts on transfer', async function () {
    await shouldFail.reverting.withMessage(this.wrapper.transfer(), "SafeERC20: low-level call failed");
  });

  it('reverts on transferFrom', async function () {
    await shouldFail.reverting.withMessage(this.wrapper.transferFrom(), "SafeERC20: low-level call failed");
  });

  it('reverts on approve', async function () {
    await shouldFail.reverting.withMessage(this.wrapper.approve(0), "SafeERC20: low-level call failed");
  });

  it('reverts on increaseAllowance', async function () {
    await shouldFail.reverting.withMessage(this.wrapper.increaseAllowance(0), "SafeERC20: low-level call failed");
  });

  it('reverts on decreaseAllowance', async function () {
    await shouldFail.reverting.withMessage(this.wrapper.decreaseAllowance(0), "SafeERC20: low-level call failed");
  });
}

function shouldOnlyRevertOnErrors () {
  it('doesn\'t revert on transfer', async function () {
    await this.wrapper.transfer();
  });

  it('doesn\'t revert on transferFrom', async function () {
    await this.wrapper.transferFrom();
  });

  describe('approvals', function () {
    context('with zero allowance', function () {
      beforeEach(async function () {
        await this.wrapper.setAllowance(0);
      });

      it('doesn\'t revert when approving a non-zero allowance', async function () {
        await this.wrapper.approve(100);
      });

      it('doesn\'t revert when approving a zero allowance', async function () {
        await this.wrapper.approve(0);
      });

      it('doesn\'t revert when increasing the allowance', async function () {
        await this.wrapper.increaseAllowance(10);
      });

      it('reverts when decreasing the allowance', async function () {
        await shouldFail.reverting.withMessage(this.wrapper.decreaseAllowance(10), "SafeERC20: low-level call failed");
      });
    });

    context('with non-zero allowance', function () {
      beforeEach(async function () {
        await this.wrapper.setAllowance(100);
      });

      it('reverts when approving a non-zero allowance', async function () {
        await shouldFail.reverting.withMessage(this.wrapper.approve(20), "SafeERC20: low-level call failed");
      });

      it('doesn\'t revert when approving a zero allowance', async function () {
        await this.wrapper.approve(0);
      });

      it('doesn\'t revert when increasing the allowance', async function () {
        await this.wrapper.increaseAllowance(10);
      });

      it('doesn\'t revert when decreasing the allowance to a positive value', async function () {
        await this.wrapper.decreaseAllowance(50);
      });

      it('reverts when decreasing the allowance to a negative value', async function () {
        await shouldFail.reverting.withMessage(this.wrapper.decreaseAllowance(200), "SafeERC20: low-level call failed");
      });
    });
  });
}

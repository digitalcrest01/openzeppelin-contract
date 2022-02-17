const { BN, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const Enums = require('../../helpers/enums');
const GovernorHelper = require('../../helpers/governance');

const Token = artifacts.require('ERC20VotesMock');
const Governor = artifacts.require('GovernorMock');
const CallReceiver = artifacts.require('CallReceiverMock');

contract('GovernorVotesQuorumFraction', function (accounts) {
  const [ owner, voter1, voter2, voter3, voter4 ] = accounts;

  const name = 'OZ-Governor';
  // const version = '1';
  const tokenName = 'MockToken';
  const tokenSymbol = 'MTKN';
  const tokenSupply = new BN(web3.utils.toWei('100'));
  const ratio = new BN(8); // percents
  const newRatio = new BN(6); // percents
  const votingDelay = new BN(4);
  const votingPeriod = new BN(16);
  const value = web3.utils.toWei('1');

  beforeEach(async function () {
    this.owner = owner;
    this.token = await Token.new(tokenName, tokenSymbol);
    this.mock = await Governor.new(name, this.token.address, votingDelay, votingPeriod, ratio);
    this.receiver = await CallReceiver.new();

    GovernorHelper.resert();
    GovernorHelper.setup(this.mock);

    await web3.eth.sendTransaction({ from: owner, to: this.mock.address, value });

    await this.token.mint(owner, tokenSupply);
    await GovernorHelper.delegate({ token: this.token, to: voter1, value: web3.utils.toWei('10') }, { from: owner });
    await GovernorHelper.delegate({ token: this.token, to: voter2, value: web3.utils.toWei('7') }, { from: owner });
    await GovernorHelper.delegate({ token: this.token, to: voter3, value: web3.utils.toWei('5') }, { from: owner });
    await GovernorHelper.delegate({ token: this.token, to: voter4, value: web3.utils.toWei('2') }, { from: owner });

    // default proposal
    this.details = GovernorHelper.setProposal([
      [ this.receiver.address ],
      [ value ],
      [ this.receiver.contract.methods.mockFunction().encodeABI() ],
      '<proposal description>',
    ]);
  });

  it('deployment check', async function () {
    expect(await this.mock.name()).to.be.equal(name);
    expect(await this.mock.token()).to.be.equal(this.token.address);
    expect(await this.mock.votingDelay()).to.be.bignumber.equal(votingDelay);
    expect(await this.mock.votingPeriod()).to.be.bignumber.equal(votingPeriod);
    expect(await this.mock.quorum(0)).to.be.bignumber.equal('0');
    expect(await this.mock.quorumNumerator()).to.be.bignumber.equal(ratio);
    expect(await this.mock.quorumDenominator()).to.be.bignumber.equal('100');
    expect(await time.latestBlock().then(blockNumber => this.mock.quorum(blockNumber.subn(1))))
      .to.be.bignumber.equal(tokenSupply.mul(ratio).divn(100));
  });

  it('quroum reached', async function () {
    await GovernorHelper.propose();
    await GovernorHelper.waitForSnapshot();
    await GovernorHelper.vote({ support: Enums.VoteType.For }, { from: voter1 });
    await GovernorHelper.waitForDeadline();
    await GovernorHelper.execute();
  });

  it('quroum not reached', async function () {
    await GovernorHelper.propose();
    await GovernorHelper.waitForSnapshot();
    await GovernorHelper.vote({ support: Enums.VoteType.For }, { from: voter2 });
    await GovernorHelper.waitForDeadline();
    await expectRevert(GovernorHelper.execute(), 'Governor: proposal not successful');
  });

  describe('onlyGovernance updates', function () {
    it('updateQuorumNumerator is protected', async function () {
      await expectRevert(
        this.mock.updateQuorumNumerator(newRatio),
        'Governor: onlyGovernance',
      );
    });

    it('can updateQuorumNumerator through governance', async function () {
      GovernorHelper.setProposal([
        [ this.mock.address ],
        [ web3.utils.toWei('0') ],
        [ this.mock.contract.methods.updateQuorumNumerator(newRatio).encodeABI() ],
        '<proposal description>',
      ]);

      await GovernorHelper.propose();
      await GovernorHelper.waitForSnapshot();
      await GovernorHelper.vote({ support: Enums.VoteType.For }, { from: voter1 });
      await GovernorHelper.waitForDeadline();

      expectEvent(
        await GovernorHelper.execute(),
        'QuorumNumeratorUpdated',
        { oldQuorumNumerator: ratio, newQuorumNumerator: newRatio },
      );

      expect(await this.mock.quorumNumerator()).to.be.bignumber.equal(newRatio);
      expect(await this.mock.quorumDenominator()).to.be.bignumber.equal('100');
      expect(await time.latestBlock().then(blockNumber => this.mock.quorum(blockNumber.subn(1))))
        .to.be.bignumber.equal(tokenSupply.mul(newRatio).divn(100));
    });

    it('cannot updateQuorumNumerator over the maximum', async function () {
      GovernorHelper.setProposal([
        [ this.mock.address ],
        [ web3.utils.toWei('0') ],
        [ this.mock.contract.methods.updateQuorumNumerator('101').encodeABI() ],
        '<proposal description>',
      ]);

      await GovernorHelper.propose();
      await GovernorHelper.waitForSnapshot();
      await GovernorHelper.vote({ support: Enums.VoteType.For }, { from: voter1 });
      await GovernorHelper.waitForDeadline();

      await expectRevert(
        GovernorHelper.execute(),
        'GovernorVotesQuorumFraction: quorumNumerator over quorumDenominator',
      );
    });
  });
});

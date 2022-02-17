const { BN } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const Enums = require('../../helpers/enums');
const GovernorHelper = require('../../helpers/governance');

const Token = artifacts.require('ERC20VotesCompMock');
const Governor = artifacts.require('GovernorCompMock');
const CallReceiver = artifacts.require('CallReceiverMock');

contract('GovernorComp', function (accounts) {
  const [ owner, voter1, voter2, voter3, voter4 ] = accounts;

  const name = 'OZ-Governor';
  // const version = '1';
  const tokenName = 'MockToken';
  const tokenSymbol = 'MTKN';
  const tokenSupply = web3.utils.toWei('100');
  const votingDelay = new BN(4);
  const votingPeriod = new BN(16);
  const value = web3.utils.toWei('1');

  beforeEach(async function () {
    this.owner = owner;
    this.token = await Token.new(tokenName, tokenSymbol);
    this.mock = await Governor.new(name, this.token.address);
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
  });

  it('voting with comp token', async function () {
    await GovernorHelper.propose();
    await GovernorHelper.waitForSnapshot();
    await GovernorHelper.vote({ support: Enums.VoteType.For }, { from: voter1 });
    await GovernorHelper.vote({ support: Enums.VoteType.For }, { from: voter2 });
    await GovernorHelper.vote({ support: Enums.VoteType.Against }, { from: voter3 });
    await GovernorHelper.vote({ support: Enums.VoteType.Abstain }, { from: voter4 });
    await GovernorHelper.waitForDeadline();
    await GovernorHelper.execute();

    expect(await this.mock.hasVoted(this.details.id, owner)).to.be.equal(false);
    expect(await this.mock.hasVoted(this.details.id, voter1)).to.be.equal(true);
    expect(await this.mock.hasVoted(this.details.id, voter2)).to.be.equal(true);
    expect(await this.mock.hasVoted(this.details.id, voter3)).to.be.equal(true);
    expect(await this.mock.hasVoted(this.details.id, voter4)).to.be.equal(true);

    await this.mock.proposalVotes(this.details.id).then(results => {
      expect(results.forVotes).to.be.bignumber.equal(web3.utils.toWei('17'));
      expect(results.againstVotes).to.be.bignumber.equal(web3.utils.toWei('5'));
      expect(results.abstainVotes).to.be.bignumber.equal(web3.utils.toWei('2'));
    });
  });
});

const { BN, expectEvent } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const Enums = require('../../helpers/enums');
const GovernorHelper = require('../../helpers/governance');

const Token = artifacts.require('ERC721VotesMock');
const Governor = artifacts.require('GovernorVoteMocks');
const CallReceiver = artifacts.require('CallReceiverMock');

contract('GovernorERC721Mock', function (accounts) {
  const [ owner, voter1, voter2, voter3, voter4 ] = accounts;

  const name = 'OZ-Governor';
  // const version = '1';
  const tokenName = 'MockNFToken';
  const tokenSymbol = 'MTKN';
  const NFT0 = new BN(0);
  const NFT1 = new BN(1);
  const NFT2 = new BN(2);
  const NFT3 = new BN(3);
  const NFT4 = new BN(4);
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

    await Promise.all([ NFT0, NFT1, NFT2, NFT3, NFT4 ].map(tokenId => this.token.mint(owner, tokenId)));
    await GovernorHelper.delegate({ token: this.token, to: voter1, tokenId: NFT0 }, { from: owner });
    await GovernorHelper.delegate({ token: this.token, to: voter2, tokenId: NFT1 }, { from: owner });
    await GovernorHelper.delegate({ token: this.token, to: voter2, tokenId: NFT2 }, { from: owner });
    await GovernorHelper.delegate({ token: this.token, to: voter3, tokenId: NFT3 }, { from: owner });
    await GovernorHelper.delegate({ token: this.token, to: voter4, tokenId: NFT4 }, { from: owner });

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

  it('voting with ERC721 token', async function () {
    await GovernorHelper.propose();
    await GovernorHelper.waitForSnapshot();

    expectEvent(
      await GovernorHelper.vote({ support: Enums.VoteType.For }, { from: voter1 }),
      'VoteCast',
      { voter: voter1, support: Enums.VoteType.For, weight: '1' },
    );

    expectEvent(
      await GovernorHelper.vote({ support: Enums.VoteType.For }, { from: voter2 }),
      'VoteCast',
      { voter: voter2, support: Enums.VoteType.For, weight: '2' },
    );

    expectEvent(
      await GovernorHelper.vote({ support: Enums.VoteType.Against }, { from: voter3 }),
      'VoteCast',
      { voter: voter3, support: Enums.VoteType.Against, weight: '1' },
    );

    expectEvent(
      await GovernorHelper.vote({ support: Enums.VoteType.Abstain }, { from: voter4 }),
      'VoteCast',
      { voter: voter4, support: Enums.VoteType.Abstain, weight: '1' },
    );

    await GovernorHelper.waitForDeadline();
    await GovernorHelper.execute();

    expect(await this.mock.hasVoted(this.details.id, owner)).to.be.equal(false);
    expect(await this.mock.hasVoted(this.details.id, voter1)).to.be.equal(true);
    expect(await this.mock.hasVoted(this.details.id, voter2)).to.be.equal(true);
    expect(await this.mock.hasVoted(this.details.id, voter3)).to.be.equal(true);
    expect(await this.mock.hasVoted(this.details.id, voter4)).to.be.equal(true);

    await this.mock.proposalVotes(this.details.id).then(results => {
      expect(results.forVotes).to.be.bignumber.equal('3');
      expect(results.againstVotes).to.be.bignumber.equal('1');
      expect(results.abstainVotes).to.be.bignumber.equal('1');
    });
  });
});

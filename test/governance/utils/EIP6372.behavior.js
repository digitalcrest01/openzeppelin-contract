const { clock } = require('../../helpers/time');

// TODO: delete
function shouldBehaveLikeEIP6372(mode = 'blocknumber') {
  describe('should implement EIP6372', function () {
    beforeEach(async function () {
      this.mock = this.mock ?? this.token ?? this.votes;
    });

    it('clock is correct', async function () {
      expect(await this.mock.clock()).to.equal(await clock[mode]());
    });

    it('CLOCK_MODE is correct', async function () {
      const params = new URLSearchParams(await this.mock.CLOCK_MODE());
      expect(params.get('mode')).to.equal(mode);
      expect(params.get('from')).to.equal(mode == 'blocknumber' ? 'default' : null);
    });
  });
}

module.exports = {
  shouldBehaveLikeEIP6372,
};

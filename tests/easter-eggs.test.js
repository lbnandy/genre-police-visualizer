const test = require('node:test');
const assert = require('node:assert/strict');

test('Genre Police easter egg requires the S3RL track identity', async () => {
  const { isGenrePoliceTrack } = await import('../renderer/easter-eggs.mjs');
  assert.equal(isGenrePoliceTrack({ title: 'Genre Police', artist: 'S3RL' }), true);
  assert.equal(isGenrePoliceTrack({ title: 'Genre Police (feat. D-NiAL)', artist: 'S3RL' }), true);
  assert.equal(isGenrePoliceTrack({ title: 'Genre Police [Extended Mix]', artist: 'S3RL feat. Lexi' }), true);
  assert.equal(isGenrePoliceTrack({ title: 'Genre Police', artist: 'Another Artist' }), false);
  assert.equal(isGenrePoliceTrack({ title: 'The Genre Police', artist: 'AronChupa、Little Sis Nora、S3RL' }), true);
  assert.equal(isGenrePoliceTrack({ title: 'The Genre Police', artist: 'Another Artist' }), false);
  assert.equal(isGenrePoliceTrack({ title: 'Pika Girl', artist: 'S3RL' }), false);
  assert.equal(isGenrePoliceTrack(null), false);
  assert.equal(isGenrePoliceTrack(), false);
});

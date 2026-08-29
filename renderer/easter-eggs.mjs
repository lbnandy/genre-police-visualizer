function normalizeIdentity(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function isGenrePoliceTrack(metadata = {}) {
  const safeMetadata = metadata || {};
  const title = normalizeIdentity(safeMetadata.title);
  const artist = normalizeIdentity(safeMetadata.artist || safeMetadata.albumArtist);
  // Cover both S3RL's original "Genre Police" and the later AronChupa,
  // Little Sis Nora & S3RL collaboration "The Genre Police". Apple Music may
  // append a featured vocalist or mix name to either title.
  const canonicalTitles = ['genre police', 'the genre police'];
  const canonicalTitle = canonicalTitles.some((base) => title === base
    || title.startsWith(`${base} feat `)
    || title.startsWith(`${base} featuring `)
    || title.startsWith(`${base} radio `)
    || title.startsWith(`${base} extended `)
    || title.startsWith(`${base} original `));
  return canonicalTitle && /(^|\s)s3rl(\s|$)/.test(artist);
}

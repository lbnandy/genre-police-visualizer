'use strict';

const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const UPDATE_RELEASES_URL = 'https://github.com/lbnandy/genre-police-visualizer/releases';

function parseVersion(value) {
  const match = String(value || '').trim().match(
    /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/
  );
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split('.') : []
  };
}

function comparePrereleaseIdentifier(left, right) {
  const leftNumeric = /^\d+$/.test(left);
  const rightNumeric = /^\d+$/.test(right);
  if (leftNumeric && rightNumeric) return Number(left) - Number(right);
  if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
  return left.localeCompare(right);
}

function compareVersions(leftValue, rightValue) {
  const left = parseVersion(leftValue);
  const right = parseVersion(rightValue);
  if (!left || !right) return null;
  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] !== right[key]) return left[key] - right[key];
  }
  if (!left.prerelease.length || !right.prerelease.length) {
    if (!left.prerelease.length && !right.prerelease.length) return 0;
    return left.prerelease.length ? -1 : 1;
  }
  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    if (left.prerelease[index] === undefined) return -1;
    if (right.prerelease[index] === undefined) return 1;
    const compared = comparePrereleaseIdentifier(left.prerelease[index], right.prerelease[index]);
    if (compared) return compared;
  }
  return 0;
}

function canonicalVersion(value) {
  const parsed = parseVersion(value);
  if (!parsed) return '';
  const prerelease = parsed.prerelease.length ? `-${parsed.prerelease.join('.')}` : '';
  return `v${parsed.major}.${parsed.minor}.${parsed.patch}${prerelease}`;
}

function isAllowedReleaseUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:'
      && url.hostname.toLowerCase() === 'github.com'
      && /^\/lbnandy\/genre-police-visualizer\/releases(?:\/|$)/i.test(url.pathname);
  } catch {
    return false;
  }
}

function selectLatestUpdate(releases, currentVersion) {
  if (!Array.isArray(releases) || !parseVersion(currentVersion)) return null;
  let latest = null;
  for (const release of releases) {
    if (!release || release.draft === true || !isAllowedReleaseUrl(release.html_url)) continue;
    const version = canonicalVersion(release.tag_name);
    if (!version || compareVersions(version, currentVersion) <= 0) continue;
    if (!latest || compareVersions(version, latest.version) > 0) {
      latest = {
        version,
        name: String(release.name || release.tag_name || version).trim().slice(0, 160),
        url: String(release.html_url),
        prerelease: release.prerelease === true
      };
    }
  }
  return latest;
}

function isUpdateCheckDue(lastCheckedAt, now = Date.now(), intervalMs = UPDATE_CHECK_INTERVAL_MS) {
  const previous = Number(lastCheckedAt);
  const current = Number(now);
  if (!Number.isFinite(previous) || previous <= 0 || !Number.isFinite(current)) return true;
  if (previous > current + 5 * 60 * 1000) return true;
  return current - previous >= intervalMs;
}

function sameVersion(left, right) {
  return compareVersions(left, right) === 0;
}

module.exports = {
  UPDATE_CHECK_INTERVAL_MS,
  UPDATE_RELEASES_URL,
  canonicalVersion,
  compareVersions,
  isAllowedReleaseUrl,
  isUpdateCheckDue,
  parseVersion,
  sameVersion,
  selectLatestUpdate
};
